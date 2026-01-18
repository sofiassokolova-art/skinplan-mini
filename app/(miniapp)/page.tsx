// app/(miniapp)/page.tsx
// Простой редирект: новый пользователь → /quiz, пользователь с планом → /home

'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import { REDIRECT_TIMEOUTS } from '@/lib/config/timeouts';

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

    // 2) Если Telegram недоступен — всё равно в /quiz
    if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
      clientLogger.log('Telegram WebApp не доступен, перенаправляем на /quiz');
      safeReplace('/quiz');
      return () => {
        if (cleanupTimerRef.current) {
          clearTimeout(cleanupTimerRef.current);
          cleanupTimerRef.current = null;
        }
      };
    }

    // 3) Авторизация (не блокирующая) + проверка hasPlanProgress
    const checkAndRedirect = async () => {
      setIsLoading(true);

      try {
        if (window.Telegram?.WebApp?.initData) {
          await api.authTelegram(window.Telegram.WebApp.initData);
          clientLogger.log('✅ Authorization successful');
        } else {
          clientLogger.warn('⚠️ Telegram WebApp initData not available, skipping authorization');
        }
      } catch (authError: any) {
        clientLogger.warn(
          '⚠️ Authorization failed, but continuing (non-blocking):',
          authError?.message
        );
      }

      let hasPlanProgress = false;

      try {
        // сначала берём кэш
        const cached = sessionStorage.getItem('user_preferences_cache');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            hasPlanProgress = parsed?.data?.hasPlanProgress ?? false;
            clientLogger.log('ℹ️ cached hasPlanProgress:', hasPlanProgress);
          } catch {
            // ignore broken cache
          }
        }

        // если кэша нет/false — можно сходить в getHasPlanProgress (кроме /quiz)
        if (!hasPlanProgress) {
          const currentPath = window.location.pathname;
          const isOnQuizPage =
            currentPath === '/quiz' || currentPath.startsWith('/quiz/');

          if (!isOnQuizPage) {
            const { getHasPlanProgress } = await import('@/lib/user-preferences');
            hasPlanProgress = await getHasPlanProgress();
          }
        }
      } catch (error) {
        clientLogger.warn('⚠️ Error checking hasPlanProgress, assume new user:', error);
        hasPlanProgress = false;
      }

      if (redirectInProgressRef.current) return;

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