// ИСПРАВЛЕНО: Проверяет профиль и план на бэкенде, возвращает информацию о редиректе

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { getCurrentProfile } from '@/lib/get-current-profile';
import { addCacheHeaders, CachePresets } from '@/lib/utils/api-cache';
import { getCorrelationId, addCorrelationIdToHeaders } from '@/lib/utils/correlation-id';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/questionnaire/active';
  let userId: string | null = null;
  const correlationId = getCorrelationId(request) || undefined;
  
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
      try {
        userId = auth.ctx.userId;

        // ОПТИМИЗАЦИЯ: Параллельно загружаем preferences и профиль
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
          const answersCount = await prisma.userAnswer.count({
            where: {
              userId,
              questionnaireId: activeQuestionnaireId.id,
            },
          });

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
          logger.info('New user (no profile) - will return active questionnaire', {
            userId,
            hasProfile: false,
          });
        }
      } catch (profilePrefsError: any) {
        // Не падаем с 500: ошибка профиля/preferences не должна блокировать загрузку анкеты
        logger.warn('Failed to load profile/preferences, continuing with defaults', {
          userId: auth.ctx.userId,
          errorMessage: profilePrefsError?.message,
          code: profilePrefsError?.code,
        });
        userId = auth.ctx.userId;
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
    
    let directQuestionsCount = 0;
    let directGroupsCount = 0;
    let directQuestionsInGroupsCount = 0;
    let directQuestionsWithoutGroupCount = 0;

    // ДИАГНОСТИКА: Проверяем количество вопросов напрямую в БД
    if (activeQuestionnaireCheck) {
      directQuestionsCount = await prisma.question.count({
        where: { questionnaireId: activeQuestionnaireCheck.id },
      });
      directGroupsCount = await prisma.questionGroup.count({
        where: { questionnaireId: activeQuestionnaireCheck.id },
      });
      directQuestionsInGroupsCount = await prisma.question.count({
        where: {
          questionnaireId: activeQuestionnaireCheck.id,
          groupId: { not: null },
        },
      });
      directQuestionsWithoutGroupCount = await prisma.question.count({
        where: {
          questionnaireId: activeQuestionnaireCheck.id,
          groupId: null,
        },
      });
      
      // КРИТИЧНО: Получаем все вопросы напрямую для диагностики
      const allQuestionsDirect = await prisma.question.findMany({
        where: { questionnaireId: activeQuestionnaireCheck.id },
        select: {
          id: true,
          code: true,
          groupId: true,
          questionnaireId: true,
        },
        take: 20, // Ограничиваем для логов
      });
      
      logger.info('🔍 Direct DB query for questions count', {
        totalQuestions: directQuestionsCount,
        groupsCount: directGroupsCount,
        questionsInGroups: directQuestionsInGroupsCount,
        questionsWithoutGroup: directQuestionsWithoutGroupCount,
        // КРИТИЧНО: Логируем первые вопросы для диагностики
        sampleQuestions: allQuestionsDirect.map(q => ({
          id: q.id,
          code: q.code,
          groupId: q.groupId,
          questionnaireId: q.questionnaireId,
        })),
        // КРИТИЧНО: Проверяем, есть ли вопросы с неправильным questionnaireId
        hasQuestionsWithWrongQuestionnaireId: allQuestionsDirect.some(q => q.questionnaireId !== activeQuestionnaireCheck.id),
      });
      
      if (directQuestionsCount === 0) {
        logger.error('❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: В БД НЕТ вопросов для активной анкеты!', {
          questionnaireId: activeQuestionnaireCheck.id,
          totalQuestionsInDB: directQuestionsCount,
        });
      }
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
      const prismaGroupQuestionsCount = questionnaire.questionGroups?.reduce((sum, group) => sum + (group.questions?.length || 0), 0) || 0;
      const prismaQuestionsCount = prismaGroupQuestionsCount + (questionnaire.questions?.length || 0);

      if (typeof directQuestionsCount !== 'undefined' && directQuestionsCount > 0 && prismaQuestionsCount === 0) {
        logger.warn('⚠️ В БД ЕСТЬ вопросы, но Prisma не вернул их в анкете!', {
          directQuestionsCount,
          directQuestionsInGroupsCount,
          directQuestionsWithoutGroupCount,
          directGroupsCount,
          prismaGroupQuestionsCount,
          prismaQuestionsCount,
        });
      }
      logger.info('✅ Questionnaire found in DB', {
        questionnaireId: questionnaire.id,
        hasQuestionGroups: !!questionnaire.questionGroups,
        hasQuestions: !!questionnaire.questions,
        questionGroupsCount: questionnaire.questionGroups?.length || 0,
        questionsCount: questionnaire.questions?.length || 0,
        prismaQuestionsCount,
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
        logger.info(`🔍 Group ${g.id} (${g.title}): ${qCount} questions`, {
          groupId: g.id,
          groupTitle: g.title,
          questionsCount: qCount,
          questionsIsArray: Array.isArray(g.questions),
          questionsType: typeof g.questions,
          // КРИТИЧНО: Логируем первые вопросы в группе для диагностики
          sampleQuestions: Array.isArray(g.questions) ? g.questions.slice(0, 3).map((q: any) => ({
            id: q?.id,
            code: q?.code,
          })) : 'not array',
        });
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
    
    // КРИТИЧНО: Детальная диагностика, если totalQuestionsCount === 0
    if (totalQuestionsCount === 0) {
      logger.error('❌ КРИТИЧЕСКАЯ ПРОБЛЕМА: totalQuestionsCount === 0 после Prisma запроса!', {
        questionnaireId: questionnaire.id,
        groupsLength: groups.length,
        plainQuestionsLength: plainQuestions.length,
        groupsQuestionsCount,
        totalQuestionsCount,
        // КРИТИЧНО: Проверяем, что вернул Prisma
        groupsStructure: groups.map(g => ({
          id: g.id,
          title: g.title,
          hasQuestions: !!g.questions,
          questionsType: typeof g.questions,
          questionsIsArray: Array.isArray(g.questions),
          questionsLength: Array.isArray(g.questions) ? g.questions.length : 'not array',
        })),
        plainQuestionsStructure: {
          hasQuestions: !!questionnaire.questions,
          questionsType: typeof questionnaire.questions,
          questionsIsArray: Array.isArray(questionnaire.questions),
          questionsLength: Array.isArray(questionnaire.questions) ? questionnaire.questions.length : 'not array',
        },
      });
    }

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
    
    // ИСПРАВЛЕНО: Если вопросов нет — возвращаем 200 с пустой структурой,
    // чтобы фронт показал экран ошибки (нет вопросов), а не 500 и бесконечный лоадер
    if (totalQuestionsCount === 0) {
      const directCheck = await prisma.question.count({
        where: { questionnaireId: questionnaire.id },
      });

      logger.warn('Active questionnaire has no questions (returning empty structure)', {
        questionnaireId: questionnaire.id,
        directQuestionsCountFromDB: directCheck,
        isPrismaIssue: directCheck > 0 && totalQuestionsCount === 0,
      });

      if (directCheck > 0) {
        logger.error('Prisma did not return questions although they exist in DB', {
          questionnaireId: questionnaire.id,
          directCheck,
        });
      }

      const emptyFormatted = {
        id: questionnaire.id,
        name: questionnaire.name,
        version: questionnaire.version,
        groups: [],
        questions: [],
        _meta: {
          shouldRedirectToPlan,
          isCompleted,
          hasProfile: !!userId,
          questionnaireEmpty: true,
          preferences: {
            hasPlanProgress,
            isRetakingQuiz,
            fullRetakeFromHome,
            paymentRetakingCompleted,
            paymentFullRetakeCompleted,
          },
        },
      };

      const duration = Date.now() - startTime;
      logApiRequest(method, path, 200, duration, userId, correlationId);
      const response = NextResponse.json(emptyFormatted);
      const responseWithCache = addCacheHeaders(response, CachePresets.noCache());
      if (correlationId) addCorrelationIdToHeaders(correlationId, responseWithCache.headers);
      return responseWithCache;
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
    let response = NextResponse.json({
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
    logApiRequest(method, path, 200, duration, userId, correlationId);
    
    // Добавляем кэширование: анкета меняется редко, кэшируем на 1 час
    // Но для персональных данных (shouldRedirectToPlan) не кэшируем
    const responseWithCache = !shouldRedirectToPlan
      ? addCacheHeaders(response, CachePresets.longCache())
      : addCacheHeaders(response, CachePresets.noCache());
    if (correlationId) {
      addCorrelationIdToHeaders(correlationId, responseWithCache.headers);
    }
    return responseWithCache;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errMsg = typeof error?.message === 'string' ? error.message : '';
    
    // КРИТИЧНО: Проверяем, является ли это ошибкой отсутствия таблицы / неинициализированной схемы
    const isTableMissingError =
      error?.code === 'P2021' || // Prisma: "The table does not exist in the current database"
      error?.name === 'PrismaClientKnownRequestError' ||
      errMsg.includes('does not exist') ||
      errMsg.includes('table') && (errMsg.includes('current database') || errMsg.includes('questionnaires'));
    
    if (isTableMissingError) {
      logger.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Таблица не существует в БД (миграции не применены)', error, {
        errorMessage: error?.message,
        errorCode: error?.code,
        errorName: error?.name,
        tableName: error?.message?.match(/table `([^`]+)`/)?.[1] || 'unknown',
        suggestion: 'Необходимо применить миграции Prisma: npx prisma migrate deploy',
      });

      logApiError(method, path, error, userId, correlationId);

      // Возвращаем 200 с пустой анкетой, чтобы фронт не уходил в бесконечный лоадер,
      // а показал экран «анкета недоступна» (нет вопросов → ERROR с сообщением)
      const emptySchemaResponse = NextResponse.json({
        id: 'schema-uninitialized',
        name: '',
        version: 0,
        groups: [],
        questions: [],
        _meta: {
          shouldRedirectToPlan: false,
          isCompleted: false,
          hasProfile: false,
          questionnaireEmpty: true,
          schemaError: true,
          preferences: {
            hasPlanProgress: false,
            isRetakingQuiz: false,
            fullRetakeFromHome: false,
            paymentRetakingCompleted: false,
            paymentFullRetakeCompleted: false,
          },
        },
      });
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 200, duration, userId, correlationId);
      const responseWithCache = addCacheHeaders(emptySchemaResponse, CachePresets.noCache());
      if (correlationId) addCorrelationIdToHeaders(correlationId, responseWithCache.headers);
      return responseWithCache;
    }
    
    logger.error('Error fetching active questionnaire', error, {
      errorMessage: error?.message,
      errorStack: error?.stack?.substring(0, 500),
    });
    
    // ИСПРАВЛЕНО: Логируем ошибку в KV для мониторинга
    logApiError(method, path, error, userId, correlationId);
    
    const errorResponse = NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error?.message : undefined },
      { status: 500 }
    );
    if (correlationId) {
      addCorrelationIdToHeaders(correlationId, errorResponse.headers);
    }
    return errorResponse;
  }
}
