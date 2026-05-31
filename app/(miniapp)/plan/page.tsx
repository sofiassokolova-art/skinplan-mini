// app/(miniapp)/plan/page.tsx
// Страница 28-дневного плана ухода за кожей - Client Component
// (используем Client Component, чтобы получить initData из window.Telegram)

'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PlanPageClientNew } from './plan-client-new';
import { PlanPageClient } from './plan-client';
import { PlanPageV2 } from './plan-page-v2';
import type { Plan28, DayPlan } from '@/lib/plan-types';
import type { GeneratedPlan, ProfileResponse } from '@/lib/api-types';
import { clientLogger } from '@/lib/client-logger';
import { PLAN_TIMEOUTS } from '@/lib/config/timeouts';
import { safeSessionStorageRemove } from '@/lib/storage-utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLoader } from '@/components/AppLoader';

// РЕФАКТОРИНГ P2: Локальный тип данных для страницы плана
// TODO: В будущем полностью унифицировать с PlanPageData из lib/plan-types.ts
// Сейчас используем any для обратной совместимости
interface PlanData {
  // Новый формат (plan28)
  plan28?: Plan28;
  productsMap?: Map<number, {
    id: number;
    name: string;
    brand: { name: string };
    price?: number;
    imageUrl?: string | null;
    description?: string;
  }>;
  planExpired?: boolean;
  // Старый формат (для обратной совместимости)
  user?: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
  };
  profile?: {
    id: string;
    skinType: string;
    skinTypeRu: string;
    primaryConcernRu: string;
    sensitivityLevel: string | null;
    acneLevel: number | null;
    scores: unknown[]; // РЕФАКТОРИНГ: any[] -> unknown[]
  };
  plan?: {
    weeks: Array<{
      week: number;
      days: Array<{
        morning: number[];
        evening: number[];
      }>;
    }>;
  };
  progress?: {
    currentDay: number;
    completedDays: number[];
  };
  wishlist: number[];
  currentDay: number;
  currentWeek?: number;
  todayProducts?: Array<{
    id: number;
    name: string;
    brand: { name: string };
    price: number;
    volume: string | null;
    imageUrl: string | null;
    step: string;
    firstIntroducedDay: number;
  }>;
  todayMorning?: number[];
  todayEvening?: number[];
  weeks?: unknown[]; // РЕФАКТОРИНГ: any[] -> unknown[]
  products?: Map<number, unknown>; // РЕФАКТОРИНГ: any -> unknown
  scores?: unknown[]; // РЕФАКТОРИНГ: any[] -> unknown[]
}

// ФИКС #12: модульный «тёплый» кэш плана (stale-while-revalidate).
// Если пользователь уже открывал /plan в течение TTL, при возврате с главной
// данные берутся из кэша мгновенно, без общего AppLoader и сетевого loadPlan.
const PLAN_WARM_TTL_MS = 60_000;
let planWarmCache: { data: PlanData; ts: number } | null = null;
function readWarmPlanCache(): PlanData | null {
  if (!planWarmCache) return null;
  if (Date.now() - planWarmCache.ts > PLAN_WARM_TTL_MS) return null;
  return planWarmCache.data;
}
function writeWarmPlanCache(data: PlanData): void {
  planWarmCache = { data, ts: Date.now() };
}

const PlanLoadingView = ({ message }: { message: string }) => (
  <AppLoader fullScreen variant="light" message={message} />
);

