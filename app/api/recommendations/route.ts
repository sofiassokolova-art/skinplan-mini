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
    status: 'published',
  };

  if (step.category && step.category.length > 0) {
    where.category = { in: step.category };
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
    where,
    include: {
      brand: true,
    },
    take: step.max_items || 3,
    orderBy: {
      createdAt: 'desc',
    },
  });

  return products;
}

export async function GET(request: NextRequest) {
  try {
    // Получаем initData из заголовков
    const initData = request.headers.get('x-telegram-init-data');

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
          status: 'published',
        },
        include: {
          brand: true,
        },
      });

      // Группируем продукты по шагам
      const steps: Record<string, any[]> = {};
      for (const product of products) {
        const step = product.step || 'other';
        if (!steps[step]) {
          steps[step] = [];
        }
        steps[step].push({
          id: product.id,
          name: product.name,
          brand: product.brand.name,
          line: product.line,
          category: product.category,
          step: product.step,
          description: product.descriptionUser,
          marketLinks: product.marketLinks,
          imageUrl: product.imageUrl,
        });
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
            status: 'published',
            step: step === 'spf' ? 'spf' : step,
            ...(profile.skinType && {
              skinTypes: { has: profile.skinType },
            }),
          },
          include: {
            brand: true,
          },
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
        });
        
        if (products.length > 0) {
          fallbackSteps[step] = products.map(p => ({
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
      steps[stepName] = products.map(p => ({
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
