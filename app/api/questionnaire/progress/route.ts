// app/api/questionnaire/progress/route.ts
// Сохранение и загрузка прогресса анкеты

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

// GET - загрузка прогресса
export async function GET(request: NextRequest) {
  try {
    // Пробуем оба варианта заголовка (регистронезависимо)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
        { status: 401 }
      );
    }

    const userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    // Проверяем наличие профиля, но разрешаем загрузку ответов для повторного прохождения
    // Если есть параметр ?retaking=true, возвращаем предыдущие ответы даже при наличии профиля
    const retaking = request.nextUrl.searchParams.get('retaking') === 'true';
    const existingProfile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (existingProfile && !retaking) {
      // Анкета завершена, прогресс не нужен (если не повторное прохождение)
      return NextResponse.json({
        progress: null,
      });
    }

    // Получаем последние ответы пользователя для активной анкеты
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
    });

    if (!activeQuestionnaire) {
      return NextResponse.json({
        progress: null,
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
      return NextResponse.json({
        progress: null,
      });
    }

    // Получаем все вопросы анкеты для определения индексов
    const allQuestions = await prisma.question.findMany({
      where: {
        questionnaireId: activeQuestionnaire.id,
      },
      orderBy: [
        { groupId: 'asc' },
        { position: 'asc' },
      ],
    });

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

    return NextResponse.json({
      progress: {
        answers,
        questionIndex: finalQuestionIndex,
        infoScreenIndex: finalInfoScreenIndex,
        timestamp: userAnswers[0]?.createdAt.getTime() || Date.now(),
      },
    });
  } catch (error) {
    console.error('Error loading progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - сохранение прогресса (ответы)
export async function POST(request: NextRequest) {
  try {
    // Пробуем оба варианта заголовка (регистронезависимо)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
        { status: 401 }
      );
    }

    const userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    let { questionnaireId, questionId, answerValue, answerValues, questionIndex, infoScreenIndex } = await request.json();

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

    if (!questionnaireId) {
      return NextResponse.json(
        { error: 'Missing questionnaireId' },
        { status: 400 }
      );
    }

    let savedAnswer = null;

    // Если questionId = -1, это только метаданные позиции
    // НЕ сохраняем их в БД, так как это нарушает внешний ключ
    // Метаданные позиции хранятся только локально на клиенте
    if (questionId === -1 || questionId === '-1') {
      console.log('ℹ️ Metadata position update (not saved to DB, stored locally only):', {
        questionIndex,
        infoScreenIndex,
      });
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
      console.warn('⚠️ Questionnaire ID mismatch:', {
        requestedQuestionnaireId: questionnaireId,
        activeQuestionnaireId: activeQuestionnaire.id,
        questionId: questionIdNum,
        userId,
      });
      // Используем ID активной анкеты вместо запрошенного
      questionnaireId = activeQuestionnaire.id;
    }

    // Удаляем старый ответ на этот вопрос (если есть)
    await prisma.userAnswer.deleteMany({
      where: {
        userId,
        questionnaireId,
        questionId: questionIdNum,
      },
    });

    // Сохраняем новый ответ
    savedAnswer = await prisma.userAnswer.create({
      data: {
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

    return NextResponse.json({
      success: true,
      answer: {
        id: savedAnswer.id,
        questionId: savedAnswer.questionId,
        answerValue: savedAnswer.answerValue,
        answerValues: savedAnswer.answerValues,
      },
    });
  } catch (error) {
    console.error('Error saving progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - очистка прогресса анкеты
export async function DELETE(request: NextRequest) {
  try {
    // Пробуем оба варианта заголовка (регистронезависимо)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
        { status: 401 }
      );
    }

    const userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

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

    console.log(`✅ Quiz progress cleared for user ${userId}, deleted ${deletedCount.count} answers`);

    return NextResponse.json({
      success: true,
      deletedCount: deletedCount.count,
    });
  } catch (error) {
    console.error('Error clearing progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
