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
// Согласно официальной документации Telegram: https://core.telegram.org/widgets/login
function validateTelegramLoginData(data: TelegramUser, botToken: string): boolean {
  const { hash, ...rest } = data;
  
  // Проверяем, что данные не старше 24 часов
  const authDate = data.auth_date;
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) { // 24 часа
    console.warn('Telegram login data expired:', { authDate, now, diff: now - authDate });
    return false;
  }

  // Формируем строку для проверки: отсортированные ключи со значениями
  const dataCheckString = Object.keys(rest)
    .sort()
    .map(key => `${key}=${rest[key as keyof typeof rest]}`)
    .join('\n');

  // Создаем секретный ключ из bot token
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  
  // Вычисляем HMAC
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const isValid = calculatedHash === hash;
  
  if (!isValid) {
    console.warn('Invalid Telegram login hash:', {
      received: hash,
      calculated: calculatedHash,
      dataCheckString: dataCheckString.substring(0, 100) + '...',
    });
  }

  return isValid;
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

