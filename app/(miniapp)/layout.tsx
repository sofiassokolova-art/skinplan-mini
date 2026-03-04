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
import { QuizInitialLoader } from './quiz/components/QuizInitialLoader';
// INFO_INITIAL_SCREENS_COUNT: кол-во начальных инфо-экранов (без showAfterQuestionCode/showAfterInfoScreenId).
// Хардкодим чтобы не тянуть весь модуль info-screens в layout-бандл.
// Обновить если изменится кол-во начальных экранов в info-screens.ts.
const INFO_INITIAL_SCREENS_COUNT = 4;

/** Скрывает статичный «Загрузка...» при первом монтировании React.
 * Используем display:none вместо remove() — прямое удаление DOM-ноды,
 * которую знает React, ломает reconciliation (insertBefore crash). */
function useRemoveRootLoading() {
  useEffect(() => {
    (window as any).__skiniq_mounted = true;
    try {
      const el = document.getElementById('root-loading');
      if (el) el.style.display = 'none';
    } catch (_) {}
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
  const [backButtonVisible, setBackButtonVisible] = useState(false);
  
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
  
  const isOnQuizPage = pathname === '/quiz' || pathname.startsWith('/quiz/');
  
  // Скрываем навигацию на определенных страницах и в режимах/экранах, где она мешает UX
  const isOnRootPage = pathname === '/';
  const hideNav = isOnQuizPage || 
                  pathname === '/loading' ||
                  pathname.startsWith('/loading/') ||
                  isResumeScreen ||
                  isPlanGenerating ||
                  paywallVisible ||
                  isOnRootPage;

  // Читаем sessionStorage только на клиенте после монтирования
  useEffect(() => {
    if (!isOnQuizPage) {
      setBackButtonVisible(false);
      return;
    }
    const idx = parseInt(sessionStorage.getItem('currentInfoScreenIndex') || '0', 10);
    setBackButtonVisible(idx > 0 && idx < INFO_INITIAL_SCREENS_COUNT);
  }, [isOnQuizPage, pathname]);
  
  // На страницах анкеты блокируем скролл body и скроллим только контент анкеты
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isOnQuizPage) return;

    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlHeight = html.style.height;
    const prevBodyHeight = body.style.height;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.height = '100%';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.height = prevHtmlHeight;
      body.style.height = prevBodyHeight;
    };
  }, [isOnQuizPage]);
  
  return (
    <>
      <NetworkStatus />

      {/* Кнопка "назад" в фиксированном контейнере (портал в body) — только на инфо-экранах */}
      {isOnQuizPage && (
        <BackButtonFixed
          show={backButtonVisible}
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
        {isOnQuizPage ? (
          <div
            style={{
              height: '100vh',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </PageTransition>
      {/* ТЗ: НЕ монтируем BottomNavigation на /quiz для чистого UX без элементов корзины */}
      {/* КРИТИЧНО: Используем hideNav, который включает проверку isOnQuizPage и проверку нового пользователя на главной */}
      {!hideNav && <BottomNavigation />}
      {/* Сервисный попап для отзывов (не показываем на анкете и когда виден пейвол PaymentGate) */}
      {!isOnQuizPage && !paywallVisible && <ServiceFeedbackPopup />}
    </>
  );
}

/** Fallback во время Suspense — используем тот же лоадер, что и анкета, чтобы не было двух разных вариантов. */
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