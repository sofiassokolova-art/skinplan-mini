// app/api/admin/auth/route.ts
// API для авторизации админа через Telegram initData

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromInitData } from '@/lib/get-admin-from-initdata';
import jwt from 'jsonwebtoken';
import { getTelegramInitDataFromHeaders } from '@/lib/auth/telegram-auth';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

    // Генерируем JWT токен
    const token = jwt.sign(
      {
        adminId: result.admin.id,
        telegramId: result.admin.telegramId,
        role: result.admin.role,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );


    // Создаем ответ с токеном
    const response = NextResponse.json({
      token,
      admin: {
        id: result.admin.id,
        telegramId: result.admin.telegramId,
        role: result.admin.role,
      },
    });

    // Устанавливаем токен в cookies
    response.cookies.set('admin_token', token, {
      httpOnly: false, // Нужен доступ из JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Admin auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - проверка текущего токена
export async function GET(request: NextRequest) {
  try {
    const token =
      request.cookies.get('admin_token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
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
    } catch (error) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

