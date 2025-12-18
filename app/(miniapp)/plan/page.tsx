// app/(miniapp)/plan/page.tsx
// Страница 28-дневного плана ухода за кожей - Client Component
// (используем Client Component, чтобы получить initData из window.Telegram)

'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PlanPageClientNew } from './plan-client-new';
import { PlanPageClient } from './plan-client';
import type { Plan28, DayPlan } from '@/lib/plan-types';
import type { GeneratedPlan, ProfileResponse } from '@/lib/api-types';
import { clientLogger } from '@/lib/client-logger';

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
  planExpired?: boolean; // Флаг истечения плана (28+ дней)
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
    scores: any[];
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
  // Общие поля
  weeks?: any[];
  products?: Map<number, any>;
  scores?: any[];
}

export default function PlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDev = process.env.NODE_ENV === 'development';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [generatingState, setGeneratingState] = useState<'generating' | 'ready' | null>(null);
  const isMountedRef = useRef(true);
  const loadPlanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const planGenerationCooldownRef = useRef<number>(0);
  const planGenerationInFlightRef = useRef<Promise<GeneratedPlan | null> | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
  const pollPlanStatus = async () => {
    try {
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
        if (payload?.ready) {
          // План готов - переходим к загрузке
          if (isMountedRef.current) {
            setGeneratingState('ready');
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

  useEffect(() => {
    isMountedRef.current = true;
    
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
      setGeneratingState('generating');
      safeSetLoading(true);
      
      // Начинаем polling статуса плана
      pollingIntervalRef.current = setInterval(pollPlanStatus, 1500);
      
      // Таймаут на 60 секунд
      setTimeout(() => {
        if (isMountedRef.current && generatingState === 'generating') {
          clientLogger.warn('Plan generation timeout, loading plan anyway');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setGeneratingState('ready');
          router.replace('/plan');
          loadPlan(0, true);
        }
      }, 60000);
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
          clientLogger.warn('⚠️ Не удалось очистить кэш профиля при загрузке:', cacheError);
        }
      }
      
      loadPlan();
    }
    
    return () => {
      isMountedRef.current = false;
      // Очищаем таймер при размонтировании
      if (loadPlanTimeoutRef.current) {
        clearTimeout(loadPlanTimeoutRef.current);
        loadPlanTimeoutRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        brand: { name: p.brand || 'Unknown' },
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
            step.alternatives.forEach(alt => allProductIds.add(Number(alt)));
          });
          day.evening.forEach(step => {
            if (step.productId) allProductIds.add(Number(step.productId));
            step.alternatives.forEach(alt => allProductIds.add(Number(alt)));
          });
          day.weekly.forEach(step => {
            if (step.productId) allProductIds.add(Number(step.productId));
            step.alternatives.forEach(alt => allProductIds.add(Number(alt)));
          });
        });

        // Загружаем продукты из API - ОСНОВНАЯ ЛОГИКА
        // Сначала пробуем загрузить из API, если не получилось - используем fallback
        let productsLoadedFromAPI = false;
        
        clientLogger.log('🔍 DEBUG: Starting product loading', {
          allProductIdsSize: allProductIds.size,
          allProductIds: Array.from(allProductIds).slice(0, 20),
          hasWindow: typeof window !== 'undefined',
          hasInitData: typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData,
        });
        
        if (allProductIds.size > 0 && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
          try {
            const productIdsArray = Array.from(allProductIds);
            clientLogger.log('📦 Loading products from batch endpoint, count:', productIdsArray.length, 'IDs:', productIdsArray.slice(0, 10));
            
            // Используем api.getProductAlternatives или создаем отдельный метод для batch
            // Пока используем fetch напрямую, но с улучшенной обработкой ошибок
            const productsResponse = await fetch('/api/products/batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
              },
              body: JSON.stringify({ productIds: productIdsArray }),
            });
            
            clientLogger.log('📡 Batch API response status:', productsResponse.status, productsResponse.ok);

            if (productsResponse.ok) {
              const productsData = await productsResponse.json();
              clientLogger.log('✅ Products loaded from batch:', productsData.products?.length || 0);
              
              if (productsData.products && Array.isArray(productsData.products)) {
                let addedCount = 0;
                productsData.products.forEach((p: any) => {
                  if (p && p.id) {
                  productsMap.set(p.id, {
                    id: p.id,
                      name: p.name || 'Неизвестный продукт',
                    brand: { name: p.brand?.name || p.brand || 'Unknown' },
                      price: p.price || null,
                    imageUrl: p.imageUrl || null,
                    // Используем descriptionUser для синхронизации с главной страницей
                    description: p.descriptionUser || p.description || null,
                  });
                    addedCount++;
              }
                });
                productsLoadedFromAPI = productsMap.size > 0;
                clientLogger.log(`✅ Products added to map from API: ${addedCount}/${productsData.products.length}, total size: ${productsMap.size}`);
                
                if (productsMap.size === 0 && productsData.products.length > 0) {
                  console.error('❌ CRITICAL: Products array is not empty but nothing was added to map!', {
                    productsData: productsData.products.slice(0, 3),
                  });
                }
              } else {
                clientLogger.warn('⚠️ productsData.products is not an array:', {
                  type: typeof productsData.products,
                  isArray: Array.isArray(productsData.products),
                  data: productsData,
                });
              }
            } else {
              const errorText = await productsResponse.text().catch(() => '');
              console.error('❌ Failed to load products from batch endpoint:', {
                status: productsResponse.status,
                statusText: productsResponse.statusText,
                error: errorText.substring(0, 200),
                productIdsCount: productIdsArray.length,
              });
            }
          } catch (err: any) {
            console.error('❌ Error loading products from batch endpoint:', {
              error: err,
              message: err?.message,
              stack: err?.stack,
              productIdsCount: allProductIds.size,
            });
          }
        } else {
          clientLogger.warn('⚠️ Cannot load products from API:', {
            hasProductIds: allProductIds.size > 0,
            hasWindow: typeof window !== 'undefined',
            hasInitData: typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData,
            initDataLength: typeof window !== 'undefined' && window.Telegram?.WebApp?.initData?.length || 0,
          });
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
                brand: { name: p.brand?.name || p.brand || 'Unknown' },
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
            brand: { name: p.brand?.name || p.brand || 'Unknown' },
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
      
      safeSetPlanData({
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
      });

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

  const MAX_RETRIES = 5;
  
  const loadPlan = async (retryCount = 0, force = false) => {
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
    
    const scheduleRetryAfterCooldown = (context: string) => {
      if (!hasActivePlanGenerationCooldown()) {
        return false;
      }

      const waitMs = getPlanCooldownMsRemaining();
      if (waitMs <= 0) {
        return false;
      }

      const waitSeconds = Math.ceil(waitMs / 1000);
      clientLogger.log(`${context}⏳ Waiting ${waitSeconds}s before retrying plan flow`);
      safeSetLoading(true);
      safeSetError(null);

      if (loadPlanTimeoutRef.current) {
        clearTimeout(loadPlanTimeoutRef.current);
      }

      loadPlanTimeoutRef.current = setTimeout(() => {
        loadPlanTimeoutRef.current = null;
        if (isMountedRef.current) {
          loadPlan(retryCount);
        }
      }, waitMs);

      return true;
    };

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
            const waitSeconds = Math.ceil(waitMs / 1000);
            clientLogger.warn(`🔄 Plan not found but rate limit cooldown active (${waitSeconds}s), waiting before retry...`);
            
            if (scheduleRetryAfterCooldown('Plan generation temporarily unavailable due to rate limit. ')) {
              return;
            }
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
          if (scheduleRetryAfterCooldown('Plan generation temporarily unavailable. ')) {
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
          // Пробуем еще раз через 2 секунды
          // ВАЖНО: Очищаем предыдущий таймер и сохраняем новый
          if (loadPlanTimeoutRef.current) {
            clearTimeout(loadPlanTimeoutRef.current);
          }
          loadPlanTimeoutRef.current = setTimeout(() => {
            loadPlanTimeoutRef.current = null;
            if (isMountedRef.current) {
              loadPlan(retryCount + 1);
            }
          }, 2000);
          return;
        }
        
        // Для 404 - уже обработано выше
        clientLogger.log('⚠️ Plan not found in cache');
        plan = null;
      }
      
      // Проверяем наличие плана (новый формат plan28 или старый weeks)
      if (!plan || (!plan.plan28 && (!plan.weeks || plan.weeks.length === 0))) {
        // ИСПРАВЛЕНО: Если план не найден, проверяем наличие профиля и ответов
        // Если есть профиль и ответы, но нет плана - это ситуация, которую нужно исправить
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
                if (!pollingIntervalRef.current) {
                  pollingIntervalRef.current = setInterval(pollPlanStatus, 1500);
                }
                return;
              }

              // ИСПРАВЛЕНО: Проверяем rate limit cooldown ПЕРЕД попыткой генерации
              if (hasActivePlanGenerationCooldown()) {
                const waitMs = getPlanCooldownMsRemaining();
                const waitSeconds = Math.ceil(waitMs / 1000);
                clientLogger.warn(`🔄 Plan not found but rate limit cooldown active (${waitSeconds}s), waiting before retry...`, {
                  profileId: profileCheck.id,
                  profileVersion: profileCheck.version,
                });
                
                if (scheduleRetryAfterCooldown('Plan generation temporarily paused (profile exists, rate limit). ')) {
                  return;
                }
              }
              
              const generatedPlan = await generatePlanWithHandling('🔄 Plan not found but profile exists - ');

              if (!generatedPlan && scheduleRetryAfterCooldown('Plan generation temporarily paused (profile exists). ')) {
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
                  setTimeout(() => {
                    loadPlan(retryCount + 1);
                  }, 3000);
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
                setTimeout(() => {
                  loadPlan(retryCount + 1);
                }, 3000);
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
            setTimeout(() => {
              loadPlan(retryCount + 1);
            }, 2000);
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
        // Если профиль не найден, но план есть - это нормально, продолжаем с план28
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
      // ИСПРАВЛЕНО: Защита от множественных вызовов - используем локальную переменную
      let progressCheckInProgress = false;
      try {
        if (!progressCheckInProgress) {
          progressCheckInProgress = true;
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
            const waitSeconds = Math.ceil(waitMs / 1000);
            clientLogger.warn(`🔄 Plan should exist but rate limit cooldown active (${waitSeconds}s), waiting...`);
            
            if (scheduleRetryAfterCooldown('Plan regeneration paused due to rate limit cooldown. ')) {
              progressCheckInProgress = false;
              return;
            }
          }
          
          // План должен существовать - пробуем регенерировать
          clientLogger.log('🔄 Plan should exist, attempting to regenerate...');
          safeSetLoading(true);
          safeSetError(null);
          try {
            const generatedPlan = await generatePlanWithHandling('🔄 Plan should exist - ');
            if (!generatedPlan && scheduleRetryAfterCooldown('Plan regeneration paused due to cooldown. ')) {
              progressCheckInProgress = false;
              return;
            }
            if (generatedPlan && (generatedPlan.plan28 || generatedPlan.weeks)) {
              clientLogger.log('✅ Plan regenerated successfully, processing...');
              await processPlanData(generatedPlan);
                progressCheckInProgress = false;
              return;
            }
          } catch (generateError: any) {
            console.error('❌ Failed to regenerate plan:', generateError);
            // Если слишком много попыток - показываем ошибку
            if (retryCount >= MAX_RETRIES - 1) {
              safeSetError('Не удалось загрузить план. Попробуйте обновить страницу.');
              safeSetLoading(false);
                progressCheckInProgress = false;
              return;
            }
            // Пробуем еще раз через 3 секунды, но увеличиваем счетчик попыток
            safeSetLoading(true);
            safeSetError(null);
              progressCheckInProgress = false;
            setTimeout(() => {
              loadPlan(retryCount + 1);
            }, 3000);
            return;
          }
        } else {
          // Профиля нет - показываем ошибку профиля
          safeSetError('no_profile');
      safeSetLoading(false);
            progressCheckInProgress = false;
          return;
          }
          progressCheckInProgress = false;
        }
      } catch (checkError) {
        console.error('❌ Error checking profile/progress:', checkError);
        progressCheckInProgress = false;
        // Если слишком много попыток - показываем ошибку
        if (retryCount >= MAX_RETRIES - 1) {
          safeSetError('Не удалось загрузить план. Попробуйте обновить страницу.');
          safeSetLoading(false);
          return;
        }
        // При ошибке проверки пробуем еще раз через 2 секунды, но увеличиваем счетчик попыток
        safeSetLoading(true);
        safeSetError(null);
        setTimeout(() => {
          loadPlan(retryCount + 1);
        }, 2000);
        return;
      }
    }
  };

  // Старый код обработки плана удален - теперь используется processPlanData

  // Остальная часть UI компонента

  // Показываем специальный экран генерации плана
  if (generatingState === 'generating') {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh', 
        flexDirection: 'column', 
        gap: '24px',
        padding: '20px',
        background: 'linear-gradient(135deg, #0A5F59 0%, #0d7a72 100%)',
        color: 'white'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center' }}>
          Подбираем уход под вашу кожу…
        </div>
        <div style={{ 
          width: '280px', 
          height: '8px', 
          backgroundColor: 'rgba(255,255,255,0.2)', 
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: '66%',
            backgroundColor: 'white',
            borderRadius: '4px',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
        </div>
        <div style={{ fontSize: '14px', opacity: 0.9, textAlign: 'center', maxWidth: '300px' }}>
          Анализ кожи → Подбор средств → Формирование плана
        </div>
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}</style>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(10, 95, 89, 0.2)',
          borderTop: '4px solid #0A5F59',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}></div>
        <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка плана...</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // План с истекшим сроком теперь не имеет отдельного экрана:
  // PaymentGate отработает как paywall + блюр, а ретейк-ссылка отображается в оверлее PaymentGate.

  if (error === 'telegram_required') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '12px',
          }}>
            Откройте через Telegram
          </h2>
          <p style={{
            color: '#475467',
            marginBottom: '24px',
            lineHeight: '1.6',
          }}>
            Для просмотра плана необходимо открыть приложение через Telegram Mini App.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#0A5F59',
              color: 'white',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
            }}
          >
            На главную
          </a>
        </div>
      </div>
    );
  }

  if (error === 'plan_generating') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(10, 95, 89, 0.2)',
            borderTop: '4px solid #0A5F59',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px',
          }}></div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '12px',
          }}>
            Генерация плана
          </h2>
          <p style={{
            color: '#475467',
            marginBottom: '24px',
            lineHeight: '1.6',
          }}>
            План ухода формируется. Это может занять несколько секунд.
          </p>
          <button
            onClick={async () => {
              safeSetError(null);
              safeSetLoading(true);
              try {
                // Явно генерируем план
                if (process.env.NODE_ENV === 'development') {
                  clientLogger.log('🔄 User requested plan generation...');
                }
                
                // ИСПРАВЛЕНО: Проверяем rate limit cooldown ПЕРЕД попыткой генерации
                if (hasActivePlanGenerationCooldown()) {
                  const waitMs = getPlanCooldownMsRemaining();
                  const waitSeconds = Math.ceil(waitMs / 1000);
                  clientLogger.log(`⏳ Manual refresh delayed due to rate limit cooldown (${waitSeconds}s).`);
                  
                  // Ждем окончания cooldown перед повторной попыткой
                  safeSetLoading(true);
                  safeSetError(null);
                  if (loadPlanTimeoutRef.current) {
                    clearTimeout(loadPlanTimeoutRef.current);
                  }
                  loadPlanTimeoutRef.current = setTimeout(() => {
                    loadPlanTimeoutRef.current = null;
                    if (isMountedRef.current) {
                      loadPlan(0);
                    }
                  }, waitMs);
                  return;
                }
                
                const generatedPlan = await generatePlanWithHandling('🔄 Manual refresh - ');
                if (!generatedPlan) {
                  if (hasActivePlanGenerationCooldown()) {
                    const waitMs = getPlanCooldownMsRemaining();
                    const waitSeconds = Math.ceil(waitMs / 1000);
                    clientLogger.log(`⏳ Manual refresh delayed due to cooldown (${waitSeconds}s).`);
                    if (loadPlanTimeoutRef.current) {
                      clearTimeout(loadPlanTimeoutRef.current);
                    }
                    loadPlanTimeoutRef.current = setTimeout(() => {
                      loadPlanTimeoutRef.current = null;
                      if (isMountedRef.current) {
                        loadPlan(0);
                      }
                    }, waitMs);
                    safeSetError('plan_generating');
                    return;
                  }
                  
                  await loadPlan(0);
                  return;
                }
                if (process.env.NODE_ENV === 'development') {
                  clientLogger.log('✅ Plan generated successfully', {
                    hasPlan28: !!generatedPlan?.plan28,
                    hasWeeks: !!generatedPlan?.weeks,
                  });
                }
                
                // Используем план напрямую из ответа генерации, не перезагружаем из кэша
                // Это избегает race condition, когда кэш еще не успел обновиться
                if (generatedPlan && (generatedPlan.plan28 || generatedPlan.weeks)) {
                  await processPlanData(generatedPlan);
                } else {
                  // Если план не в ожидаемом формате, все же пытаемся загрузить из кэша
                  await loadPlan(0);
                }
              } catch (generateError: any) {
                console.error('❌ Failed to generate plan:', generateError);
                safeSetError('plan_generating');
                safeSetLoading(false);
              }
            }}
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#0A5F59',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
            }}
          >
            Обновить
          </button>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Показываем ошибку только если точно нет профиля (не показываем если просто загрузка)
  if (error === 'no_profile' && !loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '12px',
          }}>
            Профиль не найден
          </h2>
          <p style={{
            color: '#475467',
            marginBottom: '24px',
            lineHeight: '1.6',
          }}>
            Для просмотра плана необходимо сначала пройти анкету.
          </p>
          <a
            href="/quiz"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#0A5F59',
              color: 'white',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
            }}
          >
            Пройти анкету
          </a>
        </div>
      </div>
    );
  }
  
  // Если нет planData, но загрузка еще идет - показываем лоадер
  if (!planData && loading) {
    // Лоадер уже показан выше
    return null;
  }
  
  // Если нет planData и загрузка завершена, но нет ошибки - показываем лоадер
  // (это не должно происходить, но на всякий случай)
  if (!planData && !loading && !error) {
    // Показываем лоадер
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #E8FBF7',
            borderTop: '4px solid #0A5F59',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка плана...</div>
        </div>
      </div>
    );
  }

  // Используем новый компонент, если есть plan28
  if (planData && (planData as any).plan28) {
    // Проверяем, что productsMap существует, иначе создаем пустой Map
    let productsMap: Map<number, any> = new Map();
    
    // Пытаемся получить productsMap из planData
    const productsMapFromData = (planData as any).productsMap || (planData as any).products;
    
    // Если productsMap является Map, используем его
    if (productsMapFromData instanceof Map) {
      productsMap = productsMapFromData;
    } else if (productsMapFromData && typeof productsMapFromData === 'object' && productsMapFromData !== null) {
      // Если это объект, преобразуем в Map
      clientLogger.log('⚠️ Converting productsMap from object to Map');
      try {
        Object.entries(productsMapFromData).forEach(([key, value]) => {
          const numKey = parseInt(key);
          if (!isNaN(numKey) && value) {
            productsMap.set(numKey, value);
          }
        });
      } catch (err) {
        console.error('❌ Error converting productsMap:', err);
        productsMap = new Map();
      }
    } else {
      // Если productsMap не определен или не является объектом/Map, создаем пустой Map
      clientLogger.warn('⚠️ productsMap is not available, using empty Map');
      productsMap = new Map();
    }
    
    clientLogger.log('✅ Final productsMap size:', productsMap.size);
    
    return (
      <Suspense fallback={
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        }}>
          <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка плана...</div>
        </div>
      }>
      <PlanPageClientNew
        plan28={(planData as any).plan28}
        products={productsMap}
        wishlist={planData.wishlist}
        currentDay={planData.currentDay}
        completedDays={planData.progress?.completedDays || []}
        planExpired={planData.planExpired || false}
      />
      </Suspense>
    );
  }

  // Иначе используем старый компонент (для обратной совместимости)
  // Проверяем, что все необходимые поля присутствуют
  if (!planData || !planData.user || !planData.profile || !planData.plan || !planData.progress || !planData.todayProducts || planData.todayMorning === undefined || planData.todayEvening === undefined || planData.currentWeek === undefined) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Ошибка: недостаточно данных для отображения плана</p>
      </div>
    );
  }

  return (
    <PlanPageClient
      user={planData.user}
      profile={planData.profile}
      plan={planData.plan}
      progress={planData.progress}
      wishlist={planData.wishlist}
      currentDay={planData.currentDay}
      currentWeek={planData.currentWeek}
      todayProducts={planData.todayProducts}
      todayMorning={planData.todayMorning}
      todayEvening={planData.todayEvening}
    />
  );
}
