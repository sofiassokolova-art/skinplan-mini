// app/api/questionnaire/active/route.ts
// Получение активной анкеты (обновленная версия с правильной структурой)
// ИСПРАВЛЕНО: Проверяет профиль и план на бэкенде, возвращает информацию о редиректе

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { getCurrentProfile } from '@/lib/get-current-profile';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/questionnaire/active';
  let userId: string | null = null;
  
  try {
    // ИСПРАВЛЕНО: Проверяем авторизацию и получаем userId
    const auth = await requireTelegramAuth(request, { ensureUser: false });
    let shouldRedirectToPlan = false;
    let isCompleted = false;
    let hasPlanProgress = false;
    let isRetakingQuiz = false;
    let fullRetakeFromHome = false;
    let paymentRetakingCompleted = false;
    let paymentFullRetakeCompleted = false;
    
    if (auth.ok) {
      userId = auth.ctx.userId;
      
      // ОПТИМИЗАЦИЯ: Параллельно загружаем preferences и профиль
      // Это сокращает время выполнения с ~400ms до ~200ms (самый медленный запрос)
      const [userPrefs, profile, activeQuestionnaireId] = await Promise.all([
        prisma.userPreferences.findUnique({
          where: { userId },
          select: {
            hasPlanProgress: true,
            isRetakingQuiz: true,
            fullRetakeFromHome: true,
            paymentRetakingCompleted: true,
            paymentFullRetakeCompleted: true,
          },
        }),
        getCurrentProfile(userId),
        prisma.questionnaire.findFirst({
          where: { isActive: true },
          select: { id: true },
        }),
      ]);
      
      if (userPrefs) {
        hasPlanProgress = userPrefs.hasPlanProgress;
        isRetakingQuiz = userPrefs.isRetakingQuiz;
        fullRetakeFromHome = userPrefs.fullRetakeFromHome;
        paymentRetakingCompleted = userPrefs.paymentRetakingCompleted;
        paymentFullRetakeCompleted = userPrefs.paymentFullRetakeCompleted;
      }
      
      if (profile && profile.id && activeQuestionnaireId) {
        // ОПТИМИЗАЦИЯ: Используем count вместо findMany для проверки наличия ответов
        // Это быстрее, так как не загружает данные, только считает
        const answersCount = await prisma.userAnswer.count({
          where: {
            userId,
            questionnaireId: activeQuestionnaireId.id,
          },
        });
        
        // Если есть ответы и профиль - анкета завершена
        if (answersCount > 0) {
          isCompleted = true;
          shouldRedirectToPlan = true;
          
          logger.info('Profile exists and questionnaire is completed, should redirect to plan', {
            userId,
            profileId: profile.id,
            answersCount,
          });
        }
      } else if (!profile || !profile.id) {
        // ИСПРАВЛЕНО: Для нового пользователя (без профиля) логируем как INFO, не WARN
        // Это нормальная ситуация для нового пользователя - не логируем как предупреждение
        logger.info('New user (no profile) - will return active questionnaire', {
          userId,
          hasProfile: false,
        });
      }
    }
    
    logger.info('Fetching active questionnaire', { userId, shouldRedirectToPlan, isCompleted });
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

    // ИСПРАВЛЕНО: Детальное логирование сырых данных из базы для диагностики
    logger.info('Active questionnaire found (raw data from DB)', {
      questionnaireId: questionnaire.id,
      name: questionnaire.name,
      version: questionnaire.version,
      groupsCount: groups.length,
      plainQuestionsCount: plainQuestions.length,
      groupsQuestionsCount,
      totalQuestionsCount,
      groupsDetails: groups.map(g => ({
        id: g.id,
        title: g.title,
        position: g.position,
        questionsCount: g.questions?.length || 0,
        questions: g.questions?.map((q: any) => ({
          id: q.id,
          code: q.code,
          position: q.position,
        })) || [],
      })),
      plainQuestionsDetails: plainQuestions.map((q: any) => ({
        id: q.id,
        code: q.code,
        position: q.position,
        groupId: q.groupId,
      })),
    });
    
    // ИСПРАВЛЕНО: Проверяем, что анкета содержит вопросы
    // Если вопросов нет - это критическая ошибка, возвращаем 500
    if (totalQuestionsCount === 0) {
      logger.error('❌ Active questionnaire has no questions!', {
        questionnaireId: questionnaire.id,
        name: questionnaire.name,
        version: questionnaire.version,
        groupsCount: groups.length,
        plainQuestionsCount: plainQuestions.length,
        groupsDetails: groups.map(g => ({
          id: g.id,
          title: g.title,
          position: g.position,
          questionsCount: g.questions?.length || 0,
        })),
        // Дополнительная диагностика: проверяем связи в базе
        rawQuestionnaireData: {
          hasQuestionGroups: !!questionnaire.questionGroups,
          hasQuestions: !!questionnaire.questions,
          questionGroupsType: Array.isArray(questionnaire.questionGroups),
          questionsType: Array.isArray(questionnaire.questions),
        },
      });
      
      // ИСПРАВЛЕНО: Возвращаем ошибку 500, чтобы фронтенд мог показать понятное сообщение
      return NextResponse.json(
        { 
          error: 'Active questionnaire is empty',
          message: 'Анкета временно недоступна. Пожалуйста, попробуйте позже.',
          questionnaireId: questionnaire.id,
        },
        { status: 500 }
      );
    }

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
      plainQuestionsCount: formatted.questions.length,
      groupsQuestionsCount,
      totalQuestions: totalQuestionsCount,
      shouldRedirectToPlan,
      isCompleted,
    });

    // ИСПРАВЛЕНО: Возвращаем анкету с информацией о редиректе и preferences
    const duration = Date.now() - startTime;
    const response = NextResponse.json({
      ...formatted,
      // Метаданные для фронтенда
      _meta: {
        shouldRedirectToPlan,
        isCompleted,
        hasProfile: !!userId, // userId будет null если не авторизован
        // ИСПРАВЛЕНО: Добавляем preferences в метаданные, чтобы не делать отдельные запросы
        preferences: {
          hasPlanProgress,
          isRetakingQuiz,
          fullRetakeFromHome,
          paymentRetakingCompleted,
          paymentFullRetakeCompleted,
        },
      },
    });
    
    // ИСПРАВЛЕНО: Логируем успешный запрос в KV для мониторинга
    logApiRequest(method, path, 200, duration, userId);
    
    return response;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Error fetching active questionnaire', error, {
      errorMessage: error?.message,
      errorStack: error?.stack?.substring(0, 500),
    });
    
    // ИСПРАВЛЕНО: Логируем ошибку в KV для мониторинга
    logApiError(method, path, error, userId);
    
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error?.message : undefined },
      { status: 500 }
    );
  }
}
