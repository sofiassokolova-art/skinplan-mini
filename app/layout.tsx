// app/layout.tsx
// Root layout для Next.js приложения

import type { Metadata } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import localFont from 'next/font/local';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WebVitalsTracker } from './(miniapp)/components/WebVitals';
import { Toaster } from '@/components/Toaster';
import { GlobalErrorHandler } from '@/components/GlobalErrorHandler';
import { ServiceWorker } from '@/components/ServiceWorker';
import { QueryProvider } from '@/providers/QueryProvider';

// Загружаем шрифты локально из public/fonts
// Файлы шрифтов загружены в public/fonts/
// ИСПРАВЛЕНО: Используем относительный путь от корня проекта
const unbounded = localFont({
  src: [
    {
      path: '../public/fonts/unbounded-regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/unbounded-bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-unbounded',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  adjustFontFallback: false,
});

const inter = localFont({
  src: [
    {
      path: '../public/fonts/inter-thin.ttf',
      weight: '100',
      style: 'normal',
    },
    {
      path: '../public/fonts/inter-extralight.ttf',
      weight: '200',
      style: 'normal',
    },
    {
      path: '../public/fonts/inter-light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../public/fonts/inter-regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/inter-medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/inter-semibold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../public/fonts/inter-bold.ttf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../public/fonts/inter-bold.ttf',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../public/fonts/inter-black.ttf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: 'SkinIQ - Умный уход за кожей',
  description: 'Персонализированный план ухода за кожей на основе анкеты',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html 
      lang="ru" 
      className={`${unbounded.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Telegram WebApp Script - должен быть загружен до инициализации приложения */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        {/* DEV-режим: мок Telegram WebApp для локального браузера (initData в формате, принимаемом API) */}
        {isDev && (
          <Script id="telegram-dev-mock" strategy="beforeInteractive">
            {`
              (function () {
                if (typeof window === 'undefined') return;
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) return;

                var host = window.location.hostname;
                if (host !== 'localhost' && host !== '127.0.0.1') return;

                var TEST_TELEGRAM_ID = '987654321';
                var authDate = Math.floor(Date.now() / 1000);
                var testInitData = 'user=%7B%22id%22%3A' + TEST_TELEGRAM_ID + '%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22testuser%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=' + authDate + '&hash=test_hash_for_development_only';

                if (!window.Telegram) {
                  window.Telegram = { WebApp: null };
                }
                if (!window.Telegram.WebApp) {
                  window.Telegram.WebApp = {
                    initData: testInitData,
                    initDataUnsafe: {
                      user: {
                        id: parseInt(TEST_TELEGRAM_ID, 10),
                        first_name: 'Test',
                        last_name: 'User',
                        username: 'testuser',
                        language_code: 'ru',
                      },
                    },
                    ready: function () { console.log('[DEV TG] ready()'); },
                    expand: function () { console.log('[DEV TG] expand()'); },
                    close: function () { console.log('[DEV TG] close()'); },
                    sendData: function (data) { console.log('[DEV TG] sendData:', data); },
                    showPopup: function (params) { console.log('[DEV TG] showPopup:', params); },
                    openLink: function (url) { window.open(url, '_blank'); },
                    openTelegramLink: function (url) { window.open(url, '_blank'); },
                  };
                } else {
                  var w = window.Telegram.WebApp;
                  if (!w.initData || w.initData === 'dev-init-data=1') {
                    try {
                      w.initData = testInitData;
                    } catch (e) {
                      try {
                        Object.defineProperty(w, 'initData', { value: testInitData, writable: true });
                      } catch (e2) {}
                    }
                    if (w.initDataUnsafe && w.initDataUnsafe.user) {
                      w.initDataUnsafe.user.id = parseInt(TEST_TELEGRAM_ID, 10);
                    }
                  }
                }

                console.log('[DEV TG] Telegram WebApp mocked for local development (test initData)');
              })();
            `}
          </Script>
        )}
        {/* Шрифты для админки 2025 */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap"
          rel="stylesheet"
        />
        {/* Шрифты Unbounded и Inter загружаются через next/font (см. импорты выше) */}
      </head>
      <body>
        {/* Контейнер для кнопки «Назад» — вне основного контента, чтобы position:fixed не ломался из‑за transform */}
        <div id="back-button-portal-root" />
        <ErrorBoundary>
          <QueryProvider>
            <GlobalErrorHandler />
            <WebVitalsTracker />
            <ServiceWorker />
            {children}
            <Toaster />
            <Analytics />
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
