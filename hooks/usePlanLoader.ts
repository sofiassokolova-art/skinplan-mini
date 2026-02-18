// hooks/usePlanLoader.ts
// Хук для загрузки и управления состоянием плана
// Выносит всю логику из plan/page.tsx для лучшей архитектуры
//
// ПРИМЕР ИСПОЛЬЗОВАНИЯ:
/*
import { usePlanLoader } from '@/hooks/usePlanLoader';

function PlanPage() {
  const {
    loading,
    error,
    planData,
    generatingState,
    loadPlan,
    retryLoad,
    clearError,
    isPlanExpired,
    hasPlanData,
    progressPercent
  } = usePlanLoader({
    autoLoad: true,
    smartTimeout: true,
    enableProductCaching: true
  });

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;

  return (
    <div>
      {generatingState === 'generating' && <div>Генерация плана...</div>}
      {hasPlanData && <PlanComponent planData={planData} />}
    </div>
  );
}
*/

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { GeneratedPlan, ProfileResponse } from '@/lib/api-types';
import { clientLogger } from '@/lib/client-logger';
import { PLAN_TIMEOUTS } from '@/lib/config/timeouts';

// Типы данных
interface PlanData {
  // Новый формат (plan28)
  plan28?: any;
  productsMap?: Map<number, any>;
  planExpired?: boolean;
  // Старый формат (для обратной совместимости)
  user?: any;
  profile?: any;
  plan?: any;
  progress?: any;
  wishlist?: number[];
  currentDay?: number;
  currentWeek?: number;
  todayProducts?: any[];
  todayMorning?: number[];
  todayEvening?: number[];
  weeks?: any[];
  products?: Map<number, any>;
  scores?: any[];
}

interface UsePlanLoaderOptions {
  /** Автоматически запускать загрузку при монтировании */
  autoLoad?: boolean;
  /** Включить умный absolute timeout */
  smartTimeout?: boolean;
  /** Включить кэширование продуктов */
  enableProductCaching?: boolean;
}

interface UsePlanLoaderReturn {
  // Состояние
  loading: boolean;
  error: string | null;
  planData: PlanData | null;
  generatingState: 'generating' | 'ready' | null;

  // Действия
  loadPlan: (force?: boolean) => Promise<void>;
  retryLoad: () => Promise<void>;
  clearError: () => void;

  // Утилиты
  isPlanExpired: boolean;
  hasPlanData: boolean;
  progressPercent: number;
}

/**
 * Хук для загрузки и управления планом
 * Инкапсулирует всю сложную логику из plan/page.tsx
 */
