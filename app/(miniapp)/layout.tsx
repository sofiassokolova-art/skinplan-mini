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

  const newUserCheckedRef = useRef(false);

  useEffect(() => {
    if (pathname !== '/' || !initData || newUserCheckedRef.current) {
      if (pathname !== '/') setIsNewUser(null);
      return;
    }

    newUserCheckedRef.current = true;
    let aborted = false;

    (async () => {
      try {
        const { getHasPlanProgress } = await import('@/lib/user-preferences');
        if (aborted) return;
        const has = await getHasPlanProgress();
        if (!aborted) setIsNewUser(!has);
      } catch {
        if (!aborted) setIsNewUser(false);
      }
    })();

    return () => { aborted = true; };
  }, [pathname, initData]);

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

/** Минимальный fallback во время Suspense — только спиннер, без тяжёлых компонентов */
function LayoutFallback() {
  useRemoveRootLoading();
  return <QuizInitialLoader />;
}

export default function MiniappLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // QueryProvider всегда смонтирован — он не делает запросов сам по себе.
  // Раньше на /quiz он не монтировался, что приводило к полному remount
  // дерева при навигации quiz → home (уничтожая весь кеш и state).
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