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

    // ВАЖНО: Логируем полученные данные для диагностики
    logger.debug('Received answers submission', {
      userId,
      questionnaireId,
      answersCount: Array.isArray(answers) ? answers.length : 0,
      answersType: Array.isArray(answers) ? 'array' : typeof answers,
      answerQuestionIds: Array.isArray(answers) ? answers.map((a: any) => a.questionId) : [],
      answerSample: Array.isArray(answers) ? answers.slice(0, 3) : answers,
    });

    if (!questionnaireId || !Array.isArray(answers)) {
      logger.error('Invalid request body', {
        userId,
        hasQuestionnaireId: !!questionnaireId,
        questionnaireId,
        answersType: typeof answers,
        isArray: Array.isArray(answers),
        answers,
      });
      return ApiResponse.badRequest('Invalid request body');
    }
    
    // ВАЖНО: Проверяем, что все ответы имеют валидный questionId
    const invalidAnswers = answers.filter((a: any) => !a.questionId || typeof a.questionId !== 'number' || a.questionId <= 0);
    if (invalidAnswers.length > 0) {
      logger.error('Invalid answers found (missing or invalid questionId)', {
        userId,
        questionnaireId,
        invalidAnswersCount: invalidAnswers.length,
        invalidAnswers,
        validAnswersCount: answers.length - invalidAnswers.length,
      });
      // Продолжаем обработку, но логируем проблему
    }
    
    // Фильтруем только валидные ответы
    const validAnswers = answers.filter((a: any) => a.questionId && typeof a.questionId === 'number' && a.questionId > 0);
    
    if (validAnswers.length === 0) {
      logger.error('No valid answers to process', {
        userId,
        questionnaireId,
        totalAnswers: answers.length,
        invalidAnswers: invalidAnswers.length,
      });
      return ApiResponse.badRequest('No valid answers provided');
    }
    
    logger.debug('Processing valid answers', {
      userId,
      questionnaireId,
      validAnswersCount: validAnswers.length,
      validQuestionIds: validAnswers.map((a: any) => a.questionId),
    });

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

    // ИСПРАВЛЕНО: Проверяем дубликат только если есть профиль
    // Если профиля нет, но есть ответы - это означает, что анкета не была завершена
    // В этом случае нужно создать профиль, а не возвращать дубликат
    const existingProfileBeforeTransaction = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    
    if (recentSubmission && existingProfileBeforeTransaction) {
      const timeSinceSubmission = Date.now() - new Date(recentSubmission.createdAt).getTime();
      // Если ответ был отправлен менее чем 5 секунд назад И профиль уже существует - это вероятно дубликат
      if (timeSinceSubmission < 5000) {
        logger.warn('Possible duplicate submission detected (profile exists)', {
          userId,
          questionnaireId,
          timeSinceSubmission,
          lastSubmissionId: recentSubmission.id,
          profileId: existingProfileBeforeTransaction.id,
        });
        
        // Возвращаем успешный ответ, чтобы избежать ошибки 301 и повторной обработки
        return ApiResponse.success({
          success: true,
          message: 'Answers already submitted',
          profile: {
            id: existingProfileBeforeTransaction.id,
            version: existingProfileBeforeTransaction.version,
          },
          isDuplicate: true,
        });
      }
    }
    
    // ИСПРАВЛЕНО: Если профиля нет, но есть ответы - продолжаем создание профиля
    // Это может быть случай, когда пользователь начал анкету, но не завершил её
    if (!existingProfileBeforeTransaction && recentSubmission) {
      logger.info('Profile does not exist, but answers found - will create profile', {
        userId,
        questionnaireId,
        answersCount: validAnswers.length,
      });
    }

    // ВАЖНО: Логируем перед началом транзакции
    logger.debug('Starting transaction for answers submission', {
      userId,
      questionnaireId,
      validAnswersCount: validAnswers.length,
      validQuestionIds: validAnswers.map((a: any) => a.questionId),
    });
    
    // Используем транзакцию для атомарности операций
    let transactionResult: { savedAnswers: any[]; fullAnswers: any[]; profile: any; existingProfile: any | null };
    try {
      transactionResult = await prisma.$transaction(async (tx) => {
      // ВАЖНО: Логируем внутри транзакции
      logger.debug('Inside transaction, starting to save answers', {
        userId,
        questionnaireId,
        validAnswersCount: validAnswers.length,
      });
      // Сохраняем или обновляем ответы (upsert для избежания дубликатов)
      // ВАЖНО: Используем validAnswers вместо answers
      // ВАЖНО: Логируем количество ответов для диагностики
      logger.debug('Saving answers in transaction', {
        userId,
        questionnaireId,
        answersCount: validAnswers.length,
        answerQuestionIds: validAnswers.map((a: any) => a.questionId),
      });
      
      const savedAnswers = await Promise.all(
        validAnswers.map(async (answer: AnswerInput) => {
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
            // ВАЖНО: Сохраняем answerValue как есть (включая пустую строку), только undefined преобразуем в null
            const updated = await tx.userAnswer.update({
              where: { id: existingAnswer.id },
              data: {
                answerValue: answer.answerValue !== undefined ? answer.answerValue : null,
                answerValues: answer.answerValues !== undefined ? (answer.answerValues as any) : null,
              },
              include: {
                question: {
                  include: {
                    answerOptions: true,
                  },
                },
              },
            });
            logger.debug('Answer updated', {
              userId,
              questionId: answer.questionId,
              answerValue: answer.answerValue,
              answerValues: answer.answerValues,
            });
            return updated;
          } else {
            // Создаем новый ответ
            // ВАЖНО: Сохраняем answerValue как есть (включая пустую строку), только undefined преобразуем в null
            const created = await tx.userAnswer.create({
              data: {
                userId: userId!,
                questionnaireId,
                questionId: answer.questionId,
                answerValue: answer.answerValue !== undefined ? answer.answerValue : null,
                answerValues: answer.answerValues !== undefined ? (answer.answerValues as any) : null,
              },
              include: {
                question: {
                  include: {
                    answerOptions: true,
                  },
                },
              },
            });
            logger.debug('Answer created', {
              userId,
              questionId: answer.questionId,
              answerValue: answer.answerValue,
              answerValues: answer.answerValues,
            });
            return created;
          }
        })
      );
      
      logger.debug('All answers saved in transaction', {
        userId,
        savedAnswersCount: savedAnswers.length,
        savedQuestionIds: savedAnswers.map(a => a.questionId),
      });

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
      // ВАЖНО: Логируем перед вызовом createSkinProfile для диагностики
      logger.debug('Creating skin profile', {
        userId,
        questionnaireId,
        fullAnswersCount: fullAnswers.length,
        questionnaireVersion: questionnaire.version,
      });
      
      let profileData;
      try {
        profileData = createSkinProfile(
          userId!, // userId гарантированно string в транзакции
          questionnaireId,
          fullAnswers,
          questionnaire.version
        );
        logger.debug('Skin profile calculated successfully', {
          userId,
          skinType: profileData.skinType,
          sensitivityLevel: profileData.sensitivityLevel,
        });
      } catch (profileCalcError: any) {
        logger.error('Error calculating skin profile', profileCalcError, {
          userId,
          questionnaireId,
          fullAnswersCount: fullAnswers.length,
        });
        // Пробрасываем ошибку, чтобы транзакция откатилась
        throw profileCalcError;
      }

      // Сохраняем или обновляем профиль
      // ВАЖНО: Ищем последний профиль пользователя (не по questionnaire.version, а по последней версии)
      // Это нужно для правильной обработки повторных отправок анкеты
      // ИСПРАВЛЕНО: Используем existingProfileBeforeTransaction, если он есть, иначе ищем в транзакции
      const existingProfile = existingProfileBeforeTransaction 
        ? await tx.skinProfile.findUnique({
            where: { id: existingProfileBeforeTransaction.id },
          })
        : await tx.skinProfile.findFirst({
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
      // ВАЖНО: Валидируем данные перед созданием профиля
      // Проверяем, что все обязательные поля присутствуют
      if (!profileData.skinType) {
        logger.error('CRITICAL: skinType is missing in profileData', {
          userId,
          questionnaireId,
          profileData,
        });
        throw new Error('skinType is required for profile creation');
      }
      
      if (!profileData.sensitivityLevel) {
        logger.error('CRITICAL: sensitivityLevel is missing in profileData', {
          userId,
          questionnaireId,
          profileData,
        });
        throw new Error('sensitivityLevel is required for profile creation');
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
      
      // ВАЖНО: Логируем данные перед созданием профиля для диагностики
      logger.debug('Profile data for Prisma', {
        userId,
        questionnaireId,
        skinType: profileDataForPrisma.skinType,
        sensitivityLevel: profileDataForPrisma.sensitivityLevel,
        acneLevel: profileDataForPrisma.acneLevel,
        dehydrationLevel: profileDataForPrisma.dehydrationLevel,
        hasMedicalMarkers: !!profileDataForPrisma.medicalMarkers,
        newVersion,
      });
      
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
      let profile: any = null; // ИСПРАВЛЕНО: Инициализируем как null для проверки
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
      
      // ВАЖНО: Проверяем, что профиль был создан/обновлен
      if (!profile || !profile.id) {
        logger.error('CRITICAL: Profile was not created/updated in transaction', {
          userId,
          questionnaireId,
          hasProfile: !!profile,
          profileId: profile?.id,
          existingProfileId: existingProfile?.id,
          newVersion,
        });
        throw new Error('Profile was not created/updated in transaction');
      }

      // ВАЖНО: Логируем перед возвратом из транзакции
      logger.debug('Transaction about to complete', {
        userId,
        questionnaireId,
        hasProfile: !!profile,
        profileId: profile?.id,
        savedAnswersCount: savedAnswers?.length || 0,
        fullAnswersCount: fullAnswers?.length || 0,
      });
      
      return { savedAnswers, fullAnswers, profile, existingProfile };
      }, {
        timeout: 30000, // 30 секунд таймаут для транзакции
      });
      
      // ВАЖНО: Логируем сразу после завершения транзакции
      logger.debug('Transaction completed, extracting result', {
        userId,
        questionnaireId,
        hasTransactionResult: !!transactionResult,
      });
      
      // Извлекаем результат транзакции
      const { savedAnswers, fullAnswers, profile, existingProfile } = transactionResult;
      
      // ВАЖНО: Логируем сразу после извлечения результата
      logger.debug('Transaction result extracted', {
        userId,
        questionnaireId,
        hasProfile: !!profile,
        profileId: profile?.id,
        profileVersion: profile?.version,
        savedAnswersCount: savedAnswers?.length || 0,
        fullAnswersCount: fullAnswers?.length || 0,
      });
      
      // ВАЖНО: Проверяем, что профиль был создан/обновлен
      if (!profile || !profile.id) {
        logger.error('CRITICAL: Profile was not created/updated in transaction', {
          userId,
          questionnaireId,
          hasProfile: !!profile,
          profileId: profile?.id,
          savedAnswersCount: savedAnswers?.length || 0,
        });
        throw new Error('Profile was not created/updated in transaction');
      }
      
      logger.info('✅ Transaction completed successfully', {
        userId,
        profileId: profile.id,
        profileVersion: profile.version,
        savedAnswersCount: savedAnswers?.length || 0,
      });
    } catch (transactionError: any) {
      // Логируем ошибку транзакции детально
      logger.error('CRITICAL: Transaction failed', transactionError, {
        userId,
        questionnaireId,
        errorCode: transactionError?.code,
        errorMessage: transactionError?.message,
        errorMeta: transactionError?.meta,
        stack: transactionError?.stack?.substring(0, 500),
      });
      
      // Пробрасываем ошибку дальше, чтобы вернуть правильный HTTP статус
      throw transactionError;
    }
    
    // Извлекаем результат после успешной транзакции
    const { savedAnswers, fullAnswers, profile, existingProfile } = transactionResult;
    
    // Очищаем кэш плана и рекомендаций при обновлении профиля (вне транзакции)
    if (existingProfile && existingProfile.version !== profile.version) {
      logger.info('Profile updated, clearing cache and RecommendationSession', { 
        userId: userId || undefined, 
        oldVersion: existingProfile.version, 
        newVersion: profile.version,
        isRetaking: !!existingProfile, // Это перепрохождение анкеты
      });
      try {
        const { invalidateCache, invalidateAllUserCache } = await import('@/lib/cache');
        // Очищаем кэш для старой версии
        await invalidateCache(userId, existingProfile.version);
        // Также очищаем кэш для новой версии, чтобы план перегенерировался
        await invalidateCache(userId, profile.version);
        // ВАЖНО: Также очищаем весь кэш пользователя для гарантии (все версии)
        // Это предотвращает загрузку старого плана из кэша
        await invalidateAllUserCache(userId);
        logger.info('Cache cleared for old and new profile versions, plus all user cache', { 
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
        
        // ВАЖНО: Также удаляем старый прогресс плана, чтобы не было конфликтов
        await prisma.planProgress.deleteMany({
          where: { userId },
        });
        logger.info('PlanProgress deleted for plan regeneration', { userId });
        
        // ВАЖНО: Генерацию плана переносим ПОСЛЕ создания RecommendationSession
        // Это гарантирует, что план будет использовать продукты из новой сессии
        // Генерация плана будет выполнена после создания RecommendationSession (см. ниже)
      } catch (cacheError: any) {
        // NOPERM ошибки - это ожидаемо, если используется read-only токен
        // Не критично, так как кэш будет обновлен при следующей генерации плана
        if (cacheError?.message?.includes('NOPERM') || cacheError?.message?.includes('no permissions')) {
          logger.info('Cache invalidation skipped (read-only token, non-critical)', { userId });
        } else {
          logger.warn('Failed to clear cache', { error: cacheError, userId });
        }
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
        
        // ИСПРАВЛЕНО: Увеличиваем количество продуктов на шаг для более полных рекомендаций
        // Дерматологическая логика: для каждого шага берем 3-5 продуктов вместо 1-3
        // ВАЖНО: Теперь все обязательные шаги (toner, serum) уже есть в правилах в БД,
        // поэтому не нужно добавлять их программно
        const enhancedStepsJson: Record<string, any> = { ...stepsJson };
        
        // Увеличиваем max_items для всех шагов
        for (const [stepName, stepConfig] of Object.entries(enhancedStepsJson)) {
          const step = stepConfig as any;
          // Увеличиваем max_items: минимум 3, максимум 5 для каждого шага
          if (!step.max_items || step.max_items < 3) {
            step.max_items = 3;
          } else if (step.max_items > 5) {
            step.max_items = 5;
          }
        }
        
        // Используем только шаги из правила (все обязательные шаги уже добавлены в БД)
        const allSteps = enhancedStepsJson;
        
        for (const [stepName, stepConfig] of Object.entries(allSteps)) {
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
        
        // ИСПРАВЛЕНО: Детальное логирование подбора средств для диагностики
        logger.info('Final product selection summary', {
          userId,
          totalProductIds: productIds.length,
          uniqueProductIds: productIds,
          stepsCount: Object.keys(stepsJson).length,
          hasProducts: productIds.length > 0,
          userBudget,
          userPriceSegment,
          ruleId: matchedRule.id,
          ruleName: matchedRule.name,
        });
        
        // ВАЖНО: Проверяем, что средства подобраны
        if (productIds.length === 0) {
          logger.error('❌ No products selected for RecommendationSession', {
            userId,
            profileId: profile.id,
            ruleId: matchedRule.id,
            stepsCount: Object.keys(stepsJson).length,
            userBudget,
            userPriceSegment,
          });
        } else {
          logger.info('✅ Products successfully selected', {
            userId,
            productCount: productIds.length,
            productIds: productIds.slice(0, 20), // Первые 20 для логирования
          });
        }

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
        } catch (cacheError: any) {
          // NOPERM ошибки - это ожидаемо, если используется read-only токен
          // Не критично, так как кэш будет обновлен при следующей генерации плана
          if (cacheError?.message?.includes('NOPERM') || cacheError?.message?.includes('no permissions')) {
            // Не логируем NOPERM ошибки, так как они не критичны
          } else {
            logger.warn('Failed to invalidate recommendations cache', { error: cacheError });
          }
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
        
        // ГАРАНТИРУЕМ наличие обязательных шагов: cleanser, toner, moisturizer, spf
        // Остальное (serum, treatment и т.д.) только по потребностям (правилам)
        // ВАЖНО: Используем расширенные названия шагов (cleanser_gentle, toner_hydrating и т.д.)
        const stepPatterns: Record<string, string[]> = {
          'cleanser': ['cleanser_gentle', 'cleanser_balancing', 'cleanser_deep'],
          'toner': ['toner_hydrating', 'toner_soothing'],
          'moisturizer': ['moisturizer_light', 'moisturizer_balancing', 'moisturizer_barrier', 'moisturizer_soothing'],
          'spf': ['spf_50_face', 'spf_50_oily', 'spf_50_sensitive'],
        };
        
        const requiredSteps = ['cleanser', 'toner', 'moisturizer', 'spf'];
        
        for (const step of requiredSteps) {
          const stepVariants = stepPatterns[step] || [step];
          let foundProduct = false;
          
          // Пробуем найти продукты по вариантам шага
          for (const stepVariant of stepVariants) {
            const products = await prisma.product.findMany({
              where: {
                published: true,
                step: stepVariant,
                brand: {
                  isActive: true,
                },
                // SPF универсален, для остальных учитываем тип кожи
                ...(step !== 'spf' && profile.skinType ? {
                  skinTypes: { has: profile.skinType },
                } : {}),
              } as any,
              take: 1,
              orderBy: [
                { isHero: 'desc' },
                { priority: 'desc' },
                { createdAt: 'desc' },
              ],
            });
            
            if (products.length > 0) {
              fallbackProductIds.push(products[0].id);
              logger.debug('Added fallback product', { 
                userId, 
                step, 
                stepVariant,
                productName: products[0].name,
                productId: products[0].id,
              });
              foundProduct = true;
              break; // Нашли продукт, переходим к следующему шагу
            }
          }
          
          if (!foundProduct) {
            logger.warn('No fallback product found for required step', { userId, step, stepVariants });
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
          
          // ИСПРАВЛЕНО: Детальное логирование fallback сессии
          logger.info('✅ Fallback RecommendationSession created', {
            userId,
            productCount: fallbackProductIds.length,
            productIds: fallbackProductIds,
            profileId: profile.id,
            profileVersion: profile.version,
            skinType: profile.skinType,
          });
        } else {
          // ИСПРАВЛЕНО: Детальное логирование ошибки отсутствия продуктов
          logger.error('❌ No products available for fallback session', { 
            userId,
            profileId: profile.id,
            profileVersion: profile.version,
            skinType: profile.skinType,
            requiredSteps,
          });
          // ИСПРАВЛЕНО: Если fallback сессия не создана из-за отсутствия продуктов - это критическая ошибка
          // Но не блокируем сохранение ответов - план может быть сгенерирован с базовыми продуктами
          logger.warn('⚠️ Fallback RecommendationSession could not be created - no products found. Plan may use all products.', {
            userId,
            profileId: profile.id,
            profileVersion: profile.version,
            skinType: profile.skinType,
          });
        }
      }
      
      // ИСПРАВЛЕНО: Проверяем, что RecommendationSession была создана
      const createdSession = await prisma.recommendationSession.findFirst({
        where: {
          userId,
          profileId: profile.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      
      if (createdSession) {
        logger.info('✅ RecommendationSession created successfully', {
          userId,
          profileId: profile.id,
          sessionId: createdSession.id,
          productsCount: Array.isArray(createdSession.products) ? createdSession.products.length : 0,
          ruleId: createdSession.ruleId,
        });
      } else {
        logger.warn('⚠️ RecommendationSession was not created after answers submission', {
          userId,
          profileId: profile.id,
          profileVersion: profile.version,
        });
      }
      
      // ВАЖНО: Генерируем план ПОСЛЕ создания RecommendationSession
      // Это гарантирует, что план будет использовать продукты из новой сессии
      // РЕШЕНИЕ ПРОБЛЕМЫ ДОЛГОЙ ГЕНЕРАЦИИ: Запускаем генерацию асинхронно в фоне
      // ВАЖНО: НЕ запускаем генерацию плана здесь!
      // Генерация плана запускается на клиенте в quiz/page.tsx после отправки ответов
      // Это гарантирует, что:
      // 1. План генерируется с правильными данными (ответы еще не удалены)
      // 2. Пользователь видит лоадер во время генерации
      // 3. Редирект происходит только когда план готов
      // 4. Ответы удаляются только после успешной генерации плана
      logger.info('Plan generation will be triggered by client after answers submission', { 
        userId, 
        profileVersion: profile.version,
        hasRecommendationSession: !!createdSession,
        sessionProductsCount: createdSession ? (Array.isArray(createdSession.products) ? createdSession.products.length : 0) : 0,
      });
    } catch (recommendationError) {
      // Не блокируем сохранение ответов, если рекомендации не создались
      logger.error('Error creating recommendations', recommendationError, { userId });
    }

    // ВАЖНО: НЕ удаляем ответы здесь!
    // Ответы нужны для генерации плана, которая запускается на клиенте
    // Ответы будут удалены только после успешной генерации плана в quiz/page.tsx
    // Это гарантирует, что план будет сгенерирован с правильными данными
    logger.info('Answers preserved for plan generation (will be cleared after plan is generated)', { userId });

    // ВАЖНО: Проверяем, что профиль действительно был создан/обновлен
    if (!profile || !profile.id) {
      logger.error('CRITICAL: Profile was not created/updated after transaction', {
        userId,
        questionnaireId,
        hasProfile: !!profile,
        profileId: profile?.id,
        savedAnswersCount: savedAnswers.length,
      });
      return ApiResponse.internalError(
        new Error('Profile was not created after saving answers'),
        { userId, questionnaireId, savedAnswersCount: savedAnswers.length }
      );
    }
    
    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId || undefined);

    logger.info('✅ Answers submitted and profile created successfully', {
      userId,
      profileId: profile.id,
      profileVersion: profile.version,
      answersCount: savedAnswers.length,
      duration,
    });

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
