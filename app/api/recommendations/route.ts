// app/api/recommendations/route.ts
// Получение рекомендаций продуктов на основе профиля

import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { getCachedRecommendations, setCachedRecommendations } from '@/lib/cache';
import { logger } from '@/lib/logger';

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
      return ApiResponse.unauthorized('Missing Telegram initData. Please open the app through Telegram Mini App.');
    }

    // Получаем userId из initData
    const userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      return ApiResponse.unauthorized('Invalid or expired initData');
    }

    // Получаем последний профиль пользователя
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!profile) {
      logger.warn('Profile not found for recommendations', { userId });
      return ApiResponse.notFound('No skin profile found. Please complete the questionnaire first.', { userId });
    }
    
    logger.info('Profile found for recommendations', { userId, profileId: profile.id, version: profile.version });

    // Проверяем кэш
    const cachedRecommendations = await getCachedRecommendations(userId, profile.version);
    if (cachedRecommendations) {
      logger.info('Recommendations retrieved from cache', { userId, profileVersion: profile.version });
      return ApiResponse.success(cachedRecommendations);
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
      logger.info('Using existing recommendation session', { userId, sessionId: existingSession.id });
      
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
        
        // Нормализуем базовые шаги для группировки
        // Например: cleanser_gentle -> cleanser, spf_50_face -> spf
        let normalizedStep = step;
        if (step.startsWith('cleanser')) {
          normalizedStep = 'cleanser';
        } else if (step.startsWith('spf')) {
          normalizedStep = 'spf';
        } else if (step.startsWith('moisturizer')) {
          normalizedStep = 'moisturizer';
        } else if (step.startsWith('toner')) {
          normalizedStep = 'toner';
        } else if (step.startsWith('serum')) {
          normalizedStep = 'serum';
        }
        
        if (!steps[normalizedStep]) {
          steps[normalizedStep] = [];
        }
        steps[normalizedStep].push({
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

      // ПРОВЕРЯЕМ: если в сессии нет необходимых шагов, добавляем их
      // Утренние шаги: cleanser, toner, serum/essence, moisturizer, spf
      // Вечерние шаги: cleanser (двойное очищение), serum/treatment, acid (опционально), moisturizer
      const requiredMorningSteps = ['cleanser', 'toner', 'serum', 'moisturizer', 'spf'];
      const requiredEveningSteps = ['cleanser', 'serum', 'moisturizer'];
      const allRequiredSteps = [...new Set([...requiredMorningSteps, ...requiredEveningSteps])];
      
      const missingSteps: string[] = [];
      
      for (const requiredStep of allRequiredSteps) {
        if (!steps[requiredStep] || steps[requiredStep].length === 0) {
          missingSteps.push(requiredStep);
        }
      }

      // Если не хватает шагов, добавляем их
      if (missingSteps.length > 0) {
        logger.warn('Missing required steps in session, adding fallback products', { 
          userId, 
          missingSteps: missingSteps.join(', '),
          sessionId: existingSession.id 
        });
        
        for (const missingStep of missingSteps) {
          // Для поиска продуктов используем шаги, которые начинаются с базового шага
          // Например: для 'toner' ищем 'toner_hydrating', 'toner_soothing' и т.д.
          const stepPatterns: Record<string, string[]> = {
            'cleanser': ['cleanser_gentle', 'cleanser_balancing', 'cleanser_deep'],
            'toner': ['toner_hydrating', 'toner_soothing'],
            'serum': ['serum_hydrating', 'serum_niacinamide', 'serum_vitc', 'serum_anti_redness', 'serum_brightening_soft'],
            'moisturizer': ['moisturizer_light', 'moisturizer_balancing', 'moisturizer_barrier', 'moisturizer_soothing'],
            'spf': ['spf_50_face', 'spf_50_oily', 'spf_50_sensitive'],
          };
          
          const stepVariants = stepPatterns[missingStep] || [missingStep];
          
          let fallbackProducts: any[] = [];
          
          // Пробуем найти продукты по вариантам шага
          for (const stepVariant of stepVariants) {
            const products = await prisma.product.findMany({
              where: {
                published: true as any,
                step: stepVariant,
                brand: {
                  isActive: true,
                },
                // SPF универсален, для остальных учитываем тип кожи
                ...(missingStep !== 'spf' && profile.skinType ? {
                  skinTypes: { has: profile.skinType },
                } : {}),
              } as any,
              include: {
                brand: true,
              },
              take: 5,
            });
            
            if (products.length > 0) {
              fallbackProducts = products;
              break; // Нашли продукты, выходим из цикла
            }
          }
          
          // Если не нашли по вариантам, ищем по базовому шагу (ищем все варианты, начинающиеся с базового)
          if (fallbackProducts.length === 0) {
            // Получаем все продукты с шагами, начинающимися с базового шага
            const allProducts = await prisma.product.findMany({
              where: {
                published: true as any,
                brand: {
                  isActive: true,
                },
                ...(missingStep !== 'spf' && profile.skinType ? {
                  skinTypes: { has: profile.skinType },
                } : {}),
              } as any,
              include: {
                brand: true,
              },
              take: 50, // Берем больше, чтобы отфильтровать в памяти
            });
            
            // Фильтруем в памяти по шагам, начинающимся с базового
            fallbackProducts = allProducts.filter((p: any) => {
              const productStep = p.step || '';
              return productStep.startsWith(missingStep) || 
                     productStep === missingStep ||
                     p.category === missingStep;
            });
          }
          
          // Сортируем в памяти
          fallbackProducts.sort((a: any, b: any) => {
            if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
            if (a.priority !== b.priority) return b.priority - a.priority;
            return b.createdAt.getTime() - a.createdAt.getTime();
          });
          
          // Берем до 3 продуктов для каждого шага (согласно ТЗ)
          const sortedFallback = fallbackProducts.slice(0, 3);

          if (sortedFallback.length > 0) {
            const productBrand = (sortedFallback[0] as any).brand;
            steps[missingStep] = sortedFallback.map((product: any) => ({
              id: product.id,
              name: product.name,
              brand: product.brand?.name || productBrand?.name || 'Unknown',
              line: product.line,
              category: product.category,
              step: product.step,
              description: product.descriptionUser,
              marketLinks: product.marketLinks,
              imageUrl: product.imageUrl,
            }));
            logger.info('Added fallback products for missing step', { 
              userId, 
              step: missingStep, 
              productsCount: sortedFallback.length 
            });
          } else {
            logger.warn('Could not find fallback products for step', { userId, step: missingStep });
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
      
      return ApiResponse.success(response);
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
      logger.warn('No matching rule found for profile, using fallback products', { userId, profileId: profile.id });
      
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
        
        return ApiResponse.success(response);
      }
      
      // Если даже fallback не сработал, возвращаем пустой ответ, но не ошибку
      return ApiResponse.success({
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

    return ApiResponse.success(response);
  } catch (error: unknown) {
    logger.error('Error fetching recommendations', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return ApiResponse.internalError(error, {});
  }
}
