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

    // ОПТИМИЗАЦИЯ: вся работа по сборке nested-JSON делается в Postgres через json_agg.
    // CF Workers free-tier даёт ~10-50ms CPU/запрос; Prisma deep-include с 5 фетчами
    // и затем object-tree allocation + JSON.stringify съедал 50-80ms → ответ резался
    // на ~12 KiB. Здесь один SQL возвращает уже готовые JSON-строки для groups/questions,
    // воркер делает только склейку через template-literal — CPU падает в ~5 раз.
    const rows = await prisma.$queryRaw<Array<{
      id: number;
      name: string;
      version: number;
      total_q: number;
      groups_json: string;
      questions_json: string;
    }>>`
      SELECT
        q.id,
        q.name,
        q.version,
        (SELECT COUNT(*)::int FROM questions WHERE questionnaire_id = q.id) AS total_q,
        COALESCE((
          SELECT json_agg(g_obj ORDER BY g_pos)::text
          FROM (
            SELECT
              g.position AS g_pos,
              json_build_object(
                'id', g.id,
                'title', g.title,
                'position', g.position,
                'questions', COALESCE((
                  SELECT json_agg(qu_obj ORDER BY qu_pos)
                  FROM (
                    SELECT
                      qu.position AS qu_pos,
                      json_build_object(
                        'id', qu.id,
                        'code', qu.code,
                        'text', qu.text,
                        'type', qu.type,
                        'position', qu.position,
                        'isRequired', qu.is_required,
                        'description', NULL,
                        'options', COALESCE((
                          SELECT json_agg(json_build_object(
                            'id', ao.id,
                            'value', ao.value,
                            'label', ao.label,
                            'position', ao.position
                          ) ORDER BY ao.position)
                          FROM answer_options ao
                          WHERE ao.question_id = qu.id
                        ), '[]'::json)
                      ) AS qu_obj
                    FROM questions qu
                    WHERE qu.group_id = g.id
                  ) sub
                ), '[]'::json)
              ) AS g_obj
            FROM question_groups g
            WHERE g.questionnaire_id = q.id
          ) sub
        ), '[]') AS groups_json,
        COALESCE((
          SELECT json_agg(qu_obj ORDER BY qu_pos)::text
          FROM (
            SELECT
              qu.position AS qu_pos,
              json_build_object(
                'id', qu.id,
                'code', qu.code,
                'text', qu.text,
                'type', qu.type,
                'position', qu.position,
                'isRequired', qu.is_required,
                'description', NULL,
                'options', COALESCE((
                  SELECT json_agg(json_build_object(
                    'id', ao.id,
                    'value', ao.value,
                    'label', ao.label,
                    'position', ao.position
                  ) ORDER BY ao.position)
                  FROM answer_options ao
                  WHERE ao.question_id = qu.id
                ), '[]'::json)
              ) AS qu_obj
            FROM questions qu
            WHERE qu.questionnaire_id = q.id AND qu.group_id IS NULL
          ) sub
        ), '[]') AS questions_json
      FROM questionnaires q
      WHERE q.is_active = true
      LIMIT 1
    `;

    const questionnaire = rows[0];

    if (!questionnaire) {
      logger.warn('No active questionnaire found in DB');
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 404, duration, userId, correlationId);
      const res = NextResponse.json({ error: 'No active questionnaire found' }, { status: 404 });
      if (correlationId) addCorrelationIdToHeaders(correlationId, res.headers);
      return res;
    }

    // groups_json и questions_json — уже готовые JSON-строки из Postgres.
    const totalQuestionsCount = questionnaire.total_q ?? 0;

    logger.info('Active questionnaire loaded', {
      questionnaireId: questionnaire.id,
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

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId, correlationId);

    // Склейка через template-literal: groups_json и questions_json уже валидный JSON
    // из Postgres, name экранируем через JSON.stringify (учитывает кавычки/спецсимволы).
    // _meta маленький (~200 байт), JSON.stringify на нём дёшев.
    const metaJson = JSON.stringify({
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
    });
    const body =
      `{"id":${questionnaire.id},` +
      `"name":${JSON.stringify(questionnaire.name)},` +
      `"version":${questionnaire.version},` +
      `"groups":${questionnaire.groups_json},` +
      `"questions":${questionnaire.questions_json},` +
      `"_meta":${metaJson}}`;

    const response = new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

    // Анкета может пересидиваться без смены URL, а _meta зависит от пользователя.
    // Долгий public cache прятал новые вопросы и мог отдавать чужой stale-state.
    const responseWithCache = addCacheHeaders(response, CachePresets.noCache());
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
