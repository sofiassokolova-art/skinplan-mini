// components/GlobalErrorHandler.tsx
// Глобальный обработчик необработанных ошибок и промисов

'use client';

import { useEffect } from 'react';

export function GlobalErrorHandler() {
  useEffect(() => {
    // Обработчик необработанных ошибок
    const handleError = (event: ErrorEvent) => {
      const errorDetails = {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        errorStack: event.error?.stack,
        errorName: event.error?.name,
        url: typeof window !== 'undefined' ? window.location.href : 'N/A',
        timestamp: new Date().toISOString(),
      };
      
      console.error('❌ GlobalErrorHandler: Unhandled error:', errorDetails);
      console.error('Full error event:', event);
      
      // ИСПРАВЛЕНО: Отправляем ошибку в /api/logs для диагностики
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        const initData = window.Telegram.WebApp.initData;
        fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': initData,
          },
          body: JSON.stringify({
            level: 'error',
            message: `GlobalErrorHandler: ${event.message}`,
            context: {
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno,
              errorStack: event.error?.stack,
              errorName: event.error?.name,
              url: errorDetails.url,
            },
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
            url: errorDetails.url,
          }),
        }).catch((err) => {
          console.error('Failed to save error log:', err);
        });
      }
      
      // Предотвращаем показ стандартного диалога ошибки
      event.preventDefault();
    };

    // Обработчик необработанных отклоненных промисов
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const rejectionDetails = {
        reason: event.reason,
        reasonString: String(event.reason),
        reasonStack: event.reason?.stack,
        reasonName: event.reason?.name,
        url: typeof window !== 'undefined' ? window.location.href : 'N/A',
        timestamp: new Date().toISOString(),
      };
      
      console.error('❌ GlobalErrorHandler: Unhandled promise rejection:', rejectionDetails);
      console.error('Full rejection event:', event);
      
      // ИСПРАВЛЕНО: Отправляем ошибку в /api/logs для диагностики
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        const initData = window.Telegram.WebApp.initData;
        fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': initData,
          },
          body: JSON.stringify({
            level: 'error',
            message: `GlobalErrorHandler: Unhandled promise rejection: ${String(event.reason)}`,
            context: {
              reasonString: String(event.reason),
              reasonStack: event.reason?.stack,
              reasonName: event.reason?.name,
              url: rejectionDetails.url,
            },
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
            url: rejectionDetails.url,
          }),
        }).catch((err) => {
          console.error('Failed to save error log:', err);
        });
      }
      
      // Предотвращаем вывод ошибки в консоль браузера
      event.preventDefault();
    };

    // Добавляем обработчики
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Очистка при размонтировании
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null; // Этот компонент ничего не рендерит
}

