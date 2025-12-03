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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planData, setPlanData] = useState<PlanData | null>(null);

  useEffect(() => {
    loadPlan();
  }, []);

  // Функция для обработки данных плана (вынесена для переиспользования)
  const processPlanData = async (plan: any) => {
    try {
      setLoading(true);
      setError(null);

      // Получаем профиль для scores и другой информации
      // НЕ требуем профиль для показа плана, если план уже есть
      let profile;
      try {
        profile = await api.getCurrentProfile() as any;
      } catch (profileError: any) {
        // Если профиль не найден, но план есть - это нормально, продолжаем с план28
        // Профиль нужен только для старого формата плана
        if (process.env.NODE_ENV === 'development') {
          console.warn('Could not load profile, but plan exists - continuing with plan only');
        }
        profile = null;
      }
      
      // Если план есть в новом формате plan28, можем продолжать без профиля
      if (plan.plan28) {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Using plan28 format, profile not required');
        }
        // Продолжаем дальше без проверки профиля
      } else if (!profile && plan.weeks) {
        // Для старого формата нужен профиль
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
        if (process.env.NODE_ENV === 'development') {
          console.warn('Could not load wishlist:', err);
        }
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
        if (process.env.NODE_ENV === 'development') {
          console.warn('Could not load plan progress, using defaults:', progressError);
        }
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

        // Загружаем продукты из API
        if (allProductIds.size > 0 && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
          try {
            const productIdsArray = Array.from(allProductIds);
            const productsResponse = await fetch('/api/products/batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
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
          } catch (err) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Could not load products from batch endpoint:', err);
            }
          }
        }
      } else {
        // Для старого формата используем plan.products
        if (!plan28 && process.env.NODE_ENV === 'development') {
          console.warn('⚠️ plan28 not found in plan response, falling back to old format');
        }

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
      }

      setPlanData({
        plan28: plan28 || undefined,
        weeks: plan.weeks || [],
        productsMap: productsMap, // Исправлено: используем productsMap вместо products
        products: productsMap, // Также сохраняем в products для обратной совместимости
        profile: profile || undefined,
        scores,
        wishlist,
        currentDay: currentDayGlobal,
        currentWeek: currentWeekIndex,
        todayProducts,
        todayMorning,
        todayEvening,
      });

      setLoading(false);
    } catch (err: any) {
      console.error('Error processing plan data:', err);
      setError('plan_generating');
      setLoading(false);
    }
  };

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

      // Логируем только в development
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ initData available, length:', initData.length);
      }

      // Загружаем план через API с retry-логикой
      let plan;
      try {
        console.log('🔄 Attempting to load plan from cache...');
        plan = await api.getPlan() as any;
        console.log('✅ Plan loaded from cache:', {
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
        
        // Если это 404 (план не найден) - не делаем retry, сразу показываем ошибку
        // Только для ошибок сервера (500, 502, 503) делаем одну быструю попытку
        if (retryCount < 1 && (
          planError?.status === 500 ||
          planError?.status === 502 ||
          planError?.status === 503 ||
          planError?.message?.includes('Internal server error')
        )) {
          console.log(`⏳ Ошибка сервера, повторяем через 500мс... (попытка ${retryCount + 1}/1)`);
          await new Promise(resolve => setTimeout(resolve, 500));
          return loadPlan(retryCount + 1);
        }
        
        // Для 404 или других ошибок - сразу показываем, не делаем retry
        console.log('⚠️ Plan not found in cache or error occurred');
        plan = null;
      }
      
      // Проверяем наличие плана (новый формат plan28 или старый weeks)
      if (!plan || (!plan.plan28 && (!plan.weeks || plan.weeks.length === 0))) {
        // Сначала проверяем, есть ли профиль - если его нет, сразу показываем ошибку
        let hasProfile = false;
        try {
          const profileCheck = await api.getCurrentProfile() as any;
          hasProfile = !!profileCheck;
        } catch (profileCheckError) {
          // Профиля нет - это нормальная ситуация для нового пользователя
          if (process.env.NODE_ENV === 'development') {
            console.log('Profile not found - user needs to complete questionnaire');
          }
          hasProfile = false;
        }
        
        if (!hasProfile) {
          // Профиля нет - показываем ошибку сразу
          setError('no_profile');
          setLoading(false);
          return;
        }
        
        // Профиль есть, но план не найден в кэше
        // Попробуем явно сгенерировать план один раз (возможно, кэш был очищен)
        if (retryCount === 0) {
          console.log('🔄 Plan not found in cache, but profile exists - attempting to generate...');
          try {
            console.log('📞 Calling generatePlan API...');
            const generatedPlan = await api.generatePlan() as any;
            console.log('📦 Generated plan response:', {
              hasPlan28: !!generatedPlan?.plan28,
              hasWeeks: !!generatedPlan?.weeks,
              weeksCount: generatedPlan?.weeks?.length || 0,
              plan28DaysCount: generatedPlan?.plan28?.days?.length || 0,
              responseKeys: Object.keys(generatedPlan || {}),
            });
            
            if (generatedPlan && (generatedPlan.plan28 || generatedPlan.weeks)) {
              // План успешно сгенерирован, обрабатываем его
              console.log('✅ Plan generated successfully, processing...');
              await processPlanData(generatedPlan);
              return;
            } else {
              console.error('❌ Generated plan is empty or invalid:', generatedPlan);
            }
          } catch (generateError: any) {
            console.error('❌ Failed to generate plan:', {
              status: generateError?.status,
              message: generateError?.message,
              error: generateError,
              stack: generateError?.stack,
            });
          }
        }
        
        // Если генерация не помогла, показываем экран генерации
        console.error('❌ Plan generation failed or returned empty - showing error screen');
        setError('plan_generating');
        setLoading(false);
        return;
      }

      // Получаем профиль для scores и другой информации
      // НЕ требуем профиль для показа плана, если план уже есть
      let profile;
      try {
        profile = await api.getCurrentProfile() as any;
      } catch (profileError: any) {
        // Если профиль не найден, но план есть - это нормально, продолжаем с план28
        // Профиль нужен только для старого формата плана
        if (process.env.NODE_ENV === 'development') {
          console.warn('Could not load profile, but plan exists - continuing with plan only');
        }
        profile = null;
      }
      
      // Если план есть в новом формате plan28, можем продолжать без профиля
      if (plan.plan28) {
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ Using plan28 format, profile not required');
        }
        // Продолжаем дальше без проверки профиля
      } else if (!profile) {
        // Для старого формата нужен профиль
        if (retryCount < 3) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`⏳ Профиль пустой, ждем 2 секунды... (попытка ${retryCount + 1}/3)`);
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
          return loadPlan(retryCount + 1);
        }
        setError('no_profile');
        setLoading(false);
        return;
      }

      // Используем общую функцию обработки плана (избегаем дублирования кода)
      await processPlanData(plan);
      return;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error loading plan:', error);
      setError('plan_generating');
      setLoading(false);
    }
  };

  // Старый код обработки плана удален - теперь используется processPlanData

  // Остальная часть UI компонента

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
              setError(null);
              setLoading(true);
              try {
                // Явно генерируем план
                if (process.env.NODE_ENV === 'development') {
                  console.log('🔄 User requested plan generation...');
                }
                const generatedPlan = await api.generatePlan() as any;
                if (process.env.NODE_ENV === 'development') {
                  console.log('✅ Plan generated successfully', {
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
                setError('plan_generating');
                setLoading(false);
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
    // Проверяем, что productsMap существует, иначе создаем пустой Map
    const productsMap = (planData as any).productsMap || planData.products || new Map();
    
    // Проверяем, что это действительно Map
    if (!(productsMap instanceof Map)) {
      console.error('productsMap is not a Map instance:', typeof productsMap);
      // Если это не Map, пытаемся создать Map из объекта
      const mapFromObject = new Map();
      if (productsMap && typeof productsMap === 'object') {
        Object.entries(productsMap).forEach(([key, value]) => {
          mapFromObject.set(Number(key), value);
        });
      }
      
      return (
        <PlanPageClientNew
          plan28={(planData as any).plan28}
          products={mapFromObject}
          wishlist={planData.wishlist}
          currentDay={planData.currentDay}
          completedDays={planData.progress?.completedDays || []}
        />
      );
    }
    
    return (
      <PlanPageClientNew
        plan28={(planData as any).plan28}
        products={productsMap}
        wishlist={planData.wishlist}
        currentDay={planData.currentDay}
        completedDays={planData.progress?.completedDays || []}
      />
    );
  }

  // Иначе используем старый компонент (для обратной совместимости)
  // Проверяем, что все необходимые поля присутствуют
  if (!planData.user || !planData.profile || !planData.plan || !planData.progress || !planData.todayProducts || planData.todayMorning === undefined || planData.todayEvening === undefined || planData.currentWeek === undefined) {
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
