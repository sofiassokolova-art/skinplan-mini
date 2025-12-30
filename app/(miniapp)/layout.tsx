// app/(miniapp)/layout.tsx
// Layout для мини-аппа с BottomNavigation

'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
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

  // ИСПРАВЛЕНО: Ref для предотвращения множественных попыток авторизации
  const authInProgressRef = useRef(false);
  const authAttemptedRef = useRef(false);
  
  useEffect(() => {
    // ИСПРАВЛЕНО: Инициализация Telegram только один раз
    initialize();

    // ИСПРАВЛЕНО: Авторизация через Telegram - однократная, без циклов
    // Убрали isAuthorized из зависимостей, чтобы избежать бесконечных циклов
    if (!initData) return; // Ждем initData
    
    // Guard против множественных попыток авторизации
    if (authInProgressRef.current || authAttemptedRef.current || isAuthorized) {
      return; // Уже авторизованы или авторизация в процессе
    }
    
    let aborted = false;
    authInProgressRef.current = true;
    authAttemptedRef.current = true;
    
    const authorize = async () => {
      try {
        await api.authTelegram(initData);
        if (!aborted) {
          setIsAuthorized(true);
        }
      } catch (error) {
        console.error('Auth error:', error);
        // Не блокируем приложение при ошибке авторизации
        // Не пытаемся повторно - ошибка авторизации не должна блокировать UI
      } finally {
        if (!aborted) {
          authInProgressRef.current = false;
        }
      }
    };

    authorize();
    
    return () => {
      aborted = true;
      authInProgressRef.current = false;
    };
  }, [initData, initialize]); // ИСПРАВЛЕНО: Убрали isAuthorized из зависимостей!

  // ИСПРАВЛЕНО: Ref для предотвращения множественных проверок isNewUser
  const newUserCheckInProgressRef = useRef(false);
  const newUserCheckAttemptedRef = useRef(false);
  
  // ИСПРАВЛЕНО: Проверяем, является ли пользователь новым (нет hasPlanProgress)
  // Это нужно для скрытия навигации на главной странице для нового пользователя
  // ВАЖНО: Не делаем запросы, пока Telegram WebApp не готов или мы на /quiz
  // ТЗ: На /quiz не должны выполняться запросы к /api/user/preferences
  useEffect(() => {
    // КРИТИЧНО: Проверяем pathname на /quiz ПЕРЕД любыми проверками
    // Это предотвращает вызовы getUserPreferences на /quiz
    // ИСПРАВЛЕНО: Проверяем синхронно через window.location для надежности
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
    const isOnQuizPage = currentPath === '/quiz' || currentPath.startsWith('/quiz/') ||
                         pathname === '/quiz' || pathname.startsWith('/quiz/');
    
    if (isOnQuizPage) {
      // На /quiz не проверяем нового пользователя - это лишний запрос
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
    
    // ИСПРАВЛЕНО: Проверяем только на главной странице и только один раз
    // ИСПРАВЛЕНО: Также проверяем, что мы не на /quiz (дополнительная защита)
    if (pathname !== '/' || isOnQuizPage) {
      setIsNewUser(null);
      return;
    }
    
    // Guard против множественных проверок
    if (newUserCheckInProgressRef.current || newUserCheckAttemptedRef.current || isNewUser !== null) {
      return; // Уже проверяли или проверка в процессе
    }
    
    let aborted = false;
    newUserCheckInProgressRef.current = true;
    newUserCheckAttemptedRef.current = true;
    
    const checkNewUser = async () => {
      try {
        // КРИТИЧНО: Проверяем pathname еще раз внутри async функции
        // Это защита от race condition, если пользователь перешел на /quiz во время выполнения
        // КРИТИЧНО: Проверяем pathname еще раз внутри async функции
        // Это защита от race condition, если пользователь перешел на /quiz во время выполнения
        const checkPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
        const stillOnQuiz = checkPath === '/quiz' || checkPath.startsWith('/quiz/');
        if (stillOnQuiz || aborted) {
          if (!aborted) {
            setIsNewUser(null);
          }
          return;
        }
        
        // КРИТИЧНО: Проверяем pathname еще раз ПЕРЕД импортом и вызовом getHasPlanProgress
        // Это дополнительная защита от race condition
        const finalCheckPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
        const stillOnQuizFinal = finalCheckPath === '/quiz' || finalCheckPath.startsWith('/quiz/');
        if (stillOnQuizFinal || aborted) {
          if (!aborted) {
            setIsNewUser(null);
          }
          return;
        }
        
        const { getHasPlanProgress } = await import('@/lib/user-preferences');
        // КРИТИЧНО: Проверяем pathname еще раз ПЕРЕД вызовом getHasPlanProgress
        // Это финальная защита от race condition
        const preCallCheckPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
        const preCallStillOnQuiz = preCallCheckPath === '/quiz' || preCallCheckPath.startsWith('/quiz/');
        if (preCallStillOnQuiz || aborted) {
          if (!aborted) {
            setIsNewUser(null);
          }
          return;
        }
        
        const hasPlanProgress = await getHasPlanProgress();
        if (!aborted && !stillOnQuiz) {
          setIsNewUser(!hasPlanProgress);
        }
      } catch {
        if (!aborted) {
          setIsNewUser(false);
        }
      } finally {
        if (!aborted) {
          newUserCheckInProgressRef.current = false;
        }
      }
    };
    
    checkNewUser();
    
    return () => {
      aborted = true;
      newUserCheckInProgressRef.current = false;
    };
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
  
  // ИСПРАВЛЕНО: Проверяем pathname синхронно через window.location для надежности
  // Это гарантирует, что навигация не монтируется на /quiz даже при асинхронных обновлениях pathname
  // КРИТИЧНО: Проверяем оба варианта для максимальной надежности
  // ТЗ: Скрываем навигацию на /quiz для чистого UX
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
  const isOnQuizPage = (currentPath === '/quiz' || currentPath.startsWith('/quiz/')) ||
                       (pathname === '/quiz' || pathname.startsWith('/quiz/'));
  
  // Скрываем навигацию на определенных страницах и в режимах/экранах, где она мешает UX
  // ИСПРАВЛЕНО: Скрываем навигацию на главной странице для нового пользователя
  // Это предотвращает показ навигации с лоадером "загрузка плана" для нового пользователя
  // ТЗ: Скрываем навигацию на /quiz для чистого UX без элементов корзины
  // КРИТИЧНО: Скрываем навигацию на главной странице ВСЕГДА, так как это только редирект
  // Главная страница редиректит: новый пользователь → /quiz, пользователь с планом → /home
  // Это предотвращает вызов useCart() и показ навигации на странице-редиректе
  // ИСПРАВЛЕНО: Проверяем оба pathname и currentPath для надежности
  const isOnRootPage = pathname === '/' || currentPath === '/';
  const hideNav = isOnQuizPage || 
                  pathname === '/loading' ||
                  pathname.startsWith('/loading/') ||
                  currentPath === '/loading' ||
                  currentPath.startsWith('/loading/') ||
                  isResumeScreen ||
                  isPlanGenerating ||
                  isOnRootPage; // Скрываем навигацию на главной странице всегда (это только редирект)
  
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
            onClick={() => router.push('/home')}
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
      {/* ТЗ: НЕ монтируем BottomNavigation на /quiz для чистого UX без элементов корзины */}
      {/* КРИТИЧНО: Используем hideNav, который включает проверку isOnQuizPage и проверку нового пользователя на главной */}
      {!hideNav && <BottomNavigation />}
      {/* Сервисный попап для отзывов (показывается раз в неделю, НЕ на странице анкеты) */}
      {!isOnQuizPage && <ServiceFeedbackPopup />}
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
  
  // ИСПРАВЛЕНО: Проверяем pathname синхронно через window.location для надежности
  // ТЗ: Скрываем навигацию на /quiz для чистого UX
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
  const isOnQuizPage = currentPath === '/quiz' || currentPath.startsWith('/quiz/');
  const isOnRootPage = pathname === '/' || currentPath === '/';
  
  // Определяем, нужно ли скрывать навигацию (та же логика, что и в LayoutContent)
  // КРИТИЧНО: Скрываем навигацию на главной странице ВСЕГДА, так как это только редирект
  const hideNav = isOnQuizPage ||
                 pathname === '/loading' ||
                 pathname.startsWith('/loading/') ||
                 isOnRootPage; // Скрываем навигацию на главной странице всегда
  
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
      {/* ТЗ: НЕ монтируем BottomNavigation на /quiz для чистого UX без элементов корзины */}
      {!hideNav && !isOnQuizPage && <BottomNavigation />}
      {/* Сервисный попап для отзывов (НЕ на странице анкеты) */}
      {!isOnQuizPage && <ServiceFeedbackPopup />}
    </>
  );
}

export default function MiniappLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ИСПРАВЛЕНО: Используем usePathname() для SSR-совместимости
  // Это предотвращает hydration mismatch, так как usePathname() работает одинаково на сервере и клиенте
  const pathname = usePathname();
  
  // ИСПРАВЛЕНО: Инициализируем state на основе pathname для SSR-совместимости
  // На сервере pathname будет доступен, что гарантирует одинаковое дерево рендеринга
  const [isOnQuizPage, setIsOnQuizPage] = useState(() => {
    // ИСПРАВЛЕНО: Используем pathname из usePathname() для инициализации
    // Это гарантирует, что на сервере и клиенте будет одинаковое начальное значение
    return pathname === '/quiz' || pathname.startsWith('/quiz/');
  });
  
  useEffect(() => {
    // ИСПРАВЛЕНО: Обновляем state при изменении pathname на клиенте
    // Это предотвращает проблемы с SSR и гарантирует правильную проверку
    setIsOnQuizPage(pathname === '/quiz' || pathname.startsWith('/quiz/'));
  }, [pathname]);
  
  // ИСПРАВЛЕНО: На /quiz монтируем только минимальную структуру без QueryProvider
  // QueryProvider может инициализировать запросы через React Query, поэтому на /quiz не монтируем его
  // ВАЖНО: Это критично для предотвращения любых глобальных запросов на /quiz
  // ИСПРАВЛЕНО: Используем только pathname из usePathname() для SSR-совместимости
  // Это предотвращает hydration mismatch, так как usePathname() работает одинаково на сервере и клиенте
  const isOnQuizPageFromPathname = pathname === '/quiz' || pathname.startsWith('/quiz/');
  
  // ИСПРАВЛЕНО: Используем pathname для серверного рендеринга и state для клиентского
  // Это гарантирует одинаковое дерево на сервере и клиенте
  if (isOnQuizPageFromPathname || isOnQuizPage) {
    return (
      <Suspense fallback={<LayoutFallback />}>
        <LayoutContent>{children}</LayoutContent>
      </Suspense>
    );
  }
  
  return (
    <QueryProvider>
      <Suspense fallback={<LayoutFallback />}>
        <LayoutContent>{children}</LayoutContent>
      </Suspense>
    </QueryProvider>
  );
}