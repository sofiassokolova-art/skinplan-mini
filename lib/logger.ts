// lib/logger.ts
// Структурированное логирование для production

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

interface ClientLogOptions {
  userId?: string | null;
  userAgent?: string;
  url?: string;
  saveToDb?: boolean; // Сохранять ли в БД (по умолчанию только error и warn)
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private serviceName = process.env.SERVICE_NAME || 'skinplan-mini';
  
  // Функция для сохранения лога в БД (асинхронно, не блокирует)
  private async saveToDatabase(
    level: LogLevel,
    message: string,
    context?: LogContext,
    options?: ClientLogOptions
  ) {
    // Сохраняем только error и warn по умолчанию, или если явно указано saveToDb: true
    const shouldSave = options?.saveToDb === true || 
                       (options?.saveToDb !== false && (level === 'error' || level === 'warn'));
    
    if (!shouldSave || !options?.userId) {
      return;
    }

    // Сохраняем асинхронно, не блокируя основной поток
    setTimeout(async () => {
      try {
        // Динамический импорт для избежания циклических зависимостей
        const { prisma } = await import('@/lib/db');
        const { Prisma } = await import('@prisma/client');
        
        await prisma.clientLog.create({
          data: {
            userId: options.userId!,
            level,
            message,
            context: context ? (context as any) : undefined,
            userAgent: options.userAgent || null,
            url: options.url || null,
          },
        });
      } catch (error) {
        // Не логируем ошибки сохранения логов, чтобы избежать бесконечной рекурсии
        console.error('Failed to save log to database:', error);
      }
    }, 0);
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      service: this.serviceName,
      message,
      ...context,
    };

    // В development - красивый вывод, в production - JSON
    if (this.isDevelopment) {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${context ? ' ' + JSON.stringify(context, null, 2) : ''}`;
    }

    return JSON.stringify(logEntry);
  }

  private log(level: LogLevel, message: string, context?: LogContext, options?: ClientLogOptions) {
    const formatted = this.formatMessage(level, message, context);
    
    switch (level) {
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formatted);
        }
        break;
      case 'info':
        console.log(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        // В production можно отправлять ошибки в сервис мониторинга
        if (!this.isDevelopment && process.env.SENTRY_DSN) {
          // TODO: Интеграция с Sentry или другим сервисом
        }
        break;
    }

    // Сохраняем в БД (асинхронно)
    this.saveToDatabase(level, message, context, options);
  }

  debug(message: string, context?: LogContext, options?: ClientLogOptions) {
    this.log('debug', message, context, options);
  }

  info(message: string, context?: LogContext, options?: ClientLogOptions) {
    this.log('info', message, context, options);
  }

  warn(message: string, context?: LogContext, options?: ClientLogOptions) {
    this.log('warn', message, context, options);
  }

  error(message: string, error?: Error | unknown, context?: LogContext, options?: ClientLogOptions) {
    const errorContext: LogContext = {
      ...context,
    };

    if (error instanceof Error) {
      errorContext.error = {
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
        name: error.name,
      };
    } else if (error) {
      // ИСПРАВЛЕНО: Правильно сериализуем объекты и другие типы ошибок
      if (typeof error === 'object' && error !== null) {
        try {
          errorContext.error = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        } catch {
          // Если не удалось сериализовать, пробуем преобразовать в строку с дополнительной информацией
          try {
            errorContext.error = {
              type: error.constructor?.name || 'Object',
              stringified: String(error),
              keys: Object.keys(error),
            };
          } catch {
            errorContext.error = String(error);
          }
        }
      } else {
        errorContext.error = String(error);
      }
    }

    this.log('error', message, errorContext, options);
  }
}

// Singleton instance
export const logger = new Logger();

// Helper для логирования API запросов
export function logApiRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  userId?: string | null
) {
  // Логируем в консоль (Vercel logs)
  logger.info('API Request', {
    method,
    path,
    statusCode,
    duration,
    userId,
  });

  // ИСПРАВЛЕНО: Сохраняем в KV асинхронно, но надежно
  // Используем Promise.resolve().then() для неблокирующего выполнения
  // Это гарантирует, что логирование произойдет даже если setTimeout не сработает
  Promise.resolve().then(async () => {
    try {
      const { getRedis } = await import('@/lib/redis');
      const redis = getRedis();
      
      if (!redis) {
        // Redis не настроен - логируем только в production для диагностики
        if (process.env.NODE_ENV === 'production') {
          console.warn('⚠️ API log not saved to KV: Redis not configured', {
            method,
            path,
            hasKVUrl: !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
            hasKVToken: !!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
          });
        }
        return;
      }

      // Создаем структурированный лог для KV
      const logData = {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: process.env.SERVICE_NAME || 'skinplan-mini',
        message: 'API Request',
        method,
        path,
        statusCode,
        duration,
        userId: userId || null,
      };

      // Создаем уникальный ключ: api_logs:{userId}:{timestamp}:{random}
      const logKey = `api_logs:${userId || 'anonymous'}:${Date.now()}:${Math.random().toString(36).substring(7)}`;
      
      // Сохраняем с TTL 30 дней
      const setResult = await redis.set(logKey, JSON.stringify(logData), { ex: 30 * 24 * 60 * 60 });
      
      // Также добавляем в список последних API логов пользователя (храним последние 100)
      if (userId) {
        const userApiLogsKey = `user_api_logs:${userId}`;
        await redis.lpush(userApiLogsKey, logKey);
        await redis.ltrim(userApiLogsKey, 0, 99); // Храним только последние 100 логов
        await redis.expire(userApiLogsKey, 30 * 24 * 60 * 60); // TTL 30 дней
      }
      
      // Логируем успешную запись в KV (для диагностики)
      console.log('✅ API log saved to KV', {
        method,
        path,
        statusCode,
        userId: userId || 'anonymous',
        logKey: logKey.substring(0, 50) + '...',
      });
    } catch (error: any) {
      // Логируем ошибки сохранения в KV (для диагностики)
      console.error('❌ Failed to save API request log to KV:', {
        method,
        path,
        error: error?.message,
        errorCode: error?.code,
        userId: userId || 'anonymous',
      });
    }
  }).catch((error) => {
    // Обрабатываем ошибки промиса (на случай, если Promise.resolve().then() не сработает)
    console.error('❌ Failed to schedule API request log to KV:', {
      method,
      path,
      error: error?.message,
    });
  });
}

// Helper для логирования ошибок API
export function logApiError(
  method: string,
  path: string,
  error: Error | unknown,
  userId?: string | null,
  options?: ClientLogOptions
) {
  logger.error('API Error', error, {
    method,
    path,
    userId: userId || undefined,
  }, {
    ...options,
    userId: userId || undefined,
  });
}

// Экспортируем типы для использования в других модулях
export type { LogLevel, LogContext, ClientLogOptions };

