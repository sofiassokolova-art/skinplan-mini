// app/api/recommendations/route.ts
// Получение рекомендаций продуктов на основе профиля

import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { getCachedRecommendations, setCachedRecommendations } from '@/lib/cache';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { getProductsForStep, type RuleStep } from '@/lib/product-selection';
import { normalizeIngredientSimple } from '@/lib/ingredient-normalizer';
import { calculateSkinAxes, type QuestionnaireAnswers } from '@/lib/skin-analysis-engine';

export const runtime = 'nodejs';

interface RuleCondition {
  [key: string]: string[] | { gte?: number; lte?: number } | string;
}

// RuleStep теперь импортируется из lib/product-selection.ts

interface Rule {
  id: number;
  name: string;
  conditionsJson: RuleCondition;
  stepsJson: Record<string, RuleStep>;
  priority: number;
}

/**
 * Проверяет, соответствует ли профиль условиям правила
 * ИСПРАВЛЕНО: Правильно обрабатывает отсутствующие поля и вычисленные scores
 */
function matchesRule(profile: any, rule: Rule): boolean {
  const conditions = rule.conditionsJson;

  for (const [key, condition] of Object.entries(conditions)) {
    // ИСПРАВЛЕНО: Нормализуем diagnoses - если правило проверяет diagnoses,
    // но они не на корневом уровне, берем из medicalMarkers
    let profileValue = profile[key];
    if (key === 'diagnoses' && (profileValue === undefined || profileValue === null)) {
      profileValue = (profile.medicalMarkers as any)?.diagnoses || [];
    }

    // ИСПРАВЛЕНО: Если поле отсутствует в профиле, правило не соответствует
    // (кроме случаев, когда условие может быть опциональным)
    if (profileValue === undefined || profileValue === null) {
      // Для числовых условий (gte/lte) отсутствие значения = несоответствие
      if (typeof condition === 'object' && condition !== null && ('gte' in condition || 'lte' in condition)) {
        return false;
      }
      // Для точных совпадений отсутствие значения = несоответствие
      if (typeof condition !== 'object' || condition === null) {
        return false;
      }
      // Для массивов - отсутствие значения = несоответствие
      if (Array.isArray(condition)) {
        return false;
      }
    }

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
      // Проверка hasSome для массивов (например, diagnoses: { hasSome: ["acne"] })
      if ('hasSome' in condition && Array.isArray(condition.hasSome)) {
        const profileArray = Array.isArray(profileValue) ? profileValue : [];
        const hasMatch = condition.hasSome.some((item: any) => profileArray.includes(item));
        if (!hasMatch) return false;
      }
      // Проверка in для массивов (например, age: { in: ["25-34"] })
      if ('in' in condition && Array.isArray(condition.in)) {
        if (!condition.in.includes(profileValue)) return false;
      }
    } else if (condition !== profileValue) {
      return false;
    }
  }

  return true;
}

