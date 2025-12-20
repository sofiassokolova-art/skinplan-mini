// app/layout.tsx
// Root layout для Next.js приложения

import type { Metadata } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/Toaster';
import { GlobalErrorHandler } from '@/components/GlobalErrorHandler';
import { QueryProvider } from '@/providers/QueryProvider';

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
    <html lang="ru">
      <head>
        {/* Telegram WebApp Script - должен быть загружен до инициализации приложения */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        {/* DEV-режим: мок Telegram WebApp для локальной разработки без настоящего мини-аппа */}
        {isDev && (
          <Script id="telegram-dev-mock" strategy="beforeInteractive">
            {`
              (function () {
                if (typeof window === 'undefined') return;
                // Не переопределяем, если реальный Telegram уже есть
                if (window.Telegram && window.Telegram.WebApp) return;

                // Используем простой мок только на localhost/127.0.0.1
                var host = window.location.hostname;
                if (host !== 'localhost' && host !== '127.0.0.1') return;

                window.Telegram = {
                  WebApp: {
                    initData: 'dev-init-data=1',
                    initDataUnsafe: {
                      user: {
                        id: 123456,
                        first_name: 'Dev',
                        last_name: 'User',
                        username: 'dev_user',
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
                  },
                };

                console.log('[DEV TG] Telegram WebApp mocked for local development');
              })();
            `}
          </Script>
        )}
        {/* Шрифты для админки 2025 */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap"
          rel="stylesheet"
        />
        {/* Шрифт Unbounded для анкеты */}
        <link
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700&display=swap"
          rel="stylesheet"
        />
        {/* Шрифт Inter для кнопок */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ErrorBoundary>
          <QueryProvider>
            <GlobalErrorHandler />
            {children}
            <Toaster />
            <Analytics />
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
