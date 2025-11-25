// app/layout.tsx
// Root layout для Next.js приложения

import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/Toaster';

export const metadata: Metadata = {
  title: 'SkinIQ - Умный уход за кожей',
  description: 'Персонализированный план ухода за кожей на основе анкеты',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        {/* Telegram WebApp Script - должен быть загружен до инициализации приложения */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <ErrorBoundary>
          {children}
          <Toaster />
        </ErrorBoundary>
      </body>
    </html>
  );
}
