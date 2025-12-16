// lib/api-response.ts
// Единый формат ответов API и обработка ошибок

import { NextResponse } from 'next/server';
import { logger } from './logger';

export class ApiResponse {
  static success<T>(data: T, status = 200) {
    return NextResponse.json(data, { status });
  }

  static failure(params: {
    status: number;
    code: string;
    message: string;
    details?: any;
    context?: Record<string, any>;
  }) {
    const { status, code, message, details, context } = params;
    if (context) {
      logger.error('API Failure', undefined, { code, message, status, details, ...context });
    }
    return NextResponse.json(
      {
        error: message,
        code,
        ...(process.env.NODE_ENV === 'development' && details !== undefined ? { details } : {}),
      },
      { status }
    );
  }

  static error(
    message: string,
    status = 500,
    details?: any,
    context?: Record<string, any>
  ) {
    if (context) {
      // ИСПРАВЛЕНО: logger.error принимает (message, error, context, options)
      // Здесь нет error объекта, поэтому передаем undefined как error и context как context
      logger.error('API Error', undefined, { message, status, details, ...context });
    }

    return NextResponse.json(
      {
        error: message,
        ...(process.env.NODE_ENV === 'development' && { details }),
      },
      { status }
    );
  }

  static unauthorized(message = 'Unauthorized', context?: Record<string, any>) {
    if (context) {
      logger.warn('Unauthorized request', { message, ...context });
    }
    return ApiResponse.error(message, 401, undefined, context);
  }

  static notFound(
    message = 'Resource not found',
    context?: Record<string, any>
  ) {
    if (context) {
      logger.warn('Resource not found', { message, ...context });
    }
    return ApiResponse.error(message, 404, undefined, context);
  }

  static badRequest(
    message = 'Bad request',
    details?: any,
    context?: Record<string, any>
  ) {
    if (context) {
      logger.warn('Bad request', { message, details, ...context });
    }
    return ApiResponse.error(message, 400, details, context);
  }

  static internalError(
    error: unknown,
    context?: Record<string, any>
  ): NextResponse {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // ИСПРАВЛЕНО: Правильно сериализуем ошибку для логирования
    // logger.error принимает (message, error, context, options)
    // где error - это Error или unknown, а context - это дополнительный контекст
    logger.error('API Error', error, {
      ...context,
      errorMessage,
      errorStack,
    });

    return ApiResponse.error(
      errorMessage,
      500,
      process.env.NODE_ENV === 'development' ? errorStack : undefined,
      context
    );
  }
}

