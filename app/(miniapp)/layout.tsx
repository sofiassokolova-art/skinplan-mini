// app/(miniapp)/layout.tsx
// Layout для мини-аппа с BottomNavigation

'use client';

import { useEffect, useState, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import BottomNavigation from '@/components/BottomNavigation';
import PageTransition from '@/components/PageTransition';
import { NetworkStatus } from '@/components/NetworkStatus';
import { QueryProvider } from '@/providers/QueryProvider';
import { ServiceFeedbackPopup } from '@/components/ServiceFeedbackPopup';
import { tg, useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';

function LayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initData, initialize } = useTelegram();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false); // Флаг: идет ли проверка профиля на главной странице

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

  // Проверяем наличие профиля на главной странице, чтобы скрыть навигацию для новых пользователей
  useEffect(() => {
    if (pathname === '/' && initData) {
      setIsCheckingProfile(true);
      // Проверяем профиль асинхронно
      const checkProfile = async () => {
        try {
          const profile = await api.getCurrentProfile();
          if (profile && (profile as any).id) {
            // Профиль есть - показываем навигацию после небольшой задержки
            setTimeout(() => setIsCheckingProfile(false), 100);
          } else {
            // Профиля нет - скрываем навигацию (будет редирект на анкету)
            setIsCheckingProfile(false);
          }
        } catch (err: any) {
          // Профиля нет (404) - скрываем навигацию
          const isNotFound = err?.status === 404 || 
                            err?.message?.includes('404') || 
                            err?.message?.includes('No profile') ||
                            err?.message?.includes('Profile not found');
          if (isNotFound) {
            setIsCheckingProfile(false);
          } else {
            // Другая ошибка - через небольшую задержку показываем навигацию
            setTimeout(() => setIsCheckingProfile(false), 500);
          }
        }
      };
      checkProfile();
    } else if (pathname !== '/') {
      // Не на главной странице - не проверяем профиль
      setIsCheckingProfile(false);
    }
  }, [pathname, initData]);

  // Проверяем, показывается ли экран "Вы не завершили анкету" (через query параметр)
  const isResumeScreen = searchParams?.get('resume') === 'true';
  
  // Скрываем навигацию на определенных страницах, на экране прогресса и во время проверки профиля на главной
  const hideNav = pathname === '/quiz' || 
                  pathname.startsWith('/quiz/') || 
                  isResumeScreen ||
                  (pathname === '/' && isCheckingProfile); // Скрываем навигацию на главной во время проверки профиля
  
  // Скрываем логотип на главной странице, на странице незавершенной анкеты, на странице анкеты (там логотип на фоне), и на страницах плана, избранного и профиля (там логотип встроен в страницу)
  const showLogo = pathname !== '/' && 
                   !isResumeScreen && 
                   pathname !== '/quiz' &&
                   !pathname.startsWith('/quiz/') &&
                   pathname !== '/plan' && 
                   pathname !== '/wishlist' && 
                   pathname !== '/cart' &&
                   pathname !== '/cart-new' &&
                   pathname !== '/profile';

  return (
    <>
      <NetworkStatus />
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
      <PageTransition>
        {children}
      </PageTransition>
      {!hideNav && <BottomNavigation />}
      {/* Сервисный попап для отзывов (показывается раз в неделю) */}
      <ServiceFeedbackPopup />
    </>
  );
}

export default function MiniappLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <Suspense fallback={<>{children}</>}>
        <LayoutContent>{children}</LayoutContent>
      </Suspense>
    </QueryProvider>
  );
}
