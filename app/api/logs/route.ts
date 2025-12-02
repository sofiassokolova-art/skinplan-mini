// app/api/logs/route.ts
// API для сохранения логов клиентов

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Получаем initData из заголовков
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
        { status: 401 }
      );
    }

    // Получаем userId из initData
    const userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    // Парсим тело запроса
    const body = await request.json();
    const { level, message, context, userAgent, url } = body;

    // Валидация
    if (!level || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: level, message' },
        { status: 400 }
      );
    }

    if (!['debug', 'info', 'warn', 'error'].includes(level)) {
      return NextResponse.json(
        { error: 'Invalid level. Must be one of: debug, info, warn, error' },
        { status: 400 }
      );
    }

    // Сохраняем лог в БД
    await prisma.clientLog.create({
      data: {
        userId,
        level,
        message,
        context: context || null,
        userAgent: userAgent || null,
        url: url || null,
      },
    });

    // Автоматически удаляем логи старше недели (в фоне, не блокируем ответ)
    // Используем setTimeout чтобы не блокировать ответ
    setTimeout(async () => {
      try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const deleted = await prisma.clientLog.deleteMany({
          where: {
            createdAt: {
              lt: weekAgo,
            },
          },
        });
        
        if (deleted.count > 0) {
          logger.info(`Cleaned up ${deleted.count} old client logs`, {
            olderThan: weekAgo.toISOString(),
          });
        }
      } catch (cleanupError) {
        logger.error('Error cleaning up old logs', cleanupError);
      }
    }, 0);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error saving client log', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

