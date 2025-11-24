// app/api/admin/login/route.ts
// Авторизация админа через Telegram

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateTelegramInitData } from '@/lib/telegram';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const { initData } = await request.json();

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing initData. Please open this page through Telegram Mini App.' },
        { status: 400 }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: 'Bot token not configured' },
        { status: 500 }
      );
    }

    // Валидируем данные Telegram
    const validation = validateTelegramInitData(initData, botToken);
    
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: validation.error || 'Invalid Telegram data' },
        { status: 401 }
      );
    }

    const { user } = validation.data;
    
    if (!user) {
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 401 }
      );
    }

    // Получаем username без @
    const telegramUsername = user.username?.toLowerCase().replace('@', '') || null;
    const telegramId = user.id.toString();

    // Ищем админа по username или telegramId
    let admin = telegramUsername 
      ? await prisma.admin.findUnique({
          where: { telegramUsername },
        })
      : null;

    if (!admin) {
      admin = await prisma.admin.findUnique({
        where: { telegramId },
      });
    }

    if (!admin) {
      return NextResponse.json(
        { error: 'Access denied. You are not an administrator.' },
        { status: 403 }
      );
    }

    // Обновляем telegramId и username если их не было
    if (!admin.telegramId || !admin.telegramUsername) {
      admin = await prisma.admin.update({
        where: { id: admin.id },
        data: {
          telegramId: admin.telegramId || telegramId,
          telegramUsername: admin.telegramUsername || telegramUsername,
        },
      });
    }

    // Генерируем JWT токен
    const token = jwt.sign(
      {
        adminId: admin.id,
        telegramId: admin.telegramId,
        telegramUsername: admin.telegramUsername,
        role: admin.role || 'admin',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      token,
      admin: {
        id: admin.id,
        telegramUsername: admin.telegramUsername,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

