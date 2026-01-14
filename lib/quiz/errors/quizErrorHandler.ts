// lib/quiz/errors/quizErrorHandler.ts
// Централизованная обработка ошибок для quiz
// Единая стратегия для разных типов ошибок

import { clientLogger } from '@/lib/client-logger';

/**
 * Типы ошибок quiz
 */
export enum QuizErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTH = 'AUTH',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Класс ошибки quiz
 */
export class QuizError extends Error {
  constructor(
    public type: QuizErrorType,
    message: string,
    public originalError?: any,
    public statusCode?: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'QuizError';
  }
}

/**
 * Определяет тип ошибки на основе ответа
 */
export function classifyError(error: any): QuizErrorType {
  if (!error) {
    return QuizErrorType.UNKNOWN;
  }

  // HTTP статус коды
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode;
    if (status === 401 || status === 403) {
      return QuizErrorType.AUTH;
    }
    if (status === 404) {
      return QuizErrorType.NOT_FOUND;
    }
    if (status >= 500) {
      return QuizErrorType.SERVER;
    }
    if (status >= 400) {
      return QuizErrorType.VALIDATION;
    }
  }

  // Проверка сообщения об ошибке
  const message = error.message || error.toString() || '';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('connection')) {
    return QuizErrorType.NETWORK;
  }
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('401') || lowerMessage.includes('auth')) {
    return QuizErrorType.AUTH;
  }
  if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
    return QuizErrorType.NOT_FOUND;
  }
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return QuizErrorType.VALIDATION;
  }

  return QuizErrorType.UNKNOWN;
}

/**
 * Создает QuizError из любой ошибки
 */
export function createQuizError(error: any, context?: string): QuizError {
  const type = classifyError(error);
  const statusCode = error?.status || error?.statusCode;
  
  let message = 'Произошла ошибка';
  
  switch (type) {
    case QuizErrorType.NETWORK:
      message = 'Ошибка сети. Проверьте подключение к интернету.';
      break;
    case QuizErrorType.AUTH:
      message = 'Ошибка авторизации. Пожалуйста, откройте приложение через Telegram.';
      break;
    case QuizErrorType.NOT_FOUND:
      message = 'Ресурс не найден.';
      break;
    case QuizErrorType.VALIDATION:
      message = error?.message || 'Ошибка валидации данных.';
      break;
    case QuizErrorType.SERVER:
      message = 'Ошибка сервера. Пожалуйста, попробуйте позже.';
      break;
    default:
      message = error?.message || 'Произошла неизвестная ошибка.';
  }

  const quizError = new QuizError(
    type,
    message,
    error,
    statusCode,
    { context }
  );

  return quizError;
}

/**
 * Обрабатывает ошибку и возвращает пользовательское сообщение
 */
export function handleQuizError(
  error: any,
  context?: string,
  options?: {
    logError?: boolean;
    throwError?: boolean;
    returnMessage?: boolean;
  }
): string | void {
  const { logError = true, throwError = false, returnMessage = false } = options || {};
  
  const quizError = createQuizError(error, context);
  
  if (logError) {
    // Логируем только критические ошибки (не 401 для quiz)
    if (quizError.type !== QuizErrorType.AUTH || quizError.statusCode !== 401) {
      clientLogger.error(`❌ Quiz Error [${quizError.type}]:`, {
        message: quizError.message,
        context,
        statusCode: quizError.statusCode,
        details: quizError.details,
        originalError: quizError.originalError,
      });
    } else {
      // 401 ошибки логируем как предупреждения
      clientLogger.warn(`⚠️ Quiz Auth Error (401):`, {
        message: quizError.message,
        context,
      });
    }
  }
  
  if (returnMessage) {
    return quizError.message;
  }
  
  if (throwError) {
    throw quizError;
  }
}

/**
 * Обрабатывает ошибку загрузки анкеты
 */
export function handleQuestionnaireLoadError(error: any): string {
  return handleQuizError(error, 'loadQuestionnaire', {
    logError: true,
    returnMessage: true,
  }) as string;
}

/**
 * Обрабатывает ошибку сохранения прогресса
 */
export function handleSaveProgressError(error: any): void {
  // 401 ошибки для сохранения прогресса - это нормально (пользователь не авторизован)
  // Не логируем их как ошибки
  if (error?.status === 401 || error?.statusCode === 401) {
    clientLogger.warn('⚠️ Save progress: 401 Unauthorized (нормально для неавторизованных пользователей)');
    return;
  }
  
  handleQuizError(error, 'saveProgress', {
    logError: true,
    throwError: false,
  });
}

/**
 * Обрабатывает ошибку загрузки прогресса
 */
export function handleLoadProgressError(error: any): void {
  // 404 ошибки для загрузки прогресса - это нормально (прогресса еще нет)
  if (error?.status === 404 || error?.statusCode === 404) {
    return;
  }
  
  handleQuizError(error, 'loadProgress', {
    logError: true,
    throwError: false,
  });
}

/**
 * Проверяет, является ли ошибка критической (требует показа пользователю)
 */
export function isCriticalError(error: any): boolean {
  const type = classifyError(error);
  return type === QuizErrorType.NETWORK || type === QuizErrorType.SERVER;
}

/**
 * Проверяет, можно ли игнорировать ошибку (401, 404 для некоторых случаев)
 */
export function isIgnorableError(error: any, context?: string): boolean {
  const type = classifyError(error);
  const statusCode = error?.status || error?.statusCode;
  
  // 401 для сохранения прогресса - можно игнорировать
  if (type === QuizErrorType.AUTH && statusCode === 401 && context === 'saveProgress') {
    return true;
  }
  
  // 404 для загрузки прогресса - можно игнорировать (прогресса еще нет)
  if (type === QuizErrorType.NOT_FOUND && statusCode === 404 && context === 'loadProgress') {
    return true;
  }
  
  return false;
}








