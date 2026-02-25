'use client';

import Script from 'next/script';

/**
 * Загружает telegram-web-app.js после первого рендера (afterInteractive),
 * чтобы не блокировать открытие в WebView Telegram. По готовности диспатчит событие для useTelegram.
 */
export function TelegramScript() {
  return (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('telegram-webapp-ready'));
        }
      }}
    />
  );
}
