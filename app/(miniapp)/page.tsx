// app/(miniapp)/page.tsx
// Простой редирект: новый пользователь → /quiz, пользователь с планом → /home

'use client';

import { useEffect, useRef, useState } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { REDIRECT_TIMEOUTS, ROOT_LOAD_TIMEOUTS } from '@/lib/config/timeouts';

export default function RootPage() {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const redirectInProgressRef = useRef(false);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (redirectInProgressRef.current) return;

    // initData сохранён в sessionStorage hash-fallback скриптом,
    // поэтому window.location.replace() безопасен — данные не теряются.
    const safeReplace = (url: string) => {
      if (redirectInProgressRef.current) return;
      redirectInProgressRef.current = true;
      setIsRedirecting(true);
      setIsLoading(false);
      if (typeof window !== 'undefined') {
        window.location.replace(url);
        cleanupTimerRef.current = setTimeout(() => {
          redirectInProgressRef.current = false;
        }, REDIRECT_TIMEOUTS.RESET_FLAG);
      }
    };

    // 1) quiz_just_submitted → /plan?state=generating
    const justSubmitted =
      typeof window !== 'undefined' &&
      sessionStorage.getItem('quiz_just_submitted') === 'true';

    if (justSubmitted) {
      clientLogger.log(
        '✅ quiz_just_submitted на главной — редиректим на /plan?state=generating'
      );

      (async () => {
        try {
          const { setHasPlanProgress } = await import('@/lib/user-preferences');
          await setHasPlanProgress(true);
        } catch (error) {
          clientLogger.warn('⚠️ Не удалось setHasPlanProgress (некритично):', error);
        } finally {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('quiz_just_submitted');
          }
          safeReplace('/plan?state=generating');
        }
      })();

      return () => {
        if (cleanupTimerRef.current) {
          clearTimeout(cleanupTimerRef.current);
          cleanupTimerRef.current = null;
        }
      };
    }

    // 2) Проверяем Telegram initData — ждём до 1.5с
    //    Проверяем SDK и sessionStorage (hash-fallback сохраняет туда)
    const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development';

    const hasInitData = (): boolean => {
      if (window.Telegram?.WebApp?.initData) return true;
      try { return !!sessionStorage.getItem('tg_init_data'); } catch { return false; }
    };

    const hasTelegramNow = typeof window !== 'undefined' && hasInitData();

    if (!hasTelegramNow && !isDev) {
      const waitForTelegram = new Promise<boolean>((resolve) => {
        let elapsed = 0;
        const interval = setInterval(() => {
          elapsed += 150;
          if (hasInitData()) {
            clearInterval(interval);
            resolve(true);
          } else if (elapsed >= 1500) {
            clearInterval(interval);
            resolve(false);
          }
        }, 150);
      });

      waitForTelegram.then((found) => {
        if (redirectInProgressRef.current) return;
        if (!found) {
          clientLogger.log('Telegram WebApp не доступен, перенаправляем на /quiz');
          safeReplace('/quiz');
        }
      });
    }

    // 3) Авторизация (не блокирующая) + проверка hasPlanProgress
    const maxWait = ROOT_LOAD_TIMEOUTS.ROOT_PAGE_MAX_WAIT;
    const timeoutId = setTimeout(() => {
      if (redirectInProgressRef.current) return;
      clientLogger.warn('⚠️ Root page: max wait reached, redirecting to /quiz');
      safeReplace('/quiz');
    }, maxWait);

    const checkAndRedirect = async () => {
      setIsLoading(true);

      // Сначала проверяем кэш (синхронно) — при повторном заходе редирект без ожидания API
      let hasPlanProgress = false;
      try {
        const cached = sessionStorage.getItem('user_preferences_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          const age = Date.now() - (parsed?.timestamp ?? 0);
          if (age < 5 * 60 * 1000 && parsed?.data) {
            hasPlanProgress = parsed.data.hasPlanProgress ?? false;
            clientLogger.log('ℹ️ cached hasPlanProgress (fast path):', hasPlanProgress);
          }
        }
      } catch {
        // ignore
      }

      if (hasPlanProgress) {
        clearTimeout(timeoutId);
        clientLogger.log('ℹ️ Has plan_progress (from cache) → /home');
        safeReplace('/home');
        return;
      }

      try {
        const { getHasPlanProgress } = await import('@/lib/user-preferences');
        hasPlanProgress = await getHasPlanProgress();
      } catch (error) {
        clientLogger.warn('⚠️ Root check error:', error);
        hasPlanProgress = false;
      }

      if (redirectInProgressRef.current) return;

      clearTimeout(timeoutId);

      if (!hasPlanProgress) {
        clientLogger.log('ℹ️ No plan_progress → /quiz');
        safeReplace('/quiz');
        return;
      }

      clientLogger.log('ℹ️ Has plan_progress → /home');
      safeReplace('/home');
    };

    checkAndRedirect();

    return () => {
      clearTimeout(timeoutId);
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
    }}>
      <div style={{
        width: 48,
        height: 48,
        border: '3px solid rgba(0,0,0,0.08)',
        borderTop: '3px solid #000',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
