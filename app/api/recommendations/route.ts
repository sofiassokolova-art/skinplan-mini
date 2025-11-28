// app/api/recommendations/route.ts
// Получение рекомендаций продуктов на основе профиля

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { getCachedRecommendations, setCachedRecommendations } from '@/lib/cache';

export const runtime = 'nodejs';

interface RuleCondition {
  [key: string]: string[] | { gte?: number; lte?: number } | string;
}

interface RuleStep {
  category?: string[];
  concerns?: string[];
  skin_types?: string[];
  is_non_comedogenic?: boolean;
  is_fragrance_free?: boolean;
  max_items?: number;
}

interface Rule {
  id: number;
  name: string;
  conditionsJson: RuleCondition;
  stepsJson: Record<string, RuleStep>;
  priority: number;
}

/**
 * Проверяет, соответствует ли профиль условиям правила
 */
function matchesRule(profile: any, rule: Rule): boolean {
  const conditions = rule.conditionsJson;

  for (const [key, condition] of Object.entries(conditions)) {
    const profileValue = profile[key];

    if (Array.isArray(condition)) {
      // Проверка на соответствие массиву значений
      if (!condition.includes(profileValue)) {
        return false;
      }
    } else if (typeof condition === 'object' && condition !== null) {
      // Проверка на диапазон (gte, lte)
      if ('gte' in condition && typeof profileValue === 'number') {
        if (profileValue < condition.gte!) return false;
      }
      if ('lte' in condition && typeof profileValue === 'number') {
        if (profileValue > condition.lte!) return false;
      }
    } else if (condition !== profileValue) {
      return false;
    }
  }

  return true;
}

/**
 * Получает продукты по фильтрам шага
 */
