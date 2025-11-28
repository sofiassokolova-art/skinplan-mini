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
      {/* Логотип наверху всех экранов (кроме главной) */}
      {showLogo && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'rgba(245, 255, 252, 0.9)',
          backdropFilter: 'blur(10px)',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(10, 95, 89, 0.1)',
        }}>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src="/skiniq-logo.png"
              alt="SkinIQ"
              style={{
                height: '48px',
                width: 'auto',
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
