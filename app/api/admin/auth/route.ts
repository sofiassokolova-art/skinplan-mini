// app/api/admin/auth/route.ts
// API для авторизации админа через Telegram initData

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromInitData } from '@/lib/get-admin-from-initdata';
import jwt from 'jsonwebtoken';
import { getTelegramInitDataFromHeaders } from '@/lib/auth/telegram-auth';

// ИСПРАВЛЕНО (P0): Убран fallback - критическая уязвимость безопасности
// ИСПРАВЛЕНО: Возвращаем ошибку вместо throw, чтобы не ломать обработку
function getJwtSecret(): { valid: boolean; secret?: string; error?: string } {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { valid: false, error: 'JWT_SECRET is not set. Please set JWT_SECRET environment variable.' };
  }
  return { valid: true, secret };
}

// ИСПРАВЛЕНО: Runtime для Node.js (требуется для crypto, jsonwebtoken)
export const runtime = 'nodejs';

// POST - авторизация через Telegram initData
export async function POST(request: NextRequest) {
  try {
    // ВАЖНО: единый источник initData — только headers
    const initData = getTelegramInitDataFromHeaders(request);
    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData', code: 'AUTH_MISSING_INITDATA' },
        { status: 401 }
      );
    }

    // Проверяем whitelist и получаем админа
    const result = await getAdminFromInitData(initData);

    if (!result.valid || !result.admin) {
      const message = result.error || 'Unauthorized';
      const isDbError =
        /prisma|database|P20\\d\\d|ECONN|timeout/i.test(message);
      return NextResponse.json(
        { error: message, code: isDbError ? 'DB_ERROR' : 'AUTH_UNAUTHORIZED' },
        { status: isDbError ? 503 : 401 }
      );
    }

    // ИСПРАВЛЕНО (P2): Генерируем JWT токен с issuer/audience для безопасности
    const jwtSecretResult = getJwtSecret();
    if (!jwtSecretResult.valid || !jwtSecretResult.secret) {
      return NextResponse.json(
        { error: jwtSecretResult.error || 'JWT configuration error', code: 'JWT_CONFIG_ERROR' },
        { status: 500 }
      );
    }

    const token = jwt.sign(
      {
        adminId: result.admin.id,
        telegramId: result.admin.telegramId,
        role: result.admin.role,
      },
      jwtSecretResult.secret,
      {
        expiresIn: '7d',
        issuer: 'skiniq-admin',
        audience: 'skiniq-admin-ui',
      }
    );

    // ИСПРАВЛЕНО (P1): Убрали token из JSON ответа - cookie-only подход
    // ИСПРАВЛЕНО (P0): httpOnly: true для защиты от XSS
    const response = NextResponse.json({
      valid: true,
      admin: {
        id: result.admin.id,
        telegramId: result.admin.telegramId,
        role: result.admin.role,
      },
    });

    // Устанавливаем токен в cookies (httpOnly для защиты от XSS)
    response.cookies.set('admin_token', token, {
      httpOnly: true, // ИСПРАВЛЕНО (P0): Защита от XSS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Admin auth error:', error);
    // ИСПРАВЛЕНО: Показываем реальную причину ошибки для дебага
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isConfigError = errorMessage.includes('JWT_SECRET') || errorMessage.includes('TELEGRAM_BOT_TOKEN');
    
    return NextResponse.json(
      { 
        error: isConfigError ? errorMessage : 'Internal server error',
        code: isConfigError ? 'CONFIG_ERROR' : 'INTERNAL_ERROR',
        // В development показываем детали
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}

// GET - проверка текущего токена
// ИСПРАВЛЕНО (P1): Только cookie, убрали поддержку Authorization header
export async function GET(request: NextRequest) {
  try {
    // ИСПРАВЛЕНО (P1): Только cookie, убрали чтение Authorization header
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // ИСПРАВЛЕНО (P2): Проверяем JWT_SECRET ДО попытки верификации токена
    const jwtSecretResult = getJwtSecret();
    if (!jwtSecretResult.valid || !jwtSecretResult.secret) {
      console.error('JWT_SECRET not configured in GET /api/admin/auth');
      return NextResponse.json(
        { error: jwtSecretResult.error || 'JWT configuration error', code: 'JWT_CONFIG_ERROR' },
        { status: 500 }
      );
    }

    try {
      // ИСПРАВЛЕНО (P2): Проверяем issuer/audience при верификации
      const decoded = jwt.verify(token, jwtSecretResult.secret, {
        issuer: 'skiniq-admin',
        audience: 'skiniq-admin-ui',
      }) as {
        adminId: string;
        telegramId: string;
        role: string;
      };

      return NextResponse.json({
        valid: true,
        admin: {
          id: decoded.adminId,
          telegramId: decoded.telegramId,
          role: decoded.role,
        },
      });
    } catch (verifyError: any) {
      // ИСПРАВЛЕНО: Логируем ошибку верификации для отладки
      console.warn('Token verification failed:', verifyError.message);
      return NextResponse.json({ valid: false }, { status: 401 });
    }
  } catch (error) {
    // ИСПРАВЛЕНО: Показываем реальную причину ошибки для дебага
    console.error('Unexpected error in GET /api/admin/auth:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isConfigError = errorMessage.includes('JWT_SECRET') || errorMessage.includes('TELEGRAM_BOT_TOKEN');
    
    return NextResponse.json(
      { 
        error: isConfigError ? errorMessage : 'Internal server error',
        code: isConfigError ? 'CONFIG_ERROR' : 'INTERNAL_ERROR',
        // В development показываем детали
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}

