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
      console.error('❌ /api/logs: Missing Telegram initData');
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
        { status: 401 }
      );
    }

    // Получаем userId из initData
    let userId: string | null = null;
    try {
      userId = await getUserIdFromInitData(initData);
    } catch (userIdError: any) {
      console.error('❌ /api/logs: Error getting userId from initData:', {
        error: userIdError?.message,
        stack: userIdError?.stack,
      });
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }
    
    if (!userId) {
      console.error('❌ /api/logs: userId is null after getUserIdFromInitData');
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    // Парсим тело запроса
    let body: any;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('❌ /api/logs: Error parsing request body:', {
        error: parseError?.message,
        stack: parseError?.stack,
      });
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const { level, message, context, userAgent, url } = body;

    // Валидация
    if (!level || !message) {
      console.error('❌ /api/logs: Missing required fields', {
        hasLevel: !!level,
        hasMessage: !!message,
        bodyKeys: Object.keys(body || {}),
      });
      return NextResponse.json(
        { error: 'Missing required fields: level, message' },
        { status: 400 }
      );
    }

    if (!['debug', 'info', 'warn', 'error'].includes(level)) {
      console.error('❌ /api/logs: Invalid level', { level });
      return NextResponse.json(
        { error: 'Invalid level. Must be one of: debug, info, warn, error' },
        { status: 400 }
      );
    }

    // Сохраняем лог в БД
    try {
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
      console.log('✅ /api/logs: Log saved successfully', {
        userId,
        level,
        message: message.substring(0, 50), // Первые 50 символов сообщения
      });
    } catch (dbError: any) {
      console.error('❌ /api/logs: Database error saving log:', {
        error: dbError?.message,
        code: dbError?.code,
        meta: dbError?.meta,
        stack: dbError?.stack,
        userId,
        level,
        message: message?.substring(0, 50),
      });
      throw dbError; // Пробрасываем ошибку дальше, чтобы она попала в catch блок
    }

    // Автоматически удаляем логи старше 7 дней (в фоне, не блокируем ответ)
    // Используем setTimeout чтобы не блокировать ответ
    // Проверяем только раз в 100 запросов, чтобы не перегружать БД
    const shouldCleanup = Math.random() < 0.01; // 1% вероятность при каждом запросе
    
    if (shouldCleanup) {
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
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ /api/logs: Unhandled error:', {
      error: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      meta: error?.meta,
    });
    logger.error('Error saving client log', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

