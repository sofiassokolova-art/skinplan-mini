// app/(miniapp)/plan/page.tsx
// Страница 28-дневного плана ухода за кожей - Client Component
// (используем Client Component, чтобы получить initData из window.Telegram)

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PlanPageClientNew } from './plan-client-new';
import { PlanPageClient } from './plan-client';
import type { Plan28 } from '@/lib/plan-types';

interface PlanData {
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
  };
  profile: {
    id: string;
    skinType: string;
    skinTypeRu: string;
    primaryConcernRu: string;
    sensitivityLevel: string | null;
    acneLevel: number | null;
    scores: any[];
  };
  plan: {
    weeks: Array<{
      week: number;
      days: Array<{
        morning: number[];
        evening: number[];
      }>;
    }>;
  };
  progress: {
    currentDay: number;
    completedDays: number[];
  };
  wishlist: number[];
  currentDay: number;
  currentWeek: number;
  todayProducts: Array<{
    id: number;
    name: string;
    brand: { name: string };
    price: number;
    volume: string | null;
    imageUrl: string | null;
    step: string;
    firstIntroducedDay: number;
  }>;
  todayMorning: number[];
  todayEvening: number[];
}

export default function PlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planData, setPlanData] = useState<PlanData | null>(null);

  useEffect(() => {
    loadPlan();
  }, []);

  const loadPlan = async (retryCount = 0) => {
    try {
      // Сбрасываем ошибку только при первой попытке
      if (retryCount === 0) {
        setLoading(true);
        setError(null);
      }

      // Проверяем, что приложение открыто через Telegram
      if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
        setError('telegram_required');
        setLoading(false);
        return;
      }

      // Ждем готовности initData (может быть не сразу доступен)
      let initData: string | undefined = window.Telegram?.WebApp?.initData || undefined;
      if (!initData) {
        // Ждем максимум 2 секунды для инициализации
        await new Promise<void>((resolve) => {
          let attempts = 0;
          const maxAttempts = 20; // 20 * 100ms = 2 секунды
          const checkInterval = setInterval(() => {
            attempts++;
            initData = window.Telegram?.WebApp?.initData || undefined;
            if (initData || attempts >= maxAttempts) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }

      if (!initData) {
        console.error('❌ initData not available after waiting');
        setError('telegram_required');
        setLoading(false);
        return;
      }

      console.log('✅ initData available, length:', initData.length);

      // Загружаем план через API с retry-логикой
      let plan;
      try {
        plan = await api.getPlan() as any;
        console.log('📋 Plan loaded:', {
          hasPlan28: !!plan?.plan28,
          hasWeeks: !!plan?.weeks,
          weeksCount: plan?.weeks?.length || 0,
          plan28DaysCount: plan?.plan28?.days?.length || 0,
        });
      } catch (planError: any) {
        // Если профиль не найден и это первая/вторая попытка - ждем и повторяем
        // НЕ показываем ошибку во время retry, только после всех попыток
        if (retryCount < 3 && (
          planError?.message?.includes('No skin profile') ||
          planError?.message?.includes('Skin profile not found') ||
          planError?.message?.includes('404') ||
          planError?.message?.includes('Internal server error') ||
          planError?.status === 404 ||
          planError?.status === 500
        )) {
          console.log(`⏳ План еще не готов, ждем 2 секунды... (попытка ${retryCount + 1}/3)`);
          // Не сбрасываем loading, чтобы показать лоадер вместо ошибки
          await new Promise(resolve => setTimeout(resolve, 2000));
          return loadPlan(retryCount + 1);
        }
        throw planError;
      }
      
      // Проверяем наличие плана (новый формат plan28 или старый weeks)
      if (!plan || (!plan.plan28 && (!plan.weeks || plan.weeks.length === 0))) {
        if (retryCount < 3) {
          console.log(`⏳ План пустой, ждем 2 секунды... (попытка ${retryCount + 1}/3)`);
          // Не сбрасываем loading, чтобы показать лоадер вместо ошибки
          await new Promise(resolve => setTimeout(resolve, 2000));
          return loadPlan(retryCount + 1);
        }
        setError('no_profile');
        setLoading(false);
        return;
      }

      // Получаем профиль для scores и другой информации
      let profile;
      try {
        profile = await api.getCurrentProfile() as any;
      } catch (profileError: any) {
        // Если профиль не найден и это первая/вторая попытка - ждем и повторяем
        // НЕ показываем ошибку во время retry, только после всех попыток
        if (retryCount < 3 && (
          profileError?.message?.includes('No profile') ||
          profileError?.message?.includes('404') ||
          profileError?.message?.includes('Internal server error') ||
          profileError?.status === 404 ||
          profileError?.status === 500
        )) {
          console.log(`⏳ Профиль еще не создан, ждем 2 секунды... (попытка ${retryCount + 1}/3)`);
          // Не сбрасываем loading, чтобы показать лоадер вместо ошибки
          await new Promise(resolve => setTimeout(resolve, 2000));
          return loadPlan(retryCount + 1);
        }
        setError('no_profile');
        setLoading(false);
        return;
      }
      
      if (!profile) {
        if (retryCount < 3) {
          console.log(`⏳ Профиль пустой, ждем 2 секунды... (попытка ${retryCount + 1}/3)`);
          // Не сбрасываем loading, чтобы показать лоадер вместо ошибки
          await new Promise(resolve => setTimeout(resolve, 2000));
          return loadPlan(retryCount + 1);
        }
        setError('no_profile');
        setLoading(false);
        return;
      }

      // Получаем wishlist
      let wishlist: number[] = [];
      try {
        const wishlistData = await api.getWishlist() as any;
        wishlist = (wishlistData.items || []).map((item: any) => 
          item.product?.id || item.productId
        ).filter((id: any): id is number => typeof id === 'number');
      } catch (err) {
        console.warn('Could not load wishlist:', err);
      }

      // Загружаем прогресс плана из БД (синхронизация между устройствами)
      let planProgress: { currentDay: number; completedDays: number[] } = {
        currentDay: 1,
        completedDays: [],
      };

      try {
        const progressResponse = await api.getPlanProgress() as {
          currentDay: number;
          completedDays: number[];
        };
        if (
          progressResponse &&
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
      } catch (progressError: any) {
        // Если ошибка авторизации — это означает, что initData не валиден,
        // но до этого мы уже прошли все проверки Telegram, поэтому просто логируем
        console.warn('Could not load plan progress, using defaults:', progressError);
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

      const currentWeekIndex = Math.max(0, Math.min(plan.weeks.length - 1, currentWeek - 1));
      const currentWeekData = plan.weeks[currentWeekIndex];

      const dayIndexWithinWeek = (currentDayGlobal - 1) % (currentWeekData?.days?.length || 7);
      const currentDayData = currentWeekData?.days[dayIndexWithinWeek] || currentWeekData?.days[0];

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
      
      if (!plan28) {
        console.warn('⚠️ plan28 not found in plan response, falling back to old format');
        console.warn('Plan keys:', Object.keys(plan || {}));
        console.warn('⚠️ NOTE: Plan needs to be regenerated to use new format. Old format will be used.');
      }
      
      // Создаем Map продуктов для быстрого доступа
      const productsMap = new Map<number, {
        id: number;
        name: string;
        brand: { name: string };
        price?: number;
        imageUrl?: string | null;
        description?: string;
      }>();
      
      if (plan28) {
        console.log('✅ Using new plan28 format with', plan28.days?.length || 0, 'days');
        // Собираем все productId из plan28
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

        // Загружаем продукты из БД
        try {
          const productIdsArray = Array.from(allProductIds);
          if (productIdsArray.length > 0) {
            const productsResponse = await fetch('/api/products/batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': initData || '',
              },
              body: JSON.stringify({ productIds: productIdsArray }),
            });

            if (productsResponse.ok) {
              const productsData = await productsResponse.json();
              if (productsData.products && Array.isArray(productsData.products)) {
                productsData.products.forEach((p: any) => {
                  productsMap.set(p.id, {
                    id: p.id,
                    name: p.name,
                    brand: { name: p.brand?.name || p.brand || 'Unknown' },
                    price: p.price,
                    imageUrl: p.imageUrl || null,
                    description: p.description || p.descriptionUser || null,
                  });
                });
              }
            }
          }
        } catch (err) {
          console.warn('Could not load products from batch endpoint, using plan.products:', err);
          // Fallback на продукты из плана
          if (plan.products && Array.isArray(plan.products)) {
            plan.products.forEach((p: any) => {
              productsMap.set(p.id, {
                id: p.id,
                name: p.name,
                brand: { name: p.brand || 'Unknown' },
                price: p.price,
                imageUrl: p.imageUrl || null,
                description: p.description,
              });
            });
          }
        }

        // Если есть plan28, используем новый формат
        setPlanData({
          plan28,
          productsMap,
          wishlist,
          currentDay: planProgress.currentDay,
          completedDays: planProgress.completedDays,
        } as any);
        setLoading(false);
        return;
      }

      // Иначе используем старый формат (для обратной совместимости)
      setPlanData({
        user: {
          id: profile.id || '',
          telegramId: '',
          firstName: profile.firstName || null,
          lastName: profile.lastName || null,
        },
        profile: {
          id: profile.id || '',
          skinType: profile.skinType || 'normal',
          skinTypeRu: profile.skinTypeRu || 'Нормальная',
          primaryConcernRu: profile.primaryConcernRu || 'Уход',
          sensitivityLevel: profile.sensitivityLevel || null,
          acneLevel: profile.acneLevel || null,
          scores,
        },
        plan: {
          weeks: plan.weeks.map((week: any) => ({
            week: week.week,
            days: week.days.map((day: any) => {
              // Преобразуем morning/evening в массив ID продуктов
              const morningIds = Array.isArray(day.morning) 
                ? day.morning.map((stepOrId: any) => {
                    if (typeof stepOrId === 'string' && day.products?.[stepOrId]?.id) {
                      return day.products[stepOrId].id;
                    }
                    return typeof stepOrId === 'number' ? stepOrId : null;
                  }).filter((id: any): id is number => id !== null)
                : [];
              
              const eveningIds = Array.isArray(day.evening)
                ? day.evening.map((stepOrId: any) => {
                    if (typeof stepOrId === 'string' && day.products?.[stepOrId]?.id) {
                      return day.products[stepOrId].id;
                    }
                    return typeof stepOrId === 'number' ? stepOrId : null;
                  }).filter((id: any): id is number => id !== null)
                : [];

              return {
                morning: morningIds,
                evening: eveningIds,
              };
            }),
          })),
        },
        progress: {
          currentDay: currentDayGlobal,
          completedDays: planProgress.completedDays,
        },
        wishlist,
        currentDay: currentDayGlobal,
        currentWeek,
        todayProducts,
        todayMorning,
        todayEvening,
      });

      setLoading(false);
    } catch (err: any) {
      console.error('❌ Error loading plan:', err);
      // Только показываем ошибку, если все retry попытки исчерпаны
      // Если ошибка связана с генерацией плана (500), пробуем еще раз через retry
      if (retryCount < 3 && (
        err?.message?.includes('Internal server error') ||
        err?.status === 500 ||
        err?.status === 502 ||
        err?.status === 503
      )) {
        console.log(`⏳ Ошибка сервера, ждем 2 секунды... (попытка ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return loadPlan(retryCount + 1);
      }
      // Только после всех попыток показываем ошибку
      setError(err?.message || 'Ошибка загрузки плана');
      setLoading(false);
    }
  };

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

  if (error === 'no_profile' || !planData) {
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

  // Используем новый компонент, если есть plan28
  if ((planData as any).plan28) {
    return (
      <PlanPageClientNew
        plan28={(planData as any).plan28}
        products={(planData as any).productsMap}
        wishlist={planData.wishlist}
        currentDay={planData.currentDay}
        completedDays={planData.progress?.completedDays || []}
      />
    );
  }

  // Иначе используем старый компонент (для обратной совместимости)
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
