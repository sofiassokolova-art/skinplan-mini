// app/api/questionnaire/answers/route.ts
// Сохранение ответов пользователя и расчет профиля

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createSkinProfile } from '@/lib/profile-calculator';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { ApiResponse } from '@/lib/api-response';
import { MAX_DUPLICATE_SUBMISSION_WINDOW_MS } from '@/lib/constants';

export const runtime = 'nodejs';

interface AnswerInput {
  questionId: number;
  answerValue?: string;
  answerValues?: string[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/questionnaire/answers';
  let userId: string | undefined;

  try {
    // Получаем initData из заголовков (пробуем оба варианта регистра)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      logger.warn('Missing initData in headers for questionnaire answers', {
        availableHeaders: Array.from(request.headers.keys()),
        userAgent: request.headers.get('user-agent'),
      });
      return ApiResponse.unauthorized('Missing Telegram initData. Please open the app through Telegram Mini App.');
    }
    
    logger.debug('initData received', { length: initData.length });

    // Получаем userId из initData (автоматически создает/обновляет пользователя)
    const userIdResult = await getUserIdFromInitData(initData);
    
    if (!userIdResult) {
      return ApiResponse.unauthorized('Invalid or expired initData');
    }
    
    userId = userIdResult; // Теперь userId гарантированно string

    const body = await request.json();
    const { questionnaireId, answers } = body;

    if (!questionnaireId || !Array.isArray(answers)) {
      return ApiResponse.badRequest('Invalid request body');
    }

    // Получаем анкету
    const questionnaire = await prisma.questionnaire.findUnique({
      where: { id: questionnaireId },
    });

    if (!questionnaire) {
      return ApiResponse.notFound('Questionnaire not found');
    }

    // Проверяем, не отправлял ли пользователь ответы недавно (защита от повторной отправки)
    // Если пользователь отправил ответы менее чем 5 секунд назад - считаем это дубликатом
    const recentSubmission = await prisma.userAnswer.findFirst({
      where: {
        userId,
        question: {
          questionnaireId: questionnaire.id,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        question: true,
      },
    });

    if (recentSubmission) {
      const timeSinceSubmission = Date.now() - new Date(recentSubmission.createdAt).getTime();
      // Если ответ был отправлен менее чем 5 секунд назад - это вероятно дубликат
      if (timeSinceSubmission < 5000) {
        logger.warn('Possible duplicate submission detected', {
          userId,
          questionnaireId,
          timeSinceSubmission,
          lastSubmissionId: recentSubmission.id,
        });
        
        // Возвращаем успешный ответ, чтобы избежать ошибки 301 и повторной обработки
        // Но логируем это для мониторинга
        const existingProfile = await prisma.skinProfile.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
        
        return ApiResponse.success({
          success: true,
          message: 'Answers already submitted',
          profile: existingProfile ? {
            id: existingProfile.id,
            version: existingProfile.version,
          } : null,
          isDuplicate: true,
        });
      }
    }

    // Используем транзакцию для атомарности операций
    const { savedAnswers, fullAnswers, profile, existingProfile } = await prisma.$transaction(async (tx) => {
      // Сохраняем или обновляем ответы (upsert для избежания дубликатов)
      const savedAnswers = await Promise.all(
        answers.map(async (answer: AnswerInput) => {
          // Проверяем, существует ли уже ответ
          const existingAnswer = await tx.userAnswer.findFirst({
            where: {
              userId,
              questionnaireId,
              questionId: answer.questionId,
            },
          });

          if (existingAnswer) {
            // Обновляем существующий ответ (updatedAt обновляется автоматически через @updatedAt)
            return tx.userAnswer.update({
              where: { id: existingAnswer.id },
              data: {
                answerValue: answer.answerValue || null,
                answerValues: answer.answerValues ? (answer.answerValues as any) : null,
              },
              include: {
                question: {
                  include: {
                    answerOptions: true,
                  },
                },
              },
            });
          } else {
            // Создаем новый ответ
            return tx.userAnswer.create({
              data: {
                userId: userId!,
                questionnaireId,
                questionId: answer.questionId,
                answerValue: answer.answerValue || null,
                answerValues: answer.answerValues ? (answer.answerValues as any) : null,
              },
              include: {
                question: {
                  include: {
                    answerOptions: true,
                  },
                },
              },
            });
          }
        })
      );

      // Загружаем полные данные для расчета профиля
      const fullAnswers = await tx.userAnswer.findMany({
        where: {
          userId,
          questionnaireId,
        },
        include: {
          question: {
            include: {
              answerOptions: true,
            },
          },
        },
      });

      // Рассчитываем профиль кожи
      const profileData = createSkinProfile(
        userId!, // userId гарантированно string в транзакции
        questionnaireId,
        fullAnswers,
        questionnaire.version
      );

      // Сохраняем или обновляем профиль
      // Проверяем существующий профиль
      const existingProfile = await tx.skinProfile.findUnique({
        where: {
          userId_version: {
            userId: userId!, // userId гарантированно string
            version: questionnaire.version,
          },
        },
      });

      // Подготавливаем данные для Prisma
      // При повторном прохождении анкеты сохраняем некоторые данные из старого профиля
      const existingMarkers = (existingProfile?.medicalMarkers as any) || {};
      const mergedMarkers = {
        ...existingMarkers,
        ...(profileData.medicalMarkers ? (profileData.medicalMarkers as any) : {}),
      };
      // Сохраняем gender из старого профиля, если он был
      if (existingMarkers?.gender) {
        mergedMarkers.gender = existingMarkers.gender;
      }
      const profileDataForPrisma = {
        ...profileData,
        ageGroup: existingProfile?.ageGroup ?? profileData.ageGroup,
        medicalMarkers: Object.keys(mergedMarkers).length > 0 ? mergedMarkers : null,
      };

      const profile = existingProfile
        ? await tx.skinProfile.update({
            where: { id: existingProfile.id },
            data: {
              ...profileDataForPrisma,
              version: existingProfile.version + 1, // Инкрементируем версию при обновлении профиля
              updatedAt: new Date(),
            },
          })
        : await tx.skinProfile.create({
            data: {
              userId: userId!,
              version: questionnaire.version,
              ...profileDataForPrisma,
            },
          });

      return { savedAnswers, fullAnswers, profile, existingProfile };
    }, {
      timeout: 30000, // 30 секунд таймаут для транзакции
    });
    
    // Очищаем кэш плана и рекомендаций при обновлении профиля (вне транзакции)
    if (existingProfile && existingProfile.version !== profile.version) {
      logger.info('Profile updated, clearing cache and RecommendationSession', { 
        userId: userId || undefined, 
        oldVersion: existingProfile.version, 
        newVersion: profile.version,
        isRetaking: !!existingProfile, // Это перепрохождение анкеты
      });
      try {
        const { invalidateCache } = await import('@/lib/cache');
        // Очищаем кэш для старой версии
        await invalidateCache(userId, existingProfile.version);
        // Также очищаем кэш для новой версии, чтобы план перегенерировался
        await invalidateCache(userId, profile.version);
        logger.info('Cache cleared for old and new profile versions', { 
          userId, 
          oldVersion: existingProfile.version,
          newVersion: profile.version,
        });
        
        // Удаляем старую RecommendationSession, чтобы план перегенерировался с новыми продуктами
        await prisma.recommendationSession.deleteMany({
          where: { userId },
        });
        logger.info('RecommendationSession deleted for plan regeneration', { userId });
        
        // Запускаем автоматическую регенерацию плана в фоне
        // Это гарантирует, что план обновится при изменении типа кожи или других параметров
        try {
          const planRegenerateUrl = `${process.env.NEXT_PUBLIC_API_URL || process.env.VERCEL_URL || 'http://localhost:3000'}/api/plan/generate`;
          fetch(planRegenerateUrl, {
            method: 'GET',
            headers: {
              'X-Telegram-Init-Data': initData || '',
            },
          }).catch(err => {
            logger.warn('Background plan regeneration failed', { userId, error: err });
            // Не критично - план пересоберется при следующем запросе
          });
          logger.info('Plan regeneration triggered in background', { userId, newVersion: profile.version });
        } catch (regenerateError) {
          logger.warn('Could not trigger plan regeneration', { userId, error: regenerateError });
        }
      } catch (cacheError) {
        logger.warn('Failed to clear cache', { error: cacheError, userId });
      }
    }

    // Автоматически создаем рекомендации после создания профиля
    // Импортируем логику из recommendations/route.ts
    try {
      // Получаем все активные правила
      const rules = await prisma.recommendationRule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      });

      // Находим подходящее правило
      let matchedRule: any = null;
      
      for (const rule of rules) {
        const conditions = rule.conditionsJson as any;
        let matches = true;

        for (const [key, condition] of Object.entries(conditions)) {
          const profileValue = (profile as any)[key];

          if (Array.isArray(condition)) {
            if (!condition.includes(profileValue)) {
              matches = false;
              break;
            }
          } else if (typeof condition === 'object' && condition !== null) {
            const conditionObj = condition as Record<string, unknown>;
            if (typeof profileValue === 'number') {
              if ('gte' in conditionObj && typeof conditionObj.gte === 'number') {
                const gteValue = conditionObj.gte as number;
                if (profileValue < gteValue) {
                  matches = false;
                  break;
                }
              }
              if ('lte' in conditionObj && typeof conditionObj.lte === 'number') {
                const lteValue = conditionObj.lte as number;
                if (profileValue > lteValue) {
                  matches = false;
                  break;
                }
              }
            }
          } else if (condition !== profileValue) {
            matches = false;
            break;
          }
        }

        if (matches) {
          matchedRule = rule;
          break;
        }
      }

      // Если найдено правило, создаем RecommendationSession
      if (matchedRule) {
        const stepsJson = matchedRule.stepsJson as any;
        const productIds: number[] = [];

        // Получаем бюджет пользователя из ответов (если есть)
        const budgetAnswer = userAnswers.find(a => a.question?.code === 'budget');
        const userBudget = budgetAnswer?.answerValue || 'любой';
        
        // Маппинг бюджета из ответов в формат для фильтрации
        const budgetMapping: Record<string, string> = {
          'budget': 'mass',
          'medium': 'mid',
          'premium': 'premium',
          'any': null as any,
          'любой': null as any,
        };
        
        const userPriceSegment = budgetMapping[userBudget] || null;

        // Собираем ID продуктов из всех шагов
        for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
          const where: any = { published: true };
          const step = stepConfig as any;

          if (step.category && Array.isArray(step.category) && step.category.length > 0) {
            where.category = { in: step.category };
          }
          if (step.skin_types && Array.isArray(step.skin_types) && step.skin_types.length > 0) {
            where.skinTypes = { hasSome: step.skin_types };
          }
          if (step.concerns && Array.isArray(step.concerns) && step.concerns.length > 0) {
            where.concerns = { hasSome: step.concerns };
          }
          if (step.is_non_comedogenic === true) {
            where.isNonComedogenic = true;
          }
          if (step.is_fragrance_free === true) {
            where.isFragranceFree = true;
          }
          
          // Фильтрация по бюджету (если указан в правиле или у пользователя)
          const ruleBudget = step.budget;
          if (ruleBudget && ruleBudget !== 'любой') {
            const budgetMapping: Record<string, string> = {
              'бюджетный': 'mass',
              'средний': 'mid',
              'премиум': 'premium',
            };
            const priceSegment = budgetMapping[ruleBudget];
            if (priceSegment) {
              where.priceSegment = priceSegment;
            }
          } else if (userPriceSegment) {
            // Если в правиле не указан бюджет, используем бюджет пользователя
            where.priceSegment = userPriceSegment;
          }
          
          // Фильтрация по натуральности (если указано в правиле)
          if (step.is_natural === true) {
            // ПРИМЕЧАНИЕ: В текущей схеме БД нет поля isNatural
            // Можно добавить проверку по composition, если нужно
          }

          const products = await prisma.product.findMany({
            where,
            take: (step.max_items || 3) * 2,
          });
          
          // Сортируем в памяти
          products.sort((a: any, b: any) => {
            if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
            if (a.priority !== b.priority) return b.priority - a.priority;
            return b.createdAt.getTime() - a.createdAt.getTime();
          });
          
          const sortedProducts = products.slice(0, step.max_items || 3);

          productIds.push(...sortedProducts.map(p => p.id));
        }

        // Создаем RecommendationSession
        await prisma.recommendationSession.create({
          data: {
            userId,
            profileId: profile.id,
            ruleId: matchedRule.id,
            products: productIds,
          },
        });

        logger.info('RecommendationSession created', {
          userId,
          productCount: productIds.length,
        });
      } else {
        // Если правило не найдено, создаем fallback сессию с базовыми продуктами
        logger.warn('No matching rule found, creating fallback session', {
          userId,
          profileId: profile.id,
        });
        
        const fallbackProductIds: number[] = [];
        
        // ГАРАНТИРУЕМ наличие базовых шагов: cleanser, moisturizer, spf
        const requiredSteps = ['cleanser', 'moisturizer', 'spf'];
        
        for (const step of requiredSteps) {
          const products = await prisma.product.findMany({
            where: {
              published: true,
              step: step,
              // SPF универсален, для остальных учитываем тип кожи
              ...(step !== 'spf' && profile.skinType ? {
                skinTypes: { has: profile.skinType },
              } : {}),
            },
            take: 1,
            orderBy: { createdAt: 'desc' },
          });
          
          if (products.length > 0) {
            fallbackProductIds.push(products[0].id);
            logger.debug('Added fallback product', { userId, step, productName: products[0].name });
          }
        }
        
        // Добавляем дополнительные продукты (toner, serum) если есть
        const optionalSteps = ['toner', 'serum'];
        for (const step of optionalSteps) {
          const products = await prisma.product.findMany({
            where: {
              published: true,
              step: step,
              ...(profile.skinType ? {
                skinTypes: { has: profile.skinType },
              } : {}),
            },
            take: 1,
            orderBy: { createdAt: 'desc' },
          });
          
          if (products.length > 0 && !fallbackProductIds.includes(products[0].id)) {
            fallbackProductIds.push(products[0].id);
          }
        }

        if (fallbackProductIds.length > 0) {
          await prisma.recommendationSession.create({
            data: {
              userId,
              profileId: profile.id,
              ruleId: null,
              products: fallbackProductIds,
            },
          });
          
          logger.info('Fallback RecommendationSession created', {
            userId,
            productCount: fallbackProductIds.length,
          });
        } else {
          logger.error('No products available for fallback session', { userId });
        }
      }
    } catch (recommendationError) {
      // Не блокируем сохранение ответов, если рекомендации не создались
      logger.error('Error creating recommendations', recommendationError, { userId });
    }

    // После успешного создания профиля, очищаем прогресс анкеты на сервере
    // Прогресс больше не нужен, так как анкета завершена
    try {
      await prisma.userAnswer.deleteMany({
        where: {
          userId,
          questionnaireId,
        },
      });
      logger.info('Quiz progress cleared after profile creation', { userId });
    } catch (clearError) {
      // Не критично, если не удалось очистить - прогресс просто не будет показываться
      logger.warn('Failed to clear quiz progress (non-critical)', { userId, error: clearError });
    }

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId || undefined);

    return ApiResponse.success({
      success: true,
      profile: {
        id: profile.id,
        skinType: profile.skinType,
        sensitivityLevel: profile.sensitivityLevel,
        acneLevel: profile.acneLevel,
        dehydrationLevel: profile.dehydrationLevel,
        rosaceaRisk: profile.rosaceaRisk,
        pigmentationRisk: profile.pigmentationRisk,
        ageGroup: profile.ageGroup,
        notes: profile.notes,
      },
      answersCount: savedAnswers.length,
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId || undefined);
    
    return ApiResponse.internalError(error, { userId: userId || undefined, method, path, duration });
  }
}
