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
    
    // ДИАГНОСТИКА: Логируем результат авторизации
    if (!auth.ok) {
      logger.warn('⚠️ Telegram auth failed, but continuing to load questionnaire (public access)', {
        authStatus: auth.response?.status,
        authCode: (auth.response as any)?.body?.code,
        authMessage: (auth.response as any)?.body?.message,
        hasInitData: !!request.headers.get('X-Telegram-Init-Data') || !!request.headers.get('x-telegram-init-data'),
      });
    }
    
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
    
    logger.info('Fetching active questionnaire', { userId, shouldRedirectToPlan, isCompleted, authOk: auth.ok });
    
    // ДИАГНОСТИКА: Сначала проверяем, есть ли активная анкета вообще
    const activeQuestionnaireCheck = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      select: { id: true, name: true, version: true },
    });
    
    logger.info('🔍 Active questionnaire check', {
      found: !!activeQuestionnaireCheck,
      questionnaireId: activeQuestionnaireCheck?.id,
      name: activeQuestionnaireCheck?.name,
      version: activeQuestionnaireCheck?.version,
    });
    
    // ДИАГНОСТИКА: Проверяем количество вопросов напрямую в БД
    if (activeQuestionnaireCheck) {
      const directQuestionsCount = await prisma.question.count({
        where: { questionnaireId: activeQuestionnaireCheck.id },
      });
      const directGroupsCount = await prisma.questionGroup.count({
        where: { questionnaireId: activeQuestionnaireCheck.id },
      });
      const directQuestionsInGroupsCount = await prisma.question.count({
        where: {
          questionnaireId: activeQuestionnaireCheck.id,
          groupId: { not: null },
        },
      });
      const directQuestionsWithoutGroupCount = await prisma.question.count({
        where: {
          questionnaireId: activeQuestionnaireCheck.id,
          groupId: null,
        },
      });
      
      logger.info('🔍 Direct DB query for questions count', {
        totalQuestions: directQuestionsCount,
        groupsCount: directGroupsCount,
        questionsInGroups: directQuestionsInGroupsCount,
        questionsWithoutGroup: directQuestionsWithoutGroupCount,
      });
    }
    
    // ДИАГНОСТИКА: Логируем запрос к базе данных
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
    
    // ДИАГНОСТИКА: Логируем результат запроса к базе данных
    if (questionnaire) {
      logger.info('✅ Questionnaire found in DB', {
        questionnaireId: questionnaire.id,
        hasQuestionGroups: !!questionnaire.questionGroups,
        hasQuestions: !!questionnaire.questions,
        questionGroupsCount: questionnaire.questionGroups?.length || 0,
        questionsCount: questionnaire.questions?.length || 0,
        questionGroupsWithQuestions: questionnaire.questionGroups?.map(g => ({
          id: g.id,
          title: g.title,
          questionsCount: g.questions?.length || 0,
        })) || [],
      });
    } else {
      logger.error('❌ No active questionnaire found in DB');
    }

    if (!questionnaire) {
      logger.warn('No active questionnaire found');
      return NextResponse.json(
        { error: 'No active questionnaire found' },
        { status: 404 }
      );
    }

    // ДИАГНОСТИКА: Проверяем структуру данных из Prisma
    logger.info('🔍 Raw Prisma response structure', {
      hasQuestionGroups: !!questionnaire.questionGroups,
      hasQuestions: !!questionnaire.questions,
      questionGroupsType: typeof questionnaire.questionGroups,
      questionsType: typeof questionnaire.questions,
      questionGroupsIsArray: Array.isArray(questionnaire.questionGroups),
      questionsIsArray: Array.isArray(questionnaire.questions),
      questionGroupsLength: Array.isArray(questionnaire.questionGroups) ? questionnaire.questionGroups.length : 'not array',
      questionsLength: Array.isArray(questionnaire.questions) ? questionnaire.questions.length : 'not array',
    });
    
    const groups = questionnaire.questionGroups || [];
    const plainQuestions = questionnaire.questions || [];
    
    // ДИАГНОСТИКА: Проверяем каждую группу отдельно
    logger.info('🔍 Groups details', {
      groupsCount: groups.length,
      groupsWithQuestions: groups.map(g => ({
        id: g.id,
        title: g.title,
        hasQuestions: !!g.questions,
        questionsType: typeof g.questions,
        questionsIsArray: Array.isArray(g.questions),
        questionsCount: Array.isArray(g.questions) ? g.questions.length : 'not array',
        questions: Array.isArray(g.questions) ? g.questions.map((q: any) => ({
          id: q.id,
          code: q.code,
        })) : 'not array',
      })),
    });
    
    const groupsQuestionsCount = groups.reduce(
      (sum, g) => {
        const qCount = Array.isArray(g.questions) ? g.questions.length : 0;
        logger.info(`🔍 Group ${g.id} (${g.title}): ${qCount} questions`);
        return sum + qCount;
      },
      0
    );
    const totalQuestionsCount = groupsQuestionsCount + plainQuestions.length;
    
    logger.info('🔍 Questions count calculation', {
      groupsQuestionsCount,
      plainQuestionsCount: plainQuestions.length,
      totalQuestionsCount,
    });

    // ИСПРАВЛЕНО: Детальное логирование сырых данных из базы для диагностики
    logger.info('Active questionnaire found (raw data from DB)', {
      questionnaireId: questionnaire.id,
      name: questionnaire.name,
      version: questionnaire.version,
      groupsCount: groups.length,
      plainQuestionsCount: plainQuestions.length,
      groupsQuestionsCount,
      totalQuestionsCount,
      hasQuestionGroups: !!questionnaire.questionGroups,
      hasQuestions: !!questionnaire.questions,
      questionGroupsType: Array.isArray(questionnaire.questionGroups),
      questionsType: Array.isArray(questionnaire.questions),
      groupsDetails: groups.map(g => ({
        id: g.id,
        title: g.title,
        position: g.position,
        questionsCount: g.questions?.length || 0,
        hasQuestions: !!g.questions,
        questionsType: Array.isArray(g.questions),
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
    
    // ДИАГНОСТИКА: Проверяем структуру данных перед проверкой количества
    logger.info('🔍 Checking questionnaire structure', {
      totalQuestionsCount,
      groupsQuestionsCount,
      plainQuestionsCount: plainQuestions.length,
      groupsLength: groups.length,
      plainQuestionsLength: plainQuestions.length,
      willReturn500: totalQuestionsCount === 0,
    });
    
    // ИСПРАВЛЕНО: Проверяем, что анкета содержит вопросы
    // Если вопросов нет - это критическая ошибка, возвращаем 500
    if (totalQuestionsCount === 0) {
      logger.error('❌ CRITICAL: totalQuestionsCount === 0, returning 500 error');
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
