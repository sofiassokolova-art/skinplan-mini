// app/(miniapp)/layout.tsx
// Layout для мини-аппа с BottomNavigation

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import BottomNavigation from '@/components/BottomNavigation';
import { tg, useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';

export default function MiniappLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initData, initialize } = useTelegram();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    try {
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
            // Не блокируем приложение при ошибке авторизации
          }
        }
      };

      authorize();
    } catch (error) {
      console.error('Layout initialization error:', error);
      // Не блокируем приложение при ошибке инициализации
    }
  }, [initData, isAuthorized, initialize]);

  // Скрываем навигацию на определенных страницах
  const hideNav = pathname === '/quiz' || pathname.startsWith('/quiz/');
  
  // Проверяем, показывается ли экран "Вы не завершили анкету" (через query параметр)
  const isResumeScreen = searchParams?.get('resume') === 'true';
  
  // Скрываем логотип на главной странице (там он уже есть) и на странице незавершенной анкеты
  const showLogo = pathname !== '/' && !isResumeScreen;

  return (
    <>
      {/* Логотип наверху всех экранов (кроме главной) - как на главной странице */}
      {showLogo && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
        }}>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'inline-block',
            }}
          >
            <img
              src="/skiniq-logo.png"
              alt="SkinIQ"
              style={{
                height: '140px',
                marginTop: '8px',
                marginBottom: '8px',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            />
          </button>
        </div>
      )}
      {children}
      {!hideNav && <BottomNavigation />}
    </>
  );
}
