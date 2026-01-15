// lib/utils/correlation-id.ts
// Утилиты для генерации и управления correlation IDs для трейсинга запросов

import { headers } from 'next/headers';
import { NextRequest } from 'next/server';

const CORRELATION_ID_HEADER = 'X-Correlation-ID';
const REQUEST_ID_HEADER = 'X-Request-ID';

/**
 * Генерирует уникальный correlation ID
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Получает correlation ID из заголовков запроса или генерирует новый
 */
export function getCorrelationId(request?: NextRequest | Request | null): string {
  if (request) {
    const correlationId = request.headers.get(CORRELATION_ID_HEADER) ||
                         request.headers.get(REQUEST_ID_HEADER);
    if (correlationId) {
      return correlationId;
    }
  }

  // Пытаемся получить из Next.js headers (для Server Components)
  try {
    const headersList = headers();
    const correlationId = headersList.get(CORRELATION_ID_HEADER) ||
                        headersList.get(REQUEST_ID_HEADER);
    if (correlationId) {
      return correlationId;
    }
  } catch (e) {
    // Игнорируем ошибки, если headers() недоступен
  }

  // Генерируем новый, если не найден
  return generateCorrelationId();
}

/**
 * Добавляет correlation ID в заголовки ответа
 */
export function addCorrelationIdToHeaders(
  correlationId: string,
  headers: Headers
): void {
  headers.set(CORRELATION_ID_HEADER, correlationId);
}

/**
 * Создает контекст для логирования с correlation ID
 */
export function createLogContext(
  correlationId: string,
  additionalContext?: Record<string, any>
): Record<string, any> {
  return {
    correlationId,
    ...additionalContext,
  };
}

/**
 * Middleware для добавления correlation ID в запросы
 * Используется в Next.js middleware
 */
export function correlationIdMiddleware(request: NextRequest) {
  const correlationId = getCorrelationId(request);
  
  // Клонируем запрос с добавлением correlation ID в заголовки
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_ID_HEADER, correlationId);
  
  return {
    correlationId,
    requestHeaders,
  };
}
