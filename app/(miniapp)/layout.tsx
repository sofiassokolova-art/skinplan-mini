// app/(miniapp)/layout.tsx
// Layout для мини-аппа с BottomNavigation

'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { BackButtonFixed } from '@/components/BackButtonFixed';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import BottomNavigation from '@/components/BottomNavigation';
import PageTransition from '@/components/PageTransition';
import { NetworkStatus } from '@/components/NetworkStatus';
import { QueryProvider } from '@/providers/QueryProvider';
import { PaywallVisibilityProvider, usePaywallVisibility } from '@/providers/PaywallVisibilityContext';
import { ServiceFeedbackPopup } from '@/components/ServiceFeedbackPopup';
import { useTelegram } from '@/lib/telegram-client';
import { DEV_TELEGRAM } from '@/lib/config/timeouts';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import { QuizInitialLoader } from '@/app/(miniapp)/quiz/components/QuizInitialLoader';

/** Убирает статичный «Загрузка...» из корня при первом монтировании React */
function useRemoveRootLoading() {
  useEffect(() => {
    const el = typeof document !== 'undefined' ? document.getElementById('root-loading') : null;
    if (el?.parentNode) el.parentNode.removeChild(el);
  }, []);
}

function LayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  useRemoveRootLoading();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initData, initialize } = useTelegram();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const testData = DEV_TELEGRAM.buildInitData();
      try {
        if (!window.Telegram) {
          (window as any).Telegram = { WebApp: { initData: testData, ready() {}, expand() {} } };
        } else if (!window.Telegram.WebApp) {
          (window as any).Telegram.WebApp = { initData: testData, ready() {}, expand() {} };
        } else if (!window.Telegram.WebApp.initData) {
          try { (window.Telegram.WebApp as any).initData = testData; } catch (_) {}
        }
      } catch (_) {}
    }
  }, []);
  
  useEffect(() => {
    initialize();
    if (initData && !isAuthorized) {
      setIsAuthorized(true);
    }
  }, [initData, initialize, isAuthorized]);

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
  }, [pathname, initData, isNewUser]); // Добавляем isNewUser в зависимости

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
  // Пейвол: скрываем навигацию, когда PaymentGate показывает экран оплаты (на /plan или /home)
  const { paywallVisible } = usePaywallVisibility();
  
  // ИСПРАВЛЕНО: Проверяем pathname синхронно через window.location для надежности
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
  const isOnQuizPage = (currentPath === '/quiz' || currentPath.startsWith('/quiz/')) ||
                       (pathname === '/quiz' || pathname.startsWith('/quiz/'));
  
  // Скрываем навигацию на определенных страницах и в режимах/экранах, где она мешает UX
  // ТЗ: На пейволе навигации внизу не должно быть (ни на плане, ни на главной); появляется после оплаты
  const isOnRootPage = pathname === '/' || currentPath === '/';
  const hideNav = isOnQuizPage || 
                  pathname === '/loading' ||
                  pathname.startsWith('/loading/') ||
                  currentPath === '/loading' ||
                  currentPath.startsWith('/loading/') ||
                  isResumeScreen ||
                  isPlanGenerating ||
                  paywallVisible || // Скрываем навигацию, когда виден пейвол (plan или home)
                  isOnRootPage; // Скрываем навигацию на главной странице всегда (это только редирект)
  
  return (
    <>
      <NetworkStatus />

      {/* Кнопка "назад" в фиксированном контейнере (портал в body) — только на инфо-экранах */}
      {isOnQuizPage && (
        <BackButtonFixed
          show={
            typeof window !== 'undefined' &&
            (() => {
              const currentInfoScreenIndex = parseInt(sessionStorage.getItem('currentInfoScreenIndex') || '0', 10);
              const initialLen = getInitialInfoScreens().length;
              return currentInfoScreenIndex > 0 && currentInfoScreenIndex < initialLen;
            })()
          }
          onClick={() => {
            if (typeof window !== 'undefined' && window.history.length > 1) {
              window.history.back();
            } else {
              router.push('/home');
            }
          }}
        />
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
  useRemoveRootLoading();
  const pathname = usePathname();

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : pathname;
  const isOnQuizPage = currentPath === '/quiz' || currentPath.startsWith('/quiz/');
  const isOnRootPage = pathname === '/' || currentPath === '/';
  const hideNav = isOnQuizPage ||
                 pathname === '/loading' ||
                 pathname.startsWith('/loading/') ||
                 isOnRootPage;

  // Один лоадер при открытии — чёрно-серый (QuizInitialLoader), без экрана «Загрузка...»
  return (
    <>
      <NetworkStatus />
      <PageTransition>
        <QuizInitialLoader />
      </PageTransition>
      {!hideNav && !isOnQuizPage && <BottomNavigation />}
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
      <PaywallVisibilityProvider>
        <Suspense fallback={<LayoutFallback />}>
          <LayoutContent>{children}</LayoutContent>
        </Suspense>
      </PaywallVisibilityProvider>
    );
  }

  return (
    <QueryProvider>
      <PaywallVisibilityProvider>
        <Suspense fallback={<LayoutFallback />}>
          <LayoutContent>{children}</LayoutContent>
        </Suspense>
      </PaywallVisibilityProvider>
    </QueryProvider>
  );
}