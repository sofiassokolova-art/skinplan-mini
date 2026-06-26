// app/(miniapp)/page.tsx
// Простой редирект: новый пользователь → /quiz, пользователь с планом → /home

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientLogger } from '@/lib/client-logger';
import { api } from '@/lib/api';
import { REDIRECT_TIMEOUTS, ROOT_LOAD_TIMEOUTS } from '@/lib/config/timeouts';
import { QuizInitialLoader } from './quiz/components/QuizInitialLoader';

export default function RootPage() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const redirectInProgressRef = useRef(false);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (redirectInProgressRef.current) return;

    // Используем router.replace для SPA-навигации (сохраняем Telegram контекст и initData).
    // Fallback на window.location.replace, если router недоступен.
    const safeReplace = (url: string) => {
      redirectInProgressRef.current = true;
      setIsRedirecting(true);
      setIsLoading(false);
      try {
        router.replace(url);
      } catch (_) {
        if (typeof window !== 'undefined') window.location.replace(url);
      }
      cleanupTimerRef.current = setTimeout(() => {
        redirectInProgressRef.current = false;
      }, REDIRECT_TIMEOUTS.RESET_FLAG);
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

    // 2) Параллельно прогреваем Neon (wake-up пинг) пока ждём Telegram
    fetch('/api/ping').catch(() => undefined);

    // 2b) Параллельный префетч анкеты: большинство новых пользователей попадает
    // на /quiz, и пока мы ждём Telegram + checkUser, ответ уже окажется в кэше
    // api-клиента → useQuestionnaire на /quiz станет мгновенным cache-hit.
    // Безопасно для тех, кто уйдёт на /home: ответ просто полежит в кэше.
    void api.getActiveQuestionnaire().catch(() => undefined);

    const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development';

    const hasInitData = (): boolean => {
      if (window.Telegram?.WebApp?.initData) return true;
      try { return !!sessionStorage.getItem('tg_init_data'); } catch { return false; }
    };

    const waitForTelegram = (): Promise<boolean> => {
      if (hasInitData() || isDev) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => {
        let elapsed = 0;
        const interval = setInterval(() => {
          elapsed += 100;
          if (hasInitData()) {
            clearInterval(interval);
            resolve(true);
          } else if (elapsed >= 2000) {
            clearInterval(interval);
            resolve(false);
          }
        }, 100);
      });
    };

    const planLooksPresent = (plan: unknown): boolean => {
      if (!plan || typeof plan !== 'object') return false;

      const candidate = plan as {
        plan28?: { days?: unknown[] };
        weeks?: unknown[];
        phases?: unknown[];
        currentDay?: unknown;
      };

      return Boolean(
        candidate.plan28?.days?.length ||
          candidate.weeks?.length ||
          candidate.phases?.length ||
          candidate.currentDay
      );
    };

    const checkPlanBeforeQuiz = async (source: string): Promise<boolean> => {
      try {
        const plan = await Promise.race([
          api.getPlan(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
        ]);

        const hasPlan = planLooksPresent(plan);
        if (!hasPlan) return false;

        clientLogger.warn(
          `⚠️ Root page: ${source} did not confirm plan_progress, but /api/plan has a plan → /home`
        );

        try {
          const { setHasPlanProgress } = await import('@/lib/user-preferences');
          await setHasPlanProgress(true);
        } catch (error) {
          clientLogger.warn('⚠️ Не удалось восстановить hasPlanProgress (некритично):', error);
        }

        return true;
      } catch (error) {
        clientLogger.warn('⚠️ Root plan fallback check failed:', error);
        return false;
      }
    };

    // 3) Авторизация (не блокирующая) + проверка hasPlanProgress
    const maxWait = ROOT_LOAD_TIMEOUTS.ROOT_PAGE_MAX_WAIT;
    const timeoutId = setTimeout(() => {
      if (redirectInProgressRef.current) return;
      clientLogger.warn('⚠️ Root page: max wait reached, checking /api/plan before /quiz');
      void (async () => {
        const hasPlan = await checkPlanBeforeQuiz('max wait');
        if (redirectInProgressRef.current) return;
        safeReplace(hasPlan ? '/home' : '/quiz');
      })();
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

      // Ждём Telegram initData перед API-запросом
      const telegramReady = await waitForTelegram();
      if (redirectInProgressRef.current) return;

      if (!telegramReady) {
        clientLogger.log('Telegram WebApp не доступен, проверяем /api/plan перед /quiz');
        const hasPlan = await checkPlanBeforeQuiz('telegram wait');
        clearTimeout(timeoutId);
        if (redirectInProgressRef.current) return;
        safeReplace(hasPlan ? '/home' : '/quiz');
        return;
      }

      try {
        const { getHasPlanProgress } = await import('@/lib/user-preferences');
        // Race API против быстрого таймаута: если API долго (Neon cold start),
        // отправляем на /quiz — для нового юзера это правильный путь.
        // Пользователи с планом обычно уже имеют кеш → попадают в fast-path выше.
        hasPlanProgress = await Promise.race([
          getHasPlanProgress(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500)),
        ]);
      } catch (error) {
        clientLogger.warn('⚠️ Root check error:', error);
        hasPlanProgress = false;
      }

      if (redirectInProgressRef.current) return;

      clearTimeout(timeoutId);

      if (!hasPlanProgress) {
        const hasPlan = await checkPlanBeforeQuiz('hasPlanProgress');
        if (redirectInProgressRef.current) return;
        if (hasPlan) {
          clientLogger.log('ℹ️ Plan exists despite missing plan_progress → /home');
          safeReplace('/home');
          return;
        }

        clientLogger.log('ℹ️ No plan_progress and no plan → /quiz');
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
  }, [router]);

  return <QuizInitialLoader />;
}
