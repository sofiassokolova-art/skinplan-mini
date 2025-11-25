// app/api/admin/telegram-callback/route.ts
// Обработка callback от Telegram Login Widget

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateTelegramLoginWidget } from '@/lib/validate-telegram-login';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const userData = await request.json();

    // Валидируем данные от Telegram Login Widget
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: 'Bot token not configured' },
        { status: 500 }
      );
    }

    const validation = validateTelegramLoginWidget(userData, botToken);
    
    if (!validation.valid) {
      console.error('Invalid Telegram login widget data:', validation.error);
      return NextResponse.json(
        { error: 'Invalid authentication data' },
        { status: 401 }
      );
    }

    // Ищем админа по telegramId или telegramUsername
    const admin = await prisma.admin.findFirst({
      where: {
        OR: [
          { telegramId: userData.id.toString() },
          { telegramUsername: userData.username || undefined },
        ],
      },
    });

    if (!admin) {
      console.warn(`Admin login attempt from non-whitelisted user: ${userData.id} (@${userData.username})`);
      return NextResponse.json(
        { error: 'Доступ запрещен. Ваш аккаунт не в списке администраторов.' },
        { status: 403 }
      );
    }

    // Обновляем данные админа из Telegram (если изменились)
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        telegramId: userData.id.toString(),
        telegramUsername: userData.username || null,
      },
    });

    // Генерируем JWT токен
    const token = jwt.sign(
      {
        adminId: admin.id,
        telegramId: userData.id.toString(),
        role: admin.role || 'admin',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Admin logged in via Telegram Login Widget:', { 
      adminId: admin.id, 
      telegramId: userData.id.toString(),
      telegramUsername: userData.username,
      role: admin.role 
    });

    return NextResponse.json({
      token,
      admin: {
        id: admin.id,
        telegramId: userData.id.toString(),
        telegramUsername: userData.username,
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

