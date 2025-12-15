// app/api/questionnaire/active/route.ts
// Получение активной анкеты (обновленная версия с правильной структурой)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    logger.info('Fetching active questionnaire');
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      include: {
        questionGroups: {
          include: {
            questions: {
              include: {
                answerOptions: {
                  orderBy: { position: 'asc' },
                },
              },
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
        questions: {
          where: {
            groupId: null, // Вопросы без группы
          },
          include: {
            answerOptions: {
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!questionnaire) {
      logger.warn('No active questionnaire found');
      return NextResponse.json(
        { error: 'No active questionnaire found' },
        { status: 404 }
      );
    }

    const groups = questionnaire.questionGroups || [];
    const plainQuestions = questionnaire.questions || [];
    const groupsQuestionsCount = groups.reduce(
      (sum, g) => sum + (g.questions?.length || 0),
      0
    );
    const totalQuestionsCount = groupsQuestionsCount + plainQuestions.length;

    logger.info('Active questionnaire found', {
      questionnaireId: questionnaire.id,
      name: questionnaire.name,
      version: questionnaire.version,
      groupsCount: groups.length,
      questionsCount: totalQuestionsCount,
      plainQuestionsCount: plainQuestions.length,
      groupsQuestionsCount,
    });

    // Форматируем данные в структуру, похожую на Quiz.tsx
    // Для совместимости с существующим фронтендом
    // ИСПРАВЛЕНО: Гарантируем, что groups и questions всегда являются массивами
    const questionGroups = groups;
    const questions = plainQuestions;
    
    const formatted = {
      id: questionnaire.id,
      name: questionnaire.name,
      version: questionnaire.version,
      groups: questionGroups.map(group => ({
        id: group.id,
        title: group.title,
        position: group.position,
        questions: (group.questions || []).map(q => ({
          id: q.id,
          code: q.code,
          text: q.text,
          type: q.type,
          position: q.position,
          isRequired: q.isRequired,
          description: null, // Можно добавить в схему позже
          options: (q.answerOptions || []).map(opt => ({
            id: opt.id,
            value: opt.value,
            label: opt.label,
            position: opt.position,
          })),
        })),
      })),
      // Вопросы без группы (если есть)
      questions: questions.map(q => ({
        id: q.id,
        code: q.code,
        text: q.text,
        type: q.type,
        position: q.position,
        isRequired: q.isRequired,
        description: null,
        options: (q.answerOptions || []).map(opt => ({
          id: opt.id,
          value: opt.value,
          label: opt.label,
          position: opt.position,
        })),
      })),
    };

    logger.info('Questionnaire formatted successfully', {
      questionnaireId: formatted.id,
      groupsCount: formatted.groups.length,
      questionsCount: formatted.questions.length,
      totalQuestions: formatted.groups.reduce((sum, g) => sum + (g.questions?.length || 0), 0) + formatted.questions.length,
      totalQuestions: totalQuestionsCount,
    };

    return NextResponse.json(formatted);
  } catch (error: any) {
    logger.error('Error fetching active questionnaire', error, {
      errorMessage: error?.message,
      errorStack: error?.stack?.substring(0, 500),
    });
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error?.message : undefined },
      { status: 500 }
    );
  }
}
