import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { getCurrentProfile } from '@/lib/get-current-profile';
import { addCacheHeaders, CachePresets } from '@/lib/utils/api-cache';
import { getCorrelationId, addCorrelationIdToHeaders } from '@/lib/utils/correlation-id';

function makeDbUnavailableResponse(
  startTime: number,
  method: string,
  path: string,
  userId: string | null,
  correlationId: string | undefined,
  error: any
) {
  const duration = Date.now() - startTime;
  logger.error('DB unavailable — returning 503', error, {
    errorName: error?.name,
    errorCode: error?.code,
    errorMessage: error?.message?.substring(0, 300),
  });
  logApiError(method, path, error, userId, correlationId);
  const res = NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  if (correlationId) addCorrelationIdToHeaders(correlationId, res.headers);
  logApiRequest(method, path, 503, duration, userId, correlationId);
  return res;
}

function isDbUnavailableError(error: any): boolean {
  const name: string = error?.name ?? '';
  const msg: string = error?.message ?? '';
  const code: string = error?.code ?? '';
  return (
    name === 'PrismaClientInitializationError' ||
    // P1xxx = connection / auth / server errors
    (name === 'PrismaClientKnownRequestError' && /^P1/.test(code)) ||
    msg.includes('WASM') ||
    msg.includes('WebAssembly') ||
    msg.includes('Unable to connect') ||
    msg.includes('Can\'t reach database') ||
    msg.includes('Connection refused') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('getaddrinfo ENOTFOUND')
  );
}

function isSchemaError(error: any): boolean {
  const name: string = error?.name ?? '';
  const msg: string = error?.message ?? '';
  const code: string = error?.code ?? '';
  return (
    code === 'P2021' ||
    (name === 'PrismaClientKnownRequestError' && code === 'P2021') ||
    (msg.includes('does not exist') && msg.includes('table'))
  );
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/questionnaire/active';
  let userId: string | null = null;
  const correlationId = getCorrelationId(request) || undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: false });
    let shouldRedirectToPlan = false;
    let isCompleted = false;
    let hasPlanProgress = false;
    let isRetakingQuiz = false;
    let fullRetakeFromHome = false;
    let paymentRetakingCompleted = false;
    let paymentFullRetakeCompleted = false;

    if (!auth.ok) {
      logger.warn('Telegram auth failed, loading questionnaire as public', {
        hasInitData: !!request.headers.get('X-Telegram-Init-Data') || !!request.headers.get('x-telegram-init-data'),
      });
    }

    if (auth.ok) {
      try {
        userId = auth.ctx.userId;

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

        if (profile?.id && activeQuestionnaireId) {
          const answersCount = await prisma.userAnswer.count({
            where: { userId, questionnaireId: activeQuestionnaireId.id },
          });
          if (answersCount > 0) {
            isCompleted = true;
            shouldRedirectToPlan = true;
          }
        }
      } catch (profilePrefsError: any) {
        if (isDbUnavailableError(profilePrefsError)) {
          return makeDbUnavailableResponse(startTime, method, path, auth.ctx.userId, correlationId, profilePrefsError);
        }
        logger.warn('Failed to load profile/preferences, continuing with defaults', {
          userId: auth.ctx.userId,
          errorMessage: profilePrefsError?.message,
          code: profilePrefsError?.code,
        });
        userId = auth.ctx.userId;
      }
    }

    const questionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      include: {
        questionGroups: {
          include: {
            questions: {
              include: {
                answerOptions: { orderBy: { position: 'asc' } },
              },
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
        questions: {
          where: { groupId: null },
          include: {
            answerOptions: { orderBy: { position: 'asc' } },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!questionnaire) {
      logger.warn('No active questionnaire found in DB');
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 404, duration, userId, correlationId);
      const res = NextResponse.json({ error: 'No active questionnaire found' }, { status: 404 });
      if (correlationId) addCorrelationIdToHeaders(correlationId, res.headers);
      return res;
    }

    const groups = questionnaire.questionGroups ?? [];
    const plainQuestions = questionnaire.questions ?? [];
    const totalQuestionsCount =
      groups.reduce((sum, g) => sum + (g.questions?.length ?? 0), 0) +
      plainQuestions.length;

    logger.info('Active questionnaire loaded', {
      questionnaireId: questionnaire.id,
      groupsCount: groups.length,
      totalQuestionsCount,
      shouldRedirectToPlan,
      isCompleted,
    });

    if (totalQuestionsCount === 0) {
      logger.warn('Active questionnaire has no questions', { questionnaireId: questionnaire.id });

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

    const formatted = {
      id: questionnaire.id,
      name: questionnaire.name,
      version: questionnaire.version,
      groups: groups.map(group => ({
        id: group.id,
        title: group.title,
        position: group.position,
        questions: (group.questions ?? []).map(q => ({
          id: q.id,
          code: q.code,
          text: q.text,
          type: q.type,
          position: q.position,
          isRequired: q.isRequired,
          description: null,
          options: (q.answerOptions ?? []).map(opt => ({
            id: opt.id,
            value: opt.value,
            label: opt.label,
            position: opt.position,
          })),
        })),
      })),
      questions: plainQuestions.map(q => ({
        id: q.id,
        code: q.code,
        text: q.text,
        type: q.type,
        position: q.position,
        isRequired: q.isRequired,
        description: null,
        options: (q.answerOptions ?? []).map(opt => ({
          id: opt.id,
          value: opt.value,
          label: opt.label,
          position: opt.position,
        })),
      })),
    };

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId, correlationId);

    const response = NextResponse.json({
      ...formatted,
      _meta: {
        shouldRedirectToPlan,
        isCompleted,
        hasProfile: !!userId,
        preferences: {
          hasPlanProgress,
          isRetakingQuiz,
          fullRetakeFromHome,
          paymentRetakingCompleted,
          paymentFullRetakeCompleted,
        },
      },
    });

    const responseWithCache = !shouldRedirectToPlan
      ? addCacheHeaders(response, CachePresets.longCache())
      : addCacheHeaders(response, CachePresets.noCache());
    if (correlationId) addCorrelationIdToHeaders(correlationId, responseWithCache.headers);
    return responseWithCache;
  } catch (error: any) {
    const duration = Date.now() - startTime;

    if (isDbUnavailableError(error)) {
      return makeDbUnavailableResponse(startTime, method, path, userId, correlationId, error);
    }

    if (isSchemaError(error)) {
      logger.error('Schema error — tables missing, migrations not applied', error, {
        errorCode: error?.code,
        errorMessage: error?.message,
      });
      logApiError(method, path, error, userId, correlationId);

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
      logApiRequest(method, path, 200, duration, userId, correlationId);
      const responseWithCache = addCacheHeaders(emptySchemaResponse, CachePresets.noCache());
      if (correlationId) addCorrelationIdToHeaders(correlationId, responseWithCache.headers);
      return responseWithCache;
    }

    logger.error('Unexpected error fetching active questionnaire', error, {
      errorName: error?.name,
      errorMessage: error?.message?.substring(0, 300),
      errorStack: error?.stack?.substring(0, 500),
    });
    logApiError(method, path, error, userId, correlationId);

    const errorResponse = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
    if (correlationId) addCorrelationIdToHeaders(correlationId, errorResponse.headers);
    return errorResponse;
  }
}
