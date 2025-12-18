// app/api/auth/telegram/route.ts
// Авторизация через Telegram WebApp

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

// Используем Node.js runtime для поддержки jsonwebtoken
export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function POST(request: NextRequest) {
  try {
    // ВАЖНО: единый header-only guard для initData
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;

    const { userId, telegramId } = auth.ctx;

    // Забираем данные пользователя из БД (минимальный select)
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Генерируем JWT токен
    const token = jwt.sign(
      {
        userId,
        telegramId,
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
