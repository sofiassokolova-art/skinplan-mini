// Сохранение и загрузка прогресса анкеты

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { getRedis } from '@/lib/redis';

// GET - загрузка прогресса
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/questionnaire/progress';
  let userId: string | null = null;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    // ИСПРАВЛЕНО: Проверяем наличие профиля
    // Если профиля НЕТ, но есть ответы - это незавершенная анкета, возвращаем прогресс
    // Если профиль ЕСТЬ и не повторное прохождение - анкета завершена, прогресс не нужен
    const retaking = request.nextUrl.searchParams.get('retaking') === 'true';
    const existingProfile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // ИСПРАВЛЕНО: Если профиля нет, но есть ответы - это незавершенная анкета
    // Возвращаем прогресс, чтобы пользователь мог продолжить
    // Если профиль есть и не повторное прохождение - анкета завершена
    // ВАЖНО: Возвращаем явное поле isCompleted: true, чтобы фронтенд мог правильно определить завершенность
    if (existingProfile && !retaking) {
      // Анкета завершена, возвращаем информацию о завершенности
      // Получаем ответы для проверки
      const activeQuestionnaire = await prisma.questionnaire.findFirst({
        where: { isActive: true },
      });

      if (!activeQuestionnaire) {
        const duration = Date.now() - startTime;
        logApiRequest(method, path, 200, duration, userId);
        return NextResponse.json({
          progress: null,
          isCompleted: true,
        });
      }

      const userAnswers = await prisma.userAnswer.findMany({
        where: {
          userId,
          questionnaireId: activeQuestionnaire.id,
        },
        include: {
          question: true,
        },
      });

      // Преобразуем ответы в формат для фронтенда
      const answers: Record<number, string | string[]> = {};
      for (const answer of userAnswers) {
        if (answer.questionId === -1) {
          continue;
        }
        if (answer.answerValues) {
          answers[answer.questionId] = answer.answerValues as string[];
        } else if (answer.answerValue) {
          answers[answer.questionId] = answer.answerValue;
        }
      }

      const duration = Date.now() - startTime;
      logApiRequest(method, path, 200, duration, userId);
      return NextResponse.json({
        progress: {
          answers,
          questionIndex: 0,
          infoScreenIndex: 0,
          timestamp: Date.now(),
        },
        isCompleted: true,
      });
    }
    
    // Если профиля нет - это либо новый пользователь, либо незавершенная анкета
    // Продолжаем загрузку ответов ниже

    // Получаем последние ответы пользователя для активной анкеты
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
    });
    
    // ВОССТАНОВЛЕНО: Проверяем кеш в KV для новых пользователей
    // Это позволяет новым пользователям вернуться к анкете после выхода
    const redis = getRedis();
    const kvProgressKey = activeQuestionnaire ? `questionnaire:progress:${userId}:${activeQuestionnaire.id}` : null;
    let kvProgress: any = null;
    
    if (redis && !existingProfile && kvProgressKey) {
      try {
        const cached = await redis.get(kvProgressKey);
        if (cached) {
          try {
            kvProgress = typeof cached === 'string' ? JSON.parse(cached) : cached;
            if (process.env.NODE_ENV === 'development' && activeQuestionnaire) {
              console.log('✅ Questionnaire progress loaded from KV cache for new user', {
                userId,
                questionnaireId: activeQuestionnaire.id,
                hasAnswers: !!kvProgress?.answers && Object.keys(kvProgress.answers).length > 0,
                questionIndex: kvProgress?.questionIndex,
              });
            }
          } catch (parseError) {
            console.warn('⚠️ Failed to parse KV progress cache:', parseError);
          }
        }
      } catch (kvError) {
        // Ошибка KV не критична - продолжаем с загрузкой из БД
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Failed to load progress from KV:', kvError);
        }
      }
    }

    if (!activeQuestionnaire) {
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 200, duration, userId);
      return NextResponse.json({
        progress: null,
        isCompleted: false,
      });
    }

    const userAnswers = await prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId: activeQuestionnaire.id,
      },
      include: {
        question: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // ИСПРАВЛЕНО: Если ответов в БД нет, проверяем KV и QuestionnaireProgress
    // Если есть infoScreenIndex > 0, возвращаем прогресс даже без ответов
    if (userAnswers.length === 0) {
      // Проверяем QuestionnaireProgress, даже если нет ответов
      let savedProgress = null;
      try {
        savedProgress = await prisma.questionnaireProgress.findUnique({
          where: {
            userId_questionnaireId: {
              userId,
              questionnaireId: activeQuestionnaire.id,
            },
          },
        });
      } catch (error: any) {
        if (error?.code !== 'P2021' && !error?.message?.includes('does not exist')) {
          console.error('Error loading questionnaire progress:', error);
        }
      }

      // Если есть прогресс в KV с ответами - используем его
      if (kvProgress && kvProgress.answers && Object.keys(kvProgress.answers).length > 0) {
        const duration = Date.now() - startTime;
        logApiRequest(method, path, 200, duration, userId);
        return NextResponse.json({
          progress: {
            answers: kvProgress.answers,
            questionIndex: kvProgress.questionIndex ?? 0,
            infoScreenIndex: kvProgress.infoScreenIndex ?? 0,
            timestamp: kvProgress.timestamp ?? Date.now(),
          },
          isCompleted: false,
        });
      }

      // Если есть прогресс в БД с infoScreenIndex > 0 - возвращаем его даже без ответов
      if (savedProgress && savedProgress.infoScreenIndex > 0) {
        const duration = Date.now() - startTime;
        logApiRequest(method, path, 200, duration, userId);
        return NextResponse.json({
          progress: {
            answers: {},
            questionIndex: savedProgress.questionIndex ?? 0,
            infoScreenIndex: savedProgress.infoScreenIndex ?? 0,
            timestamp: savedProgress.updatedAt?.getTime() ?? Date.now(),
          },
          isCompleted: false,
        });
      }
      
      // Если есть прогресс в KV с infoScreenIndex > 0 - возвращаем его даже без ответов
      if (kvProgress && kvProgress.infoScreenIndex > 0) {
        const duration = Date.now() - startTime;
        logApiRequest(method, path, 200, duration, userId);
        return NextResponse.json({
          progress: {
            answers: {},
            questionIndex: kvProgress.questionIndex ?? 0,
            infoScreenIndex: kvProgress.infoScreenIndex ?? 0,
            timestamp: kvProgress.timestamp ?? Date.now(),
          },
          isCompleted: false,
        });
      }
      
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 200, duration, userId);
      return NextResponse.json({
        progress: null,
        isCompleted: false,
      });
    }

    // Получаем все вопросы анкеты для определения индексов
    // ВАЖНО: порядок вопросов должен совпадать с `/api/questionnaire/active`
    // и тем, как фронтенд формирует allQuestionsRaw:
    // 1) группы по group.position asc, внутри группы вопросы по question.position asc
    // 2) затем вопросы без группы по question.position asc
    const questionnaireForOrdering = await prisma.questionnaire.findFirst({
      where: { id: activeQuestionnaire.id },
      include: {
        questionGroups: {
          include: {
            questions: {
              orderBy: { position: 'asc' },
              select: { id: true },
            },
          },
          orderBy: { position: 'asc' },
        },
        questions: {
          where: { groupId: null },
          orderBy: { position: 'asc' },
          select: { id: true },
        },
      },
    });

    const allQuestions = [
      ...(questionnaireForOrdering?.questionGroups ?? []).flatMap((g) => g.questions ?? []),
      ...(questionnaireForOrdering?.questions ?? []),
    ];

    // Находим последний отвеченный вопрос
    const answeredQuestionIds = new Set(userAnswers.map(a => a.questionId));
    let lastAnsweredIndex = -1;
    
    for (let i = 0; i < allQuestions.length; i++) {
      if (answeredQuestionIds.has(allQuestions[i].id)) {
        lastAnsweredIndex = i;
      }
    }

    // Преобразуем ответы в формат для фронтенда
    // Исключаем метаданные с questionId = -1 (если они еще есть в БД от старых версий)
    const answers: Record<number, string | string[]> = {};
    
    for (const answer of userAnswers) {
      // Пропускаем метаданные позиции (questionId = -1) - они больше не используются
      if (answer.questionId === -1) {
        continue;
      }
      
      if (answer.answerValues) {
        answers[answer.questionId] = answer.answerValues as string[];
      } else if (answer.answerValue) {
        answers[answer.questionId] = answer.answerValue;
      }
    }

    // ИСПРАВЛЕНО: Загружаем метаданные позиции из БД для синхронизации между устройствами
    // ИСПРАВЛЕНО: Обрабатываем случай, когда таблица questionnaire_progress не существует
    let savedProgress = null;
    try {
      // Use the correct Prisma model name (camelCase)
      savedProgress = await prisma.questionnaireProgress.findUnique({
        where: {
          userId_questionnaireId: {
            userId,
            questionnaireId: activeQuestionnaire.id,
          },
        },
      });
    } catch (error: any) {
      // Если таблица не существует (P2021) или другая ошибка БД - используем fallback
      if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
        // Таблица не существует - это нормально, используем вычисленный индекс
        // Логируем только в development
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ questionnaire_progress table does not exist, using computed index');
        }
      } else {
        // Другая ошибка - логируем, но продолжаем с fallback
        console.error('Error loading questionnaire progress:', error);
      }
    }

    // Используем сохраненные метаданные, если они есть, иначе вычисляем на основе последнего отвеченного вопроса
    // ВОССТАНОВЛЕНО: Приоритет: KV кеш > БД метаданные > вычисленный индекс
    const finalQuestionIndex = kvProgress?.questionIndex ?? savedProgress?.questionIndex ?? (lastAnsweredIndex + 1);
    const finalInfoScreenIndex = kvProgress?.infoScreenIndex ?? savedProgress?.infoScreenIndex ?? 0;

    // Проверяем, все ли вопросы анкеты отвечены
    const totalQuestions = allQuestions.filter(q => q.id !== -1).length;
    const answeredQuestionsCount = Object.keys(answers).length;
    const isCompleted = answeredQuestionsCount >= totalQuestions;

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json({
      progress: {
        answers,
        questionIndex: finalQuestionIndex,
        infoScreenIndex: finalInfoScreenIndex,
        timestamp: userAnswers[0]?.createdAt.getTime() || Date.now(),
      },
      isCompleted,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - сохранение прогресса (ответы)
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/questionnaire/progress';
  let userId: string | null = null;
  // ИСПРАВЛЕНО: Объявляем переменные в начале функции для доступа в catch блоке
  let questionnaireId: number | undefined;
  let questionId: any;
  let answerValue: any;
  let answerValues: any;
  let questionIndex: any;
  let infoScreenIndex: any;
  let savedAnswer: any = null;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    ({ questionnaireId, questionId, answerValue, answerValues, questionIndex, infoScreenIndex } = await request.json());

    // Логируем только в development режиме
    if (process.env.NODE_ENV === 'development') {
      console.log('📝 Saving quiz progress:', { 
        userId, 
        questionnaireId, 
        questionId, 
        questionIdType: typeof questionId,
        hasAnswerValue: !!answerValue, 
        hasAnswerValues: !!answerValues,
        questionIndex,
        infoScreenIndex,
      });
    }

    if (!questionnaireId) {
      return NextResponse.json(
        { error: 'Missing questionnaireId' },
        { status: 400 }
      );
    }

    // Если questionId = -1, это только метаданные позиции
    // ИСПРАВЛЕНО: Сохраняем метаданные позиции в БД для синхронизации между устройствами
    if (questionId === -1 || questionId === '-1') {
      // Проверяем, что активная анкета существует
      const activeQuestionnaire = await prisma.questionnaire.findFirst({
        where: { isActive: true },
        select: { id: true },
      });

      if (!activeQuestionnaire) {
        return NextResponse.json(
          { error: 'No active questionnaire found' },
          { status: 404 }
        );
      }

      // Используем ID активной анкеты
      const finalQuestionnaireId = questionnaireId || activeQuestionnaire.id;

      // Сохраняем или обновляем метаданные позиции
      // ИСПРАВЛЕНО: Обрабатываем случай, когда таблица questionnaire_progress не существует
      try {
        await prisma.questionnaireProgress.upsert({
          where: {
            userId_questionnaireId: {
              userId,
              questionnaireId: finalQuestionnaireId,
            },
          },
          update: {
            questionIndex: questionIndex ?? 0,
            infoScreenIndex: infoScreenIndex ?? 0,
          },
          create: {
            userId,
            questionnaireId: finalQuestionnaireId,
            questionIndex: questionIndex ?? 0,
            infoScreenIndex: infoScreenIndex ?? 0,
          },
        });
      } catch (error: any) {
        // Если таблица не существует (P2021) - просто игнорируем сохранение метаданных
        if (error?.code === 'P2021' || error?.message?.includes('does not exist')) {
          // Таблица не существует - это нормально, метаданные не сохраняются
          // Логируем только в development
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ questionnaire_progress table does not exist, skipping metadata save');
          }
        } else {
          // Другая ошибка - пробрасываем дальше
          throw error;
        }
      }

      // Логируем только в development режиме
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Metadata position saved to DB:', {
          userId,
          questionnaireId: finalQuestionnaireId,
          questionIndex,
          infoScreenIndex,
        });
      }

      const duration = Date.now() - startTime;
      logApiRequest(method, path, 200, duration, userId);
      return NextResponse.json({
        success: true,
        answer: null, // Метаданные сохранены в отдельной таблице
      });
    }

    // Обычный ответ на вопрос - валидируем, что вопрос существует
    if (questionId === null || questionId === undefined) {
      return NextResponse.json(
        { error: 'Missing questionId' },
        { status: 400 }
      );
    }

    // Преобразуем questionId в число, если это строка
    const questionIdNum = typeof questionId === 'string' ? parseInt(questionId, 10) : questionId;
    
    if (isNaN(questionIdNum) || questionIdNum <= 0) {
      console.error('Invalid questionId:', { questionId, questionIdNum, questionnaireId, userId });
      return NextResponse.json(
        { 
          error: `Invalid questionId: ${questionId} (must be a positive number)`,
          questionId,
          questionnaireId,
        },
        { status: 400 }
      );
    }

    // Проверяем, что активная анкета существует
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    if (!activeQuestionnaire) {
      console.error('No active questionnaire found');
      return NextResponse.json(
        { error: 'No active questionnaire found' },
        { status: 404 }
      );
    }

    // Проверяем, что вопрос существует в активной анкете
    const question = await prisma.question.findFirst({
      where: {
        id: questionIdNum,
        questionnaireId: activeQuestionnaire.id, // Используем ID активной анкеты
      },
    });

    if (!question) {
      // Проверяем, существует ли вопрос вообще (может быть в другой анкете)
      const questionInAnyQuestionnaire = await prisma.question.findFirst({
        where: {
          id: questionIdNum,
        },
        select: {
          id: true,
          questionnaireId: true,
          code: true,
        },
      });

      // Получаем список всех вопросов в активной анкете для отладки
      const allQuestionsInActive = await prisma.question.findMany({
        where: {
          questionnaireId: activeQuestionnaire.id,
        },
        select: {
          id: true,
          code: true,
          text: true,
        },
        take: 10, // Первые 10 для примера
      });

      console.error('❌ Question not found in active questionnaire:', { 
        questionId: questionIdNum, 
        requestedQuestionnaireId: questionnaireId,
        activeQuestionnaireId: activeQuestionnaire.id,
        userId,
        questionExistsInOtherQuestionnaire: !!questionInAnyQuestionnaire,
        actualQuestionnaireId: questionInAnyQuestionnaire?.questionnaireId,
        questionCode: questionInAnyQuestionnaire?.code,
        sampleQuestionsInActive: allQuestionsInActive.map(q => ({ id: q.id, code: q.code })),
      });

      return NextResponse.json(
        { 
          error: `Question with id ${questionIdNum} not found in active questionnaire`,
          questionId: questionIdNum,
          requestedQuestionnaireId: questionnaireId,
          activeQuestionnaireId: activeQuestionnaire.id,
          questionExistsInOtherQuestionnaire: !!questionInAnyQuestionnaire,
          sampleQuestionsInActive: allQuestionsInActive.map(q => ({ id: q.id, code: q.code })),
        },
        { status: 404 }
      );
    }

    // Проверяем, что questionnaireId совпадает с активной анкетой
    if (questionnaireId !== activeQuestionnaire.id) {
      // Логируем только в development режиме
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ Questionnaire ID mismatch:', {
          requestedQuestionnaireId: questionnaireId,
          activeQuestionnaireId: activeQuestionnaire.id,
          questionId: questionIdNum,
          userId,
        });
      }
      // Используем ID активной анкеты вместо запрошенного
      questionnaireId = activeQuestionnaire.id;
    }

    // КРИТИЧНО: Логируем перед сохранением в БД для диагностики
    // ВАЖНО: Указываем saveToDb: true, чтобы логи сохранялись в PostgreSQL
    logger.info('💾 Сохранение ответа в БД (Prisma upsert)', {
      userId,
      questionnaireId,
      questionId: questionIdNum,
      questionIdType: typeof questionIdNum,
      hasAnswerValue: answerValue !== undefined && answerValue !== null,
      hasAnswerValues: answerValues !== undefined && answerValues !== null,
      answerValue: answerValue || null,
      answerValues: answerValues || null,
      questionIndex,
      infoScreenIndex,
    }, {
      userId: userId || undefined,
      saveToDb: true, // КРИТИЧНО: Сохраняем в БД для диагностики
    });

    // ИСПРАВЛЕНО: Используем upsert вместо delete + create для предотвращения race condition
    // Это устраняет ошибку "Unique constraint failed" при одновременных запросах
    savedAnswer = await prisma.userAnswer.upsert({
      where: {
        userId_questionnaireId_questionId: {
          userId,
          questionnaireId,
          questionId: questionIdNum,
        },
      },
      update: {
        answerValue: answerValue || null,
        answerValues: answerValues ? (answerValues as any) : null,
      },
      create: {
        userId,
        questionnaireId,
        questionId: questionIdNum,
        answerValue: answerValue || null,
        answerValues: answerValues ? (answerValues as any) : null,
      },
    });

    // КРИТИЧНО: Логируем после успешного сохранения
    // ВАЖНО: Указываем saveToDb: true, чтобы логи сохранялись в PostgreSQL
    logger.info('✅ Ответ успешно сохранен в БД', {
      userId,
      questionnaireId,
      questionId: questionIdNum,
      savedAnswerId: savedAnswer.id,
      answerValue: savedAnswer.answerValue,
      answerValues: savedAnswer.answerValues,
    }, {
      userId: userId || undefined,
      saveToDb: true, // КРИТИЧНО: Сохраняем в БД для диагностики
    });

    // ВОССТАНОВЛЕНО: Сохраняем прогресс в KV для новых пользователей (когда нет профиля)
    // Это позволяет новым пользователям вернуться к анкете после выхода
    const existingProfile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!existingProfile) {
      const redis = getRedis();
      const kvProgressKey = `questionnaire:progress:${userId}:${questionnaireId}`;
      
      if (redis) {
        try {
          // Получаем текущий прогресс из KV или создаем новый
          let currentProgress: any = null;
          try {
            const cached = await redis.get(kvProgressKey);
            if (cached) {
              currentProgress = typeof cached === 'string' ? JSON.parse(cached) : cached;
            }
          } catch (parseError) {
            // Игнорируем ошибки парсинга
          }
          
          // Обновляем ответы в прогрессе
          const updatedAnswers = currentProgress?.answers || {};
          if (answerValue) {
            updatedAnswers[questionIdNum] = answerValue;
          } else if (answerValues) {
            updatedAnswers[questionIdNum] = answerValues;
          }
          
          // Сохраняем обновленный прогресс в KV (TTL 7 дней)
          const progressData = {
            answers: updatedAnswers,
            questionIndex: questionIndex ?? currentProgress?.questionIndex ?? 0,
            infoScreenIndex: infoScreenIndex ?? currentProgress?.infoScreenIndex ?? 0,
            timestamp: Date.now(),
          };
          
          await redis.set(kvProgressKey, JSON.stringify(progressData), { ex: 7 * 24 * 60 * 60 });
          
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Questionnaire progress saved to KV cache for new user', {
              userId,
              questionnaireId,
              questionId: questionIdNum,
              answersCount: Object.keys(updatedAnswers).length,
            });
          }
        } catch (kvError) {
          // Ошибка KV не критична - продолжаем работу
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Failed to save progress to KV:', kvError);
          }
        }
      }
    }

    // Метаданные позиции (questionIndex, infoScreenIndex) больше не сохраняются в БД
    // Они хранятся только локально на клиенте в localStorage
    // Позицию можно вычислить на основе последнего отвеченного вопроса

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json({
      success: true,
      answer: {
        id: savedAnswer.id,
        questionId: savedAnswer.questionId,
        answerValue: savedAnswer.answerValue,
        answerValues: savedAnswer.answerValues,
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // КРИТИЧНО: Логируем все ошибки сохранения для диагностики
    // ВАЖНО: error логи сохраняются в БД по умолчанию, но явно указываем saveToDb: true
    logger.error('❌ Ошибка сохранения ответа в БД', error, {
      userId,
      questionnaireId,
      questionId,
      questionIdType: typeof questionId,
      answerValue: answerValue || null,
      answerValues: answerValues || null,
      errorCode: error?.code,
      errorMessage: error?.message,
      errorMeta: error?.meta,
      errorStack: error?.stack?.substring(0, 500),
    }, {
      userId: userId || undefined,
      saveToDb: true, // КРИТИЧНО: Сохраняем в БД для диагностики
    });
    
    // ИСПРАВЛЕНО: Обрабатываем ошибку уникального ограничения отдельно
    // Это может произойти при race condition, даже с upsert
    if (error?.code === 'P2002' && error?.meta?.target?.includes('user_id') && 
        error?.meta?.target?.includes('questionnaire_id') && error?.meta?.target?.includes('question_id')) {
      // Это race condition - пытаемся получить существующий ответ
      // ВАЖНО: questionIdNum уже определен выше в try блоке, используем его
      try {
        // questionIdNum уже определен выше, но для безопасности проверяем еще раз
        let retryQuestionIdNum: number;
        if (typeof questionId === 'string') {
          retryQuestionIdNum = parseInt(questionId, 10);
        } else if (typeof questionId === 'number') {
          retryQuestionIdNum = questionId;
        } else {
          throw new Error('Invalid questionId type');
        }
        
        if (isNaN(retryQuestionIdNum) || retryQuestionIdNum <= 0) {
          throw new Error('Invalid questionId');
        }
        
        const existingAnswer = await prisma.userAnswer.findUnique({
          where: {
            userId_questionnaireId_questionId: {
              userId: userId!,
              questionnaireId: questionnaireId || 0,
              questionId: retryQuestionIdNum,
            },
          },
        });
        
        if (existingAnswer) {
          // Обновляем существующий ответ
          savedAnswer = await prisma.userAnswer.update({
            where: { id: existingAnswer.id },
            data: {
              answerValue: answerValue || null,
              answerValues: answerValues ? (answerValues as any) : null,
            },
          });
          
          const duration = Date.now() - startTime;
          logApiRequest(method, path, 200, duration, userId);
          return NextResponse.json({
            success: true,
            answer: {
              id: savedAnswer.id,
              questionId: savedAnswer.questionId,
              answerValue: savedAnswer.answerValue,
              answerValues: savedAnswer.answerValues,
            },
          });
        }
      } catch (retryError) {
        // Если не удалось обработать, логируем и продолжаем
        logApiError(method, path, retryError, userId);
      }
    }
    
    logApiError(method, path, error, userId);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - очистка прогресса анкеты
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  const method = 'DELETE';
  const path = '/api/questionnaire/progress';
  let userId: string | null = null;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    // Получаем активную анкету
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
    });

    if (!activeQuestionnaire) {
      return NextResponse.json(
        { error: 'No active questionnaire found' },
        { status: 404 }
      );
    }

    // Удаляем все ответы пользователя для активной анкеты
    const deletedCount = await prisma.userAnswer.deleteMany({
      where: {
        userId,
        questionnaireId: activeQuestionnaire.id,
      },
    });

    // Логируем только в development режиме
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Quiz progress cleared for user ${userId}, deleted ${deletedCount.count} answers`);
    }

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json({
      success: true,
      deletedCount: deletedCount.count,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
