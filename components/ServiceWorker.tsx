// components/ServiceWorker.tsx
// Компонент для регистрации Service Worker

'use client';

import { useEffect } from 'react';

/** SW отключён: на проде SW отдавал старый HTML → 404 на чанки. */
export function ServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Принудительно снимаем старый SW, который мог остаться у пользователя
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      }).catch(() => {});
    }
  }, []);

  return null; // Компонент не рендерит ничего
}