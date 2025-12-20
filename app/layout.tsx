// app/layout.tsx
// Root layout для Next.js приложения

import type { Metadata } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/react';
import localFont from 'next/font/local';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/Toaster';
import { GlobalErrorHandler } from '@/components/GlobalErrorHandler';
import { QueryProvider } from '@/providers/QueryProvider';

// Загружаем шрифты локально из public/fonts для надежности
// Файлы шрифтов должны быть загружены в public/fonts/
const unbounded = localFont({
  src: [
    {
      path: '/fonts/unbounded-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '/fonts/unbounded-bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-unbounded',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
});

const inter = localFont({
  src: [
    {
      path: '/fonts/inter-thin.woff2',
      weight: '100',
      style: 'normal',
    },
    {
      path: '/fonts/inter-extralight.woff2',
      weight: '200',
      style: 'normal',
    },
    {
      path: '/fonts/inter-light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '/fonts/inter-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '/fonts/inter-medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '/fonts/inter-semibold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '/fonts/inter-bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '/fonts/inter-extrabold.woff2',
      weight: '800',
      style: 'normal',
    },
    {
      path: '/fonts/inter-black.woff2',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
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
    <html lang="ru" className={`${unbounded.variable} ${inter.variable}`}>
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
        {/* Шрифты Unbounded и Inter загружаются через next/font (см. импорты выше) */}
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
