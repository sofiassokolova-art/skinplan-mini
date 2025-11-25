// app/api/admin/login/route.ts
// Авторизация админа через Telegram (вайт-лист)

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromInitData } from '@/lib/get-admin-from-initdata';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    // Получаем initData из заголовков или тела запроса
    const initData = request.headers.get('x-telegram-init-data') || 
                     (await request.json()).initData;

    if (!initData) {
      return NextResponse.json(
        { error: 'Требуется авторизация через Telegram. Откройте страницу через Telegram Mini App.' },
        { status: 401 }
      );
    }

    // Проверяем, является ли пользователь админом
    const admin = await getAdminFromInitData(initData);

    if (!admin) {
      console.warn('Admin login attempt from non-whitelisted user');
      return NextResponse.json(
        { error: 'Доступ запрещен. Вы не в списке администраторов.' },
        { status: 403 }
      );
    }

    // Генерируем JWT токен
    const token = jwt.sign(
      {
        adminId: admin.id,
        telegramId: admin.telegramId,
        role: admin.role || 'admin',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Admin logged in via Telegram:', { 
      adminId: admin.id, 
      telegramId: admin.telegramId,
      telegramUsername: admin.telegramUsername,
      role: admin.role 
    });

    return NextResponse.json({
      token,
      admin: {
        id: admin.id,
        telegramId: admin.telegramId,
        telegramUsername: admin.telegramUsername,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
