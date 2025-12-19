// app/api/questionnaire/progress/route.ts
// Сохранение и загрузка прогресса анкеты

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

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

    if (userAnswers.length === 0) {
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

    // Вычисляем позицию на основе последнего отвеченного вопроса
    // Метаданные позиции больше не хранятся в БД, они только локально
    const finalQuestionIndex = lastAnsweredIndex + 1; // Следующий вопрос после последнего отвеченного
    const finalInfoScreenIndex = 0; // По умолчанию 0

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
    // НЕ сохраняем их в БД, так как это нарушает внешний ключ
    // Метаданные позиции хранятся только локально на клиенте
    if (questionId === -1 || questionId === '-1') {
      // Логируем только в development режиме
      if (process.env.NODE_ENV === 'development') {
        console.log('ℹ️ Metadata position update (not saved to DB, stored locally only):', {
          questionIndex,
          infoScreenIndex,
        });
      }
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 200, duration, userId);
      return NextResponse.json({
        success: true,
        answer: null, // Метаданные не сохраняются в БД
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
