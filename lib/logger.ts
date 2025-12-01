// lib/logger.ts
// Структурированное логирование для production

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private serviceName = process.env.SERVICE_NAME || 'skinplan-mini';

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

  private log(level: LogLevel, message: string, context?: LogContext) {
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
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
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
      errorContext.error = String(error);
    }

    this.log('error', message, errorContext);
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
  userId?: string
) {
  logger.error('API Error', error, {
    method,
    path,
    userId,
  });
}

