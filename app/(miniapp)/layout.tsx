// app/(miniapp)/layout.tsx
// Layout для мини-аппа с BottomNavigation

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import BottomNavigation from '@/components/BottomNavigation';
import { tg, useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';

export default function MiniappLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { initData, initialize } = useTelegram();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Инициализация Telegram
    initialize();

    // Авторизация через Telegram
    const authorize = async () => {
      if (initData && !isAuthorized) {
        try {
          await api.authTelegram(initData);
          setIsAuthorized(true);
        } catch (error) {
          console.error('Auth error:', error);
        }
      }
    };

    authorize();
  }, [initData, isAuthorized, initialize]);

  // Скрываем навигацию на определенных страницах
  const hideNav = pathname === '/quiz' || pathname.startsWith('/quiz/');

  return (
    <>
      {children}
      {!hideNav && <BottomNavigation />}
    </>
  );
}
