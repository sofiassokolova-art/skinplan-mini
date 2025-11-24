// app/api/auth/telegram/route.ts
// Авторизация через Telegram WebApp

import { NextRequest, NextResponse } from 'next/server';
import { validateTelegramInitData } from '@/lib/telegram';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

// Используем Node.js runtime для поддержки jsonwebtoken
export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    const { initData } = await request.json();

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing initData' },
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
        { error: validation.error || 'Invalid initData' },
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

    // Создаем или обновляем пользователя
    const dbUser = await prisma.user.upsert({
      where: { telegramId: user.id.toString() },
      update: {
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        language: user.language_code || 'ru',
        updatedAt: new Date(),
      },
      create: {
        telegramId: user.id.toString(),
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        language: user.language_code || 'ru',
      },
    });

    // Генерируем JWT токен
    const token = jwt.sign(
      {
        userId: dbUser.id,
        telegramId: dbUser.telegramId,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      token,
      user: {
        id: dbUser.id,
        telegramId: dbUser.telegramId,
        username: dbUser.username,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