// Функция getProductsForStep теперь импортируется из lib/product-selection.ts
// Это устраняет дублирование кода и обеспечивает единую логику подбора продуктов

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/recommendations';
  let userId: string | null | undefined;
  
  try {
    logger.info('📥 Recommendations request started', { timestamp: new Date().toISOString() });
    
    // Получаем initData из заголовков
    // Пробуем оба варианта заголовка (регистронезависимо)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      logger.warn('Missing initData in recommendations request', {
        availableHeaders: Array.from(request.headers.keys()),
      });
      return ApiResponse.unauthorized('Missing Telegram initData. Please open the app through Telegram Mini App.');
    }

    // Получаем userId из initData
    userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      logger.warn('Invalid or expired initData in recommendations request');
      return ApiResponse.unauthorized('Invalid or expired initData');
    }
    
    logger.info('User identified for recommendations', { userId });

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

    // ИСПРАВЛЕНО: Используем текущий день плана для рекомендаций на главной
    // День 1 = день генерации плана, день 2 = второй день из plan28, и так до 28
    // После 28 дней показываем экран оплаты
    const existingPlan = await prisma.plan28.findFirst({
      where: {
        userId,
        profileVersion: profile.version,
      },
      select: {
        planData: true,
        createdAt: true,
      },
    });

    if (existingPlan && existingPlan.planData) {
      const planData = existingPlan.planData as any;
      if (planData?.days && Array.isArray(planData.days) && planData.days.length > 0) {
        // Проверяем, прошло ли 28 дней с момента создания плана
        const planCreatedAt = existingPlan.createdAt;
        const daysSinceCreation = Math.floor((Date.now() - planCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceCreation >= 28) {
          // План истек - возвращаем флаг для показа экрана оплаты
          logger.info('Plan expired (28+ days), showing payment screen', { 
            userId, 
            profileVersion: profile.version,
            daysSinceCreation,
          });
          return ApiResponse.success({
            expired: true,
            daysSinceCreation,
            message: 'План завершен. Оформите новый план для продолжения.',
          });
        }
        
        // Получаем текущий день из PlanProgress
        const progress = await prisma.planProgress.findUnique({
          where: { userId },
          select: { currentDay: true },
        });
        
        const currentDay = progress?.currentDay || 1;
        const dayIndex = Math.min(currentDay - 1, planData.days.length - 1); // Индекс в массиве (0-based)
        const dayData = planData.days[dayIndex];
        
        if (dayData && (dayData.morning || dayData.evening)) {
          logger.info('Using products from Plan28 current day for recommendations', { 
            userId, 
            profileVersion: profile.version,
            currentDay,
            dayIndex: dayIndex + 1,
          });
          
          // Собираем продукты из текущего дня плана
          const productIds = new Set<number>();
          if (dayData.morning) {
            dayData.morning.forEach((step: any) => {
              if (step.productId) productIds.add(Number(step.productId));
            });
          }
          if (dayData.evening) {
            dayData.evening.forEach((step: any) => {
              if (step.productId) productIds.add(Number(step.productId));
            });
          }
          
          if (productIds.size > 0) {
            const planProducts = await prisma.product.findMany({
              where: {
                id: { in: Array.from(productIds) },
                published: true as any,
              } as any,
              include: {
                brand: true,
              },
            });
            
            // Группируем продукты по шагам (используя ту же логику, что и для RecommendationSession)
            // ИСПРАВЛЕНО: Не исключаем lip_balm - он теперь показывается как отдельная рекомендация утром
            const excludedProducts = ['eye_cream', 'eye_serum', 'eye'];
            const steps: Record<string, any[]> = {};
            const lipBalms: any[] = []; // Собираем бальзамы для губ отдельно
            
            for (const product of planProducts) {
              const productStep = product.step || '';
              const productCategory = product.category || '';
              const productName = product.name.toLowerCase();
              
              // Собираем бальзамы для губ отдельно для добавления утром
              if (productStep.toLowerCase().includes('lip_care') || 
                  productStep.toLowerCase().includes('lip_balm') || 
                  productCategory.toLowerCase().includes('lip') ||
                  productName.includes('lip balm') ||
                  productName.includes('бальзам для губ')) {
                lipBalms.push({
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
                continue; // Пропускаем добавление в основные шаги
              }
              
              // Исключаем только крем для глаз (его добавляем отдельно для тех, у кого темные круги)
              if (excludedProducts.some(excluded => 
                productStep.toLowerCase().includes(excluded) || 
                productCategory.toLowerCase().includes(excluded)
              )) {
                continue;
              }
              
              // Нормализуем step
              let step = productStep;
              if (step === 'treatment' || step === 'essence') {
                step = 'serum';
              }
              
              // Нормализуем базовые шаги для группировки
              let normalizedStep = step;
              if (step.startsWith('cleanser')) {
                normalizedStep = 'cleanser';
              } else if (step.startsWith('spf')) {
                normalizedStep = 'spf';
              } else if (step.startsWith('moisturizer')) {
                normalizedStep = 'moisturizer';
              } else if (step.startsWith('toner')) {
                normalizedStep = 'toner';
              } else if (step.startsWith('serum') || step.startsWith('treatment')) {
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
                step: product.step,
                description: product.descriptionUser,
                marketLinks: product.marketLinks,
                imageUrl: product.imageUrl,
              });
            }
            
            // ИСПРАВЛЕНО: Добавляем бальзам для губ утром для всех
            if (lipBalms.length > 0 && !steps.lip_care) {
              steps.lip_care = [lipBalms[0]]; // Берем первый бальзам для губ
            }
            
            // Формируем ответ в формате рекомендаций
            const recommendations = {
              profile_summary: {
                skinType: profile.skinType,
                sensitivityLevel: profile.sensitivityLevel,
                acneLevel: profile.acneLevel,
                notes: profile.notes,
              },
              rule: {
                name: 'Персональный план ухода',
              },
              steps,
              currentDay, // Добавляем текущий день для информации
            };
            
            // Сохраняем в кэш
            await setCachedRecommendations(userId, profile.version, recommendations);
            
            logger.info('Recommendations generated from Plan28 first day', { 
              userId, 
              profileVersion: profile.version,
              stepsCount: Object.keys(steps).length,
            });
            
            return ApiResponse.success(recommendations);
          }
        }
      }
    }

    // Проверяем, есть ли уже сессия рекомендаций для этого профиля
    // ВАЖНО: При перепрохождении анкеты старые сессии должны быть удалены,
    // поэтому ищем только сессии для текущего profileId
    const existingSession = await prisma.recommendationSession.findFirst({
      where: {
        userId,
        profileId: profile.id, // Только для текущего профиля
        ruleId: { not: null }, // Только сессии, созданные из правил
      },
      orderBy: { createdAt: 'desc' },
      include: {
        rule: true,
      },
    });

    // ВАЖНО: Используем сессию только если она создана из правил (ruleId !== null)
    // Если сессия создана из плана (ruleId = null), игнорируем её и создаем новую из правил
    if (existingSession && existingSession.products && Array.isArray(existingSession.products) && existingSession.ruleId !== null) {
      logger.info('Using existing recommendation session created from rules', { 
        userId, 
        sessionId: existingSession.id,
        ruleId: existingSession.ruleId,
      });
      
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
      // ИСПРАВЛЕНО: Исключаем неподходящие продукты (lip_balm, eye_cream и т.д.)
      const excludedProducts = ['lip_balm', 'eye_cream', 'eye_serum', 'lip_care', 'eye'];
      
      const steps: Record<string, any[]> = {};
      for (const product of products) {
        const productStep = product.step || '';
        const productCategory = product.category || '';
        
        // Исключаем неподходящие продукты (бальзам для губ, средства для глаз и т.д.)
        if (excludedProducts.some(excluded => 
          productStep.toLowerCase().includes(excluded) || 
          productCategory.toLowerCase().includes(excluded) ||
          product.name.toLowerCase().includes('lip balm') ||
          product.name.toLowerCase().includes('бальзам для губ')
        )) {
          continue; // Пропускаем неподходящие продукты
        }
        
        // Нормализуем step: serum, treatment, essence -> serum для совместимости
        let step = productStep;
        if (step === 'treatment' || step === 'essence') {
          step = 'serum'; // Объединяем treatment и essence в serum для главной страницы
        }
        
        // Нормализуем базовые шаги для группировки
        // Например: cleanser_gentle -> cleanser, cleanser_oil -> cleanser, spf_50_face -> spf
        // ВАЖНО: Все расширенные названия нормализуются в базовые для проверки обязательных шагов
        let normalizedStep = step;
        if (step.startsWith('cleanser')) {
          // Включает: cleanser_gentle, cleanser_balancing, cleanser_deep, cleanser_oil
          normalizedStep = 'cleanser';
        } else if (step.startsWith('spf')) {
          // Включает: spf_50_face, spf_50_oily, spf_50_sensitive
          normalizedStep = 'spf';
        } else if (step.startsWith('moisturizer')) {
          // Включает: moisturizer_light, moisturizer_balancing, moisturizer_barrier, moisturizer_soothing, moisturizer_rich
          normalizedStep = 'moisturizer';
        } else if (step.startsWith('toner')) {
          // Включает: toner_hydrating, toner_soothing
          normalizedStep = 'toner';
        } else if (step.startsWith('serum') || step.startsWith('treatment')) {
          // Включает: serum_*, treatment_* (treatment уже обработан выше, но на всякий случай)
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
      // ОБЯЗАТЕЛЬНЫЕ шаги: cleanser, toner, moisturizer, spf
      // Остальное (serum, treatment и т.д.) только по потребностям (правилам)
      const requiredMorningSteps = ['cleanser', 'toner', 'moisturizer', 'spf'];
      const requiredEveningSteps = ['cleanser', 'moisturizer'];
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
            // ИСПРАВЛЕНО: Исключаем неподходящие продукты (lip_balm, eye_cream и т.д.)
            fallbackProducts = allProducts.filter((p: any) => {
              const productStep = p.step || '';
              const productCategory = p.category || '';
              
              // Исключаем неподходящие продукты для каждого шага
              const excludedSteps: Record<string, string[]> = {
                'moisturizer': ['lip_balm', 'eye_cream', 'eye_serum', 'lip_care'],
                'serum': ['lip_balm', 'eye_cream', 'eye_serum', 'lip_care'],
                'cleanser': ['lip_balm', 'eye_cream', 'lip_care'],
                'toner': ['lip_balm', 'eye_cream', 'lip_care'],
                'spf': ['lip_balm', 'eye_cream', 'lip_care'],
              };
              
              const excluded = excludedSteps[missingStep] || [];
              if (excluded.some(excludedStep => productStep.includes(excludedStep) || productCategory.includes(excludedStep))) {
                return false; // Исключаем неподходящие продукты
              }
              
              // Проверяем step (не category, так как category может быть неточным)
              return productStep.startsWith(missingStep) || productStep === missingStep;
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

    // ИСПРАВЛЕНО: Вычисляем skin scores перед проверкой правил
    // Правила могут использовать поля из scores (inflammation, oiliness, hydration, barrier, pigmentation, photoaging)
    // которые не хранятся в профиле, а вычисляются из ответов
    const answersForScores = await prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId: 3, // Активная анкета
      },
      include: {
        question: true,
      },
    });

    // ИСПРАВЛЕНО: Формируем QuestionnaireAnswers ТОЛЬКО из ответов, не из профиля
    // axes должны вычисляться ТОЛЬКО из answers для детерминированности
    // Profile - это snapshot, не source of truth
    const questionnaireAnswers: QuestionnaireAnswers = {
      skinType: 'normal', // Будет перезаписано из answers
      age: '25-34', // Будет перезаписано из answers
      concerns: [],
      diagnoses: [],
      allergies: [],
      sensitivityLevel: 'low', // Будет перезаписано из answers
      acneLevel: 0, // Будет перезаписано из answers
    };

    // ИСПРАВЛЕНО: Извлекаем все необходимые данные из ответов для правильного вычисления scores
    // НЕ используем данные из profile, только из answers
    for (const answer of answersForScores) {
      const code = answer.question?.code || '';
      const value = answer.answerValue || 
        (Array.isArray(answer.answerValues) ? answer.answerValues[0] : null);
      
      if (code === 'skin_type' || code === 'skinType') {
        questionnaireAnswers.skinType = (value as string) || 'normal';
      } else if (code === 'age' || code === 'age_group' || code === 'ageGroup') {
        questionnaireAnswers.age = (value as string) || '25-34';
      } else if (code === 'skin_concerns' && Array.isArray(answer.answerValues)) {
        questionnaireAnswers.concerns = answer.answerValues as string[];
      } else if (code === 'diagnoses' && Array.isArray(answer.answerValues)) {
        questionnaireAnswers.diagnoses = answer.answerValues as string[];
      } else if (code === 'allergies' && Array.isArray(answer.answerValues)) {
        questionnaireAnswers.allergies = answer.answerValues as string[];
      } else if (code === 'habits' && Array.isArray(answer.answerValues)) {
        questionnaireAnswers.habits = answer.answerValues as string[];
      } else if (code === 'season_change' || code === 'seasonChange') {
        questionnaireAnswers.seasonChange = value as string;
      } else if (code === 'retinol_reaction' || code === 'retinolReaction') {
        questionnaireAnswers.retinolReaction = value as string;
      } else if (code === 'spf_frequency' || code === 'spfFrequency') {
        questionnaireAnswers.spfFrequency = value as string;
      } else if (code === 'sun_exposure' || code === 'sunExposure') {
        questionnaireAnswers.sunExposure = value as string;
      } else if (code === 'sensitivity_level' || code === 'sensitivityLevel') {
        questionnaireAnswers.sensitivityLevel = (value as string) || 'low';
      } else if (code === 'acne_level' || code === 'acneLevel') {
        questionnaireAnswers.acneLevel = typeof value === 'number' ? value : (parseInt(value as string) || 0);
      } else if (code === 'pregnant' || code === 'has_pregnancy' || code === 'pregnancy_breastfeeding') {
        // ИСПРАВЛЕНО: Приводим к строке для сравнения, чтобы избежать ошибки типов
        const strValue = String(value).toLowerCase();
        questionnaireAnswers.pregnant = strValue === 'yes' || strValue === 'true' || (typeof value === 'boolean' && value === true);
      }
    }

    // Вычисляем skin scores
    const skinScores = calculateSkinAxes(questionnaireAnswers);

    // ИСПРАВЛЕНО: Нормализуем тип кожи и чувствительность для совместимости с правилами
    const { normalizeSkinTypeForRules, normalizeSensitivityForRules } = await import('@/lib/skin-type-normalizer');
    const normalizedSkinType = normalizeSkinTypeForRules(profile.skinType, { userId });
    const normalizedSensitivity = normalizeSensitivityForRules(profile.sensitivityLevel);

    // ИСПРАВЛЕНО: Используем buildRuleContext для создания типизированного контекста правил
    // Это обеспечивает единую точку маппинга полей и консистентность
    const { buildRuleContext } = await import('@/lib/rule-context');
    const ruleContext = buildRuleContext(profile, skinScores, normalizedSkinType, normalizedSensitivity);
    
    // Используем ruleContext как profileWithScores для обратной совместимости
    const profileWithScores: any = {
      ...profile,
      ...ruleContext,
    };

    logger.info('Profile with calculated scores for rule matching', {
      userId,
      profileId: profile.id,
      skinType: profile.skinType,
      inflammation: profileWithScores.inflammation,
      oiliness: profileWithScores.oiliness,
      hydration: profileWithScores.hydration,
      barrier: profileWithScores.barrier,
    });

    // Получаем все активные правила, отсортированные по приоритету
    const rules = await prisma.recommendationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    // Находим подходящее правило
    let matchedRule: Rule | null = null;
    
    for (const rule of rules) {
      const conditions = rule.conditionsJson as RuleCondition;
      if (matchesRule(profileWithScores, { ...rule, conditionsJson: conditions } as Rule)) {
        matchedRule = { ...rule, conditionsJson: conditions } as Rule;
        logger.info('Rule matched for profile', {
          userId,
          ruleId: rule.id,
          ruleName: rule.name,
          profileId: profile.id,
        });
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

    // Получаем бюджет пользователя из ответов (если есть)
    const userAnswers = await prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId: 2,
        question: {
          code: 'budget',
        },
      },
      take: 1,
    });
    
    const userBudget = userAnswers.length > 0 
      ? (userAnswers[0].answerValue || 'любой')
      : 'любой';
    
    // Маппинг бюджета из ответов в формат для фильтрации
    const budgetMapping: Record<string, 'бюджетный' | 'средний' | 'премиум' | 'любой'> = {
      'budget': 'бюджетный',
      'medium': 'средний',
      'premium': 'премиум',
      'any': 'любой',
      'любой': 'любой',
    };
    
    const normalizedUserBudget = budgetMapping[userBudget] || 'любой';

    // Получаем продукты для каждого шага
    const stepsJson = matchedRule.stepsJson as Record<string, RuleStep>;
    const steps: Record<string, any[]> = {};

    // ИСПРАВЛЕНО: Увеличиваем количество продуктов на шаг для более полных рекомендаций
    const enhancedStepsJson: Record<string, RuleStep> = { ...stepsJson };
    
    // Увеличиваем max_items для всех шагов
    for (const [stepName, stepConfig] of Object.entries(enhancedStepsJson)) {
      const step = { ...stepConfig };
      // Увеличиваем max_items: минимум 3, максимум 5 для каждого шага
      if (!step.max_items || step.max_items < 3) {
        step.max_items = 3;
      } else if (step.max_items > 5) {
        step.max_items = 5;
      }
      enhancedStepsJson[stepName] = step;
    }

    for (const [stepName, stepConfig] of Object.entries(enhancedStepsJson)) {
      // Если в правиле не указан бюджет, используем бюджет пользователя
      const stepWithBudget: RuleStep = {
        ...stepConfig,
        budget: stepConfig.budget || normalizedUserBudget,
      };
      
      const products = await getProductsForStep(stepWithBudget);
      if (products.length > 0) {
        // Нормализуем step для группировки
        // ВАЖНО: Используем ту же логику нормализации, что и выше, для консистентности
        let normalizedStep = stepName;
        
        // Нормализуем базовые шаги (как в части выше)
        if (stepName.startsWith('cleanser')) {
          normalizedStep = 'cleanser';
        } else if (stepName.startsWith('spf')) {
          normalizedStep = 'spf';
        } else if (stepName.startsWith('moisturizer')) {
          normalizedStep = 'moisturizer';
        } else if (stepName.startsWith('toner')) {
          normalizedStep = 'toner';
        } else if (stepName.startsWith('serum') || stepName.startsWith('treatment') || stepName === 'essence') {
          normalizedStep = 'serum';
        }
        
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
    
    const duration = Date.now() - startTime;
    logger.info('✅ Recommendations generated successfully', {
      userId,
      profileVersion: profile.version,
      stepsCount: Object.keys(steps).length,
      totalProducts: Object.values(steps).flat().length,
      duration,
    });
    logApiRequest(method, path, 200, duration, userId);

    return ApiResponse.success(response);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.error('❌ Error fetching recommendations', error, {
      userId,
      duration,
    });
    logApiError(method, path, error, userId);
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}
