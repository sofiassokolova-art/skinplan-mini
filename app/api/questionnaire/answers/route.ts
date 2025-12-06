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
      // ВАЖНО: Ищем последний профиль пользователя (не по questionnaire.version, а по последней версии)
      // Это нужно для правильной обработки повторных отправок анкеты
      const existingProfile = await tx.skinProfile.findFirst({
        where: {
          userId: userId!, // userId гарантированно string
        },
        orderBy: {
          version: 'desc', // Берем последнюю версию
        },
      });

      // ВАЖНО: Извлекаем diagnoses и другие данные из ответов напрямую
      // createSkinProfile не извлекает diagnoses, поэтому делаем это здесь
      const diagnosesAnswer = fullAnswers.find(a => a.question?.code === 'diagnoses' || a.question?.code === 'DIAGNOSES');
      const concernsAnswer = fullAnswers.find(a => a.question?.code === 'skin_concerns' || a.question?.code === 'current_concerns');
      
      const extractedData: any = {};
      if (diagnosesAnswer && Array.isArray(diagnosesAnswer.answerValues)) {
        extractedData.diagnoses = diagnosesAnswer.answerValues;
      }
      if (concernsAnswer && Array.isArray(concernsAnswer.answerValues)) {
        extractedData.mainGoals = concernsAnswer.answerValues;
      }

      // Подготавливаем данные для Prisma
      // При повторном прохождении анкеты сохраняем некоторые данные из старого профиля
      const existingMarkers = (existingProfile?.medicalMarkers as any) || {};
      const mergedMarkers = {
        ...existingMarkers,
        ...(profileData.medicalMarkers ? (profileData.medicalMarkers as any) : {}),
        // ВАЖНО: Перезаписываем diagnoses и mainGoals из новых ответов
        ...extractedData,
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

      // ВАЖНО: Используем upsert для избежания конфликтов уникальности при повторных отправках
      // Если профиль существует, обновляем его с новой версией
      // Если нет - создаем новый
      const newVersion = existingProfile ? existingProfile.version + 1 : questionnaire.version;
      
      // Проверяем, не существует ли уже профиль с новой версией (защита от race condition)
      const existingProfileWithNewVersion = await tx.skinProfile.findUnique({
        where: {
          userId_version: {
            userId: userId!,
            version: newVersion,
          },
        },
      });
      
      // Если профиль с новой версией уже существует, используем его (повторная отправка)
      if (existingProfileWithNewVersion) {
        logger.warn('Profile with new version already exists, using existing profile', {
          userId,
          existingVersion: existingProfile?.version,
          newVersion,
          profileId: existingProfileWithNewVersion.id,
        });
        const profile = await tx.skinProfile.update({
          where: { id: existingProfileWithNewVersion.id },
          data: {
            ...profileDataForPrisma,
            updatedAt: new Date(),
          },
        });
        return { savedAnswers, fullAnswers, profile, existingProfile };
      }
      
      // Если существующий профиль есть, обновляем его с новой версией
      // Если нет - создаем новый
      // ВАЖНО: Используем try-catch для обработки unique constraint ошибок при race condition
      let profile;
      try {
        profile = existingProfile
          ? await tx.skinProfile.update({
              where: { id: existingProfile.id },
              data: {
                ...profileDataForPrisma,
                version: newVersion, // Инкрементируем версию при обновлении профиля
                updatedAt: new Date(),
              },
            })
          : await tx.skinProfile.create({
              data: {
                userId: userId!,
                version: newVersion,
                ...profileDataForPrisma,
              },
            });
      } catch (updateError: any) {
        // Если возникла ошибка unique constraint, значит профиль с новой версией уже был создан
        // (race condition - два запроса одновременно)
        if (updateError?.code === 'P2002' && updateError?.meta?.target?.includes('user_id') && updateError?.meta?.target?.includes('version')) {
          logger.warn('Unique constraint error during profile update (race condition), fetching existing profile', {
            userId,
            newVersion,
            error: updateError.message,
          });
          
          // Ищем профиль с новой версией, который был создан другим запросом
          const raceConditionProfile = await tx.skinProfile.findUnique({
            where: {
              userId_version: {
                userId: userId!,
                version: newVersion,
              },
            },
          });
          
          if (raceConditionProfile) {
            // Обновляем существующий профиль без изменения версии
            profile = await tx.skinProfile.update({
              where: { id: raceConditionProfile.id },
              data: {
                ...profileDataForPrisma,
                updatedAt: new Date(),
              },
            });
            logger.info('Profile updated after race condition resolution', {
              userId,
              profileId: profile.id,
              version: profile.version,
            });
          } else {
            // Если профиль не найден, это странно - пробуем найти последний профиль
            const lastProfile = await tx.skinProfile.findFirst({
              where: { userId: userId! },
              orderBy: { version: 'desc' },
            });
            if (lastProfile) {
              profile = lastProfile;
              logger.warn('Using last profile after race condition (profile with new version not found)', {
                userId,
                profileId: profile.id,
                version: profile.version,
              });
            } else {
              // Если ничего не найдено, пробуем создать снова (может быть другая ошибка)
              throw updateError;
            }
          }
        } else {
          // Другая ошибка - пробрасываем дальше
          throw updateError;
        }
      }

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
        // ВАЖНО: Удаляем только по userId, так как новая сессия будет создана позже
        await prisma.recommendationSession.deleteMany({
          where: { userId },
        });
        logger.info('RecommendationSession deleted for plan regeneration', { userId });
        
        // ВАЖНО: Генерацию плана переносим ПОСЛЕ создания RecommendationSession
        // Это гарантирует, что план будет использовать продукты из новой сессии
        // Генерация плана будет выполнена после создания RecommendationSession (см. ниже)
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
          // ВАЖНО: diagnoses хранятся в medicalMarkers, а не в корне профиля
          let profileValue: any;
          if (key === 'diagnoses') {
            // Извлекаем diagnoses из medicalMarkers
            profileValue = (profile.medicalMarkers as any)?.diagnoses || [];
          } else {
            profileValue = (profile as any)[key];
          }

          if (Array.isArray(condition)) {
            if (!condition.includes(profileValue)) {
              matches = false;
              break;
            }
          } else if (typeof condition === 'object' && condition !== null) {
            const conditionObj = condition as Record<string, unknown>;
            
            // Обработка hasSome для массивов (например, diagnoses: { hasSome: ["atopic_dermatitis"] })
            if ('hasSome' in conditionObj && Array.isArray(conditionObj.hasSome)) {
              const hasSomeArray = conditionObj.hasSome as any[];
              const profileArray = Array.isArray(profileValue) ? profileValue : [];
              // Проверяем, есть ли хотя бы один элемент из hasSome в profileValue
              const hasMatch = hasSomeArray.some(item => profileArray.includes(item));
              if (!hasMatch) {
                matches = false;
                break;
              }
              continue; // Переходим к следующему условию
            }
            
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
      // ВАЖНО: Перед созданием новой сессии удаляем все старые сессии для этого профиля
      // Это гарантирует, что при перепрохождении анкеты будут использоваться новые продукты
      await prisma.recommendationSession.deleteMany({
        where: {
          userId,
          profileId: profile.id,
        },
      });
      logger.info('Old RecommendationSessions deleted before creating new one', {
        userId,
        profileId: profile.id,
      });
      
      if (matchedRule) {
        const stepsJson = matchedRule.stepsJson as any;

        // Получаем бюджет пользователя из ответов (если есть)
        const budgetAnswer = fullAnswers.find(a => a.question?.code === 'budget');
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

        // Импортируем функцию getProductsForStep из общего модуля
        // ВАЖНО: Используем ту же логику подбора продуктов, что и в /api/recommendations
        // Это гарантирует консистентность между главной страницей и планом
        const { getProductsForStep: getProductsForStepFromLib } = await import('@/lib/product-selection');
        
        // Обертка для совместимости с локальной сигнатурой
        const getProductsForStep = async (stepConfig: any) => {
          return await getProductsForStepFromLib(stepConfig, userPriceSegment);
        };
        
        // Старая локальная реализация (будет удалена после полного рефакторинга)
        const getProductsForStepOld = async (stepConfig: any) => {
          const where: any = {
            published: true,
            brand: {
              isActive: true,
            },
          };

          // SPF универсален для всех типов кожи - не фильтруем по типу кожи
          const isSPF = stepConfig.category?.includes('spf') || stepConfig.category?.some((c: string) => c.toLowerCase().includes('spf'));

          // Строим условия для category/step
          if (stepConfig.category && stepConfig.category.length > 0) {
            const categoryConditions: any[] = [];
            
            // Маппинг категорий из правил в категории БД
            const categoryMapping: Record<string, string[]> = {
              'cream': ['moisturizer'], // В правилах используется "cream", в БД - "moisturizer"
              'moisturizer': ['moisturizer'],
              'cleanser': ['cleanser'],
              'serum': ['serum'],
              'toner': ['toner'],
              'treatment': ['treatment'],
              'spf': ['spf'],
              'mask': ['mask'],
            };
            
            for (const cat of stepConfig.category) {
              const normalizedCats = categoryMapping[cat] || [cat];
              
              for (const normalizedCat of normalizedCats) {
                // Точное совпадение по category
                categoryConditions.push({ category: normalizedCat });
                // Точное совпадение по step (на случай, если в БД step = category)
                categoryConditions.push({ step: normalizedCat });
                // Частичное совпадение по step (например, 'serum' найдет 'serum_hydrating')
                categoryConditions.push({ step: { startsWith: normalizedCat } });
              }
            }
            
            where.OR = categoryConditions;
          }

          // Нормализуем skinTypes: combo -> combination_dry, combination_oily, или просто combo
          if (stepConfig.skin_types && stepConfig.skin_types.length > 0 && !isSPF) {
            const normalizedSkinTypes: string[] = [];
            
            for (const skinType of stepConfig.skin_types) {
              normalizedSkinTypes.push(skinType);
              // Если ищем 'combo', также ищем варианты
              if (skinType === 'combo') {
                normalizedSkinTypes.push('combination_dry');
                normalizedSkinTypes.push('combination_oily');
              }
              // Если ищем 'dry', также ищем 'combination_dry'
              if (skinType === 'dry') {
                normalizedSkinTypes.push('combination_dry');
              }
              // Если ищем 'oily', также ищем 'combination_oily'
              if (skinType === 'oily') {
                normalizedSkinTypes.push('combination_oily');
              }
            }
            
            where.skinTypes = { hasSome: normalizedSkinTypes };
          }

          // Concerns: если указаны, ищем по ним, но не блокируем, если не найдено
          if (stepConfig.concerns && stepConfig.concerns.length > 0) {
            const concernsCondition = {
              OR: [
                { concerns: { hasSome: stepConfig.concerns } },
                { concerns: { isEmpty: true } }, // Также берем продукты без concerns
              ],
            };
            
            if (where.AND) {
              where.AND = Array.isArray(where.AND) ? [...where.AND, concernsCondition] : [where.AND, concernsCondition];
            } else {
              where.AND = [concernsCondition];
            }
          }

          if (stepConfig.is_non_comedogenic === true) {
            where.isNonComedogenic = true;
          }

          if (stepConfig.is_fragrance_free === true) {
            where.isFragranceFree = true;
          }

          // Фильтрация по бюджету (priceSegment)
          const ruleBudget = stepConfig.budget;
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

          // Фильтрация по натуральности (если указано)
          if (stepConfig.is_natural === true) {
            // ПРИМЕЧАНИЕ: В текущей схеме БД нет поля isNatural
            // Можно добавить проверку по composition, если нужно
          }
          
          // Фильтрация по активным ингредиентам (если указано в правиле)
          // ВАЖНО: Если продуктов с указанными ингредиентами нет, не блокируем поиск - используем fallback
          if (stepConfig.active_ingredients && Array.isArray(stepConfig.active_ingredients) && stepConfig.active_ingredients.length > 0) {
            // Нормализуем названия ингредиентов: убираем проценты, дополнительные слова
            const normalizeIngredient = (ing: string): string[] => {
              let normalized = ing.replace(/\s*\d+[–\-]\d+\s*%/gi, '');
              normalized = normalized.replace(/\s*\d+\s*%/gi, '');
              normalized = normalized.replace(/\s*%\s*/gi, '');
              normalized = normalized.split('(')[0].split(',')[0].trim();
              normalized = normalized.toLowerCase().trim();
              
              const variants = [normalized];
              if (normalized.includes('_')) {
                variants.push(normalized.replace(/_/g, ''));
              }
              
              return variants;
            };
            
            const normalizedIngredients: string[] = [];
            for (const ingredient of stepConfig.active_ingredients) {
              const variants = normalizeIngredient(ingredient);
              normalizedIngredients.push(...variants);
            }
            
            const activeIngredientsCondition = {
              OR: [
                ...normalizedIngredients.map((ingredient: string) => ({
                  activeIngredients: { has: ingredient },
                })),
                { activeIngredients: { isEmpty: true } },
              ],
            };
            
            if (where.AND) {
              where.AND = Array.isArray(where.AND) ? [...where.AND, activeIngredientsCondition] : [where.AND, activeIngredientsCondition];
            } else {
              where.AND = [activeIngredientsCondition];
            }
          }

          // Первая попытка: точный поиск
          let products = await prisma.product.findMany({
            where,
            include: {
              brand: true,
            },
            take: (stepConfig.max_items || 3) * 3,
          });

          // Дополнительная фильтрация по ингредиентам с частичным совпадением
          if (stepConfig.active_ingredients && Array.isArray(stepConfig.active_ingredients) && stepConfig.active_ingredients.length > 0 && products.length > 0) {
            // Импортируем функцию нормализации из общего модуля
            const { normalizeIngredientSimple } = await import('@/lib/ingredient-normalizer');

            const normalizedRuleIngredients = stepConfig.active_ingredients.map(normalizeIngredientSimple);
            
            products = products.filter(product => {
              if (product.activeIngredients.length === 0) {
                return true;
              }
              
              return product.activeIngredients.some(productIng => {
                const normalizedProductIng = productIng.toLowerCase().trim();
                return normalizedRuleIngredients.some((ruleIng: string) => {
                  if (normalizedProductIng === ruleIng) return true;
                  if (normalizedProductIng.includes(ruleIng) || ruleIng.includes(normalizedProductIng)) return true;
                  const productIngNoUnderscore = normalizedProductIng.replace(/_/g, '');
                  const ruleIngNoUnderscore = ruleIng.replace(/_/g, '');
                  if (productIngNoUnderscore === ruleIngNoUnderscore) return true;
                  if (productIngNoUnderscore.includes(ruleIngNoUnderscore) || ruleIngNoUnderscore.includes(productIngNoUnderscore)) return true;
                  return false;
                });
              });
            });
          }

          // Если не нашли достаточно продуктов, делаем более мягкий поиск
          if (products.length < (stepConfig.max_items || 3)) {
            const fallbackWhere: any = {
              published: true,
              brand: {
                isActive: true,
              },
            };

            // Более мягкий поиск по category/step
            if (stepConfig.category && stepConfig.category.length > 0) {
              const fallbackConditions: any[] = [];
              for (const cat of stepConfig.category) {
                fallbackConditions.push({ category: { contains: cat } });
                fallbackConditions.push({ step: { contains: cat } });
              }
              fallbackWhere.OR = fallbackConditions;
            }

            // Убираем фильтры по skinTypes и concerns для fallback
            const fallbackProducts = await prisma.product.findMany({
              where: fallbackWhere,
              include: {
                brand: true,
              },
              take: (stepConfig.max_items || 3) * 2,
            });

            // Объединяем результаты, убирая дубликаты
            const existingIds = new Set(products.map(p => p.id));
            const newProducts = fallbackProducts.filter(p => !existingIds.has(p.id));
            products = [...products, ...newProducts];
          }
          
          // Сортируем в памяти по приоритету и isHero
          const sorted = products.sort((a: any, b: any) => {
            if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
            if (a.priority !== b.priority) return b.priority - a.priority;
            return b.createdAt.getTime() - a.createdAt.getTime();
          });
          
          return sorted.slice(0, stepConfig.max_items || 3);
        };

        // Собираем ID продуктов из всех шагов, используя улучшенную логику
        const productIdsSet = new Set<number>(); // Используем Set для автоматической дедупликации
        
        for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
          const step = stepConfig as any;
          
          // ВАЖНО: Если в правиле нет category, определяем его из имени шага
          // Это нужно, чтобы treatment, serum и другие шаги корректно находили продукты
          if (!step.category || step.category.length === 0) {
            // Маппинг имени шага в категорию
            const stepNameToCategory: Record<string, string[]> = {
              'treatment': ['treatment'],
              'serum': ['serum'],
              'toner': ['toner'],
              'cleanser': ['cleanser'],
              'moisturizer': ['moisturizer'],
              'cream': ['moisturizer'],
              'spf': ['spf'],
              'mask': ['mask'],
            };
            
            if (stepNameToCategory[stepName]) {
              step.category = stepNameToCategory[stepName];
            }
          }
          
          // Если в правиле не указан бюджет, используем бюджет пользователя
          const stepWithBudget = {
            ...step,
            budget: step.budget || (userPriceSegment ? 
              (userPriceSegment === 'mass' ? 'бюджетный' : 
               userPriceSegment === 'mid' ? 'средний' : 
               userPriceSegment === 'premium' ? 'премиум' : 'любой') : 'любой'),
          };
          
          const products = await getProductsForStep(stepWithBudget);
          logger.info(`Products selected for step ${stepName}`, {
            stepName,
            productCount: products.length,
            productIds: products.map(p => p.id),
            productNames: products.map(p => p.name),
            stepConfig: stepWithBudget,
            userId,
          });
          
          // Добавляем продукты в Set (автоматически убирает дубликаты)
          products.forEach(p => productIdsSet.add(p.id));
        }
        
        // Конвертируем Set обратно в массив
        const productIds = Array.from(productIdsSet);
        
        logger.info('Final product selection summary', {
          userId,
          totalProductIds: productIds.length,
          uniqueProductIds: productIds,
          stepsCount: Object.keys(stepsJson).length,
        });

        // Создаем RecommendationSession
        // ВАЖНО: Логируем для диагностики, особенно при перепрохождении
        logger.info('Creating RecommendationSession with products', {
          userId,
          profileId: profile.id,
          profileVersion: profile.version,
          ruleId: matchedRule.id,
          productCount: productIds.length,
          productIds: productIds.slice(0, 10), // Первые 10 для логирования
          isRetaking: !!existingProfile,
          oldProfileVersion: existingProfile?.version,
        });
        
        await prisma.recommendationSession.create({
          data: {
            userId,
            profileId: profile.id,
            ruleId: matchedRule.id,
            products: productIds,
          },
        });

        // Очищаем кэш рекомендаций для текущего профиля, чтобы новые рекомендации загрузились
        try {
          const { invalidateCache } = await import('@/lib/cache');
          await invalidateCache(userId, profile.version);
          logger.info('Recommendations cache invalidated after creating new session', {
            userId,
            profileVersion: profile.version,
          });
        } catch (cacheError) {
          logger.warn('Failed to invalidate recommendations cache', { error: cacheError });
        }

        logger.info('RecommendationSession created', {
          userId,
          productCount: productIds.length,
          ruleId: matchedRule.id,
        });
      } else {
        // Если правило не найдено, создаем fallback сессию с базовыми продуктами
        // ВАЖНО: Старые сессии уже удалены выше
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

          // Очищаем кэш рекомендаций для текущего профиля
          try {
            const { invalidateCache } = await import('@/lib/cache');
            await invalidateCache(userId, profile.version);
            logger.info('Recommendations cache invalidated after creating fallback session', {
              userId,
              profileVersion: profile.version,
            });
          } catch (cacheError) {
            logger.warn('Failed to invalidate recommendations cache', { error: cacheError });
          }
          
          logger.info('Fallback RecommendationSession created', {
            userId,
            productCount: fallbackProductIds.length,
          });
        } else {
          logger.error('No products available for fallback session', { userId });
        }
      }
      
      // ВАЖНО: Генерируем план ПОСЛЕ создания RecommendationSession
      // Это гарантирует, что план будет использовать продукты из новой сессии
      // РЕШЕНИЕ ПРОБЛЕМЫ ДОЛГОЙ ГЕНЕРАЦИИ: Запускаем генерацию асинхронно в фоне
      // Это не блокирует ответ на запрос анкеты, план будет готов позже
      // При первом запросе плана, если его нет, он будет сгенерирован автоматически (lazy generation)
      // Генерируем план как при первом прохождении, так и при перепрохождении
      const shouldGeneratePlan = !existingProfile || (existingProfile.version !== profile.version);
      if (shouldGeneratePlan) {
        // Запускаем генерацию плана асинхронно в фоне, не ждем завершения
        // Это решает проблему долгой синхронной генерации (до 60 секунд)
        // Пользователь получит ответ сразу, а план будет готов позже
        const generatePlanInBackground = async () => {
          try {
            logger.info('Starting background plan generation after RecommendationSession creation', { 
              userId, 
              newVersion: profile.version 
            });
            
            // Используем fetch для асинхронной генерации в фоне
            // Это не блокирует текущий запрос
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 
                           (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                           'http://localhost:3000';
            const planRegenerateUrl = `${baseUrl}/api/plan/generate`;
            
            const response = await fetch(planRegenerateUrl, {
              method: 'GET',
              headers: {
                'X-Telegram-Init-Data': initData || '',
              },
              // Не устанавливаем таймаут на уровне fetch, пусть API сам управляет таймаутом
            });
            
            if (!response.ok) {
              logger.warn('Background plan generation returned non-OK status', { 
                userId, 
                status: response.status,
                statusText: response.statusText,
              });
            } else {
              const generatedPlan = await response.json();
              if (generatedPlan && generatedPlan.plan28) {
                logger.info('Background plan generation succeeded', { 
                  userId, 
                  profileVersion: profile.version,
                  planDays: generatedPlan.plan28?.days?.length || 0,
                });
              } else {
                logger.warn('Background plan generation returned empty result', { 
                  userId, 
                  profileVersion: profile.version 
                });
              }
            }
          } catch (bgError: any) {
            // Логируем ошибку, но не блокируем основной ответ
            logger.error('Background plan generation failed', bgError, { 
              userId, 
              profileVersion: profile.version,
              errorMessage: bgError?.message,
            });
          }
        };
        
        // Запускаем в фоне, не ждем завершения
        // Используем setTimeout(0) чтобы гарантировать, что это выполнится после ответа
        generatePlanInBackground().catch(err => {
          logger.warn('Background plan generation promise rejected', { userId, error: err });
        });
        
        logger.info('Background plan generation triggered (non-blocking)', { 
          userId, 
          profileVersion: profile.version 
        });
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
