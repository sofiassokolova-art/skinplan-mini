// app/api/questionnaire/progress/route.ts
// Сохранение и загрузка прогресса анкеты

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

// GET - загрузка прогресса
export async function GET(request: NextRequest) {
  try {
    const initData = request.headers.get('x-telegram-init-data');

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
    const answers: Record<number, string | string[]> = {};
    for (const answer of userAnswers) {
      if (answer.answerValues) {
        answers[answer.questionId] = answer.answerValues as string[];
      } else if (answer.answerValue) {
        answers[answer.questionId] = answer.answerValue;
      }
    }

    return NextResponse.json({
      progress: {
        answers,
        questionIndex: lastAnsweredIndex + 1, // Следующий вопрос после последнего отвеченного
        infoScreenIndex: 0, // Информационные экраны пропускаем, так как они только в начале
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
    const initData = request.headers.get('x-telegram-init-data');

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

    const { questionnaireId, questionId, answerValue, answerValues } = await request.json();

    if (!questionnaireId || !questionId) {
      return NextResponse.json(
        { error: 'Missing questionnaireId or questionId' },
        { status: 400 }
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
    const answer = await prisma.userAnswer.create({
      data: {
        userId,
        questionnaireId,
        questionId,
        answerValue: answerValue || null,
        answerValues: answerValues ? (answerValues as any) : null,
      },
    });

    return NextResponse.json({
      success: true,
      answer: {
        id: answer.id,
        questionId: answer.questionId,
        answerValue: answer.answerValue,
        answerValues: answer.answerValues,
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
