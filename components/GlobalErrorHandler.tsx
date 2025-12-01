// components/GlobalErrorHandler.tsx
// Глобальный обработчик необработанных ошибок и промисов

'use client';

import { useEffect } from 'react';

export function GlobalErrorHandler() {
  useEffect(() => {
    // Обработчик необработанных ошибок
    const handleError = (event: ErrorEvent) => {
      console.error('❌ Unhandled error:', event.error);
      // Предотвращаем показ стандартного диалога ошибки
      event.preventDefault();
    };

    // Обработчик необработанных отклоненных промисов
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('❌ Unhandled promise rejection:', event.reason);
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

