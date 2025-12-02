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

    // Преобразуем ответы в формат для фронтенда (исключаем метаданные с questionId = -1)
    const answers: Record<number, string | string[]> = {};
    let savedQuestionIndex: number | null = null;
    let savedInfoScreenIndex: number | null = null;
    
    for (const answer of userAnswers) {
      // Проверяем, является ли это метаданными позиции
      if (answer.questionId === -1 && answer.answerValue) {
        try {
          const positionData = JSON.parse(answer.answerValue);
          savedQuestionIndex = positionData.questionIndex ?? null;
          savedInfoScreenIndex = positionData.infoScreenIndex ?? null;
        } catch (e) {
          console.warn('Failed to parse position metadata:', e);
        }
      } else if (answer.answerValues) {
        answers[answer.questionId] = answer.answerValues as string[];
      } else if (answer.answerValue) {
        answers[answer.questionId] = answer.answerValue;
      }
    }

    // Используем сохраненную позицию, если она есть, иначе вычисляем
    const finalQuestionIndex = savedQuestionIndex !== null 
      ? savedQuestionIndex 
      : lastAnsweredIndex + 1; // Следующий вопрос после последнего отвеченного
    const finalInfoScreenIndex = savedInfoScreenIndex !== null 
      ? savedInfoScreenIndex 
      : 0; // По умолчанию 0

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

    const { questionnaireId, questionId, answerValue, answerValues, questionIndex, infoScreenIndex } = await request.json();

    console.log('📝 Saving quiz progress:', { 
      userId, 
      questionnaireId, 
      questionId, 
      hasAnswerValue: !!answerValue, 
      hasAnswerValues: !!answerValues,
      questionIndex,
      infoScreenIndex,
    });

    if (!questionnaireId || questionId === undefined) {
      return NextResponse.json(
        { error: 'Missing questionnaireId' },
        { status: 400 }
      );
    }

    let savedAnswer = null;

    // Если questionId = -1, это только метаданные позиции
    if (questionId === -1) {
      // Обрабатываем только метаданные позиции
      if (questionIndex !== undefined || infoScreenIndex !== undefined) {
        // Удаляем старую запись о позиции (если есть)
        await prisma.userAnswer.deleteMany({
          where: {
            userId,
            questionnaireId,
            questionId: -1, // Используем -1 как маркер для метаданных позиции
          },
        });

        // Сохраняем позицию в answerValue как JSON строку
        savedAnswer = await prisma.userAnswer.create({
          data: {
            userId,
            questionnaireId,
            questionId: -1, // Маркер для метаданных
            answerValue: JSON.stringify({
              questionIndex: questionIndex ?? null,
              infoScreenIndex: infoScreenIndex ?? null,
              timestamp: Date.now(),
            }),
          },
        });
      }

      return NextResponse.json({
        success: true,
        answer: savedAnswer ? {
          id: savedAnswer.id,
          questionId: savedAnswer.questionId,
          answerValue: savedAnswer.answerValue,
          answerValues: savedAnswer.answerValues,
        } : null,
      });
    }

    // Обычный ответ на вопрос - валидируем, что вопрос существует
    if (questionId === null) {
      return NextResponse.json(
        { error: 'Missing questionId' },
        { status: 400 }
      );
    }

    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        questionnaireId: questionnaireId,
      },
    });

    if (!question) {
      console.error('Question not found:', { questionId, questionnaireId, userId });
      return NextResponse.json(
        { 
          error: `Question with id ${questionId} not found in questionnaire ${questionnaireId}`,
          questionId,
          questionnaireId,
        },
        { status: 404 }
      );
    }

    // Удаляем старый ответ на этот вопрос (если есть)
    await prisma.userAnswer.deleteMany({
      where: {
        userId,
        questionnaireId,
        questionId,
      },
    });

    // Сохраняем новый ответ
    savedAnswer = await prisma.userAnswer.create({
      data: {
        userId,
        questionnaireId,
        questionId,
        answerValue: answerValue || null,
        answerValues: answerValues ? (answerValues as any) : null,
      },
    });

    // Сохраняем позицию (questionIndex и infoScreenIndex) в метаданных, если указана
    if (questionIndex !== undefined || infoScreenIndex !== undefined) {
      // Удаляем старую запись о позиции (если есть)
      await prisma.userAnswer.deleteMany({
        where: {
          userId,
          questionnaireId,
          questionId: -1, // Используем -1 как маркер для метаданных позиции
        },
      });

      // Сохраняем позицию в answerValue как JSON строку
      await prisma.userAnswer.create({
        data: {
          userId,
          questionnaireId,
          questionId: -1, // Маркер для метаданных
          answerValue: JSON.stringify({
            questionIndex: questionIndex ?? null,
            infoScreenIndex: infoScreenIndex ?? null,
            timestamp: Date.now(),
          }),
        },
      });
    }

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
