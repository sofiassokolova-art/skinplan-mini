// app/api/questionnaire/answers/route.ts
// Сохранение ответов пользователя и расчет профиля

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { createSkinProfile } from '@/lib/profile-calculator';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { ApiResponse } from '@/lib/api-response';
import { MAX_DUPLICATE_SUBMISSION_WINDOW_MS } from '@/lib/constants';
import { buildSkinProfileFromAnswers } from '@/lib/skinprofile-rules-engine';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { logDbFingerprint } from '@/lib/db-fingerprint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AnswerInput {
  questionId: number;
  answerValue?: string;
  answerValues?: string[];
}

// ИСПРАВЛЕНО: Добавлен GET метод для получения ответов пользователя
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/questionnaire/answers';
  let userId: string | undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    // Получаем активную анкету
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!questionnaire) {
      return ApiResponse.notFound('No active questionnaire found');
    }

    // Получаем все ответы пользователя для этой анкеты
    const userAnswers = await prisma.userAnswer.findMany({
      where: {
        userId,
        question: {
          questionnaireId: questionnaire.id,
        },
      },
      include: {
        question: {
          select: {
            id: true,
            code: true,
            text: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    logApiRequest(method, path, 200, Date.now() - startTime, userId);
    return ApiResponse.success(userAnswers);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId || undefined);
    return ApiResponse.internalError(error, { userId: userId || undefined, method, path, duration });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/questionnaire/answers';
  let userId: string | undefined;

  try {
    // DEBUG: Логируем DB fingerprint для диагностики разных БД
    // Используем console.warn для гарантированного вывода в Vercel logs
    console.warn('🔍 [QUESTIONNAIRE/ANSWERS] Starting DB fingerprint check...');
    const fingerprintAtStart = await logDbFingerprint('/api/questionnaire/answers');
    console.warn('🔍 [QUESTIONNAIRE/ANSWERS] DB fingerprint at start:', JSON.stringify(fingerprintAtStart, null, 2));
    
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    const body = await request.json();
    const { questionnaireId, answers, clientSubmissionId } = body as {
      questionnaireId: number;
      answers: AnswerInput[];
      clientSubmissionId?: string | null;
    };

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

    // Идемпотентность: если клиент прислал clientSubmissionId и мы уже обрабатывали этот сабмит,
    // сразу возвращаем существующий результат без повторной тяжелой работы.
    if (clientSubmissionId) {
      try {
        const existingSubmission = await (prisma as any).questionnaireSubmission.findUnique({
          where: {
            userId_questionnaireId_clientSubmissionId: {
              userId,
              questionnaireId,
              clientSubmissionId,
            },
          },
        });

        if (existingSubmission && existingSubmission.profileId && existingSubmission.profileVersion !== null) {
          logger.info('Idempotent questionnaire submission detected, returning existing profile', {
            userId,
            questionnaireId,
            clientSubmissionId,
            profileId: existingSubmission.profileId,
            profileVersion: existingSubmission.profileVersion,
          });

          const existingProfile = await prisma.skinProfile.findUnique({
            where: { id: existingSubmission.profileId },
          });

          if (existingProfile) {
            const duration = Date.now() - startTime;
            logApiRequest(method, path, 200, duration, userId || undefined);

            return ApiResponse.success({
              success: true,
              profile: {
                id: existingProfile.id,
                version: existingProfile.version,
                skinType: existingProfile.skinType,
                sensitivityLevel: existingProfile.sensitivityLevel,
                acneLevel: existingProfile.acneLevel,
                dehydrationLevel: existingProfile.dehydrationLevel,
                rosaceaRisk: existingProfile.rosaceaRisk,
                pigmentationRisk: existingProfile.pigmentationRisk,
                ageGroup: existingProfile.ageGroup,
                notes: existingProfile.notes,
              },
              answersCount: undefined,
              isDuplicate: true,
            });
          }
        }
      } catch (idempotencyCheckError) {
        logger.warn('Failed to check questionnaire submission idempotency, continuing as new submission', {
          userId,
          questionnaireId,
          clientSubmissionId,
          error: (idempotencyCheckError as any)?.message,
        });
      }
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

    // ИСПРАВЛЕНО: Серверная валидация критических медицинских условий
    // Не доверяем UI фильтрации - проверяем на сервере
    const validateMedicalConditions = async () => {
      // Получаем все вопросы анкеты для проверки кодов
      const allQuestions = await prisma.question.findMany({
        where: { questionnaireId },
        select: { id: true, code: true, type: true, answerOptions: true },
      });

      // Создаем мапу ответов по questionId
      const answersMap = new Map<number, { value?: string; values?: string[] }>();
      validAnswers.forEach((a: AnswerInput) => {
        answersMap.set(a.questionId, { value: a.answerValue, values: a.answerValues });
      });

      // Находим вопрос про пол
      const genderQuestion = allQuestions.find(q => q.code === 'gender' || q.code === 'sex');
      const genderAnswer = genderQuestion ? answersMap.get(genderQuestion.id) : null;
      
      // Определяем, является ли пользователь мужчиной
      const isMale = (() => {
        if (!genderAnswer || !genderQuestion) return false;
        const value = genderAnswer.value || (Array.isArray(genderAnswer.values) ? genderAnswer.values[0] : null);
        if (!value) return false;
        
        const option = genderQuestion.answerOptions?.find((opt: any) => 
          opt.id.toString() === value || 
          opt.value === value ||
          opt.value?.toLowerCase() === value?.toLowerCase() ||
          opt.label?.toLowerCase().includes('мужск') ||
          opt.label?.toLowerCase().includes('male')
        );
        
        const normalizedValue = String(value).toLowerCase();
        return normalizedValue.includes('мужск') || 
               normalizedValue.includes('male') ||
               normalizedValue === 'gender_2' ||
               normalizedValue === '137' ||
               option?.label?.toLowerCase().includes('мужск') ||
               option?.label?.toLowerCase().includes('male') ||
               option?.value?.toLowerCase().includes('мужск') ||
               option?.value?.toLowerCase().includes('male');
      })();

      // Проверяем вопрос про беременность - не должен быть у мужчин
      const pregnancyQuestion = allQuestions.find(q => 
        q.code === 'pregnancy' || 
        q.code === 'pregnancy_breastfeeding' ||
        q.code === 'pregnancy_breastfeeding_status'
      );
      if (pregnancyQuestion && isMale) {
        const pregnancyAnswer = answersMap.get(pregnancyQuestion.id);
        if (pregnancyAnswer && (pregnancyAnswer.value || (pregnancyAnswer.values && pregnancyAnswer.values.length > 0))) {
          logger.warn('CRITICAL: Male user has pregnancy answer - removing invalid answer', {
            userId,
            questionId: pregnancyQuestion.id,
            questionCode: pregnancyQuestion.code,
          });
          // Удаляем невалидный ответ из validAnswers
          const index = validAnswers.findIndex((a: AnswerInput) => a.questionId === pregnancyQuestion.id);
          if (index >= 0) {
            validAnswers.splice(index, 1);
          }
        }
      }

      // Проверяем вопрос про ретинол - должен быть только если используется ретинол
      const retinoidUsageQuestion = allQuestions.find(q => 
        q.code === 'retinoid_usage' || 
        q.code === 'retinol_usage' ||
        q.code === 'retinoid_current'
      );
      const retinoidReactionQuestion = allQuestions.find(q => 
        q.code === 'retinoid_reaction' || 
        q.code === 'retinol_reaction'
      );
      
      if (retinoidUsageQuestion && retinoidReactionQuestion) {
        const retinoidUsageAnswer = answersMap.get(retinoidUsageQuestion.id);
        const retinoidReactionAnswer = answersMap.get(retinoidReactionQuestion.id);
        
        // Проверяем, использует ли пользователь ретинол
        const usesRetinoid = (() => {
          if (!retinoidUsageAnswer) return false;
          const value = retinoidUsageAnswer.value || (Array.isArray(retinoidUsageAnswer.values) ? retinoidUsageAnswer.values[0] : null);
          if (!value) return false;
          
          const option = retinoidUsageQuestion.answerOptions?.find((opt: any) => 
            opt.id.toString() === value || 
            opt.value === value ||
            opt.value?.toLowerCase() === value?.toLowerCase()
          );
          
          const normalizedValue = String(value).toLowerCase();
          const optionValue = option?.value?.toLowerCase() || '';
          const optionLabel = option?.label?.toLowerCase() || '';
          
          return normalizedValue === 'yes' || 
                 optionValue === 'yes' ||
                 optionLabel.includes('да') ||
                 optionLabel.includes('использую') ||
                 optionLabel.includes('yes');
        })();
        
        // Если не использует ретинол, но есть ответ на реакцию - удаляем
        if (!usesRetinoid && retinoidReactionAnswer && 
            (retinoidReactionAnswer.value || (retinoidReactionAnswer.values && retinoidReactionAnswer.values.length > 0))) {
          logger.warn('CRITICAL: User does not use retinoid but has reaction answer - removing invalid answer', {
            userId,
            questionId: retinoidReactionQuestion.id,
            questionCode: retinoidReactionQuestion.code,
          });
          // Удаляем невалидный ответ из validAnswers
          const index = validAnswers.findIndex((a: AnswerInput) => a.questionId === retinoidReactionQuestion.id);
          if (index >= 0) {
            validAnswers.splice(index, 1);
          }
        }
      }
    };

    // Выполняем валидацию перед транзакцией
    await validateMedicalConditions();

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
          // Используем upsert по уникальному ключу (userId, questionnaireId, questionId),
          // чтобы при гонках не создавать дублирующие ответы
          const upserted = await (tx.userAnswer as any).upsert({
            where: {
              userId_questionnaireId_questionId: {
                userId: userId!,
              questionnaireId,
              questionId: answer.questionId,
            },
            },
            update: {
            // ВАЖНО: Сохраняем answerValue как есть (включая пустую строку), только undefined преобразуем в null
                answerValue: answer.answerValue !== undefined ? answer.answerValue : null,
                answerValues: answer.answerValues !== undefined ? (answer.answerValues as any) : null,
              },
            create: {
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

          logger.debug('Answer upserted', {
              userId,
              questionId: answer.questionId,
              answerValue: answer.answerValue,
              answerValues: answer.answerValues,
            });

          return upserted;
        })
      );
      
      logger.debug('All answers saved in transaction', {
        userId,
        savedAnswersCount: savedAnswers.length,
        savedQuestionIds: savedAnswers.map(a => a.questionId),
      });

      // ИСПРАВЛЕНО: Сохраняем имя пользователя из ответа на вопрос USER_NAME
      const nameAnswer = (savedAnswers as any[]).find(a => a.question?.code === 'USER_NAME');
      if (nameAnswer && nameAnswer.answerValue && String(nameAnswer.answerValue).trim().length > 0) {
        const userName = String(nameAnswer.answerValue).trim();
        // ВАЖНО: ограничиваем select, чтобы не падать при рассинхроне схемы БД
        await tx.user.update({
          where: { id: userId! },
          data: { firstName: userName },
          select: { id: true },
        });
        logger.info('User name saved', {
          userId,
          firstName: userName,
        });
      }

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

      // ИСПРАВЛЕНО: Извлекаем mainGoals через buildSkinProfileFromAnswers для правильного маппинга values -> labels
      // Преобразуем ответы в формат для buildSkinProfileFromAnswers
      const rawAnswers = fullAnswers.map(answer => {
        let answerOptionLabels: string[] | undefined;
        
        // Если есть answerValues (массив values опций), маппим их на labels
        if (answer.answerValues && Array.isArray(answer.answerValues) && answer.question?.answerOptions) {
          answerOptionLabels = answer.answerValues
            .filter((val): val is string => typeof val === 'string')
            .map((val: string) => {
              const option = answer.question!.answerOptions.find(opt => opt.value === val);
              // Используем label, если есть, иначе value
              return option?.label || val;
            })
            .filter(Boolean);
        } else if (answer.answerValue && answer.question?.answerOptions) {
          // ИСПРАВЛЕНО: Для single_choice тоже маппим value на label
          // Это важно для правил, которые ищут опции по label (например, бюджет)
          const option = answer.question.answerOptions.find(opt => opt.value === answer.answerValue);
          if (option?.label) {
            answerOptionLabels = [option.label];
          }
        }
        
        return {
          questionId: answer.questionId,
          questionCode: answer.question?.code,
          answerValue: answer.answerValue,
          answerValues: answer.answerValues,
          answerOptionLabels,
        };
      });
      
      // Применяем правила для извлечения mainGoals
      const profileFromRules = buildSkinProfileFromAnswers(rawAnswers);
      
      // ВАЖНО: Извлекаем diagnoses и другие данные из ответов напрямую
      // createSkinProfile не извлекает diagnoses, поэтому делаем это здесь
      const diagnosesAnswer = fullAnswers.find(a => a.question?.code === 'diagnoses' || a.question?.code === 'DIAGNOSES');
      
      const extractedData: any = {};
      if (diagnosesAnswer && Array.isArray(diagnosesAnswer.answerValues)) {
        extractedData.diagnoses = diagnosesAnswer.answerValues;
      }
      // ИСПРАВЛЕНО: Используем mainGoals из buildSkinProfileFromAnswers вместо concernsAnswer
      if (profileFromRules.mainGoals && Array.isArray(profileFromRules.mainGoals) && profileFromRules.mainGoals.length > 0) {
        extractedData.mainGoals = profileFromRules.mainGoals;
      }

      // ВАЖНО: Профили делаем append-only: каждая отправка анкеты создает НОВУЮ версию профиля,
      // старые записи не перезаписываются.
      // Берём последнюю версию и инкрементируем её; если профиля не было — стартуем с версии анкеты.
      const lastVersion = existingProfile?.version ?? 0;
      const newVersion = lastVersion > 0 ? lastVersion + 1 : questionnaire.version;
      
      // Подготавливаем данные для Prisma
      // При повторном прохождении анкеты сохраняем некоторые данные из старого профиля
      const existingMarkers = (existingProfile?.medicalMarkers as any) || {};
      const mergedMarkers = {
        ...existingMarkers,
        ...(profileData.medicalMarkers ? (profileData.medicalMarkers as any) : {}),
        // ВАЖНО: Перезаписываем diagnoses и mainGoals из новых ответов
        ...extractedData,
      };
      // ИСПРАВЛЕНО: Сохраняем gender из старого профиля при retake (immutable contract)
      // Gender устанавливается один раз при первом прохождении и не изменяется при retake
      // Это обеспечивает консистентность: пол не может измениться между прохождениями
      if (existingMarkers?.gender) {
        mergedMarkers.gender = existingMarkers.gender;
        logger.info('Gender preserved from existing profile (immutable)', {
          userId,
          gender: existingMarkers.gender,
          oldVersion: existingProfile?.version,
          newVersion: newVersion,
        });
      } else {
        // Если gender нет в старом профиле, пытаемся извлечь из текущих ответов
        const genderAnswer = fullAnswers.find((a: any) => 
          a.question?.code === 'gender' || a.question?.code === 'sex'
        );
        if (genderAnswer) {
          const genderValue = genderAnswer.answerValue || 
            (Array.isArray(genderAnswer.answerValues) ? genderAnswer.answerValues[0] : null);
          if (genderValue) {
            // Нормализуем gender для хранения
            const normalizedGender = String(genderValue).toLowerCase().includes('мужск') || 
                                    String(genderValue).toLowerCase().includes('male') ||
                                    String(genderValue) === 'gender_2' ||
                                    String(genderValue) === '137'
              ? 'male' : 'female';
            mergedMarkers.gender = normalizedGender;
            logger.info('Gender extracted from answers (first pass)', {
              userId,
              gender: normalizedGender,
              rawValue: genderValue,
            });
          }
        }
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
      
      // ВАЖНО: Создаём НОВУЮ запись профиля (append‑only).
      // При гонке (два запроса одновременно) одна из вставок может поймать P2002 по (userId, version) —
      // в этом случае просто используем уже созданный профиль.
      let profile: any = null;
      try {
        logger.debug('Attempting to create new profile version (append-only)', {
          userId,
          hasExistingProfile: !!existingProfile,
          existingProfileId: existingProfile?.id,
          newVersion,
          profileDataKeys: Object.keys(profileDataForPrisma),
        });
        
        // КРИТИЧНО: Логируем перед созданием профиля
        console.warn('🔍 [TX] About to create profile', JSON.stringify({
          userId,
          newVersion,
          hasProfileData: !!profileDataForPrisma,
          skinType: profileDataForPrisma.skinType,
        }, null, 2));
        
        profile = await tx.skinProfile.create({
              data: {
                userId: userId!,
                version: newVersion,
                ...profileDataForPrisma,
              },
            });
        
        // КРИТИЧНО: Логируем сразу после создания
        console.warn('🔍 [TX] Profile created', JSON.stringify({
          profileId: profile.id,
          userId: profile.userId,
          version: profile.version,
        }, null, 2));
        
        // КРИТИЧНО: Проверяем, что профиль виден ВНУТРИ транзакции сразу после создания
        const profileInTx = await tx.skinProfile.findUnique({
          where: { id: profile.id },
          select: { id: true, userId: true, version: true },
        });
        
        console.warn('🔍 [TX] Profile lookup result', JSON.stringify({
          profileId: profile.id,
          foundInTx: !!profileInTx,
          profileInTx: profileInTx,
        }, null, 2));
        
        // DEBUG: Проверяем, что запись реально создана в транзакции
        const countInsideTx = await tx.skinProfile.count({ where: { userId: userId! } });
        const debugInfo = { 
          userId, 
          createdId: profile.id, 
          countInsideTx,
          profileVersion: profile.version,
          foundInTx: !!profileInTx,
          profileInTx: profileInTx,
        };
        // Логируем через console.warn для гарантированного вывода в Vercel
        console.warn('🔍 DEBUG: profiles count inside TX after create', JSON.stringify(debugInfo, null, 2));
        logger.warn('DEBUG: profiles count inside TX after create', debugInfo);
        
        // КРИТИЧНО: Если профиль не виден в транзакции - это серьезная проблема
        if (!profileInTx) {
          logger.error('CRITICAL: Profile not visible in transaction after create', {
            userId,
            createdProfileId: profile.id,
            profileVersion: profile.version,
            countInsideTx,
          });
          throw new Error('Profile not visible in transaction after create - possible transaction isolation issue');
        }
        
        // DEBUG: Проверяем идентичность БД
        try {
          const dbIdentity = await tx.$queryRaw<Array<{ current_database: string; current_schema: string }>>`
            SELECT current_database() as current_database, current_schema() as current_schema
          `;
          logger.warn('DEBUG: DB identity in questionnaire/answers', { 
            userId,
            dbIdentity: dbIdentity[0],
          });
        } catch (dbIdentityError) {
          logger.warn('DEBUG: Failed to get DB identity', { error: (dbIdentityError as any)?.message });
        }
        
        // ИСПРАВЛЕНО: Обновляем currentProfileId в User для быстрого доступа к текущему профилю
        // Но не ломаем транзакцию, если миграция в БД не применена и колонки нет.
        try {
          await (tx.user as any).update({
            where: { id: userId! },
            data: { currentProfileId: profile.id },
            select: { id: true },
          });
        } catch (err: any) {
          if (
            err?.code === 'P2022' &&
            (err?.meta?.column === 'users.current_profile_id' ||
              (typeof err?.message === 'string' && err.message.includes('current_profile_id')))
          ) {
            logger.warn('users.current_profile_id missing in DB; skipping currentProfileId update', {
              userId,
              profileId: profile.id,
            });
          } else {
            throw err;
          }
        }
        
        logger.debug('Profile created successfully (append-only)', {
          userId,
          profileId: profile?.id,
          version: profile?.version,
          previousVersion: existingProfile?.version,
        });
      } catch (updateError: any) {
        // Если возникла ошибка уникальности по (userId, version), значит профиль уже был создан параллельным запросом.
        if (updateError?.code === 'P2002' && updateError?.meta?.target?.includes('user_id') && updateError?.meta?.target?.includes('version')) {
          logger.warn('Unique constraint error during profile create (race condition), fetching existing profile version', {
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
            // Используем уже созданный профиль как результат
            profile = raceConditionProfile;
            logger.info('Existing profile version reused after race condition', {
              userId,
              profileId: profile.id,
              version: profile.version,
            });
          } else {
            // Если профиль не найден, пробуем fallback: берем последний доступный профиль
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
    
    // ИСПРАВЛЕНО: Всегда очищаем кэш после создания/обновления профиля
    // Критично: даже при первом создании профиля нужно очистить кэш,
    // иначе старый кэш "нет профиля/нет плана" будет возвращаться.
    //
    // ВАЖНО: нельзя делать "массовое" удаление 1..100 версий — это даёт огромный шлейф DEL в Redis,
    // замедляет ответ /api/questionnaire/answers и может создавать гонки с генерацией плана.
    // Достаточно удалить:
    // - версию 1 (исторически там мог закэшироваться ответ "нет профиля/нет плана")
    // - старую версию (если обновление профиля)
    // - новую версию (текущая)
    const isFirstProfile = !existingProfile;
    const isProfileUpdated = existingProfile && existingProfile.version !== profile.version;
    
    if (isFirstProfile || isProfileUpdated) {
      logger.info('Profile created/updated, clearing cache', { 
        userId: userId || undefined, 
        isFirstProfile,
        isProfileUpdated,
        oldVersion: existingProfile?.version, 
        newVersion: profile.version,
      });
      
      try {
        const { invalidateCache } = await import('@/lib/cache');
        
        // Минимальная, но достаточная инвалидация.
        await invalidateCache(userId, 1);
        await invalidateCache(userId, profile.version);
        
        // Если это обновление (не первый профиль) - также очищаем кэш для старой версии
        if (isProfileUpdated && existingProfile) {
          await invalidateCache(userId, existingProfile.version);
          logger.info('Cache cleared for old and new profile versions', { 
          userId, 
          oldVersion: existingProfile.version,
          newVersion: profile.version,
        });
        
        // ИСПРАВЛЕНО: Удаляем старую RecommendationSession и PlanProgress по userId
        // Семантика: при создании нового профиля (новая версия) удаляем ВСЕ сессии и прогресс пользователя
        // Это гарантирует чистый старт для новой версии профиля
        // Новая сессия будет создана позже через /api/recommendations или /api/plan/generate
        await prisma.recommendationSession.deleteMany({
          where: { userId },
        });
        logger.info('RecommendationSession deleted for plan regeneration (all user sessions)', { 
          userId,
          oldProfileVersion: existingProfile.version,
          newProfileVersion: profile.version,
        });
        
        // ВАЖНО: Также удаляем старый прогресс плана, чтобы не было конфликтов
        await prisma.planProgress.deleteMany({
          where: { userId },
        });
        logger.info('PlanProgress deleted for plan regeneration (all user progress)', { 
          userId,
          oldProfileVersion: existingProfile.version,
          newProfileVersion: profile.version,
        });
        }
        
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

    // ВАЖНО: Не создаём рекомендации и не подбираем продукты внутри POST /answers.
    // Этот эндпоинт должен быть максимально быстрым и атомарным: сохранить ответы, создать новый профиль,
    // инвалидация кэша — а дальше клиент отдельно дергает /api/recommendations и /api/plan.
    logger.info('Skipping in-transaction recommendations build in /api/questionnaire/answers. Recommendations will be built via /api/recommendations.', {
          userId,
          profileId: profile.id,
          profileVersion: profile.version,
    });

    // ВАЖНО: Если clientSubmissionId передан, фиксируем успешный сабмит в QuestionnaireSubmission,
    // чтобы повторные запросы с тем же ключом отдавали уже созданный профиль.
    if (clientSubmissionId) {
      try {
        await (prisma as any).questionnaireSubmission.upsert({
              where: {
            userId_questionnaireId_clientSubmissionId: {
                userId, 
              questionnaireId,
              clientSubmissionId,
            },
          },
          update: {
            profileId: profile.id,
            profileVersion: profile.version,
            status: 'completed',
            errorMessage: null,
          },
          create: {
            userId,
            questionnaireId,
            clientSubmissionId,
            profileId: profile.id,
            profileVersion: profile.version,
            status: 'completed',
          },
        });
        logger.info('QuestionnaireSubmission stored for idempotency', {
          userId,
          questionnaireId,
          clientSubmissionId,
          profileId: profile.id,
          profileVersion: profile.version,
        });
      } catch (submissionError: any) {
        logger.warn('Failed to store QuestionnaireSubmission (idempotency)', {
        userId,
        questionnaireId,
          clientSubmissionId,
          error: submissionError?.message,
        });
      }
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

    // КРИТИЧНО: Проверяем, что профиль реально виден в БД после создания
    // Используем тот же prisma instance для проверки
    // Это поможет диагностировать проблему "разные БД"
    const profileAfterCreate = await prisma.skinProfile.findUnique({
      where: { id: profile.id },
      select: { id: true, userId: true, version: true },
    });
    
    // Логируем fingerprint БД для сравнения с другими роутами (повторно после создания профиля)
    const fingerprintAfterCreate = await logDbFingerprint('/api/questionnaire/answers');
    
    console.warn('🔍 [QUESTIONNAIRE/ANSWERS] Profile verification after create:', JSON.stringify({
      createdProfileId: profile.id,
      foundInDb: !!profileAfterCreate,
      profileAfterCreate: profileAfterCreate,
      userId,
      fingerprint: fingerprintAfterCreate ? {
        db: fingerprintAfterCreate.db,
        schema: fingerprintAfterCreate.schema,
        user: fingerprintAfterCreate.user,
        host: fingerprintAfterCreate.host,
        port: fingerprintAfterCreate.port,
      } : null,
      databaseUrl: process.env.DATABASE_URL ? {
        host: process.env.DATABASE_URL.match(/@([^:]+)/)?.[1],
        db: process.env.DATABASE_URL.match(/\/([^?]+)/)?.[1],
        prefix: process.env.DATABASE_URL.substring(0, 50) + '...',
      } : null,
    }, null, 2));
    
    logger.info('✅ Answers submitted and profile created successfully', {
      userId,
      profileId: profile.id,
      profileVersion: profile.version,
      answersCount: savedAnswers.length,
      duration,
      profileFoundAfterCreate: !!profileAfterCreate,
    });

    // ВАЖНО: Запускаем генерацию плана асинхронно (не блокируя ответ)
    // План будет сгенерирован в фоне, клиент будет polling /api/plan/status
    const initData = request.headers.get('X-Telegram-Init-Data') || request.headers.get('x-telegram-init-data');
    if (initData) {
      // Запускаем генерацию плана в фоне (не ждем завершения)
      // Используем абсолютный URL для внутреннего вызова
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      
      fetch(`${baseUrl}/api/plan/generate?profileId=${profile.id}`, {
        method: 'GET',
        headers: {
          'X-Telegram-Init-Data': initData,
        },
      }).catch(err => {
        logger.warn('Background plan generation failed (non-critical)', { 
          userId, 
          profileId: profile.id,
          error: err?.message 
        });
        // Не критично - план пересоберется при следующем запросе
      });
      
      logger.info('🚀 Plan generation started in background', {
        userId,
        profileId: profile.id,
        profileVersion: profile.version,
      });
    } else {
      logger.warn('Cannot trigger plan generation: initData missing', { userId });
    }

    return ApiResponse.success({
      success: true,
      profile: {
        id: profile.id,
        version: profile.version,
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
