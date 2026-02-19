// app/(miniapp)/page.tsx
// Простой редирект: новый пользователь → /quiz, пользователь с планом → /home

'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import { REDIRECT_TIMEOUTS, ROOT_LOAD_TIMEOUTS } from '@/lib/config/timeouts';

export default function RootPage() {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const redirectInProgressRef = useRef(false);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (redirectInProgressRef.current) return;

    const safeReplace = (url: string) => {
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

    // 2) Если Telegram недоступен: в production → /quiz; в development проверяем кэш/профиль (тестовый initData)
    const hasTelegram = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
    const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development';
    if (!hasTelegram && !isDev) {
      clientLogger.log('Telegram WebApp не доступен (production), перенаправляем на /quiz');
      safeReplace('/quiz');
      return () => {
        if (cleanupTimerRef.current) {
          clearTimeout(cleanupTimerRef.current);
          cleanupTimerRef.current = null;
        }
      };
    }
    if (!hasTelegram && isDev) {
      clientLogger.log('Telegram WebApp не доступен (localhost) — проверяем кэш и hasPlanProgress для тестового пользователя');
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

      // Если по кэшу уже знаем — редиректим сразу, авторизацию догоним на целевой странице
      if (hasPlanProgress) {
        clearTimeout(timeoutId);
        clientLogger.log('ℹ️ Has plan_progress (from cache) → /home');
        safeReplace('/home');
        return;
      }

      // Нет свежего кэша: запросы auth и hasPlanProgress параллельно (не подряд)
      try {
        const initData = window.Telegram?.WebApp?.initData;
        const authPromise = initData
          ? api.authTelegram(initData).then(() => true).catch((e: any) => {
              clientLogger.warn('⚠️ Authorization failed (non-blocking):', e?.message);
              return false;
            })
          : Promise.resolve(false);
        const planPromise = (async () => {
          try {
            const { getHasPlanProgress } = await import('@/lib/user-preferences');
            return await getHasPlanProgress();
          } catch (e) {
            clientLogger.warn('⚠️ Error getHasPlanProgress, assume new user:', e);
            return false;
          }
        })();

        const [authOk, planProgress] = await Promise.all([authPromise, planPromise]);
        hasPlanProgress = planProgress;
        if (initData && authOk) clientLogger.log('✅ Authorization successful');
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

  // Во время загрузки/редиректа ничего не показываем
  if (isLoading || isRedirecting) return null;

  return null;
}