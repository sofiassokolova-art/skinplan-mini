// lib/auth/telegram-auth.ts
// Единый guard для Telegram WebApp initData
// Цели:
// - header-only источник initData (никаких body/cookies)
// - валидируем HMAC
// - разделяем AUTH ошибки и DB ошибки
// - минимальные побочные эффекты (по умолчанию без записи в БД)

import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateTelegramInitData } from '@/lib/telegram';
import { prisma } from '@/lib/db';
import { updateUserActivity } from '@/lib/update-user-activity';

export type TelegramAuthErrorCode =
  | 'AUTH_MISSING_INITDATA'
  | 'AUTH_INVALID_INITDATA'
  | 'AUTH_BOT_TOKEN_MISSING'
  | 'DB_UNAVAILABLE'
  | 'DB_SCHEMA_MISMATCH'
  | 'DB_ERROR'
  | 'USER_NOT_FOUND';

export type TelegramAuthContext = {
  telegramId: string;
  userId: string;
  user: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
};

export function getTelegramInitDataFromHeaders(request: NextRequest): string | null {
  return (
    request.headers.get('x-telegram-init-data') ||
    request.headers.get('X-Telegram-Init-Data') ||
    null
  );
}

export function tryGetTelegramIdentityFromRequest(
  request: NextRequest
):
  | { ok: true; telegramId: string; user: TelegramAuthContext['user'] }
  | { ok: false; code: TelegramAuthErrorCode; message: string } {
  const initData = getTelegramInitDataFromHeaders(request);
  if (!initData) {
    return { ok: false, code: 'AUTH_MISSING_INITDATA', message: 'Missing Telegram initData' };
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { ok: false, code: 'AUTH_BOT_TOKEN_MISSING', message: 'Bot token not configured' };
  }
  const validation = validateTelegramInitData(initData, botToken);
  if (!validation.valid || !validation.data?.user) {
    return { ok: false, code: 'AUTH_INVALID_INITDATA', message: validation.error || 'Invalid initData' };
  }
  const telegramUser = validation.data.user;
  return { ok: true, telegramId: telegramUser.id.toString(), user: telegramUser };
}

function isMissingColumnError(err: any, columnSubstring: string) {
  return (
    err?.code === 'P2022' &&
    (err?.meta?.column === columnSubstring ||
      (typeof err?.meta?.column === 'string' && err.meta.column.includes(columnSubstring)) ||
      (typeof err?.message === 'string' && err.message.includes(columnSubstring)))
  );
}

async function findUserIdByTelegramId(telegramId: string): Promise<string | null> {
  const existing = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true },
  });
  return existing?.id || null;
}

async function ensureUserIdByTelegramId(telegramId: string, userPayload?: TelegramAuthContext['user']): Promise<string> {
  // ВАЖНО: эта функция может писать в БД, поэтому вызывается только из endpoints,
  // где создание пользователя допустимо. Сама по себе auth-валидация её не вызывает.
  const now = new Date();

  const existingId = await findUserIdByTelegramId(telegramId);
  if (existingId) {
    // Асинхронно обновляем lastActive (не критично для запроса)
    updateUserActivity(existingId).catch(() => undefined);
    return existingId;
  }

  try {
    const created = await prisma.user.create({
      data: {
        telegramId,
        username: userPayload?.username || null,
        firstName: userPayload?.first_name || null,
        lastName: userPayload?.last_name || null,
        language: userPayload?.language_code || 'ru',
        lastActive: now,
      },
      select: { id: true },
    });

    return created.id;
  } catch (err: any) {
    // Гонка: второй параллельный create
    if (err?.code === 'P2002') {
      const raced = await findUserIdByTelegramId(telegramId);
      if (raced) return raced;
    }
    throw err;
  }
}

export async function requireTelegramAuth(
  request: NextRequest,
  options?: {
    // Если true — userId должен существовать в БД, иначе будет 404 (без создания)
    requireExistingUser?: boolean;
    // Если true — создаём пользователя при отсутствии
    ensureUser?: boolean;
  }
): Promise<
  | { ok: true; ctx: TelegramAuthContext }
  | { ok: false; response: ReturnType<typeof ApiResponse.error> }
> {
  const initData = getTelegramInitDataFromHeaders(request);

  if (!initData) {
    return {
      ok: false,
      response: ApiResponse.failure({
        status: 401,
        code: 'AUTH_MISSING_INITDATA',
        message: 'Missing Telegram initData',
      }),
    };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return {
      ok: false,
      response: ApiResponse.failure({
        status: 500,
        code: 'AUTH_BOT_TOKEN_MISSING',
        message: 'Bot token not configured',
      }),
    };
  }

  const validation = validateTelegramInitData(initData, botToken);
  if (!validation.valid || !validation.data?.user) {
    return {
      ok: false,
      response: ApiResponse.failure({
        status: 401,
        code: 'AUTH_INVALID_INITDATA',
        message: validation.error || 'Invalid or expired initData',
      }),
    };
  }

  const telegramUser = validation.data.user;
  const telegramId = telegramUser.id.toString();

  try {
    let userId: string | null = null;

    if (options?.ensureUser) {
      userId = await ensureUserIdByTelegramId(telegramId, telegramUser);
    } else {
      userId = await findUserIdByTelegramId(telegramId);
    }

    if (!userId) {
      if (options?.requireExistingUser) {
        return {
          ok: false,
          response: ApiResponse.failure({
            status: 404,
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          }),
        };
      }

      // По умолчанию считаем, что отсутствие пользователя — нормальное состояние.
      // Но большинство защищенных ручек требуют userId, поэтому лучше явно включать ensureUser.
      return {
        ok: false,
        response: ApiResponse.failure({
          status: 503,
          code: 'DB_UNAVAILABLE',
          message: 'User record is missing (enable ensureUser for this endpoint)',
        }),
      };
    }

    return {
      ok: true,
      ctx: {
        telegramId,
        userId,
        user: telegramUser,
      },
    };
  } catch (err: any) {
    // AUTH != DB: DB ошибки — это 500/503, а не 401
    const code: TelegramAuthErrorCode =
      isMissingColumnError(err, 'current_profile_id') ? 'DB_SCHEMA_MISMATCH' : 'DB_ERROR';

    const status = code === 'DB_SCHEMA_MISMATCH' ? 503 : 503;

    logger.error('Telegram auth: DB error while resolving user', err, {
      telegramId,
      code,
    });

    return {
      ok: false,
      response: ApiResponse.failure({
        status,
        code,
        message: 'Database error while resolving user',
      }),
    };
  }
}
