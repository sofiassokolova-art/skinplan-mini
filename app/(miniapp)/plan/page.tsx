// app/(miniapp)/plan/page.tsx
// Страница 28-дневного плана ухода за кожей - Client Component
// (используем Client Component, чтобы получить initData из window.Telegram)

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PlanPageClient } from './plan-client';

const TOTAL_PLAN_DAYS = 28;

interface PlanProduct {
  id: number;
  name: string;
  brand: { name: string };
  price: number;
  volume: string | null;
  imageUrl: string | null;
  step: string;
  firstIntroducedDay: number;
}

interface PlanWeekDay {
  dayNumber?: number;
  morning: number[];
  evening: number[];
}

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
      days: PlanWeekDay[];
    }>;
  };
  planProducts: PlanProduct[];
  progress: {
    currentDay: number;
    currentWeek: number;
    completedDays: number[];
    totalDays: number;
  };
  wishlist: number[];
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
      setLoading(true);
      setError(null);

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
      } catch (planError: any) {
        // Если профиль не найден и это первая/вторая попытка - ждем и повторяем
        if (retryCount < 3 && (
          planError?.message?.includes('No skin profile') ||
          planError?.message?.includes('Skin profile not found') ||
          planError?.message?.includes('404')
        )) {
          console.log(`⏳ Профиль еще не создан, ждем 2 секунды... (попытка ${retryCount + 1}/3)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return loadPlan(retryCount + 1);
        }
        throw planError;
      }
      
      if (!plan || !plan.weeks || plan.weeks.length === 0) {
        if (retryCount < 3) {
          console.log(`⏳ План пустой, ждем 2 секунды... (попытка ${retryCount + 1}/3)`);
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
        if (retryCount < 3 && (
          profileError?.message?.includes('No profile') ||
          profileError?.message?.includes('404')
        )) {
          console.log(`⏳ Профиль еще не создан, ждем 2 секунды... (попытка ${retryCount + 1}/3)`);
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

      const rawWeeks = Array.isArray(plan.weeks) ? plan.weeks : [];

      const productFirstDay: Record<number, number> = {};
      rawWeeks.forEach((week: any) => {
        const days = Array.isArray(week.days) ? week.days : [];
        days.forEach((day: any, index: number) => {
          const calculatedDay =
            typeof day?.day === 'number'
              ? day.day
              : ((week.week || 1) - 1) * 7 + index + 1;
          if (day?.products && typeof day.products === 'object') {
            Object.values(day.products).forEach((product: any) => {
              if (product?.id && productFirstDay[product.id] === undefined) {
                productFirstDay[product.id] = calculatedDay;
              }
            });
          }
        });
      });

      const normalizedWeeks = rawWeeks.map((week: any) => ({
        week: week.week,
        days: (Array.isArray(week.days) ? week.days : []).map(
          (day: any, index: number) => {
            const dayNumber =
              typeof day?.day === 'number'
                ? day.day
                : ((week.week || 1) - 1) * 7 + index + 1;

            const morningIds = Array.isArray(day?.morning)
              ? day.morning
                  .map((stepOrId: any) => {
                    if (
                      typeof stepOrId === 'string' &&
                      day.products?.[stepOrId]?.id
                    ) {
                      return day.products[stepOrId].id;
                    }
                    return typeof stepOrId === 'number' ? stepOrId : null;
                  })
                  .filter((id: any): id is number => id !== null)
              : [];

            const eveningIds = Array.isArray(day?.evening)
              ? day.evening
                  .map((stepOrId: any) => {
                    if (
                      typeof stepOrId === 'string' &&
                      day.products?.[stepOrId]?.id
                    ) {
                      return day.products[stepOrId].id;
                    }
                    return typeof stepOrId === 'number' ? stepOrId : null;
                  })
                  .filter((id: any): id is number => id !== null)
              : [];

            return {
              dayNumber,
              morning: morningIds,
              evening: eveningIds,
            };
          }
        ),
      }));

      const planLength =
        normalizedWeeks.reduce(
          (total, week) => total + (week.days?.length || 0),
          0
        ) || TOTAL_PLAN_DAYS;

      const planProducts: PlanProduct[] = (plan.products || []).map(
        (p: any) => ({
          id: p.id,
          name: p.name,
          brand: { name: p.brand || 'Unknown' },
          price: p.price || 0,
          volume: p.volume || null,
          imageUrl: p.imageUrl || null,
          step: p.category || p.step || 'moisturizer',
          firstIntroducedDay: productFirstDay[p.id] || 1,
        })
      );

      let progressState = {
        currentDay: 1,
        currentWeek: 1,
        completedDays: [] as number[],
        totalDays: planLength,
      };

      try {
        const progressResponse = (await api.getPlanProgress()) as any;
        const serverProgress = progressResponse?.progress;
        if (serverProgress) {
          const sanitizedCompleted = Array.isArray(serverProgress.completedDays)
            ? Array.from(
                new Set(
                  serverProgress.completedDays
                    .map((day: any) => Number(day))
                    .filter((day: number) => Number.isFinite(day))
                )
              )
                .filter((day) => day >= 1 && day <= planLength)
                .sort((a, b) => a - b)
            : [];

          const safeCurrentDay = Math.min(
            Math.max(serverProgress.currentDay ?? 1, 1),
            planLength
          );

          const safeCurrentWeek = Math.min(
            Math.max(Math.ceil(safeCurrentDay / 7), 1),
            normalizedWeeks.length || 1
          );

          progressState = {
            currentDay: safeCurrentDay,
            currentWeek: safeCurrentWeek,
            completedDays: sanitizedCompleted,
            totalDays: planLength,
          };
        }
      } catch (progressError) {
        console.warn('⚠️ Could not load plan progress:', progressError);
      }

      const scores = plan.skinScores || [];

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
          weeks: normalizedWeeks,
        },
        planProducts,
        progress: progressState,
        wishlist,
      });

      setLoading(false);
    } catch (err: any) {
      console.error('❌ Error loading plan:', err);
      setError(err?.message || 'Ошибка загрузки плана');
      setLoading(false);
    }
  };

  const handleProgressUpdate = (nextProgress: {
    currentDay: number;
    currentWeek: number;
    completedDays: number[];
  }) => {
    setPlanData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        progress: {
          ...prev.progress,
          ...nextProgress,
        },
      };
    });
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

  return (
    <PlanPageClient
      user={planData.user}
      profile={planData.profile}
      plan={planData.plan}
      planProducts={planData.planProducts}
      progress={planData.progress}
      wishlist={planData.wishlist}
      onProgressUpdate={handleProgressUpdate}
    />
  );
}
