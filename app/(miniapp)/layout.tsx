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
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null); // null = еще не проверено

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

  // ИСПРАВЛЕНО: Проверяем, является ли пользователь новым (нет hasPlanProgress)
  // Это нужно для скрытия навигации на главной странице для нового пользователя
  // ВАЖНО: Не делаем запросы, пока Telegram WebApp не готов или мы на /quiz
  useEffect(() => {
    // ИСПРАВЛЕНО: НА /quiz НИКОГДА не делаем запросы
    if (pathname === '/quiz' || pathname.startsWith('/quiz/')) {
      setIsNewUser(null);
      return;
    }
    
    // ИСПРАВЛЕНО: Проверяем готовность Telegram WebApp перед вызовом API
    // Используем initData из useTelegram, так как он уже проверяет готовность
    const isTelegramReady = Boolean(
      initData && 
      typeof initData === 'string' &&
      initData.length > 0
    );
    
    // Не делаем запросы, если Telegram не готов
    if (!isTelegramReady) {
      setIsNewUser(null);
      return;
    }
    
    if (pathname === '/') {
      const checkNewUser = async () => {
        try {
          const { getHasPlanProgress } = await import('@/lib/user-preferences');
          const hasPlanProgress = await getHasPlanProgress();
          setIsNewUser(!hasPlanProgress);
        } catch {
          setIsNewUser(false);
        }
      };
      checkNewUser();
    } else {
      setIsNewUser(null);
    }
  }, [pathname, initData]); // Добавляем initData в зависимости, чтобы перепроверить при его появлении

  // УДАЛЕНО: Старая проверка профиля, которая вызывала множественные запросы
  /* useEffect(() => {
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
  }, [pathname, initData]); */

  // Проверяем, показывается ли экран "Вы не завершили анкету" (через query параметр)
  const isResumeScreen = searchParams?.get('resume') === 'true';
  const planState = searchParams?.get('state');
  const isPlanGenerating = pathname === '/plan' && planState === 'generating';
  
  // Скрываем навигацию на определенных страницах и в режимах/экранах, где она мешает UX
  // ИСПРАВЛЕНО: Скрываем навигацию на главной странице для нового пользователя
  // Это предотвращает показ навигации с лоадером "загрузка плана" для нового пользователя
  const hideNav = pathname === '/quiz' || 
                  pathname.startsWith('/quiz/') || 
                  pathname === '/loading' ||
                  pathname.startsWith('/loading/') ||
                  isResumeScreen ||
                  isPlanGenerating ||
                  (pathname === '/' && isNewUser === true); // Скрываем навигацию для нового пользователя на главной
  
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
      {/* Сервисный попап для отзывов (показывается раз в неделю, НЕ на странице анкеты) */}
      {pathname !== '/quiz' && !pathname.startsWith('/quiz/') && <ServiceFeedbackPopup />}
    </>
  );
}

// Fallback компонент, который сохраняет всю структуру layout
// ИСПРАВЛЕНО: usePathname() не вызывает suspend, но для консистентности используем его безопасно
// В fallback показываем базовую структуру без зависимостей от конкретного пути
function LayoutFallback() {
  // usePathname() не вызывает suspend, только useSearchParams() вызывает
  // Но для fallback лучше показать универсальную структуру
  const pathname = usePathname();
  
  // Определяем, нужно ли показывать логотип (та же логика, что и в LayoutContent)
  const showLogo = pathname !== '/' && 
                   pathname !== '/quiz' &&
                   !pathname.startsWith('/quiz/') &&
                   pathname !== '/plan' && 
                   pathname !== '/wishlist' && 
                   pathname !== '/cart' &&
                   pathname !== '/cart-new' &&
                   pathname !== '/profile';
  
  // Определяем, нужно ли скрывать навигацию (та же логика, что и в LayoutContent)
  const hideNav = pathname === '/quiz' || 
                 pathname.startsWith('/quiz/') ||
                 pathname === '/loading' ||
                 pathname.startsWith('/loading/');
  
  return (
    <>
      <NetworkStatus />
      {/* Логотип наверху всех экранов (кроме главной) */}
      {showLogo && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
        }}>
          <img
            src="/skiniq-logo.png"
            alt="SkinIQ"
            style={{
              height: '140px',
              marginTop: '8px',
              marginBottom: '8px',
            }}
          />
        </div>
      )}
      <PageTransition>
        <div style={{
          minHeight: 'calc(100vh - 200px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        }}>
          <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка...</div>
        </div>
      </PageTransition>
      {!hideNav && <BottomNavigation />}
      {/* Сервисный попап для отзывов */}
      {pathname !== '/quiz' && !pathname.startsWith('/quiz/') && <ServiceFeedbackPopup />}
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
      <Suspense fallback={<LayoutFallback />}>
        <LayoutContent>{children}</LayoutContent>
      </Suspense>
    </QueryProvider>
  );
}