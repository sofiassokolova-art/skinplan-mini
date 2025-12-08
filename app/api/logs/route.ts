// app/api/logs/route.ts
// API для сохранения логов клиентов
// ИСПРАВЛЕНО: Используем Upstash KV как основное хранилище для логов

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { logger } from '@/lib/logger';
import { getRedis } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    // Получаем initData из заголовков
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    // ИСПРАВЛЕНО: initData не обязателен - можем логировать даже без него
    let userId: string | null = null;
    if (initData) {
      try {
        userId = await getUserIdFromInitData(initData);
      } catch (userIdError: any) {
        console.warn('⚠️ /api/logs: Error getting userId from initData (continuing without userId):', {
          error: userIdError?.message,
        });
        // Продолжаем без userId - логируем как анонимный лог
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

    const timestamp = new Date().toISOString();
    const logData = {
      userId: userId || 'anonymous',
      level,
      message,
      context: context || null,
      userAgent: userAgent || null,
      url: url || null,
      timestamp,
    };

    // ИСПРАВЛЕНО: Сохраняем в Upstash KV как основное хранилище
    let kvSaved = false;
    
    // ИСПРАВЛЕНО: Проверяем наличие переменных окружения для диагностики
    const hasKVUrl = !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
    const writeToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    const readOnlyToken = process.env.KV_REST_API_READ_ONLY_TOKEN;
    const hasKVToken = !!writeToken;
    const tokensMatch = readOnlyToken && writeToken && writeToken === readOnlyToken;
    
    // ИСПРАВЛЕНО: Проверяем, не используется ли read-only токен вместо write token
    if (tokensMatch) {
      console.error('❌ /api/logs: KV_REST_API_TOKEN и KV_REST_API_READ_ONLY_TOKEN совпадают! Нужен write token!');
    }
    
    if (!hasKVToken && readOnlyToken) {
      console.error('❌ /api/logs: Only KV_REST_API_READ_ONLY_TOKEN is set, but KV_REST_API_TOKEN is missing!');
    }
    
    const redis = getRedis();
    
    if (!redis && (hasKVUrl && hasKVToken)) {
      // Если переменные есть, но Redis не инициализирован - это проблема
      console.warn('⚠️ /api/logs: Redis variables set but getRedis() returned null', {
        hasKVUrl,
        hasKVToken,
        tokensMatch,
        hasReadOnlyToken: !!readOnlyToken,
        kvUrl: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
      });
    }
    
    if (redis) {
      try {
        // Создаем уникальный ключ: logs:{userId}:{timestamp}:{random}
        const logKey = `logs:${userId || 'anonymous'}:${Date.now()}:${Math.random().toString(36).substring(7)}`;
        
        // ИСПРАВЛЕНО: Детальное логирование для диагностики (даже в production)
        console.log('🔄 /api/logs: Attempting to save to KV', {
          logKey,
          userId: userId || 'anonymous',
          level,
          hasRedis: !!redis,
        });
        
        // Сохраняем с TTL 30 дней
        const setResult = await redis.set(logKey, JSON.stringify(logData), { ex: 30 * 24 * 60 * 60 });
        console.log('✅ /api/logs: redis.set completed', { logKey, setResult });
        
        // Также добавляем в список последних логов пользователя (храним последние 100)
        if (userId) {
          const userLogsKey = `user_logs:${userId}`;
          await redis.lpush(userLogsKey, logKey);
          await redis.ltrim(userLogsKey, 0, 99); // Храним только последние 100 логов
          await redis.expire(userLogsKey, 30 * 24 * 60 * 60); // TTL 30 дней
          console.log('✅ /api/logs: Added to user logs list', { userLogsKey, logKey });
        }
        
        // Для ошибок также добавляем в общий список ошибок
        if (level === 'error') {
          const errorsKey = 'logs:errors:recent';
          await redis.lpush(errorsKey, logKey);
          await redis.ltrim(errorsKey, 0, 999); // Последние 1000 ошибок
          await redis.expire(errorsKey, 7 * 24 * 60 * 60); // TTL 7 дней
          console.log('✅ /api/logs: Added to errors list', { errorsKey, logKey });
        }
        
        kvSaved = true;
        console.log('✅ /api/logs: Log saved to Upstash KV successfully', {
          userId: userId || 'anonymous',
          level,
          message: message.substring(0, 50),
          logKey,
        });
      } catch (kvError: any) {
        // ИСПРАВЛЕНО: Детальное логирование ошибки (даже в production)
        console.error('❌ /api/logs: Upstash KV error (will try PostgreSQL fallback):', {
          error: kvError?.message,
          errorCode: kvError?.code,
          errorName: kvError?.name,
          errorStack: kvError?.stack?.substring(0, 500),
          hasRedis: !!redis,
          hasKVUrl,
          hasKVToken,
          kvUrl: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
          kvUrlLength: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)?.length || 0,
          tokenLength: (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)?.length || 0,
          isReadOnlyToken: kvError?.message?.includes('NOPERM') || kvError?.message?.includes('read-only'),
        });
        
        // Если это ошибка read-only токена, логируем отдельно
        if (kvError?.message?.includes('NOPERM') || kvError?.message?.includes('read-only')) {
          console.error('❌ /api/logs: READ-ONLY TOKEN ERROR! KV_REST_API_TOKEN is read-only token, not write token!', {
            kvUrl: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
            hasKVToken: hasKVToken,
          });
        }
      }
    } else if (!hasKVUrl || !hasKVToken) {
      // Если Redis не настроен - это нормально, используем только PostgreSQL
      if (process.env.NODE_ENV === 'development') {
        console.log('ℹ️ /api/logs: Upstash KV not configured, using PostgreSQL only', {
          hasKVUrl,
          hasKVToken,
        });
      }
    }

    // Fallback: Сохраняем в PostgreSQL (если доступен и userId есть)
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
        console.log('✅ /api/logs: Log saved to PostgreSQL (fallback)', {
          userId,
          level,
          message: message.substring(0, 50),
        });
      } catch (dbError: any) {
        // Если KV уже сохранил, это не критично
        if (!kvSaved) {
          console.error('❌ /api/logs: Database error saving log:', {
            error: dbError?.message,
            code: dbError?.code,
          });
          // Если не удалось сохранить ни в KV, ни в БД - это проблема
          if (!kvSaved) {
            throw dbError;
          }
        }
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

    // ИСПРАВЛЕНО: Логируем результат сохранения (даже в production для диагностики)
    console.log('📊 /api/logs: Save result', {
      kvSaved,
      storedIn: kvSaved ? 'kv' : (userId ? 'postgres' : 'none'),
      userId: userId || 'anonymous',
      level,
      hasKVUrl,
      hasKVToken,
    });
    
    // Если хотя бы одно хранилище успешно - возвращаем успех
    return NextResponse.json({ 
      success: true,
      storedIn: kvSaved ? 'kv' : (userId ? 'postgres' : 'none'),
      kvSaved,
      hasKVUrl,
      hasKVToken,
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
    
    // ИСПРАВЛЕНО: Даже при ошибке пытаемся сохранить в KV как последний резерв
    try {
      const redis = getRedis();
      if (redis) {
        const errorLogKey = `logs:errors:${Date.now()}:${Math.random().toString(36).substring(7)}`;
        await redis.set(errorLogKey, JSON.stringify({
          error: error?.message,
          stack: error?.stack,
          timestamp: new Date().toISOString(),
        }), { ex: 7 * 24 * 60 * 60 }); // TTL 7 дней
      }
    } catch (kvError) {
      // Игнорируем ошибки сохранения ошибок логирования
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}

