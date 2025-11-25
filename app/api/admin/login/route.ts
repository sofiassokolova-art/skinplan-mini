// app/api/admin/login/route.ts
// Авторизация админа через Telegram Login Widget

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// Функция для валидации данных, полученных от Telegram Login Widget
function validateTelegramLoginData(data: TelegramUser, botToken: string): boolean {
  const { hash, ...rest } = data;
  const checkString = Object.keys(rest)
    .sort()
    .map(key => `${key}=${rest[key as keyof typeof rest]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  return hmac === hash;
}

export async function POST(request: NextRequest) {
  try {
    const { telegramUser } = await request.json();

    if (!telegramUser) {
      return NextResponse.json(
        { error: 'Missing Telegram user data' },
        { status: 400 }
      );
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'Bot token not configured' },
        { status: 500 }
      );
    }

    // Валидируем данные, полученные от виджета
    const isValid = validateTelegramLoginData(telegramUser, TELEGRAM_BOT_TOKEN);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid Telegram login data' },
        { status: 401 }
      );
    }

    // Получаем username без @
    const telegramUsername = telegramUser.username?.toLowerCase().replace('@', '') || null;
    const telegramId = telegramUser.id.toString();

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
      console.error('Admin not found:', {
        telegramUsername,
        telegramId,
        searchedBy: telegramUsername ? 'username' : 'telegramId',
      });
      return NextResponse.json(
        { 
          error: 'Access denied. You are not an administrator.',
          debug: {
            telegramUsername,
            telegramId,
            searchedBy: telegramUsername ? 'username' : 'telegramId',
          },
        },
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