async function getProductsForStep(step: RuleStep) {
  const where: any = {
    published: true, // Используем published вместо status
  };

  if (step.category && step.category.length > 0) {
    // Проверяем и category, и step (они могут совпадать)
    where.OR = [
      { category: { in: step.category } },
      { step: { in: step.category } },
    ];
  }

  // SPF универсален для всех типов кожи - не фильтруем по типу кожи
  const isSPF = step.category?.includes('spf') || step.category?.some((c: string) => c.toLowerCase().includes('spf'));
  
  if (step.skin_types && step.skin_types.length > 0 && !isSPF) {
    where.skinTypes = { hasSome: step.skin_types };
  }

  if (step.concerns && step.concerns.length > 0) {
    where.concerns = { hasSome: step.concerns };
  }

  if (step.is_non_comedogenic === true) {
    where.isNonComedogenic = true;
  }

  if (step.is_fragrance_free === true) {
    where.isFragranceFree = true;
  }

  const products = await prisma.product.findMany({
    where: {
      ...where,
      brand: {
        isActive: true, // Только активные бренды
      },
    },
    include: {
      brand: true,
    },
    take: (step.max_items || 3) * 2, // Берем больше для сортировки
  });

  // Сортируем в памяти по приоритету и isHero
  const sorted = products.sort((a: any, b: any) => {
    if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return sorted.slice(0, step.max_items || 3);
}

export async function GET(request: NextRequest) {
  try {
    // Получаем initData из заголовков
    // Пробуем оба варианта заголовка (регистронезависимо)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData. Please open the app through Telegram Mini App.' },
        { status: 401 }
      );
    }

    // Получаем userId из initData
    const userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    // Получаем последний профиль пользователя
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'No skin profile found. Please complete the questionnaire first.' },
        { status: 404 }
      );
    }

    // Проверяем кэш
    const cachedRecommendations = await getCachedRecommendations(userId, profile.version);
    if (cachedRecommendations) {
      console.log('✅ Recommendations retrieved from cache');
      return NextResponse.json(cachedRecommendations);
    }

    // Проверяем, есть ли уже сессия рекомендаций для этого профиля
    const existingSession = await prisma.recommendationSession.findFirst({
      where: {
        userId,
        profileId: profile.id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        rule: true,
      },
    });

    if (existingSession && existingSession.products && Array.isArray(existingSession.products)) {
      console.log('✅ Using existing recommendation session');
      
      // Получаем продукты из сессии
      const productIds = existingSession.products as number[];
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          published: true as any,
        } as any,
        include: {
          brand: true,
        },
      });

      // Группируем продукты по шагам
      const steps: Record<string, any[]> = {};
      for (const product of products) {
        // Нормализуем step: serum, treatment, essence -> serum для совместимости
        let step = product.step || 'other';
        if (step === 'treatment' || step === 'essence') {
          step = 'serum'; // Объединяем treatment и essence в serum для главной страницы
        }
        
        if (!steps[step]) {
          steps[step] = [];
        }
        steps[step].push({
          id: product.id,
          name: product.name,
          brand: product.brand.name,
          line: product.line,
          category: product.category,
          step: product.step, // Сохраняем оригинальный step
          description: product.descriptionUser,
          marketLinks: product.marketLinks,
          imageUrl: product.imageUrl,
        });
      }

      // ПРОВЕРЯЕМ: если в сессии нет базовых продуктов, добавляем их
      const requiredSteps = ['cleanser', 'moisturizer', 'spf'];
      const missingSteps: string[] = [];
      
      for (const requiredStep of requiredSteps) {
        if (!steps[requiredStep] || steps[requiredStep].length === 0) {
          missingSteps.push(requiredStep);
        }
      }

      // Если не хватает базовых продуктов, добавляем их
      if (missingSteps.length > 0) {
        console.log(`⚠️ Missing required steps in session: ${missingSteps.join(', ')}, adding fallback products...`);
        
        for (const missingStep of missingSteps) {
          const fallbackProducts = await prisma.product.findMany({
            where: {
              published: true as any,
              step: missingStep,
              brand: {
                isActive: true, // Только активные бренды
              },
              // SPF универсален, для остальных учитываем тип кожи
              ...(missingStep !== 'spf' && profile.skinType ? {
                skinTypes: { has: profile.skinType },
              } : {}),
            } as any,
            include: {
              brand: true,
            },
            take: 3, // Берем больше для сортировки
          });
          
          // Сортируем в памяти
          fallbackProducts.sort((a: any, b: any) => {
            if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
            if (a.priority !== b.priority) return b.priority - a.priority;
            return b.createdAt.getTime() - a.createdAt.getTime();
          });
          
          const sortedFallback = fallbackProducts.slice(0, 1);

          if (sortedFallback.length > 0) {
            const product = sortedFallback[0];
            const productBrand = (product as any).brand;
            steps[missingStep] = [{
              id: product.id,
              name: product.name,
              brand: productBrand?.name || 'Unknown',
              line: product.line,
              category: product.category,
              step: product.step,
              description: product.descriptionUser,
              marketLinks: product.marketLinks,
              imageUrl: product.imageUrl,
            }];
            console.log(`✅ Added fallback ${missingStep}: ${product.name}`);
          }
        }
      }

      const response = {
        profile_summary: {
          skinType: profile.skinType,
          sensitivityLevel: profile.sensitivityLevel,
          acneLevel: profile.acneLevel,
          notes: profile.notes,
        },
        rule: {
          name: existingSession.rule?.name || 'Рекомендации',
        },
        steps,
      };

      // Сохраняем в кэш
      await setCachedRecommendations(userId, profile.version, response);
      
      return NextResponse.json(response);
    }

    // Получаем все активные правила, отсортированные по приоритету
    const rules = await prisma.recommendationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    // Находим подходящее правило
    let matchedRule: Rule | null = null;
    
    for (const rule of rules) {
      const conditions = rule.conditionsJson as RuleCondition;
      if (matchesRule(profile, { ...rule, conditionsJson: conditions } as Rule)) {
        matchedRule = { ...rule, conditionsJson: conditions } as Rule;
        break;
      }
    }

    // Если правило не найдено, используем fallback - возвращаем базовые продукты
    if (!matchedRule) {
      console.warn(`⚠️ No matching rule found for profile ${profile.id}, using fallback products`);
      
      // Fallback: возвращаем базовые опубликованные продукты по категориям
      const fallbackSteps: Record<string, any[]> = {};
      
      // Получаем продукты для базовых шагов
      const steps = ['cleanser', 'toner', 'moisturizer', 'spf', 'serum'];
      
      for (const step of steps) {
        const products = await prisma.product.findMany({
          where: {
            published: true as any,
            step: step === 'spf' ? 'spf' : step,
            brand: {
              isActive: true, // Только активные бренды
            },
            ...(profile.skinType && {
              skinTypes: { has: profile.skinType },
            }),
          } as any,
          include: {
            brand: true,
          },
          take: 3,
        });
        
        // Сортируем в памяти
        products.sort((a: any, b: any) => {
          if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
          if (a.priority !== b.priority) return b.priority - a.priority;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        const sortedProducts = products.slice(0, 1);
        
        if (sortedProducts.length > 0) {
          fallbackSteps[step] = sortedProducts.map((p: any) => ({
            id: p.id,
            name: p.name,
            brand: p.brand.name,
            line: p.line,
            category: p.category,
            step: p.step,
            description: p.descriptionUser,
            marketLinks: p.marketLinks,
            imageUrl: p.imageUrl,
          }));
        }
      }
      
      // Если есть хотя бы один продукт, возвращаем fallback
      if (Object.keys(fallbackSteps).length > 0) {
        const response = {
          profile_summary: {
            skinType: profile.skinType,
            sensitivityLevel: profile.sensitivityLevel,
            acneLevel: profile.acneLevel,
            notes: profile.notes,
          },
          rule: {
            name: 'Базовые рекомендации',
          },
          steps: fallbackSteps,
        };
        
        // Сохраняем в кэш
        await setCachedRecommendations(userId, profile.version, response);
        
        return NextResponse.json(response);
      }
      
      // Если даже fallback не сработал, возвращаем пустой ответ, но не ошибку
      return NextResponse.json({
        profile_summary: {
          skinType: profile.skinType,
          sensitivityLevel: profile.sensitivityLevel,
          acneLevel: profile.acneLevel,
          notes: profile.notes,
        },
        rule: {
          name: 'Рекомендации',
        },
        steps: {},
      });
    }

    // Получаем продукты для каждого шага
    const stepsJson = matchedRule.stepsJson as Record<string, RuleStep>;
    const steps: Record<string, any[]> = {};

    for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
      const products = await getProductsForStep(stepConfig);
      if (products.length > 0) {
        // Нормализуем step: serum, treatment, essence -> serum для совместимости с главной страницей
        const normalizedStep = stepName === 'treatment' || stepName === 'essence' ? 'serum' : stepName;
        
        if (!steps[normalizedStep]) {
          steps[normalizedStep] = [];
        }
        
        steps[normalizedStep].push(...products.map(p => ({
          id: p.id,
          name: p.name,
          brand: p.brand.name,
          line: p.line,
          category: p.category,
          step: p.step, // Сохраняем оригинальный step продукта
          description: p.descriptionUser,
          marketLinks: p.marketLinks,
          imageUrl: p.imageUrl,
        })));
      }
    }

    // Сохраняем сессию рекомендаций
    const productIds = Object.values(steps).flat().map(p => p.id);
    await prisma.recommendationSession.create({
      data: {
        userId,
        profileId: profile.id,
        ruleId: matchedRule.id,
        products: productIds,
      },
    });

    const response = {
      profile_summary: {
        skinType: profile.skinType,
        sensitivityLevel: profile.sensitivityLevel,
        acneLevel: profile.acneLevel,
        notes: profile.notes,
      },
      rule: {
        name: matchedRule.name,
      },
      steps,
    };

    // Сохраняем в кэш
    await setCachedRecommendations(userId, profile.version, response);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