export default function PlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDev = process.env.NODE_ENV === 'development';
  // ФИКС #12: снимок тёплого кэша на момент маунта (см. модульный planWarmCache).
  // Если есть свежий кэш — пропускаем общий лоадер и рендерим данные сразу.
  const initialWarmPlan = typeof window !== 'undefined' ? readWarmPlanCache() : null;
  const [loading, setLoading] = useState(initialWarmPlan === null);
  const [error, setError] = useState<string | null>(null);
  const [planData, setPlanData] = useState<PlanData | null>(initialWarmPlan);
  const [generatingState, setGeneratingState] = useState<'generating' | 'ready' | null>(null);
  const generatingStateRef = useRef<'generating' | 'ready' | null>(null); // ИСПРАВЛЕНО: Ref для проверки в таймаутах
  const loadingRef = useRef(true); // ИСПРАВЛЕНО: Ref для проверки в таймаутах (избегаем stale closure)
  const planDataRef = useRef<PlanData | null>(null); // ИСПРАВЛЕНО: Ref для проверки в таймаутах (избегаем stale closure)
  const [shouldRedirectToQuiz, setShouldRedirectToQuiz] = useState(false);
  const isMountedRef = useRef(true);
  const pageLoadStartTimeRef = useRef<number>(Date.now()); // ИСПРАВЛЕНО: Время начала загрузки страницы для абсолютного таймаута
  const loadPlanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const planGenerationCooldownRef = useRef<number>(0);
  const planGenerationInFlightRef = useRef<Promise<GeneratedPlan | null> | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const generateKickoffRef = useRef(false);

  // ФИКС P0: Централизованное управление таймерами loadPlan
  const loadPlanInFlightRef = useRef<Promise<void> | null>(null);
  const scheduledRetryRef = useRef<NodeJS.Timeout | null>(null);
  const progressCheckInProgressRef = useRef(false);

  const MAX_RETRIES = 5;

  // ФИКС P0: Централизованная функция для планирования повторных вызовов loadPlan
  const scheduleLoadPlan = (delayMs: number, reason: string) => {
    // Очищаем предыдущий таймер
    if (scheduledRetryRef.current) {
      clearTimeout(scheduledRetryRef.current);
      scheduledRetryRef.current = null;
    }

    clientLogger.log(`⏳ ${reason} - scheduling loadPlan retry in ${delayMs}ms`);
    scheduledRetryRef.current = setTimeout(() => {
      scheduledRetryRef.current = null;
      if (isMountedRef.current) {
        loadPlan(0, true); // force=true чтобы обойти проверки генерации
      }
    }, delayMs);
  };

  // Безопасные обертки для setState (проверяют mounted перед обновлением)
  const safeSetLoading = (value: boolean) => {
    if (isMountedRef.current) setLoading(value);
  };
  const safeSetError = (value: string | null) => {
    if (isMountedRef.current) setError(value);
  };
  const safeSetPlanData = (value: PlanData | null) => {
    if (isMountedRef.current) setPlanData(value);
  };

  const getPlanCooldownMsRemaining = () => Math.max(planGenerationCooldownRef.current - Date.now(), 0);
  const hasActivePlanGenerationCooldown = () => getPlanCooldownMsRemaining() > 0;

  const isRateLimitError = (error: any) => {
    if (!error) return false;
    if (typeof error.status === 'number' && error.status === 429) return true;
    if (typeof error.retryAfter === 'number') return true;
    if (typeof error.details?.retryAfter === 'number') return true;
    return typeof error.message === 'string' && /Слишком много запросов/i.test(error.message);
  };

  const extractRetryAfterSeconds = (error: any) => {
    if (typeof error?.retryAfter === 'number' && Number.isFinite(error.retryAfter)) {
      return error.retryAfter;
    }
    if (typeof error?.details?.retryAfter === 'number' && Number.isFinite(error.details.retryAfter)) {
      return error.details.retryAfter;
    }
    if (typeof error?.message === 'string') {
      const match = error.message.match(/через\s+(\d+)/i);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  };

  const generatePlanWithHandling = async (logPrefix = ''): Promise<GeneratedPlan | null> => {
    const cooldownMs = getPlanCooldownMsRemaining();
    if (cooldownMs > 0) {
      clientLogger.log(
        `${logPrefix}⏳ Plan generation cooldown active (${Math.ceil(cooldownMs / 1000)}s remaining), skipping request`
      );
      return null;
    }

    if (planGenerationInFlightRef.current) {
      clientLogger.log(`${logPrefix}⏳ Plan generation already in progress, awaiting existing request`);
      return planGenerationInFlightRef.current;
    }

    const generationPromise = (async () => {
      try {
        const result = await api.generatePlan() as GeneratedPlan;
        planGenerationCooldownRef.current = 0;
        return result;
      } catch (err: any) {
        if (isRateLimitError(err)) {
          const retrySeconds = extractRetryAfterSeconds(err) ?? 30;
          planGenerationCooldownRef.current = Date.now() + retrySeconds * 1000;
          clientLogger.warn(
            `${logPrefix}⚠️ Rate limit triggered for plan generation, pausing for ${retrySeconds} сек.`
          );
          return null;
        }

        // ИСПРАВЛЕНО: Обработка 404 ошибки (профиль не найден)
        if (err?.status === 404) {
          clientLogger.warn(`${logPrefix}⚠️ Profile not found (404), cannot generate plan`);
          return null; // Возвращаем null вместо ошибки
        }

        throw err;
      }
    })();

    planGenerationInFlightRef.current = generationPromise;

    try {
      return await generationPromise;
    } finally {
      planGenerationInFlightRef.current = null;
    }
  };

  // Polling статуса генерации плана
  // ИСПРАВЛЕНО: Инициализируем как null, чтобы не учитывать время до начала polling
  // Устанавливается только когда polling действительно начинается (строка 314 или внутри pollPlanStatus)
  const pollPlanStatusStartTimeRef = useRef<number | null>(null);
  const MAX_POLLING_DURATION = 120000; // 2 минуты максимум
  
  const pollPlanStatus = async () => {
    try {
      // ИСПРАВЛЕНО: Проверяем, что polling действительно начался
      // Если ref равен null, это означает, что polling еще не начался - устанавливаем его сейчас
      if (pollPlanStatusStartTimeRef.current === null) {
        pollPlanStatusStartTimeRef.current = Date.now();
        clientLogger.log('⚠️ pollPlanStatusStartTimeRef was null, setting it now (polling started)');
      }
      
      // ИСПРАВЛЕНО: Останавливаем polling если прошло слишком много времени
      const pollingDuration = Date.now() - pollPlanStatusStartTimeRef.current;
      if (pollingDuration > MAX_POLLING_DURATION) {
        clientLogger.warn('⚠️ Polling timeout - stopping and trying to load plan directly', {
          duration: pollingDuration,
          maxDuration: MAX_POLLING_DURATION,
        });
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        // Пробуем загрузить план напрямую
        loadPlan(0, true);
        return;
      }
      
      const response = await fetch('/api/plan/status', {
        cache: 'no-store',
        headers: {
          'X-Telegram-Init-Data': typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData || '' : '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // ApiResponse.success() возвращает payload напрямую (без { data: ... }),
        // но поддерживаем оба формата.
        const payload = (data && typeof data === 'object' && 'data' in data) ? (data as any).data : data;
        
        // ИСПРАВЛЕНО: Если статус no_profile, пробуем запустить генерацию плана
        if (payload?.status === 'no_profile') {
          clientLogger.warn('⚠️ Plan status: no_profile - trying to generate plan', { payload });
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          // Пробуем запустить генерацию плана
          const generatedPlan = await tryGeneratePlan({ checkProfile: true, logPrefix: '🔄 No profile in status, ' });
          if (generatedPlan) {
            await processPlanData(generatedPlan);
          }
          return;
        }
        
        if (payload?.ready) {
          // План готов - переходим к загрузке
          if (isMountedRef.current) {
            setGeneratingState('ready');
            generatingStateRef.current = 'ready'; // ИСПРАВЛЕНО: Синхронизируем ref
            // Очищаем polling
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            // Убираем state=generating из URL
            router.replace('/plan');
            // Загружаем план (форсируем даже если URL ещё содержал state=generating)
            loadPlan(0, true);
          }
        }
      }
    } catch (error) {
      clientLogger.warn('Error polling plan status:', error);
    }
  };

  const getPlanStatus = async (): Promise<{ status?: string; ready?: boolean } | null> => {
    try {
      const response = await fetch('/api/plan/status', {
        cache: 'no-store',
        headers: {
          'X-Telegram-Init-Data': typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData || '' : '',
        },
      });
      if (!response.ok) return null;
      const data = await response.json();
      const payload = (data && typeof data === 'object' && 'data' in data) ? (data as any).data : data;
      return payload && typeof payload === 'object' ? payload : null;
    } catch {
      return null;
    }
  };

  // ФИКС P0: Функция loadPlan определена выше useEffect для избежания хрупкого hoisting
  const loadPlan = async (retryCount = 0, force = false) => {
    // ФИКС P0: Защита от множественных одновременных вызовов
    if (loadPlanInFlightRef.current) {
      clientLogger.warn('⏸️ loadPlan already in progress, skipping duplicate call');
      return;
    }

    loadPlanInFlightRef.current = (async () => {
      try {
        // ИСПРАВЛЕНО: Не загружаем план, если мы в режиме генерации
        // Проверяем state из URL напрямую, чтобы избежать проблем с задержкой searchParams
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const state = urlParams.get('state');
          if (!force && state === 'generating') {
            clientLogger.log('⏸️ Skipping loadPlan - plan is being generated');
            return;
          }
        }

        // Защита от бесконечных попыток
        if (retryCount >= MAX_RETRIES) {
          console.error('❌ Max retries reached, stopping to prevent infinite loop');
          safeSetError('Не удалось загрузить план. Попробуйте обновить страницу.');
          safeSetLoading(false);
          return;
        }

        try {
          // Проверяем, что компонент еще смонтирован
          if (!isMountedRef.current) {
            clientLogger.warn('⚠️ Component unmounted, skipping loadPlan');
            return;
          }

          // Сбрасываем ошибку только при первой попытке
          if (retryCount === 0) {
            safeSetLoading(true);
            safeSetError(null);
          }

          // Проверяем, что приложение открыто через Telegram
          // В development не блокируем, чтобы можно было тестировать локально без Mini App
          if ((typeof window === 'undefined' || !window.Telegram?.WebApp) && !isDev) {
            safeSetError('telegram_required');
            safeSetLoading(false);
            return;
          }

          // Ждем готовности initData (может быть не сразу доступен)
          let initData: string | undefined = window.Telegram?.WebApp?.initData || undefined;
          if (!initData) {
            // Ждем максимум 2 секунды для инициализации
            await new Promise<void>((resolve) => {
              let attempts = 0;
              const maxAttempts = 20; // 20 * 100ms = 2 секунды
              let checkInterval: NodeJS.Timeout | null = null;
              try {
                checkInterval = setInterval(() => {
                  attempts++;
                  initData = window.Telegram?.WebApp?.initData || undefined;
                  if (initData || attempts >= maxAttempts) {
                    if (checkInterval) {
                      clearInterval(checkInterval);
                      checkInterval = null;
                    }
                    resolve();
                  }
                }, 100);
              } catch (error) {
                // Гарантируем очистку интервала даже при ошибке
                if (checkInterval) {
                  clearInterval(checkInterval);
                }
                resolve();
              }
            });
          }

          if (!initData && !isDev) {
            console.error('❌ initData not available after waiting');
            safeSetError('telegram_required');
            safeSetLoading(false);
            return;
          }

          // Логируем только в development и только если initData реально есть
          if (process.env.NODE_ENV === 'development' && initData) {
            clientLogger.log('✅ initData available, length:', initData.length);
          }

          // Загружаем план через API - сначала пытаемся из кэша
          // НЕ делаем лишних проверок профиля/прогресса - это замедляет загрузку
          let plan;
          try {
            clientLogger.log('🔄 Attempting to load plan from cache...');
            plan = await api.getPlan() as GeneratedPlan | null;
            clientLogger.log('✅ Plan loaded from cache:', {
                hasPlan28: !!plan?.plan28,
                hasWeeks: !!plan?.weeks,
                weeksCount: plan?.weeks?.length || 0,
                plan28DaysCount: plan?.plan28?.days?.length || 0,
              planKeys: Object.keys(plan || {}),
              });
          } catch (planError: any) {
            console.error('❌ Error loading plan from cache:', {
              status: planError?.status,
              message: planError?.message,
              error: planError,
              stack: planError?.stack,
            });

            // Если план не найден (404), проверяем, не идет ли уже rate limit cooldown
            // ИСПРАВЛЕНО: Проверяем rate limit ПЕРЕД попыткой генерации, чтобы избежать лишних запросов
            if (planError?.status === 404) {
              // Проверяем, есть ли активный cooldown от предыдущих попыток
              if (hasActivePlanGenerationCooldown()) {
                const waitMs = getPlanCooldownMsRemaining();
                scheduleLoadPlan(waitMs, `Plan not found but rate limit cooldown active (${Math.ceil(waitMs / 1000)}s)`);
                return;
              }

              // Пробуем сгенерировать план только если нет активного cooldown
              const generatedPlan = await tryGeneratePlan({
                checkProfile: true,
                logPrefix: '🔄 Plan not in cache, '
              });

              if (generatedPlan) {
                await processPlanData(generatedPlan);
                return;
              }

              // Если генерация не удалась и есть cooldown - ждем
              if (hasActivePlanGenerationCooldown()) {
                const waitMs = getPlanCooldownMsRemaining();
                scheduleLoadPlan(waitMs, 'Plan generation temporarily unavailable after failure');
                return;
              }

              // План не сгенерировался - проверяем, есть ли профиль
              // ВАЖНО: Очищаем кэш профиля перед проверкой, чтобы получить актуальные данные
              if (typeof window !== 'undefined') {
                try {
                  sessionStorage.removeItem('profile_check_cache');
                  sessionStorage.removeItem('profile_check_cache_timestamp');
                  clientLogger.log('✅ Кэш профиля очищен перед проверкой');
                } catch (cacheError) {
                  clientLogger.warn('⚠️ Не удалось очистить кэш профиля:', cacheError);
                }
              }

              const profileCheck = await api.getCurrentProfile() as ProfileResponse | null;
              if (!profileCheck) {
                // Нет профиля - показываем ошибку
                clientLogger.log('❌ No profile found after cache clear, showing error');
                safeSetError('no_profile');
                safeSetLoading(false);
                return;
              }

              clientLogger.log('✅ Profile found after cache clear:', {
                profileId: profileCheck.id,
                profileVersion: profileCheck.version,
              });

              // Профиль есть, но план не сгенерировался - возможно еще обрабатывается
              clientLogger.log('⚠️ Profile exists but plan not generated, will retry...');
            }

            // Если это не 404 или регенерация не удалась - пробуем еще раз или показываем лоадер
            // Не показываем ошибку сразу - возможно план генерируется
            if (retryCount < 2 && (
              planError?.status === 500 ||
              planError?.status === 502 ||
              planError?.status === 503 ||
              planError?.status === 504 ||
              planError?.message?.includes('Internal server error') ||
              planError?.message?.includes('timeout')
            )) {
              clientLogger.log(`⏳ Ошибка сервера, повторяем через 1 секунду... (попытка ${retryCount + 1}/2)`);
              safeSetLoading(true);
              safeSetError(null);
              await new Promise(resolve => setTimeout(resolve, 1000));
              return loadPlan(retryCount + 1);
            }

            // Если это не 404 и не серверная ошибка - показываем лоадер (возможно план генерируется)
            if (planError?.status !== 404) {
              clientLogger.log('⚠️ Unexpected error, showing loader (plan might be generating)');
              safeSetLoading(true);
              safeSetError(null);
              // ФИКС P0: Используем централизованную функцию для повторных вызовов
              scheduleLoadPlan(2000, 'Unexpected error - retrying');
              return;
            }

            // Для 404 - уже обработано выше
            clientLogger.log('⚠️ Plan not found in cache');
            plan = null;
          }

          // Проверяем наличие плана (новый формат plan28 или старый weeks)
          if (!plan || (!plan.plan28 && (!plan.weeks || plan.weeks.length === 0))) {
            // ИСПРАВЛЕНО: Если план не найден, проверяем наличие профиля и ответов
            // Если есть профиль и ответы, но нет плана - это ситуацию нужно исправить
            try {
              const profileCheck = await api.getCurrentProfile() as any;
              if (profileCheck) {
                // Профиль есть - пробуем регенерировать план
                // ИСПРАВЛЕНО: Более агрессивная генерация плана при отсутствии плана, но наличии профиля
                clientLogger.log('🔄 Plan not found but profile exists - attempting to generate plan immediately...', {
                  profileId: profileCheck.id,
                  profileVersion: profileCheck.version,
                  retryCount,
                });

                // ИСПРАВЛЕНО: Показываем лоадер генерации плана
                safeSetLoading(true);
                safeSetError(null);

                try {
                  // ИСПРАВЛЕНО: сначала проверяем status, чтобы не дергать /api/plan/generate лишний раз
                  // (особенно важно при 429 и при параллельной генерации после submitAnswers).
                  const status = await getPlanStatus();
                  if (status?.status === 'generating' && status.ready === false) {
                    clientLogger.log('⏳ Plan status=generating, starting polling instead of calling generate', {
                      profileId: profileCheck.id,
                      profileVersion: profileCheck.version,
                    });
                    setGeneratingState('generating');
                    generatingStateRef.current = 'generating'; // ИСПРАВЛЕНО: Синхронизируем ref
                    if (!pollingIntervalRef.current) {
                      pollingIntervalRef.current = setInterval(pollPlanStatus, 1500);
                    }
                    return;
                  }

                  // ИСПРАВЛЕНО: Проверяем rate limit cooldown ПЕРЕД попыткой генерации
                  if (hasActivePlanGenerationCooldown()) {
                    const waitMs = getPlanCooldownMsRemaining();
                    scheduleLoadPlan(waitMs, `Plan not found but rate limit cooldown active (${Math.ceil(waitMs / 1000)}s)`);
                    return;
                  }

                  const generatedPlan = await generatePlanWithHandling('🔄 Plan not found but profile exists - ');

                  if (!generatedPlan && hasActivePlanGenerationCooldown()) {
                    const waitMs = getPlanCooldownMsRemaining();
                    scheduleLoadPlan(waitMs, 'Plan generation temporarily paused (profile exists)');
                    return;
                  }

                  // ИСПРАВЛЕНО: Проверяем оба формата плана
                  const hasPlan28 = generatedPlan?.plan28 && generatedPlan.plan28.days && generatedPlan.plan28.days.length > 0;
                  const hasWeeks = generatedPlan?.weeks && Array.isArray(generatedPlan.weeks) && generatedPlan.weeks.length > 0;

                  if (generatedPlan && (hasPlan28 || hasWeeks)) {
                    clientLogger.log('✅ Plan generated successfully, processing...', {
                      hasPlan28,
                      hasWeeks,
                      plan28Days: generatedPlan?.plan28?.days?.length || 0,
                      weeksCount: generatedPlan?.weeks?.length || 0,
                    });
                    await processPlanData(generatedPlan);
                    return;
                  } else {
                    // План не сгенерировался - возможно еще обрабатывается или ошибка
                    clientLogger.warn('⚠️ Plan generation returned empty result', {
                      hasPlan: !!generatedPlan,
                      hasPlan28,
                      hasWeeks,
                      planKeys: generatedPlan ? Object.keys(generatedPlan) : [],
                    });

                    // ИСПРАВЛЕНО: Если это не последняя попытка, пробуем еще раз
                    if (retryCount < MAX_RETRIES - 1) {
                      clientLogger.log('⏳ Retrying plan generation...', { retryCount: retryCount + 1 });
                      safeSetLoading(true);
                      safeSetError(null);
                      scheduleLoadPlan(3000, 'Plan generation returned empty result');
                      return;
                    } else {
                      // Последняя попытка - показываем ошибку
                      safeSetError('Не удалось создать план. Попробуйте обновить страницу или пройдите анкету заново.');
                      safeSetLoading(false);
                      return;
                    }
                  }
                } catch (generateError: any) {
                  console.error('❌ Failed to regenerate plan:', generateError);

                  // ИСПРАВЛЕНО: Детальное логирование ошибки
                  clientLogger.error('❌ Plan generation failed', {
                    error: generateError?.message,
                    status: generateError?.status,
                    statusText: generateError?.statusText,
                    stack: generateError?.stack?.substring(0, 300),
                    retryCount,
                  });

                  // Если это ошибка 404 (нет профиля) и это не первая попытка - показываем ошибку
                  if ((generateError?.status === 404 || generateError?.message?.includes('No skin profile') || generateError?.message?.includes('Profile not found')) && retryCount >= 2) {
                    safeSetError('no_profile');
                    safeSetLoading(false);
                    return;
                  }

                  // ИСПРАВЛЕНО: Для других ошибок пробуем еще раз, если не последняя попытка
                  if (retryCount < MAX_RETRIES - 1) {
                    clientLogger.log('⏳ Plan generation error, but profile exists - retrying...', {
                      error: generateError?.message,
                      retryCount: retryCount + 1,
                    });
                    safeSetLoading(true);
                    safeSetError(null);
                    scheduleLoadPlan(3000, 'Plan generation error');
                    return;
                  } else {
                    // Последняя попытка - показываем ошибку
                    safeSetError('Не удалось создать план. Попробуйте обновить страницу.');
                    safeSetLoading(false);
                    return;
                  }
                }
              } else {
                // Профиля нет - показываем ошибку только после нескольких попыток
                if (retryCount >= 2) {
                  safeSetError('no_profile');
                  safeSetLoading(false);
                  return;
                }
                // При первой попытке показываем лоадер, возможно профиль еще создается
                clientLogger.log('⏳ Profile not found, but might be creating - waiting and retrying...');
                safeSetLoading(true);
                safeSetError(null);
                scheduleLoadPlan(2000, 'Profile not found - waiting');
                return;
              }
            } catch (profileCheckError: any) {
              console.error('❌ Error checking profile:', profileCheckError);
              // Если ошибка проверки профиля - возможно временная проблема, пробуем еще раз
              if (retryCount < 2) {
                clientLogger.log('⏳ Profile check error, retrying...');
                safeSetLoading(true);
                safeSetError(null);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return loadPlan(retryCount + 1);
              }
              // После нескольких попыток - показываем ошибку
              safeSetError('no_profile');
              safeSetLoading(false);
              return;
            }
          }

          // Получаем профиль для scores и другой информации
          // НЕ требуем профиль для показа плана, если план уже есть
          let profile;
          try {
            profile = await api.getCurrentProfile() as ProfileResponse | null;
          } catch (profileError: any) {
            // Если профиль не найден, но план есть - это нормально, продолжаем с plan28
            // Профиль нужен только для старого формата плана
            if (process.env.NODE_ENV === 'development') {
              clientLogger.warn('Could not load profile, but plan exists - continuing with plan only');
            }
            profile = null;
          }

          // Если план есть в новом формате plan28, можем продолжать без профиля
          if (plan.plan28) {
            if (process.env.NODE_ENV === 'development') {
              clientLogger.log('✅ Using plan28 format, profile not required');
            }
            // Продолжаем дальше без проверки профиля
          } else if (!profile) {
            // Для старого формата нужен профиль
            if (retryCount < 3) {
              if (process.env.NODE_ENV === 'development') {
                clientLogger.log(`⏳ Профиль пустой, ждем 2 секунды... (попытка ${retryCount + 1}/3)`);
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
              return loadPlan(retryCount + 1);
            }
            safeSetError('no_profile');
            safeSetLoading(false);
            return;
          }

          // План может быть истёкшим (28+ дней) — UX: не редиректим и не показываем отдельный экран.
          // PaymentGate заблюрит контент и покажет оплату, а ниже будет ссылка "Перепройти анкету".
          // Флаг expired сохраняется внутри processPlanData → planExpired.

          // Используем общую функцию обработки плана (избегаем дублирования кода)
          await processPlanData(plan);
          return;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Error loading plan:', error);

          // При ошибке не показываем экран ошибки - показываем лоадер
          // Проверяем, есть ли профиль или прогресс - если есть, план должен существовать
          // ФИКС P0: Защита от множественных вызовов через ref (ref объявлен на верхнем уровне)
          if (progressCheckInProgressRef.current) {
            clientLogger.warn('⏸️ Progress check already in progress, skipping');
            return;
          }

          progressCheckInProgressRef.current = true;

          try {
            const [profileCheck, progressCheck] = await Promise.allSettled([
              api.getCurrentProfile() as Promise<any>,
              api.getPlanProgress() as Promise<any>,
            ]);

            const hasProfile = profileCheck.status === 'fulfilled' && !!profileCheck.value;
            const hasProgress = progressCheck.status === 'fulfilled' &&
              !!progressCheck.value &&
              (progressCheck.value.completedDays?.length > 0 || progressCheck.value.currentDay > 1);

            if (hasProfile || hasProgress) {
              // План должен существовать - но сначала проверяем, не идет ли rate limit cooldown
              if (hasActivePlanGenerationCooldown()) {
                const waitMs = getPlanCooldownMsRemaining();
                scheduleLoadPlan(waitMs, `Plan should exist but rate limit cooldown active (${Math.ceil(waitMs / 1000)}s)`);
                progressCheckInProgressRef.current = false;
                return;
              }

              // План должен существовать - пробуем регенерировать
              clientLogger.log('🔄 Plan should exist, attempting to regenerate...');
              safeSetLoading(true);
              safeSetError(null);
              try {
                const generatedPlan = await generatePlanWithHandling('🔄 Plan should exist - ');
                if (!generatedPlan && hasActivePlanGenerationCooldown()) {
                  const waitMs = getPlanCooldownMsRemaining();
                  scheduleLoadPlan(waitMs, 'Plan regeneration paused due to cooldown');
                  progressCheckInProgressRef.current = false;
                  return;
                }
                if (generatedPlan && (generatedPlan.plan28 || generatedPlan.weeks)) {
                  clientLogger.log('✅ Plan regenerated successfully, processing...');
                  await processPlanData(generatedPlan);
                    progressCheckInProgressRef.current = false;
                  return;
                }
              } catch (generateError: any) {
                console.error('❌ Failed to regenerate plan:', generateError);
                // Если слишком много попыток - показываем ошибку
                if (retryCount >= MAX_RETRIES - 1) {
                  safeSetError('Не удалось загрузить план. Попробуйте обновить страницу.');
                  safeSetLoading(false);
                  progressCheckInProgressRef.current = false;
                  return;
                }
                // Пробуем еще раз через 3 секунды, но увеличиваем счетчик попыток
                safeSetLoading(true);
                safeSetError(null);
                scheduleLoadPlan(3000, 'Plan regeneration failed');
                progressCheckInProgressRef.current = false;
                return;
              }
            } else {
              // Профиля нет - показываем ошибку профиля
              safeSetError('no_profile');
            safeSetLoading(false);
              progressCheckInProgressRef.current = false;
              return;
            }
            progressCheckInProgressRef.current = false;
          } catch (checkError) {
            console.error('❌ Error checking profile/progress:', checkError);
            progressCheckInProgressRef.current = false;
            // Если слишком много попыток - показываем ошибку
            if (retryCount >= MAX_RETRIES - 1) {
              safeSetError('Не удалось загрузить план. Попробуйте обновить страницу.');
              safeSetLoading(false);
              return;
            }
            // При ошибке проверки пробуем еще раз через 2 секунды, но увеличиваем счетчик попыток
            safeSetLoading(true);
            safeSetError(null);
            scheduleLoadPlan(2000, 'Error checking profile/progress');
            return;
          }
        }
      } finally {
        loadPlanInFlightRef.current = null;
      }
    })();
  };

  // ИСПРАВЛЕНО: Синхронизируем generatingStateRef с generatingState
  useEffect(() => {
    generatingStateRef.current = generatingState;
  }, [generatingState]);

  // ИСПРАВЛЕНО: Синхронизируем loadingRef с loading для использования в таймаутах
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // ИСПРАВЛЕНО: Синхронизируем planDataRef с planData для использования в таймаутах
  useEffect(() => {
    planDataRef.current = planData;
  }, [planData]);

  useEffect(() => {
    isMountedRef.current = true;
    pageLoadStartTimeRef.current = Date.now(); // ИСПРАВЛЕНО: Запоминаем время начала загрузки страницы
    
    // УМНЫЙ абсолютный таймаут: учитывает реальный прогресс
    const absoluteTimeout = setTimeout(() => {
      if (isMountedRef.current && loadingRef.current && !planDataRef.current) {
        // Проверяем реальный прогресс загрузки
        const timeElapsed = Date.now() - pageLoadStartTimeRef.current;
        const hasRealProgress = planDataRef.current || generatingStateRef.current === 'generating';

        // Если нет реального прогресса и прошло достаточно времени - показываем ошибку
        if (!hasRealProgress && timeElapsed > PLAN_TIMEOUTS.PAGE_ABSOLUTE) {
          clientLogger.warn('⚠️ Smart absolute timeout reached - showing fallback screen', {
            timeElapsed,
            hasProgress: !!planDataRef.current,
            isGenerating: generatingStateRef.current === 'generating',
            maxTime: PLAN_TIMEOUTS.PAGE_ABSOLUTE
          });
          safeSetLoading(false);
          safeSetError('Не удалось загрузить план за отведенное время. Пожалуйста, попробуйте обновить страницу или перейти в анкету.');
        }
      }
    }, PLAN_TIMEOUTS.PAGE_ABSOLUTE);
    
    // ИСПРАВЛЕНО: Проверяем state из URL напрямую, чтобы избежать проблем с задержкой searchParams
    let state: string | null = null;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      state = urlParams.get('state');
    }
    
    // Также проверяем searchParams для надежности
    const stateFromParams = searchParams?.get('state');
    if (stateFromParams) {
      state = stateFromParams;
    }
    
    if (state === 'generating') {
      clientLogger.log('✅ State=generating detected, starting polling');
      pollPlanStatusStartTimeRef.current = Date.now(); // Сбрасываем таймер при старте polling
      setGeneratingState('generating');
      generatingStateRef.current = 'generating'; // ИСПРАВЛЕНО: Синхронизируем ref сразу
      safeSetLoading(true);

      // ИСПРАВЛЕНО: при /plan?state=generating мы обязаны "пнуть" генерацию,
      // иначе polling /api/plan/status может крутиться бесконечно (если генерация ещё не стартовала).
      if (!generateKickoffRef.current) {
        generateKickoffRef.current = true;
        (async () => {
          try {
            // profileId помогает read-your-write после submitAnswers / создания профиля
            const profileId = searchParams?.get('profileId') || undefined;
            await api.generatePlan(profileId);
            clientLogger.log('✅ Plan generation kickoff requested', { profileId: profileId || null });
          } catch (err: any) {
            // Не критично: polling/обычная загрузка ещё могут подобрать план
            clientLogger.warn('⚠️ Plan generation kickoff failed (non-critical):', err);
          }
        })();
      }
      
      // Начинаем polling статуса плана
      pollingIntervalRef.current = setInterval(pollPlanStatus, PLAN_TIMEOUTS.POLLING_INTERVAL);
      
      // РЕФАКТОРИНГ: Таймаут генерации из конфигурации
      setTimeout(() => {
        if (isMountedRef.current && generatingStateRef.current === 'generating') {
          clientLogger.warn('Plan generation timeout, loading plan anyway');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setGeneratingState('ready');
          generatingStateRef.current = 'ready';
          router.replace('/plan');
          loadPlan(0, true);
        }
      }, PLAN_TIMEOUTS.GENERATION_TIMEOUT);
    } else {
      // Обычная загрузка плана
      // ВАЖНО: Очищаем кэш профиля при загрузке страницы плана
      // Это гарантирует, что мы получим актуальные данные профиля, даже если он был только что создан
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('profile_check_cache');
          sessionStorage.removeItem('profile_check_cache_timestamp');
          clientLogger.log('✅ Кэш профиля очищен при загрузке страницы плана');
        } catch (cacheError) {
          clientLogger.warn('⚠️ Не удалось загрузить кэш профиля при загрузке:', cacheError);
        }
      }

      // ФИКС #12: если на маунте есть свежий тёплый кэш плана — пропускаем
      // полный loadPlan, общий лоадер не показывается, контент уже отрендерен
      // из initialWarmPlan через useState. Следующий заход за пределами TTL
      // нормально перезагрузит план.
      if (initialWarmPlan !== null) {
        clientLogger.log('✅ Тёплый кэш плана на маунте — loadPlan пропущен', {
          ageMs: Date.now() - (planWarmCache?.ts ?? Date.now()),
        });
      } else {
        loadPlan();
      }
    }
    
    return () => {
      isMountedRef.current = false;
      // Очищаем таймеры при размонтировании
      clearTimeout(absoluteTimeout); // ИСПРАВЛЕНО: Очищаем абсолютный таймаут
      if (loadPlanTimeoutRef.current) {
        clearTimeout(loadPlanTimeoutRef.current);
        loadPlanTimeoutRef.current = null;
      }
      if (scheduledRetryRef.current) {
        clearTimeout(scheduledRetryRef.current);
        scheduledRetryRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ИСПРАВЛЕНО: Если нет профиля, сразу редиректим на /quiz вместо показа экрана ошибки
  // Это предотвращает показ страницы плана на секунду перед редиректом
  useEffect(() => {
    if (error === 'no_profile' && !loading && !shouldRedirectToQuiz) {
      clientLogger.log('❌ No profile found on plan page, redirecting to /quiz');
      setShouldRedirectToQuiz(true);
      router.replace('/quiz');
    }
  }, [error, loading, shouldRedirectToQuiz, router]);

  // Функция для генерации плана с проверкой профиля
  // Унифицированная функция для замены дублирующейся логики
  const tryGeneratePlan = async (options?: {
    checkProfile?: boolean; // Проверять ли профиль перед генерацией
    logPrefix?: string; // Префикс для логов
  }): Promise<GeneratedPlan | null> => {
    const { checkProfile = true, logPrefix = '' } = options || {};
    
    try {
      // Опционально проверяем наличие профиля
      if (checkProfile) {
        // ВАЖНО: Очищаем кэш профиля перед проверкой, чтобы получить актуальные данные
        // Это особенно важно после создания профиля, когда кэш может содержать старый null
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('profile_check_cache');
            sessionStorage.removeItem('profile_check_cache_timestamp');
            if (logPrefix) {
              clientLogger.log(`${logPrefix}✅ Кэш профиля очищен перед проверкой`);
            }
          } catch (cacheError) {
            if (logPrefix) {
              clientLogger.warn(`${logPrefix}⚠️ Не удалось очистить кэш профиля:`, cacheError);
            }
          }
        }
        
        const profile = await api.getCurrentProfile() as ProfileResponse | null;
        if (!profile) {
          clientLogger.log(`${logPrefix}❌ No profile found after cache clear, cannot generate plan`);
          return null;
        }
        
        clientLogger.log(`${logPrefix}✅ Profile found:`, {
          profileId: profile.id,
          profileVersion: profile.version,
        });
      }

      // Пытаемся сгенерировать план
      clientLogger.info(`${logPrefix}🔄 Attempting to generate plan...`);
      const generatedPlan = await generatePlanWithHandling(logPrefix);
      
      if (generatedPlan && (generatedPlan.plan28 || generatedPlan.weeks)) {
        clientLogger.info(`${logPrefix}✅ Plan generated successfully`, {
          hasPlan28: !!generatedPlan.plan28,
          hasWeeks: !!generatedPlan.weeks,
          plan28Days: generatedPlan.plan28?.days?.length || 0,
        });
        return generatedPlan;
      }
      
      if (hasActivePlanGenerationCooldown()) {
        clientLogger.log(`${logPrefix}⏳ Plan generation delayed due to active rate limit cooldown`);
        return null;
      }

      clientLogger.warn(`${logPrefix}⚠️ Plan generation returned empty result`);
      return null;
    } catch (error: any) {
      clientLogger.error(`${logPrefix}❌ Error generating plan`, {
        error: error?.message || String(error),
        status: error?.status,
        stack: error?.stack?.substring(0, 200),
      });
      
      // Проверяем, является ли ошибка связанной с отсутствием профиля
      if (error?.status === 404 || 
          error?.message?.includes('No skin profile') || 
          error?.message?.includes('Profile not found')) {
        clientLogger.log(`${logPrefix}❌ No profile found in error response`);
        return null;
      }
      
      // Другие ошибки - возвращаем null, но не показываем ошибку сразу
      return null;
    }
  };

  // Кэш продуктов для производительности
  const productsCacheRef = useRef<Map<string, { data: Map<number, any>; timestamp: number }>>(new Map());

  // Функция для загрузки продуктов с кэшированием
  const loadProductsBatch = async (productIds: number[]): Promise<Map<number, any>> => {
    if (productIds.length === 0) {
      return new Map();
    }

    const cacheKey = productIds.sort().join(',');
    const cached = productsCacheRef.current.get(cacheKey);

    // Используем кэш если он свежий (5 минут)
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      clientLogger.log('✅ Using cached products batch');
      return cached.data;
    }

    const productsMap = new Map<number, any>();

    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      try {
        clientLogger.log('📦 Loading products from batch endpoint, count:', productIds.length);

        const productsResponse = await fetch('/api/products/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
          },
          body: JSON.stringify({ productIds }),
        });

        if (productsResponse.ok) {
          const productsData = await productsResponse.json().catch((parseErr: any) => {
            clientLogger.warn('Batch response JSON parse failed, using empty products', parseErr);
            return { products: [] };
          });
          clientLogger.log('✅ Products loaded from batch:', productsData?.products?.length ?? 0);

          if (productsData?.products && Array.isArray(productsData.products)) {
            productsData.products.forEach((p: any) => {
              if (p && p.id) {
                productsMap.set(p.id, {
                  id: p.id,
                  name: p.name || 'Неизвестный продукт',
                  brand: { name: p.brand?.name || (typeof p.brand === 'string' ? p.brand : 'Unknown') },
                  price: p.price || null,
                  imageUrl: p.imageUrl || null,
                  description: p.descriptionUser || p.description || null,
                });
              }
            });
          }
        } else {
          // 404/5xx — не бросаем, возвращаем пустую карту; processPlanData подставит fallback из плана
          clientLogger.warn('Batch endpoint non-OK:', {
            status: productsResponse.status,
            statusText: productsResponse.statusText,
          });
        }
      } catch (err: any) {
        clientLogger.warn('Error loading products from batch (using empty map):', err?.message || err);
      }
    }

    // Кэшируем результат
    productsCacheRef.current.set(cacheKey, {
      data: productsMap,
      timestamp: Date.now()
    });

    clientLogger.log('📊 Products loaded and cached, map size:', productsMap.size);
    return productsMap;
  };

  // Функция для обработки данных плана (вынесена для переиспользования)
  const processPlanData = async (plan: GeneratedPlan) => {
    try {
      safeSetLoading(true);
      safeSetError(null);
      
      // Проверяем, что план валиден
      if (!plan) {
        throw new Error('Plan data is null or undefined');
      }
      
      if (!plan.plan28 && (!plan.weeks || plan.weeks.length === 0)) {
        throw new Error('Plan has no valid data (no plan28 and no weeks)');
      }

      // Для нового формата plan28 профиль не обязателен, поэтому запрашиваем его
      // только для старого формата (weeks), чтобы не тратить лишнее время
      const usingPlan28 = !!plan.plan28;
      const needsProfile = !usingPlan28 && !!plan.weeks && plan.weeks.length > 0;
      const needsLegacyFields = !usingPlan28 && !!plan.weeks && plan.weeks.length > 0;

      let profile: ProfileResponse | null = null;
      let userProfile: any | null = null;
      let wishlist: number[] = [];
      let planProgress: { currentDay: number; completedDays: number[] } = {
        currentDay: 1,
        completedDays: [],
      };

      try {
        const [profileResult, wishlistResult, progressResult, userResult] = await Promise.allSettled([
          needsProfile ? (api.getCurrentProfile() as Promise<ProfileResponse | null>) : Promise.resolve(null),
          api.getWishlist() as Promise<any>,
          api.getPlanProgress() as Promise<{ currentDay: number; completedDays: number[] }>,
          needsLegacyFields ? (api.getUserProfile() as Promise<any>) : Promise.resolve(null),
        ]);

        // Профиль нужен только для старого формата
        if (needsProfile) {
          if (profileResult.status === 'fulfilled') {
            profile = profileResult.value;
          } else {
            if (process.env.NODE_ENV === 'development') {
              clientLogger.warn('Could not load profile for legacy plan format:', profileResult.reason);
            }
            profile = null;
          }

          if (!profile) {
            // Для старого формата без профиля отображать план некорректно
            safeSetError('no_profile');
            safeSetLoading(false);
            return;
          }
        } else if (usingPlan28 && process.env.NODE_ENV === 'development') {
          clientLogger.log('✅ Using plan28 format, skipping profile load');
        }

        // User profile нужен только для legacy-компонента (старый формат weeks)
        if (needsLegacyFields) {
          if (userResult.status === 'fulfilled') {
            userProfile = userResult.value;
          } else if (process.env.NODE_ENV === 'development') {
            clientLogger.warn('Could not load user profile for legacy plan format:', userResult.reason);
          }
        }

        // Wishlist
        if (wishlistResult.status === 'fulfilled' && wishlistResult.value) {
          const wishlistData = wishlistResult.value;
          wishlist = (wishlistData.items || [])
            .map((item: any) => item.product?.id || item.productId)
            .filter((id: any): id is number => typeof id === 'number');
        } else if (wishlistResult.status === 'rejected' && process.env.NODE_ENV === 'development') {
          clientLogger.warn('Could not load wishlist:', wishlistResult.reason);
        }

        // Прогресс плана (синхронизация между устройствами)
        if (progressResult.status === 'fulfilled' && progressResult.value) {
          const progressResponse = progressResult.value;
          if (
            typeof progressResponse.currentDay === 'number' &&
            Array.isArray(progressResponse.completedDays)
          ) {
            planProgress = {
              currentDay:
                progressResponse.currentDay < 1
                  ? 1
                  : progressResponse.currentDay > 28
                  ? 28
                  : progressResponse.currentDay,
              completedDays: progressResponse.completedDays,
            };
          }
        } else if (progressResult.status === 'rejected' && process.env.NODE_ENV === 'development') {
          clientLogger.warn('Could not load plan progress, using defaults:', progressResult.reason);
        }
      } catch (parallelError: any) {
        if (process.env.NODE_ENV === 'development') {
          clientLogger.warn('Parallel profile/wishlist/progress load failed, using partial data:', parallelError);
        }
        // В случае общей ошибки оставляем значения по умолчанию
      }

      // Обрабатываем данные для передачи в компонент
      const currentDayGlobal = planProgress.currentDay || 1;
      const currentWeek =
        currentDayGlobal <= 7
          ? 1
          : currentDayGlobal <= 14
          ? 2
          : currentDayGlobal <= 21
          ? 3
          : 4;

      const currentWeekIndex = Math.max(0, Math.min((plan.weeks?.length || 0) - 1, currentWeek - 1));
      const currentWeekData = plan.weeks?.[currentWeekIndex];

      const dayIndexWithinWeek = (currentDayGlobal - 1) % ((currentWeekData as any)?.days?.length || 7);
      const currentDayData = (currentWeekData as any)?.days?.[dayIndexWithinWeek] || (currentWeekData as any)?.days?.[0];

      const todayMorning = currentDayData?.morning || [];
      const todayEvening = currentDayData?.evening || [];

      // Получаем продукты для текущего дня
      const todayProductIds = [...new Set([...todayMorning, ...todayEvening])].filter((id): id is number => typeof id === 'number');
      
      // Преобразуем продукты из плана
      const todayProducts = (plan.products || []).filter((p: any) => todayProductIds.includes(p.id)).map((p: any) => ({
        id: p.id,
        name: p.name,
        brand: { name: p.brand?.name || (typeof p.brand === 'string' ? p.brand : 'Unknown') },
        price: p.price || 0,
        volume: p.volume || null,
        imageUrl: p.imageUrl || null,
        step: p.category || p.step || 'moisturizer',
        firstIntroducedDay: 1,
      }));

      // Преобразуем scores из плана
      const scores = plan.skinScores || [];

      // Используем новый формат plan28, если доступен
      let plan28 = plan.plan28 as Plan28 | undefined;
      
      // Создаем Map продуктов для быстрого доступа
      const productsMap = new Map<number, {
        id: number;
        name: string;
        brand: { name: string };
        price?: number;
        imageUrl?: string | null;
        description?: string;
      }>();

      if (plan28 && plan28.days) {
        // Для нового формата plan28 собираем все productId из всех дней
        const allProductIds = new Set<number>();
        plan28.days.forEach(day => {
          day.morning.forEach(step => {
            if (step.productId) allProductIds.add(Number(step.productId));
            (step.alternatives ?? []).forEach(alt => allProductIds.add(Number(alt)));
          });
          day.evening.forEach(step => {
            if (step.productId) allProductIds.add(Number(step.productId));
            (step.alternatives ?? []).forEach(alt => allProductIds.add(Number(alt)));
          });
          day.weekly.forEach(step => {
            if (step.productId) allProductIds.add(Number(step.productId));
            (step.alternatives ?? []).forEach(alt => allProductIds.add(Number(alt)));
          });
        });

        // Загружаем продукты из API с кэшированием
        let productsLoadedFromAPI = false;

        if (allProductIds.size > 0) {
          const loadedProductsMap = await loadProductsBatch(Array.from(allProductIds));
          loadedProductsMap.forEach((product, id) => {
            productsMap.set(id, product);
          });
          productsLoadedFromAPI = productsMap.size > 0;
        }

        // Fallback: если продукты не загрузились из API, используем продукты из плана
        // НО: это должно быть исключением, а не правилом
        if (!productsLoadedFromAPI && plan.products && Array.isArray(plan.products)) {
          clientLogger.log('⚠️ Using products from plan as fallback (API failed)');
          plan.products.forEach((p: any) => {
            if (p && p.id) {
              productsMap.set(p.id, {
                id: p.id,
                name: p.name,
                brand: { name: p.brand?.name || (typeof p.brand === 'string' ? p.brand : 'Unknown') },
                price: p.price,
                imageUrl: p.imageUrl || null,
                description: p.description || p.descriptionUser || null,
              });
            }
          });
          clientLogger.log('⚠️ Products loaded from plan fallback, map size:', productsMap.size);
            }
        
        // Если после всех попыток продуктов все еще нет - это ошибка
        if (productsMap.size === 0) {
          console.error('❌ CRITICAL: No products loaded at all!', {
            hasProductIds: allProductIds.size > 0,
            hasPlanProducts: !!plan.products,
            planProductsCount: plan.products?.length || 0,
          });
        }

        clientLogger.log('📊 Final productsMap size:', productsMap.size);
        if (productsMap.size > 0) {
          clientLogger.log('📦 Sample product IDs in map:', Array.from(productsMap.keys()).slice(0, 5));
        }
      } else {
        // Для старого формата используем plan.products
        if (!plan28 && process.env.NODE_ENV === 'development') {
          clientLogger.warn('⚠️ plan28 not found in plan response, falling back to old format');
        }

        clientLogger.log('📦 Loading products from plan.products, count:', (plan.products || []).length);
        (plan.products || []).forEach((p: any) => {
          productsMap.set(p.id, {
            id: p.id,
            name: p.name,
            brand: { name: p.brand?.name || (typeof p.brand === 'string' ? p.brand : 'Unknown') },
            price: p.price,
            imageUrl: p.imageUrl || null,
            description: p.description || p.descriptionUser || null,
          });
        });
        clientLogger.log('📊 Products loaded from plan.products, map size:', productsMap.size);
      }

      // Важно: Map не сериализуется в JSON, поэтому сохраняем как есть
      // При передаче через setState Map сохраняется корректно
      clientLogger.log('💾 Setting planData with productsMap size:', productsMap.size);

      // ИСПРАВЛЕНО: Сохраняем флаг expired из ответа API
      const planResponse = plan as any;
      const planExpired = planResponse?.expired === true;
      
      // ИСПРАВЛЕНО: Устанавливаем hasPlanProgress = true после успешной обработки плана
      // Это гарантирует, что пользователь не будет редиректиться на /quiz при следующем заходе
      try {
        const { setHasPlanProgress } = await import('@/lib/user-preferences');
        await setHasPlanProgress(true);
        clientLogger.log('✅ hasPlanProgress установлен в true после успешной загрузки плана');
      } catch (error) {
        clientLogger.warn('⚠️ Ошибка при установке hasPlanProgress (некритично):', error);
      }

      // ИСПРАВЛЕНО: Очищаем quiz_just_submitted при успешной загрузке плана
      // Иначе при заходе на /home будет редирект обратно на /plan
      safeSessionStorageRemove('quiz_just_submitted');
      
      const nextPlanData: PlanData = {
        plan28: plan28 || undefined,
        weeks: plan.weeks || [],
        productsMap: productsMap, // Map передается напрямую
        products: productsMap, // Также сохраняем в products для обратной совместимости
        // Legacy-поля: нужны, если пришёл старый формат (weeks без plan28)
        user: needsLegacyFields && userProfile ? {
          id: String(userProfile.id || ''),
          telegramId: String(userProfile.telegramId || ''),
          firstName: userProfile.firstName ?? null,
          lastName: userProfile.lastName ?? null,
        } : (needsLegacyFields ? {
          id: '',
          telegramId: '',
          firstName: null,
          lastName: null,
        } : undefined),
        profile: profile ? {
          id: String(profile.id), // Преобразуем id в строку для совместимости
          skinType: profile.skinType,
          skinTypeRu: profile.skinTypeRu || profile.skinType, // Значение по умолчанию
          primaryConcernRu: profile.primaryConcernRu || '', // Значение по умолчанию
          sensitivityLevel: profile.sensitivityLevel || null,
          acneLevel: profile.acneLevel || null,
          scores: profile.scores || [], // Значение по умолчанию
        } : undefined,
        plan: needsLegacyFields ? {
          weeks: (plan.weeks || []).map((w: any) => ({
            week: w.week,
            days: Array.isArray(w.days) ? w.days : [],
          })),
        } : undefined,
        progress: planProgress,
        scores,
        wishlist,
        currentDay: currentDayGlobal,
        // В legacy-компоненте ожидается номер недели (1..4), а не индекс 0..3
        currentWeek,
        todayProducts,
        todayMorning,
        todayEvening,
        planExpired, // Сохраняем флаг истечения плана
      };
      // ФИКС #12: пишем тёплый кэш плана — следующие заходы на /plan в пределах
      // TTL отрендерятся мгновенно без общего лоадера (см. readWarmPlanCache).
      writeWarmPlanCache(nextPlanData);
      safeSetPlanData(nextPlanData);

      safeSetLoading(false);
    } catch (err: any) {
      console.error('❌ Error processing plan data:', err);
      console.error('   Error message:', err?.message);
      console.error('   Error stack:', err?.stack);
      
      // Логируем ошибку в БД для техподдержки
      try {
        if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
          await fetch('/api/logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
            },
            body: JSON.stringify({
              level: 'error',
              message: `Plan: Error processing plan data - ${err?.message || 'Unknown error'}`,
              context: {
                error: err?.message || String(err),
                stack: err?.stack,
                planHasPlan28: !!plan?.plan28,
                planHasWeeks: !!plan?.weeks,
                url: window.location.href,
              },
              url: window.location.href,
              userAgent: navigator.userAgent,
            }),
          }).catch(logErr => clientLogger.warn('Failed to log error:', logErr));
        }
      } catch (logError) {
        clientLogger.warn('Failed to save error log:', logError);
      }
      
      // При ошибке обработки плана не показываем экран генерации
      // Вместо этого пытаемся загрузить план заново или показываем обычный лоадер
      console.error('❌ Error processing plan, attempting to reload...');
      // ВАЖНО: Сбрасываем ошибку и показываем только лоадер
      // Не показываем ошибку пользователю, так как план может еще генерироваться
      safeSetError(null);
      safeSetLoading(true);
      // Пробуем загрузить план еще раз через небольшую задержку
      setTimeout(() => {
        if (isMountedRef.current) {
          loadPlan(0);
        }
      }, 2000);
    }
  };

  // ИСПРАВЛЕНО: Добавлен return statement для рендеринга компонента
  // Если редиректим на /quiz, не рендерим ничего
  if (shouldRedirectToQuiz) {
    return null;
  }

  // ДИАГНОСТИКА: Логируем состояние для отладки
  if (isDev) {
    console.log('🔍 [PlanPage] Render state:', {
      loading,
      hasPlanData: !!planData,
      hasPlan28: !!planData?.plan28,
      hasUser: !!planData?.user,
      hasProfile: !!planData?.profile,
      hasPlan: !!planData?.plan,
      generatingState,
      error,
      shouldRedirectToQuiz,
    });
  }

  // Если загрузка, показываем лоадер
  if (loading || !planData) {
    // Показываем лоадер генерации, если план генерируется
    if (generatingState === 'generating') {
      return <PlanLoadingView message="Генерируем ваш план..." />;
    }

    // Обычный лоадер
    return <PlanLoadingView message="Загружаем план..." />;
  }

  // Если ошибка, показываем сообщение об ошибке
  if (error && error !== 'no_profile') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <p style={{
          fontSize: '18px',
          color: '#D32F2F',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          {error}
        </p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            loadPlan(0);
          }}
          style={{
            padding: '12px 24px',
            background: '#0A5F59',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  // Экран «Обновить» для ErrorBoundary и повторной загрузки
  const planErrorFallback = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
    }}>
      <p style={{ fontSize: '18px', color: '#D32F2F', marginBottom: '20px', textAlign: 'center' }}>
        Не удалось загрузить план. Пожалуйста, попробуйте обновить страницу.
      </p>
      <button
        onClick={() => { setError(null); setLoading(true); loadPlan(0); }}
        style={{
          padding: '12px 24px',
          background: '#0A5F59',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Обновить
      </button>
    </div>
  );

  // Рендерим план
  // V2: новый компонент сам подгружает /api/plan/page-context и
  // рендерит персонализированный контент (hero / скор / карусель профиля /
  // фазы / средства / советы / фидбек). Старый PlanPageClientNew оставлен
  // как fallback на случай feature-flag отката.
  if (planData.plan28) {
    const usePlanV2 = process.env.NEXT_PUBLIC_PLAN_V2 !== 'false';

    if (usePlanV2) {
      return (
        <ErrorBoundary fallback={planErrorFallback}>
          <Suspense fallback={<PlanLoadingView message="Загружаем план..." />}>
            <PlanPageV2 />
          </Suspense>
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary fallback={planErrorFallback}>
        <Suspense fallback={<PlanLoadingView message="Загружаем план..." />}>
          <PlanPageClientNew
            plan28={planData.plan28}
            products={planData.productsMap || planData.products || new Map()}
            wishlist={planData.wishlist || []}
            currentDay={planData.currentDay || 1}
            completedDays={planData.progress?.completedDays || []}
            planExpired={planData.planExpired || false}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Используем старый компонент для обратной совместимости
  if (planData.user && planData.profile && planData.plan) {
    return (
      <ErrorBoundary fallback={planErrorFallback}>
        <Suspense fallback={<PlanLoadingView message="Загружаем план..." />}>
          <PlanPageClient
            user={planData.user}
            profile={planData.profile}
            plan={planData.plan}
            progress={planData.progress || { currentDay: 1, completedDays: [] }}
            wishlist={planData.wishlist || []}
            currentDay={planData.currentDay || 1}
            currentWeek={planData.currentWeek || 1}
            todayProducts={planData.todayProducts || []}
            todayMorning={planData.todayMorning || []}
            todayEvening={planData.todayEvening || []}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Если данные плана неполные, показываем ошибку
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
    }}>
      <p style={{
        fontSize: '18px',
        color: '#D32F2F',
        marginBottom: '20px',
        textAlign: 'center',
      }}>
        Не удалось загрузить план. Пожалуйста, попробуйте обновить страницу.
      </p>
      <button
        onClick={() => {
          setError(null);
          setLoading(true);
          loadPlan(0);
        }}
        style={{
          padding: '12px 24px',
          background: '#0A5F59',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Обновить
      </button>
    </div>
  );
}
