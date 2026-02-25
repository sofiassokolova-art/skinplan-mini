'use client';

import Script from 'next/script';

/**
 * Загружает telegram-web-app.js после первого рендера (afterInteractive),
 * чтобы не блокировать открытие в WebView Telegram. По готовности вызывает
 * ready()/expand() на настоящем SDK и диспатчит событие для useTelegram.
 */
export function TelegramScript() {
  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (typeof window === 'undefined') return;
        try {
          const wa = window.Telegram?.WebApp;
          if (wa) {
            wa.ready();
            wa.expand();
            if (wa.initData) {
              try { sessionStorage.setItem('tg_init_data', wa.initData); } catch (_) {}
            }
          }
        } catch (_) {}
        window.dispatchEvent(new Event('telegram-webapp-ready'));
      }}
      onError={() => {
        // SDK не загрузился (сетевая ошибка и т.д.) — всё равно диспатчим событие,
        // чтобы useTelegram перестал ждать и использовал данные из hash/sessionStorage.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('telegram-webapp-ready'));
        }
      }}
    />
  );
}