export function usePlanLoader(options: UsePlanLoaderOptions = {}): UsePlanLoaderReturn {
  const {
    autoLoad = true,
    smartTimeout = true,
    enableProductCaching = true
  } = options;

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [generatingState, setGeneratingState] = useState<'generating' | 'ready' | null>(null);

  // Refs для управления состоянием
  const isMountedRef = useRef(true);
  const pageLoadStartTimeRef = useRef<number>(Date.now());
  const loadingRef = useRef(true);
  const planDataRef = useRef<PlanData | null>(null);
  const generatingStateRef = useRef<'generating' | 'ready' | null>(null);

  // Refs для управления загрузкой
  const loadPlanInFlightRef = useRef<Promise<void> | null>(null);
  const scheduledRetryRef = useRef<NodeJS.Timeout | null>(null);
  const planGenerationCooldownRef = useRef<number>(0);
  const planGenerationInFlightRef = useRef<Promise<GeneratedPlan | null> | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollPlanStatusStartTimeRef = useRef<number | null>(null);

  // Кэш продуктов для производительности
  const productsCacheRef = useRef<Map<string, any>>(new Map());

  const MAX_RETRIES = 5;

  // Безопасные сеттеры
  const safeSetLoading = useCallback((value: boolean) => {
    if (isMountedRef.current) {
      setLoading(value);
      loadingRef.current = value;
    }
  }, []);

  const safeSetError = useCallback((value: string | null) => {
    if (isMountedRef.current) setError(value);
  }, []);

  const safeSetPlanData = useCallback((value: PlanData | null) => {
    if (isMountedRef.current) {
      setPlanData(value);
      planDataRef.current = value;
    }
  }, []);

  // Синхронизация refs
  useEffect(() => {
    generatingStateRef.current = generatingState;
  }, [generatingState]);

  useEffect(() => {
    planDataRef.current = planData;
  }, [planData]);

  // Утилиты для работы с cooldown
  const getPlanCooldownMsRemaining = useCallback(() => Math.max(planGenerationCooldownRef.current - Date.now(), 0), []);
  const hasActivePlanGenerationCooldown = useCallback(() => getPlanCooldownMsRemaining() > 0, [getPlanCooldownMsRemaining]);

  // Утилиты для работы с ошибками
  const isRateLimitError = useCallback((error: any) => {
    if (!error) return false;
    if (typeof error.status === 'number' && error.status === 429) return true;
    if (typeof error.retryAfter === 'number') return true;
    if (typeof error.details?.retryAfter === 'number') return true;
    return typeof error.message === 'string' && /Слишком много запросов/i.test(error.message);
  }, []);

  const extractRetryAfterSeconds = useCallback((error: any) => {
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
  }, []);

  // Планирование повторных вызовов
  const scheduleLoadPlan = useCallback((delayMs: number, reason: string) => {
    if (scheduledRetryRef.current) {
      clearTimeout(scheduledRetryRef.current);
      scheduledRetryRef.current = null;
    }

    clientLogger.log(`⏳ ${reason} - scheduling loadPlan retry in ${delayMs}ms`);
    scheduledRetryRef.current = setTimeout(() => {
      scheduledRetryRef.current = null;
      if (isMountedRef.current) {
        loadPlan(true); // force=true
      }
    }, delayMs);
  }, []);

  // Генерация плана с обработкой ошибок
  const generatePlanWithHandling = useCallback(async (logPrefix = ''): Promise<GeneratedPlan | null> => {
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
        throw err;
      }
    })();

    planGenerationInFlightRef.current = generationPromise;

    try {
      return await generationPromise;
    } finally {
      planGenerationInFlightRef.current = null;
    }
  }, [getPlanCooldownMsRemaining, isRateLimitError, extractRetryAfterSeconds]);

  // Получение статуса плана
  const getPlanStatus = useCallback(async (): Promise<{ status?: string; ready?: boolean } | null> => {
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
  }, []);

  // Polling статуса генерации плана
  const pollPlanStatus = useCallback(async () => {
    try {
      if (pollPlanStatusStartTimeRef.current === null) {
        pollPlanStatusStartTimeRef.current = Date.now();
        clientLogger.log('⚠️ pollPlanStatusStartTimeRef was null, setting it now (polling started)');
      }

      const pollingDuration = Date.now() - pollPlanStatusStartTimeRef.current;
      if (pollingDuration > PLAN_TIMEOUTS.POLLING_MAX_DURATION) {
        clientLogger.warn('⚠️ Polling timeout - stopping and trying to load plan directly', {
          duration: pollingDuration,
          maxDuration: PLAN_TIMEOUTS.POLLING_MAX_DURATION,
        });
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        loadPlan(true);
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
        const payload = (data && typeof data === 'object' && 'data' in data) ? (data as any).data : data;

        if (payload?.status === 'no_profile') {
          clientLogger.warn('⚠️ Plan status: no_profile - trying to generate plan', { payload });
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          const generatedPlan = await tryGeneratePlan({ checkProfile: true, logPrefix: '🔄 No profile in status, ' });
          if (generatedPlan) {
            await processPlanData(generatedPlan);
          }
          return;
        }

        if (payload?.ready) {
          if (isMountedRef.current) {
            setGeneratingState('ready');
            generatingStateRef.current = 'ready';
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            router.replace('/plan');
            loadPlan(true);
          }
        }
      }
    } catch (error) {
      clientLogger.warn('Error polling plan status:', error);
    }
  }, []);

  // Попытка генерации плана с проверкой профиля
  const tryGeneratePlan = useCallback(async (options?: {
    checkProfile?: boolean;
    logPrefix?: string;
  }): Promise<GeneratedPlan | null> => {
    const { checkProfile = true, logPrefix = '' } = options || {};

    try {
      if (checkProfile) {
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

      if (error?.status === 404 ||
          error?.message?.includes('No skin profile') ||
          error?.message?.includes('Profile not found')) {
        clientLogger.log(`${logPrefix}❌ No profile found in error response`);
        return null;
      }

      return null;
    }
  }, [generatePlanWithHandling, hasActivePlanGenerationCooldown]);

  // Загрузка продуктов с кэшированием
  const loadProductsBatch = useCallback(async (productIds: number[]): Promise<Map<number, any>> => {
    if (!enableProductCaching || productIds.length === 0) {
      return new Map();
    }

    const cacheKey = productIds.sort().join(',');
    const cached = productsCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 минут кэша
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
          const productsData = await productsResponse.json();
          clientLogger.log('✅ Products loaded from batch:', productsData.products?.length || 0);

          if (productsData.products && Array.isArray(productsData.products)) {
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
          console.error('❌ Failed to load products from batch endpoint:', {
            status: productsResponse.status,
            statusText: productsResponse.statusText,
          });
        }
      } catch (err: any) {
        console.error('❌ Error loading products from batch endpoint:', err);
      }
    }

    // Кэшируем результат
    productsCacheRef.current.set(cacheKey, {
      data: productsMap,
      timestamp: Date.now()
    });

    clientLogger.log('📊 Products loaded and cached, map size:', productsMap.size);
    return productsMap;
  }, [enableProductCaching]);

  // Обработка данных плана
  const processPlanData = useCallback(async (plan: GeneratedPlan) => {
    try {
      safeSetLoading(true);
      safeSetError(null);

      if (!plan) {
        throw new Error('Plan data is null or undefined');
      }

      if (!plan.plan28 && (!plan.weeks || plan.weeks.length === 0)) {
        throw new Error('Plan has no valid data (no plan28 and no weeks)');
      }

      const usingPlan28 = !!plan.plan28;
      const needsProfile = !usingPlan28 && !!plan.weeks && plan.weeks.length > 0;
      const needsLegacyFields = !usingPlan28 && !!plan.weeks && plan.weeks.length > 0;

      // Загружаем дополнительные данные параллельно
      const [profileResult, wishlistResult, progressResult, userResult] = await Promise.allSettled([
        needsProfile ? (api.getCurrentProfile() as Promise<ProfileResponse | null>) : Promise.resolve(null),
        api.getWishlist() as Promise<any>,
        api.getPlanProgress() as Promise<{ currentDay: number; completedDays: number[] }>,
        needsLegacyFields ? (api.getUserProfile() as Promise<any>) : Promise.resolve(null),
      ]);

      // Обрабатываем результаты
      let profile: ProfileResponse | null = null;
      let userProfile: any | null = null;
      let wishlist: number[] = [];
      let planProgress: { currentDay: number; completedDays: number[] } = {
        currentDay: 1,
        completedDays: [],
      };

      if (needsProfile && profileResult.status === 'fulfilled') {
        profile = profileResult.value;
      }

      if (wishlistResult.status === 'fulfilled' && wishlistResult.value) {
        const wishlistData = wishlistResult.value;
        wishlist = (wishlistData.items || [])
          .map((item: any) => item.product?.id || item.productId)
          .filter((id: any): id is number => typeof id === 'number');
      }

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
      }

      // Создаем Map продуктов
      const productsMap = new Map<number, any>();

      if (plan28 && plan28.days) {
        // Для нового формата собираем все productIds
        const allProductIds = new Set<number>();
        plan28.days.forEach((day: any) => {
          day.morning.forEach((step: any) => {
            if (step.productId) allProductIds.add(Number(step.productId));
            (step.alternatives ?? []).forEach((alt: any) => allProductIds.add(Number(alt)));
          });
          day.evening.forEach((step: any) => {
            if (step.productId) allProductIds.add(Number(step.productId));
            (step.alternatives ?? []).forEach((alt: any) => allProductIds.add(Number(alt)));
          });
          day.weekly.forEach((step: any) => {
            if (step.productId) allProductIds.add(Number(step.productId));
            (step.alternatives ?? []).forEach((alt: any) => allProductIds.add(Number(alt)));
          });
        });

        // Загружаем продукты
        const loadedProductsMap = await loadProductsBatch(Array.from(allProductIds));
        loadedProductsMap.forEach((product, id) => {
          productsMap.set(id, product);
        });

        // Fallback: используем продукты из плана
        if (productsMap.size === 0 && plan.products && Array.isArray(plan.products)) {
          clientLogger.log('⚠️ Using products from plan as fallback');
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
        }
      } else {
        // Для старого формата
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
      }

      // Вычисляем дополнительные поля
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

      const todayProductIds = [...new Set([...todayMorning, ...todayEvening])].filter((id): id is number => typeof id === 'number');

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

      const scores = plan.skinScores || [];
      const planExpired = (plan as any)?.expired === true;

      // Устанавливаем hasPlanProgress
      try {
        const { setHasPlanProgress } = await import('@/lib/user-preferences');
        await setHasPlanProgress(true);
        clientLogger.log('✅ hasPlanProgress установлен в true после успешной загрузки плана');
      } catch (error) {
        clientLogger.warn('⚠️ Ошибка при установке hasPlanProgress (некритично):', error);
      }

      // Устанавливаем данные плана
      safeSetPlanData({
        plan28: plan.plan28 || undefined,
        weeks: plan.weeks || [],
        productsMap,
        products: productsMap, // Для обратной совместимости
        user: needsLegacyFields && userProfile ? {
          id: String(userProfile.id || ''),
          telegramId: String(userProfile.telegramId || ''),
          firstName: userProfile.firstName ?? null,
          lastName: userProfile.lastName ?? null,
        } : undefined,
        profile: profile ? {
          id: String(profile.id),
          skinType: profile.skinType,
          skinTypeRu: profile.skinTypeRu || profile.skinType,
          primaryConcernRu: profile.primaryConcernRu || '',
          sensitivityLevel: profile.sensitivityLevel || null,
          acneLevel: profile.acneLevel || null,
          scores: profile.scores || [],
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
        currentWeek,
        todayProducts,
        todayMorning,
        todayEvening,
        planExpired,
      });

      safeSetLoading(false);
    } catch (err: any) {
      console.error('❌ Error processing plan data:', err);

      // Логируем ошибку
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

      // При ошибке пытаемся загрузить заново
      console.error('❌ Error processing plan, attempting to reload...');
      safeSetError(null);
      safeSetLoading(true);
      setTimeout(() => {
        if (isMountedRef.current) {
          loadPlan();
        }
      }, 2000);
    }
  }, [loadProductsBatch]);

  // Основная функция загрузки плана
  const loadPlan = useCallback(async (force = false, retryCount = 0) => {
    if (loadPlanInFlightRef.current && !force) {
      clientLogger.warn('⏸️ loadPlan already in progress, skipping duplicate call');
      return;
    }

    loadPlanInFlightRef.current = (async () => {
      try {
        // Проверяем состояние генерации
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
          if (!isMountedRef.current) {
            clientLogger.warn('⚠️ Component unmounted, skipping loadPlan');
            return;
          }

          if (retryCount === 0) {
            safeSetLoading(true);
            safeSetError(null);
          }

          // Проверяем Telegram WebApp
          if ((typeof window === 'undefined' || !window.Telegram?.WebApp) && process.env.NODE_ENV !== 'development') {
            safeSetError('telegram_required');
            safeSetLoading(false);
            return;
          }

          // Ждем initData
          let initData: string | undefined = window.Telegram?.WebApp?.initData || undefined;
          if (!initData) {
            await new Promise<void>((resolve) => {
              let attempts = 0;
              const maxAttempts = 20;
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
                if (checkInterval) {
                  clearInterval(checkInterval);
                }
                resolve();
              }
            });
          }

          if (!initData && process.env.NODE_ENV !== 'development') {
            console.error('❌ initData not available after waiting');
            safeSetError('telegram_required');
            safeSetLoading(false);
            return;
          }

          // Загружаем план
          clientLogger.log('🔄 Attempting to load plan from cache...');
          let plan;
          try {
            plan = await api.getPlan() as GeneratedPlan | null;
            clientLogger.log('✅ Plan loaded from cache:', {
              hasPlan28: !!plan?.plan28,
              hasWeeks: !!plan?.weeks,
              weeksCount: plan?.weeks?.length || 0,
              plan28DaysCount: plan?.plan28?.days?.length || 0,
              planKeys: Object.keys(plan || {}),
            });
          } catch (planError: any) {
            console.error('❌ Error loading plan from cache:', planError);

            if (planError?.status === 404) {
              if (hasActivePlanGenerationCooldown()) {
                const waitMs = getPlanCooldownMsRemaining();
                scheduleLoadPlan(waitMs, `Plan not found but rate limit cooldown active (${Math.ceil(waitMs / 1000)}s)`);
                return;
              }

              const generatedPlan = await tryGeneratePlan({
                checkProfile: true,
                logPrefix: '🔄 Plan not in cache, '
              });

              if (generatedPlan) {
                await processPlanData(generatedPlan);
                return;
              }

              if (hasActivePlanGenerationCooldown()) {
                const waitMs = getPlanCooldownMsRemaining();
                scheduleLoadPlan(waitMs, 'Plan generation temporarily unavailable after failure');
                return;
              }

              // Очищаем кэш профиля
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
                clientLogger.log('❌ No profile found after cache clear, showing error');
                safeSetError('no_profile');
                safeSetLoading(false);
                return;
              }

              clientLogger.log('⚠️ Profile exists but plan not generated, will retry...');
            }

            if (planError?.status !== 404) {
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
                return loadPlan(force, retryCount + 1);
              }

              if (planError?.status !== 404) {
                clientLogger.log('⚠️ Unexpected error, showing loader (plan might be generating)');
                safeSetLoading(true);
                safeSetError(null);
                scheduleLoadPlan(2000, 'Unexpected error - retrying');
                return;
              }
            }

            plan = null;
          }

          // Проверяем наличие плана
          if (!plan || (!plan.plan28 && (!plan.weeks || plan.weeks.length === 0))) {
            try {
              const profileCheck = await api.getCurrentProfile() as any;
              if (profileCheck) {
                clientLogger.log('🔄 Plan not found but profile exists - attempting to generate plan immediately...');

                safeSetLoading(true);
                safeSetError(null);

                const status = await getPlanStatus();
                if (status?.status === 'generating' && status.ready === false) {
                  clientLogger.log('⏳ Plan status=generating, starting polling instead of calling generate');
                  setGeneratingState('generating');
                  generatingStateRef.current = 'generating';
                  if (!pollingIntervalRef.current) {
                    pollingIntervalRef.current = setInterval(pollPlanStatus, PLAN_TIMEOUTS.POLLING_INTERVAL);
                  }
                  return;
                }

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

                const hasPlan28 = generatedPlan?.plan28 && generatedPlan.plan28.days && generatedPlan.plan28.days.length > 0;
                const hasWeeks = generatedPlan?.weeks && Array.isArray(generatedPlan.weeks) && generatedPlan.weeks.length > 0;

                if (generatedPlan && (hasPlan28 || hasWeeks)) {
                  clientLogger.log('✅ Plan generated successfully, processing...');
                  await processPlanData(generatedPlan);
                  return;
                } else {
                  if (retryCount < MAX_RETRIES - 1) {
                    clientLogger.log('⏳ Retrying plan generation...');
                    safeSetLoading(true);
                    safeSetError(null);
                    scheduleLoadPlan(3000, 'Plan generation returned empty result');
                    return;
                  } else {
                    safeSetError('Не удалось создать план. Попробуйте обновить страницу или пройдите анкету заново.');
                    safeSetLoading(false);
                    return;
                  }
                }
              } else {
                if (retryCount >= 2) {
                  safeSetError('no_profile');
                  safeSetLoading(false);
                  return;
                }
                clientLogger.log('⏳ Profile not found, but might be creating - waiting and retrying...');
                safeSetLoading(true);
                safeSetError(null);
                scheduleLoadPlan(2000, 'Profile not found - waiting');
                return;
              }
            } catch (profileCheckError: any) {
              console.error('❌ Error checking profile:', profileCheckError);
              if (retryCount < 2) {
                clientLogger.log('⏳ Profile check error, retrying...');
                safeSetLoading(true);
                safeSetError(null);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return loadPlan(force, retryCount + 1);
              }
              safeSetError('no_profile');
              safeSetLoading(false);
              return;
            }
          }

          // Проверяем профиль для старого формата
          let profile;
          try {
            profile = await api.getCurrentProfile() as ProfileResponse | null;
          } catch (profileError: any) {
            if (process.env.NODE_ENV === 'development') {
              clientLogger.warn('Could not load profile, but plan exists - continuing with plan only');
            }
            profile = null;
          }

          if (plan.plan28) {
            if (process.env.NODE_ENV === 'development') {
              clientLogger.log('✅ Using plan28 format, profile not required');
            }
          } else if (!profile) {
            if (retryCount < 3) {
              if (process.env.NODE_ENV === 'development') {
                clientLogger.log(`⏳ Профиль пустой, ждем 2 секунды... (попытка ${retryCount + 1}/3)`);
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
              return loadPlan(force, retryCount + 1);
            }
            safeSetError('no_profile');
            safeSetLoading(false);
            return;
          }

          await processPlanData(plan);
          return;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Error loading plan:', error);

          if (retryCount >= MAX_RETRIES - 1) {
            safeSetError('Не удалось загрузить план. Попробуйте обновить страницу.');
            safeSetLoading(false);
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
              if (hasActivePlanGenerationCooldown()) {
                const waitMs = getPlanCooldownMsRemaining();
                scheduleLoadPlan(waitMs, `Plan should exist but rate limit cooldown active (${Math.ceil(waitMs / 1000)}s)`);
                progressCheckInProgressRef.current = false;
                return;
              }

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
                if (retryCount >= MAX_RETRIES - 1) {
                  safeSetError('Не удалось загрузить план. Попробуйте обновить страницу.');
                  safeSetLoading(false);
                  progressCheckInProgressRef.current = false;
                  return;
                }
                safeSetLoading(true);
                safeSetError(null);
                scheduleLoadPlan(3000, 'Plan regeneration failed');
                progressCheckInProgressRef.current = false;
                return;
              }
            } else {
              safeSetError('no_profile');
              safeSetLoading(false);
              progressCheckInProgressRef.current = false;
              return;
            }
            progressCheckInProgressRef.current = false;
          } catch (checkError) {
            console.error('❌ Error checking profile/progress:', checkError);
            progressCheckInProgressRef.current = false;
            if (retryCount >= MAX_RETRIES - 1) {
              safeSetError('Не удалось загрузить план. Попробуйте обновить страницу.');
              safeSetLoading(false);
              return;
            }
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
  }, []);

  // Умный absolute timeout
  useEffect(() => {
    if (!smartTimeout) return;

    const absoluteTimeout = setTimeout(() => {
      if (isMountedRef.current && loadingRef.current && !planDataRef.current) {
        // Умная логика: проверяем реальный прогресс
        const timeElapsed = Date.now() - pageLoadStartTimeRef.current;
        const hasRealProgress = planDataRef.current || generatingStateRef.current === 'generating';

        if (!hasRealProgress && timeElapsed > PLAN_TIMEOUTS.PAGE_ABSOLUTE) {
          clientLogger.warn('⚠️ Smart absolute timeout reached - showing fallback screen', {
            timeElapsed,
            hasProgress: !!planDataRef.current,
            isGenerating: generatingStateRef.current === 'generating'
          });
          safeSetLoading(false);
          safeSetError('Не удалось загрузить план за отведенное время. Пожалуйста, попробуйте обновить страницу или перейти в анкету.');
        }
      }
    }, PLAN_TIMEOUTS.PAGE_ABSOLUTE);

    return () => clearTimeout(absoluteTimeout);
  }, [smartTimeout]);

  // Инициализация
  useEffect(() => {
    isMountedRef.current = true;
    pageLoadStartTimeRef.current = Date.now();

    // Проверяем состояние из URL
    let state: string | null = null;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      state = urlParams.get('state');
    }

    if (state === 'generating') {
      clientLogger.log('✅ State=generating detected, starting polling');
      pollPlanStatusStartTimeRef.current = Date.now();
      setGeneratingState('generating');
      generatingStateRef.current = 'generating';
      safeSetLoading(true);

      // Kickoff генерации если нужно
      if (!generateKickoffRef.current) {
        generateKickoffRef.current = true;
        (async () => {
          try {
            const profileId = searchParams?.get('profileId') || undefined;
            await api.generatePlan(profileId);
            clientLogger.log('✅ Plan generation kickoff requested', { profileId });
          } catch (err: any) {
            clientLogger.warn('⚠️ Plan generation kickoff failed (non-critical):', err);
          }
        })();
      }

      pollingIntervalRef.current = setInterval(pollPlanStatus, PLAN_TIMEOUTS.POLLING_INTERVAL);

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
          loadPlan(true);
        }
      }, PLAN_TIMEOUTS.GENERATION_TIMEOUT);
    } else {
      // Обычная загрузка
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem('profile_check_cache');
          sessionStorage.removeItem('profile_check_cache_timestamp');
          clientLogger.log('✅ Кэш профиля очищен при загрузке страницы плана');
        } catch (cacheError) {
          clientLogger.warn('⚠️ Не удалось очистить кэш профиля при загрузке:', cacheError);
        }
      }

      if (autoLoad) {
        loadPlan();
      }
    }

    return () => {
      isMountedRef.current = false;
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
  }, [autoLoad, smartTimeout]);

  // Вычисляемые значения
  const isPlanExpired = planData?.planExpired === true;
  const hasPlanData = !!planData && (!!planData.plan28 || !!planData.weeks);
  const progressPercent = planData?.progress ? (planData.progress.currentDay / 28) * 100 : 0;

  // Действия
  const retryLoad = useCallback(() => {
    loadPlan(true);
  }, [loadPlan]);

  const clearError = useCallback(() => {
    safeSetError(null);
  }, [safeSetError]);

  return {
    // Состояние
    loading,
    error,
    planData,
    generatingState,

    // Действия
    loadPlan,
    retryLoad,
    clearError,

    // Утилиты
    isPlanExpired,
    hasPlanData,
    progressPercent,
  };
}