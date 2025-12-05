// lib/api-response.ts
// Единый формат ответов API и обработка ошибок

import { NextResponse } from 'next/server';
import { logger } from './logger';

export class ApiResponse {
  static success<T>(data: T, status = 200) {
    return NextResponse.json(data, { status });
  }

  static error(
    message: string,
    status = 500,
    details?: any,
    context?: Record<string, any>
  ) {
    if (context) {
      logger.error('API Error', { message, status, details, ...context });
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
    
    // Правильно сериализуем ошибку для логирования
    let errorDetails: any = {
      error: errorMessage,
      stack: errorStack,
      ...context,
    };
    
    // Если это не Error, пытаемся сериализовать как JSON
    if (!(error instanceof Error)) {
      try {
        errorDetails.errorDetails = JSON.stringify(error);
      } catch {
        errorDetails.errorDetails = String(error);
      }
    }

    logger.error('Internal server error', errorDetails);

    return ApiResponse.error(
      errorMessage,
      500,
      process.env.NODE_ENV === 'development' ? errorStack : undefined,
      context
    );
  }
}

