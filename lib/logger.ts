// lib/logger.ts
// Структурированное логирование для production

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

interface ClientLogOptions {
  userId?: string;
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
  userId?: string
) {
  logger.info('API Request', {
    method,
    path,
    statusCode,
    duration,
    userId,
  });
}

// Helper для логирования ошибок API
export function logApiError(
  method: string,
  path: string,
  error: Error | unknown,
  userId?: string,
  options?: ClientLogOptions
) {
  logger.error('API Error', error, {
    method,
    path,
    userId,
  }, {
    ...options,
    userId,
  });
}

// Экспортируем типы для использования в других модулях
export type { LogLevel, LogContext, ClientLogOptions };

