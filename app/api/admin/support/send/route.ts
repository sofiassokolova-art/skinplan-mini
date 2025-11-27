// app/api/admin/support/send/route.ts
// Отправка ответа админа

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const cookieToken = request.cookies.get('admin_token')?.value;
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;
    
    if (!token) return false;
    
    try {
      jwt.verify(token, JWT_SECRET);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

async function sendTelegramMessage(telegramId: string, text: string): Promise<{ success: boolean; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: telegramId,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      return { success: false, error: data.description || 'Unknown error' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { chatId, text } = body;

    if (!chatId || !text || !text.trim()) {
      return NextResponse.json(
        { error: 'chatId and text are required' },
        { status: 400 }
      );
    }

    // Получаем чат и пользователя
    const chat = await prisma.supportChat.findUnique({
      where: { id: chatId },
      include: {
        user: true,
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Сохраняем сообщение в БД
    const message = await prisma.supportMessage.create({
      data: {
        chatId,
        text: text.trim(),
        isAdmin: true,
      },
    });

    // Отправляем в Telegram
    const result = await sendTelegramMessage(chat.user.telegramId, text.trim());

    if (!result.success) {
      // Сообщение сохранено, но не отправлено - можно пометить как ошибку
      console.error('Failed to send Telegram message:', result.error);
    }

    // Обновляем чат
    await prisma.supportChat.update({
      where: { id: chatId },
      data: {
        lastMessage: text.trim(),
        unreadAdmin: { increment: 1 }, // Увеличиваем счетчик непрочитанных для пользователя
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        text: message.text,
        isAdmin: message.isAdmin,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

