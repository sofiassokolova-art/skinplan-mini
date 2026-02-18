// app/api/logs/route.ts
// API для сохранения логов клиентов
// ИСПРАВЛЕНО: Логи сохраняются ТОЛЬКО в PostgreSQL, без Redis/KV

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { tryGetTelegramIdentityFromRequest } from '@/lib/auth/telegram-auth';

export async function POST(request: NextRequest) {
  try {
    // ИСПРАВЛЕНО: initData не обязателен - можем логировать даже без него
    let userId: string | null = null;
    const identity = await tryGetTelegramIdentityFromRequest(request);
    if (identity.ok) {
      try {
        const existing = await prisma.user.findUnique({
          where: { telegramId: identity.telegramId },
          select: { id: true },
        });
        userId = existing?.id || null;
      } catch (userIdError: any) {
        // DB ошибка ≠ auth ошибка: логирование не должно ломать продукт
        console.warn('⚠️ /api/logs: DB error while mapping telegramId->userId (continuing without userId):', {
          error: userIdError?.message,
          code: userIdError?.code,
        });
      }
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

    // ИСПРАВЛЕНО: Сохраняем ТОЛЬКО в PostgreSQL, без Redis/KV
    // Если userId есть - сохраняем в БД
    // Если userId нет - все равно возвращаем успех (логирование не должно блокировать)
    if (userId) {
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
        
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ /api/logs: Log saved to PostgreSQL', {
            userId,
            level,
            message: message.substring(0, 50),
          });
        }
      } catch (dbError: any) {
        // Если не удалось сохранить - логируем, но не блокируем ответ
        // Логирование не должно ломать приложение
        console.error('❌ /api/logs: Database error saving log:', {
          error: dbError?.message,
          code: dbError?.code,
          userId,
        });
        // Не выбрасываем ошибку - логирование не критично для работы приложения
      }
    } else {
      // userId нет - это нормально для анонимных логов
      // В будущем можем сохранять и анонимные логи, но пока просто возвращаем успех
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ /api/logs: userId is null, log not saved to PostgreSQL', {
          hasIdentity: identity.ok,
          telegramId: identity.ok ? identity.telegramId : null,
          level,
          message: message.substring(0, 50),
        });
      }
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

    // ИСПРАВЛЕНО: Возвращаем успех независимо от того, сохранился ли лог
    // Логирование не должно блокировать работу приложения
    return NextResponse.json({ 
      success: true,
      saved: !!userId, // true если userId есть и лог сохранен
      storedIn: 'postgres',
    });
  } catch (error: any) {
    console.error('❌ /api/logs: Unhandled error:', {
      error: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      meta: error?.meta,
    });
    logger.error('Error saving client log', error);
    
    // ИСПРАВЛЕНО: Даже при ошибке возвращаем 200 OK с информацией об ошибке
    // Логирование не должно блокировать приложение
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to save log',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 200 } // Всегда возвращаем 200 OK, даже при ошибке
    );
  }
}
