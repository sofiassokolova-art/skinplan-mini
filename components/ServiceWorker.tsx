// components/ServiceWorker.tsx
// Компонент для регистрации Service Worker

'use client';

import { useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';

export function ServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Регистрируем Service Worker только в production
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('Service Worker registered successfully:', registration.scope);

          // Обработка обновлений
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // Новой версии SW доступна
                  console.log('New Service Worker available, consider refreshing the page');

                  // Можно показать пользователю уведомление об обновлении
                  clientLogger.log('Service Worker update available');
                }
              });
            }
          });

          // Обработка сообщений от SW
          navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
              console.log('Service Worker update available');
            }
          });
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
          clientLogger.error('Service Worker registration failed', { error: error.message });
        });

      // Обработка контроллера SW
      if (navigator.serviceWorker.controller) {
        console.log('Service Worker is controlling the page');
      }

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service Worker controller changed');
        // Можно перезагрузить страницу для применения обновлений
        window.location.reload();
      });
    }
  }, []);

  return null; // Компонент не рендерит ничего
}