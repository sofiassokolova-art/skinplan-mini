// app/api/admin/auth/route.ts
// API для авторизации админа через Telegram initData

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromInitData } from '@/lib/get-admin-from-initdata';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// POST - авторизация через Telegram initData
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData } = body;

    if (!initData) {
      return NextResponse.json(
        { error: 'initData is required' },
        { status: 400 }
      );
    }

    // Проверяем whitelist и получаем админа
    const result = await getAdminFromInitData(initData);

    if (!result.valid || !result.admin) {
      
      return NextResponse.json(
        { error: result.error || 'Unauthorized' },
        { status: 401 }
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

