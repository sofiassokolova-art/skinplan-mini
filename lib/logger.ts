// lib/logger.ts
// Структурированное логирование для production

import { getCorrelationId } from './utils/correlation-id';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
  correlationId?: string; // Correlation ID для трейсинга запросов
}

interface ClientLogOptions {
  userId?: string | null;
  userAgent?: string;
  url?: string;
  saveToDb?: boolean; // Сохранять ли в БД (по умолчанию только error и warn)
  correlationId?: string; // Correlation ID для трейсинга запросов
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
      // Correlation ID всегда в начале для удобства поиска
      ...(context?.correlationId ? { correlationId: context.correlationId } : {}),
    };

    // В development - красивый вывод, в production - JSON
    if (this.isDevelopment) {
      const correlationIdStr = context?.correlationId ? `[${context.correlationId}] ` : '';
      return `[${timestamp}] ${correlationIdStr}${level.toUpperCase()}: ${message}${context ? ' ' + JSON.stringify(context, null, 2) : ''}`;
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
  userId?: string | null,
  correlationId?: string | null
) {
  // ОПТИМИЗАЦИЯ: Проверяем медленные запросы
  // Импортируем динамически, чтобы избежать циклических зависимостей
  Promise.resolve().then(async () => {
    try {
      const { checkAndLogSlowRequest } = await import('./utils/performance-monitor');
      checkAndLogSlowRequest(method, path, duration, userId, correlationId);
    } catch (error) {
      // Игнорируем ошибки импорта
    }
  });

  // Логируем в консоль (Vercel logs)
  logger.info('API Request', {
    method,
    path,
    statusCode,
    duration,
    userId,
    correlationId: correlationId || undefined,
  });

  // ИСПРАВЛЕНО: Отключаем логирование в KV по умолчанию (достигнут лимит 500000 запросов)
  // Логируем в KV только ошибки или если явно включено через env переменную
  const shouldLogToKV = process.env.ENABLE_KV_API_LOGGING === 'true' || 
                        statusCode >= 500; // Логируем только ошибки сервера
  
  if (shouldLogToKV) {
    Promise.resolve().then(async () => {
      try {
        const { getRedis } = await import('@/lib/redis');
        const redis = getRedis();
        
        if (!redis) {
          return;
        }

        // Создаем структурированный лог для KV
        const logData = {
          timestamp: new Date().toISOString(),
          level: statusCode >= 500 ? 'ERROR' : 'INFO',
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
        
        // Сохраняем с TTL 7 дней (уменьшено с 30 дней)
        await redis.set(logKey, JSON.stringify(logData), { ex: 7 * 24 * 60 * 60 });
        
        // Также добавляем в список последних API логов пользователя (храним последние 50, уменьшено с 100)
        if (userId) {
          const userApiLogsKey = `user_api_logs:${userId}`;
          await redis.lpush(userApiLogsKey, logKey);
          await redis.ltrim(userApiLogsKey, 0, 49); // Храним только последние 50 логов
          await redis.expire(userApiLogsKey, 7 * 24 * 60 * 60); // TTL 7 дней
        }
      } catch (error: any) {
        // Молча игнорируем ошибки KV (чтобы не создавать лишние запросы)
        // Только логируем в консоль для диагностики
        if (error?.message?.includes('max requests limit exceeded')) {
          console.warn('⚠️ KV request limit exceeded, skipping API log', {
            method,
            path,
            statusCode,
          });
        }
      }
    }).catch(() => {
      // Молча игнорируем ошибки промиса
    });
  }
}

// Helper для логирования ошибок API
export function logApiError(
  method: string,
  path: string,
  error: Error | unknown,
  userId?: string | null,
  correlationId?: string | null
) {
  logger.error('API Error', error, {
    method,
    path,
    userId: userId || undefined,
    correlationId: correlationId || undefined,
  }, {
    userId: userId || undefined,
  });
}

// Экспортируем типы для использования в других модулях
export type { LogLevel, LogContext, ClientLogOptions };

