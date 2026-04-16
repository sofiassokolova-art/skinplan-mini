// lib/utils/performance-monitor.ts
// Утилиты для мониторинга производительности

import { logger } from '@/lib/logger';

// Пороги для определения медленных запросов (в миллисекундах)
export const PERFORMANCE_THRESHOLDS = {
  /** Медленный запрос - предупреждение */
  SLOW_REQUEST: 1000, // 1 секунда
  /** Очень медленный запрос - ошибка */
  VERY_SLOW_REQUEST: 3000, // 3 секунды
  /** Критически медленный запрос - критическая ошибка */
  CRITICAL_REQUEST: 5000, // 5 секунд
} as const;

export interface SlowRequestInfo {
  method: string;
  path: string;
  duration: number;
  userId?: string | null;
  correlationId?: string | null;
  threshold: 'slow' | 'very_slow' | 'critical';
}

/**
 * Логирует медленный запрос с соответствующим уровнем логирования
 */
export function logSlowRequest(info: SlowRequestInfo): void {
  const { method, path, duration, userId, correlationId, threshold } = info;

  const context = {
    method,
    path,
    duration,
    threshold,
    userId: userId || undefined,
    correlationId: correlationId || undefined,
    durationSeconds: (duration / 1000).toFixed(2),
  };

  switch (threshold) {
    case 'slow':
      logger.warn('⚠️ Slow API Request', context);
      break;
    case 'very_slow':
      logger.error('❌ Very Slow API Request', undefined, context);
      break;
    case 'critical':
      logger.error('🚨 CRITICAL: Extremely Slow API Request', undefined, {
        ...context,
        severity: 'critical',
      });
      break;
  }

  // В production можно отправлять в систему мониторинга (Sentry, DataDog и т.д.)
  if (process.env.NODE_ENV === 'production' && threshold === 'critical') {
    // TODO: Интеграция с системой мониторинга
    console.error('🚨 CRITICAL slow request detected - should alert monitoring system', context);
  }
}

/**
 * Проверяет, является ли запрос медленным, и логирует при необходимости
 */
export function checkAndLogSlowRequest(
  method: string,
  path: string,
  duration: number,
  userId?: string | null,
  correlationId?: string | null
): void {
  if (duration >= PERFORMANCE_THRESHOLDS.CRITICAL_REQUEST) {
    logSlowRequest({
      method,
      path,
      duration,
      userId,
      correlationId,
      threshold: 'critical',
    });
  } else if (duration >= PERFORMANCE_THRESHOLDS.VERY_SLOW_REQUEST) {
    logSlowRequest({
      method,
      path,
      duration,
      userId,
      correlationId,
      threshold: 'very_slow',
    });
  } else if (duration >= PERFORMANCE_THRESHOLDS.SLOW_REQUEST) {
    logSlowRequest({
      method,
      path,
      duration,
      userId,
      correlationId,
      threshold: 'slow',
    });
  }
}

/**
 * Web Vitals метрики для клиентской стороны
 */
export interface WebVitals {
  /** Largest Contentful Paint - время до отображения основного контента */
  lcp?: number;
  /** First Input Delay - задержка первого взаимодействия */
  fid?: number;
  /** Cumulative Layout Shift - накопленный сдвиг макета */
  cls?: number;
  /** First Contentful Paint - время до первого отображения контента */
  fcp?: number;
  /** Time to First Byte - время до первого байта */
  ttfb?: number;
}

/**
 * Отправляет Web Vitals метрики на сервер
 */
export async function reportWebVitals(metrics: WebVitals): Promise<void> {
  if (typeof window === 'undefined') {
    return; // SSR - не отправляем
  }

  try {
    const initData = window.Telegram?.WebApp?.initData || null;

    await fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
      },
      body: JSON.stringify({
        level: 'info',
        message: 'Web Vitals',
        context: {
          type: 'web_vitals',
          ...metrics,
          url: window.location.href,
          userAgent: navigator.userAgent,
        },
      }),
    });
  } catch (error) {
    // Игнорируем ошибки отправки метрик
    console.debug('Failed to report Web Vitals', error);
  }
}
