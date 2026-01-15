// lib/api/errors.ts
// Обработка ошибок API запросов

export interface ApiError extends Error {
  status?: number;
  isNotFound?: boolean;
  isMethodError?: boolean;
  retryAfter?: number;
  details?: any;
  response?: {
    status: number;
    data: any;
  };
}

/**
 * Создает ошибку для 401 Unauthorized
 */
export function createUnauthorizedError(endpoint: string, hasInitData: boolean, errorData: any): ApiError {
  const error = new Error(
    hasInitData 
      ? (errorData.error || 'Ошибка авторизации. Попробуйте обновить страницу.')
      : 'Откройте приложение через Telegram Mini App. initData не доступен.'
  ) as ApiError;
  error.status = 401;
  return error;
}

/**
 * Создает ошибку для 404 Not Found
 */
export function createNotFoundError(errorData: any): ApiError {
  const error = new Error(errorData.error || 'Not found') as ApiError;
  error.status = 404;
  error.isNotFound = true;
  return error;
}

/**
 * Создает ошибку для 405 Method Not Allowed
 */
export function createMethodError(errorData: any): ApiError {
  const error = new Error(`HTTP 405: ${errorData.error || 'Method not allowed'}`) as ApiError;
  error.status = 405;
  error.isMethodError = true;
  return error;
}

/**
 * Создает ошибку для 500 Internal Server Error
 */
export function createServerError(errorData: any): ApiError {
  const error = new Error(errorData.message || errorData.error || 'Ошибка сервера') as ApiError;
  error.status = 500;
  error.response = {
    status: 500,
    data: errorData,
  };
  return error;
}

/**
 * Создает ошибку для 429 Rate Limit
 */
export function createRateLimitError(retryAfterSeconds: number | null): ApiError {
  const message = retryAfterSeconds 
    ? `Слишком много запросов. Попробуйте через ${retryAfterSeconds} секунд.`
    : 'Слишком много запросов. Попробуйте позже.';
  const error = new Error(message) as ApiError;
  error.status = 429;
  if (retryAfterSeconds) {
    error.retryAfter = retryAfterSeconds;
  }
  return error;
}

/**
 * Создает общую ошибку API
 */
export function createApiError(status: number, errorData: any): ApiError {
  const errorMsg = errorData.error || errorData.message || `HTTP ${status}`;
  const error = new Error(errorMsg) as ApiError;
  error.status = status;
  error.details = errorData.details || errorData;
  return error;
}
