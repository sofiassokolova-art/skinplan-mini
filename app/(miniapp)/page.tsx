// app/(miniapp)/page.tsx
// Главная страница мини-аппа (рутина ухода) - миграция из Home.tsx

'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import PlanFeedbackPopup from '@/components/PlanFeedbackPopup';
import toast from 'react-hot-toast';

interface RoutineItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  howto: {
    steps: string[];
    volume: string;
    tip: string;
  };
  done: boolean;
}

interface Recommendation {
  profile_summary: {
    skinType: string;
    sensitivityLevel: string;
    notes: string;
  };
  steps: Record<string, Array<{
    id: number;
    name: string;
    brand: string;
    description: string;
    imageUrl?: string;
  }>>;
}

const ICONS: Record<string, string> = {
  cleanser: '/icons/cleanser1.PNG',
  toner: '/icons/toner1.PNG',
  serum: '/icons/serum.PNG',
  cream: '/icons/cream.PNG',
  spf: '/icons/spf1.PNG',
  acid: '/icons/acid1.PNG',
  mask: '/icons/cream.PNG', // Используем иконку крема для масок
};

export default function HomePage() {
  const router = useRouter();
  
  // Хуки должны вызываться на верхнем уровне, без условий
  // useTelegram должен сам обрабатывать ошибки внутри
  const telegramHook = useTelegram();
  const { initialize, isAvailable } = telegramHook;
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation | null>(null);
  const [morningItems, setMorningItems] = useState<RoutineItem[]>([]);
  const [eveningItems, setEveningItems] = useState<RoutineItem[]>([]);
  const [tab, setTab] = useState<'AM' | 'PM'>('AM');
  const [selectedItem, setSelectedItem] = useState<RoutineItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(false);
  const planCheckDoneRef = useRef(false); // Защита от повторных проверок плана
  const [currentDay, setCurrentDay] = useState(1); // Текущий день плана
  const [completedSteps, setCompletedSteps] = useState<{
    morning: Set<string>;
    evening: Set<string>;
  }>({
    morning: new Set(),
    evening: new Set(),
  });
  const [redirectingToQuiz, setRedirectingToQuiz] = useState(false); // Флаг: редиректим на анкету
  const [hasCheckedProfile, setHasCheckedProfile] = useState(false); // Флаг: проверили ли наличие профиля

  // УДАЛЕНО: Функция checkIncompleteQuiz больше не нужна
  // Если профиля нет, сразу редиректим на /quiz, где есть экран "Вы не завершили анкету"

  useEffect(() => {
    console.log('🚀 HomePage useEffect started');
    setMounted(true);
    planCheckDoneRef.current = false; // Сбрасываем флаг проверки плана при монтировании
    
    // Проверяем доступность Telegram WebApp
    console.log('📱 Checking Telegram WebApp:', {
      hasWindow: typeof window !== 'undefined',
      hasTelegram: typeof window !== 'undefined' && !!window.Telegram,
      hasWebApp: typeof window !== 'undefined' && !!window.Telegram?.WebApp,
      hasInitData: typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData,
      initDataLength: typeof window !== 'undefined' && window.Telegram?.WebApp?.initData?.length || 0,
    });
    
    // Инициализируем Telegram с обработкой ошибок
    try {
    initialize();
    console.log('✅ Telegram WebApp initialized');
    } catch (err) {
      console.error('❌ Error initializing Telegram:', err);
      // Продолжаем работу даже при ошибке инициализации
    }
    
    // Загружаем данные (пользователь идентифицируется автоматически через initData)
    const initAndLoad = async () => {
      try {
        console.log('🔄 initAndLoad started');
        
        // Ждем немного, чтобы Telegram WebApp успел инициализироваться
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Проверяем, что приложение открыто через Telegram
        const hasInitData = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData;
        console.log('🔍 Checking initData after wait:', {
          hasInitData,
          initDataLength: typeof window !== 'undefined' && window.Telegram?.WebApp?.initData?.length || 0,
        });
        
        if (!hasInitData) {
          console.warn('⚠️ Telegram WebApp не доступен, redirecting to quiz');
          setRedirectingToQuiz(true);
          setLoading(false);
          if (typeof window !== 'undefined') {
            window.location.href = '/quiz';
          } else {
            router.push('/quiz');
          }
          return;
        }
        
        console.log('✅ Telegram WebApp available, proceeding with initialization');

        // СНАЧАЛА проверяем наличие профиля (самая надежная проверка)
        console.log('🔍 Step 1: Checking for existing profile...');
        setHasCheckedProfile(true); // Помечаем, что проверили профиль
        let hasProfile = false;
        try {
          const profile = await api.getCurrentProfile();
          if (profile && (profile as any).id) {
            hasProfile = true;
            console.log('✅ Profile exists, user has completed quiz');
          }
        } catch (err: any) {
          // Проверяем, какая именно ошибка
          const errorMessage = err?.message || err?.toString() || '';
          const isNotFound = errorMessage.includes('404') || 
                            errorMessage.includes('No skin profile') ||
                            errorMessage.includes('Skin profile not found') ||
                            errorMessage.includes('Profile not found') ||
                            err?.status === 404 ||
                            err?.isNotFound;
          
          if (isNotFound) {
            console.log('ℹ️ Profile not found (expected for new users or incomplete quiz)');
            hasProfile = false;
            // Если профиля нет, сразу редиректим на анкету
            console.log('ℹ️ No profile found, redirecting to quiz immediately');
            setRedirectingToQuiz(true);
            setLoading(false);
            if (typeof window !== 'undefined') {
              window.location.href = '/quiz';
            } else {
              router.push('/quiz');
            }
            return;
          } else {
            // Другая ошибка (сеть, авторизация и т.д.) - логируем, но продолжаем
            console.warn('⚠️ Error checking profile:', errorMessage);
            hasProfile = false;
          }
        }
        
        // Если профиля нет после проверки, сразу редиректим на анкету
        if (!hasProfile) {
          console.log('ℹ️ No profile found, redirecting to quiz immediately');
          setRedirectingToQuiz(true);
          setLoading(false);
          if (typeof window !== 'undefined') {
            window.location.href = '/quiz';
          } else {
            router.push('/quiz');
          }
          return;
        }

        // Если профиль есть - загружаем рекомендации
        if (hasProfile) {
          console.log('✅ Profile exists, loading recommendations...');
          try {
            await loadRecommendations();
            console.log('✅ loadRecommendations completed, checking if we should show feedback popup...');
            
            // Проверяем, нужно ли показывать поп-ап с отзывом (раз в неделю)
            setTimeout(async () => {
              if (!error && recommendations) {
                console.log('✅ Recommendations loaded, checking feedback popup...');
                await checkFeedbackPopup();
              } else {
                console.log('⚠️ Skipping feedback popup check:', { error, hasRecommendations: !!recommendations });
              }
            }, 100);
          } catch (recError: any) {
            console.error('❌ Error in loadRecommendations:', recError);
            // Если произошла ошибка загрузки плана (404) - редиректим на анкету
            if (recError?.status === 404 || recError?.isNotFound || 
                recError?.message?.includes('404') || 
                recError?.message?.includes('Plan not found')) {
              console.log('ℹ️ Plan not found after profile check, redirecting to quiz');
              setRedirectingToQuiz(true);
              setLoading(false);
              if (typeof window !== 'undefined') {
                window.location.href = '/quiz';
              } else {
                router.push('/quiz');
              }
              return;
            }
            // loadRecommendations уже обработал ошибку и вызвал setLoading(false)
            // Если произошел редирект или установлена ошибка, просто завершаем
          }
          // Убеждаемся что loading установлен в false
          setLoading(false);
          return; // Завершаем инициализацию
        }

        // Если профиля нет - просто завершаем загрузку, покажем экран с кнопкой
        console.log('ℹ️ No profile found, showing "Start quiz" screen');
        setLoading(false);
        return;
      } catch (err: any) {
        console.error('❌ Error in initAndLoad:', {
          error: err,
          message: err?.message,
          status: err?.status,
          isNotFound: err?.isNotFound,
          stack: err?.stack,
          name: err?.name,
        });
        
        // Обрабатываем любые необработанные ошибки
        // НО: если это 404 (профиль не найден), редиректим на анкету
        if (err?.status === 404 || err?.isNotFound || 
            err?.message?.includes('404') || 
            err?.message?.includes('Not found') ||
            err?.message?.includes('No skin profile') ||
            err?.message?.includes('Profile not found')) {
          console.log('ℹ️ Profile not found in initAndLoad, redirecting to quiz');
          setRedirectingToQuiz(true);
          setLoading(false);
          if (typeof window !== 'undefined') {
            window.location.href = '/quiz';
          } else {
            router.push('/quiz');
          }
          return;
        }
        
        console.error('❌ Unexpected error in initAndLoad, setting error state');
        setError('Произошла ошибка при загрузке данных. Попробуйте обновить страницу.');
        setLoading(false);
      }
    };

    initAndLoad().catch((err: any) => {
      console.error('❌ Unhandled promise rejection in initAndLoad catch:', {
        error: err,
        message: err?.message,
        status: err?.status,
        isNotFound: err?.isNotFound,
        stack: err?.stack,
        name: err?.name,
      });
      
      // Обрабатываем ошибку более мягко - не показываем ошибку пользователю
      // Если профиль не найден, редиректим на анкету
      if (err?.status === 404 || err?.isNotFound || 
          err?.message?.includes('404') || 
          err?.message?.includes('Not found') ||
          err?.message?.includes('No skin profile') ||
          err?.message?.includes('Profile not found')) {
        console.log('ℹ️ Profile not found in catch, redirecting to quiz');
        setRedirectingToQuiz(true);
        setLoading(false);
        if (typeof window !== 'undefined') {
          window.location.href = '/quiz';
        } else {
          router.push('/quiz');
        }
        return;
      }
      
      // Для других ошибок пытаемся загрузить план
      try {
        api.getPlan().then((plan: any) => {
          if (plan && (plan.plan28 || plan.weeks)) {
            console.log('✅ Plan exists despite error, redirecting to /plan');
            router.push('/plan');
          } else {
            console.log('ℹ️ No plan found, redirecting to quiz');
            router.push('/quiz');
          }
        }).catch(() => {
          console.log('ℹ️ Could not load plan, redirecting to quiz');
          router.push('/quiz');
        });
      } catch {
        console.log('ℹ️ Error in error handler, redirecting to quiz');
        router.push('/quiz');
      }
      
      setLoading(false);
      
      // Дополнительная обработка на случай, если промис отклонен
      // Если это 404 (профиль не найден), редиректим на анкету
      if (err?.status === 404 || err?.isNotFound || 
          err?.message?.includes('404') || 
          err?.message?.includes('Not found') ||
          err?.message?.includes('No skin profile') ||
          err?.message?.includes('Profile not found')) {
        console.log('ℹ️ Profile not found in catch, redirecting to quiz');
        setRedirectingToQuiz(true);
        setLoading(false);
        if (typeof window !== 'undefined') {
          window.location.href = '/quiz';
        } else {
          router.push('/quiz');
        }
        return;
      }
      
      console.error('❌ Unexpected unhandled rejection, setting error state');
      setError('Произошла ошибка при загрузке данных. Попробуйте обновить страницу.');
      setLoading(false);
    });
  }, [router]);

  // Проверка, нужно ли показывать поп-ап с отзывом (раз в неделю)
  const checkFeedbackPopup = async () => {
    if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
      return;
    }

    try {
      // Проверяем последний отзыв пользователя
      const response = await api.getLastPlanFeedback() as {
        lastFeedback?: {
          id: string;
          rating: number;
          feedback: string | null;
          createdAt: string;
        } | null;
      };

      const lastFeedback = response?.lastFeedback;
      const now = new Date();

      if (!lastFeedback) {
        // Если отзывов еще не было, показываем поп-ап через неделю после первого захода
        const firstVisit = localStorage.getItem('first_visit_date');
        if (!firstVisit) {
          // Первый заход - сохраняем дату, но не показываем поп-ап
          localStorage.setItem('first_visit_date', now.toISOString());
          return;
        }
        
        const firstVisitDate = new Date(firstVisit);
        const daysSinceFirstVisit = Math.floor((now.getTime() - firstVisitDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Показываем поп-ап через 7 дней после первого захода
        if (daysSinceFirstVisit >= 7) {
          // Проверяем, не закрывал ли пользователь поп-ап сегодня
          const closedToday = localStorage.getItem('feedback_popup_closed');
          if (closedToday) {
            const closedDate = new Date(closedToday);
            const sameDay = closedDate.toDateString() === now.toDateString();
            if (!sameDay) {
              setShowFeedbackPopup(true);
            }
          } else {
            setShowFeedbackPopup(true);
          }
        }
      } else {
        // Проверяем, прошла ли неделя с последнего отзыва
        const lastFeedbackDate = new Date(lastFeedback.createdAt);
        const daysSinceLastFeedback = Math.floor((now.getTime() - lastFeedbackDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Показываем поп-ап, если прошло 7 или более дней
        if (daysSinceLastFeedback >= 7) {
          // Проверяем, не закрывал ли пользователь поп-ап сегодня
          const closedToday = localStorage.getItem('feedback_popup_closed');
          if (closedToday) {
            const closedDate = new Date(closedToday);
            const sameDay = closedDate.toDateString() === now.toDateString();
            if (!sameDay) {
              setShowFeedbackPopup(true);
            }
          } else {
            setShowFeedbackPopup(true);
          }
        }
      }
    } catch (err: any) {
      // Игнорируем ошибки при проверке поп-апа (404, отсутствие профиля и т.д.)
      // Это не критично для работы приложения
      if (err?.status !== 404 && !err?.message?.includes('404') && !err?.message?.includes('Not found')) {
        console.warn('⚠️ Error checking feedback popup:', err);
      }
      // Не показываем поп-ап при ошибке
    }
  };

  // УДАЛЕНО: Функции resumeQuiz и startOver больше не нужны
  // Экран "Вы не завершили анкету" теперь только на странице анкеты

  // Функция для формирования полного названия продукта с брендом
  const getProductFullName = (product?: { name: string; brand?: string }): string => {
    if (!product) return '';
    if (product.brand) {
      return `${product.name}, ${product.brand}`;
    }
    return product.name;
  };

  const loadRecommendations = async () => {
    try {
      // ДОПОЛНИТЕЛЬНАЯ ЗАЩИТА: проверяем наличие профиля перед загрузкой
      console.log('🔍 loadRecommendations: Checking profile before loading...');
      let profileExists = false;
      try {
        const profile = await api.getCurrentProfile();
        if (profile && (profile as any).id) {
          profileExists = true;
          console.log('✅ loadRecommendations: Profile confirmed, proceeding...');
        } else {
          console.log('⚠️ loadRecommendations: No profile found, redirecting to quiz');
          setRedirectingToQuiz(true);
          setLoading(false);
          if (typeof window !== 'undefined') {
            window.location.href = '/quiz';
          } else {
            router.push('/quiz');
          }
          return;
        }
      } catch (profileErr: any) {
        const errorMessage = profileErr?.message || profileErr?.toString() || '';
        const isNotFound = errorMessage.includes('404') || 
                          errorMessage.includes('No skin profile') ||
                          errorMessage.includes('Skin profile not found') ||
                          errorMessage.includes('Profile not found') ||
                          profileErr?.status === 404 ||
                          profileErr?.isNotFound;
        
        if (isNotFound) {
          console.log('⚠️ loadRecommendations: Profile not found (404), redirecting to quiz');
          setRedirectingToQuiz(true);
          setLoading(false);
          if (typeof window !== 'undefined') {
            window.location.href = '/quiz';
          } else {
            router.push('/quiz');
          }
          return;
        }
        // Другая ошибка - логируем, но продолжаем (может быть временная проблема)
        console.warn('⚠️ loadRecommendations: Error checking profile, but continuing:', errorMessage);
        // Если это не 404, но профиль не найден - все равно редиректим
        profileExists = false;
      }
      
      // Если профиля нет - не загружаем план
      if (!profileExists) {
        console.log('⚠️ loadRecommendations: Profile not confirmed, redirecting to quiz');
        setRedirectingToQuiz(true);
        setLoading(false);
        if (typeof window !== 'undefined') {
          window.location.href = '/quiz';
        } else {
          router.push('/quiz');
        }
        return;
      }
      
      console.log('📥 Loading plan for current day...');
      
      // Загружаем план и прогресс
      let planData: any = null;
      let progress: { currentDay: number; completedDays: number[] } | null = null;
      
      try {
        // Пробуем загрузить план
        planData = await api.getPlan() as any;
        console.log('📥 Home: Plan loaded', {
          hasPlan: !!planData,
          hasPlan28: !!planData?.plan28,
          hasWeeks: !!planData?.weeks,
        });
      } catch (planErr: any) {
        console.error('❌ Home: Error loading plan', planErr);
        // Проверяем, какая именно ошибка
        const errorMessage = planErr?.message || planErr?.toString() || '';
        const isNotFound = planErr?.status === 404 || 
                          planErr?.isNotFound ||
                          errorMessage.includes('404') ||
                          errorMessage.includes('Plan not found') ||
                          errorMessage.includes('not found');
        
        if (isNotFound) {
          // План не найден - пробуем регенерировать, если профиль есть
          console.log('⚠️ Home: Plan not found (404), but profile exists. Attempting to generate plan...');
          try {
            const generatedPlan = await api.generatePlan() as any;
            if (generatedPlan && (generatedPlan.plan28 || generatedPlan.weeks)) {
              console.log('✅ Home: Plan generated successfully, using it');
              planData = generatedPlan;
              // Продолжаем обработку плана ниже
            } else {
              console.log('⚠️ Home: Plan generation returned empty result');
              setError('План не найден. Пожалуйста, пройдите анкету для генерации плана.');
              setLoading(false);
              return;
            }
          } catch (generateErr: any) {
            console.error('❌ Home: Failed to generate plan:', generateErr);
            // Если генерация не удалась, показываем ошибку
            setError('План не найден. Пожалуйста, пройдите анкету для генерации плана.');
            setLoading(false);
            return;
          }
        } else {
          // Другая ошибка (сеть, сервер и т.д.)
          setError('Не удалось загрузить план. Попробуйте обновить страницу.');
          setLoading(false);
          return;
        }
      }
      
      // Загружаем прогресс (может быть ошибка, но это не критично)
      try {
        progress = await api.getPlanProgress() as { currentDay: number; completedDays: number[] };
      } catch (progressErr) {
        console.warn('⚠️ Home: Error loading progress (non-critical)', progressErr);
        progress = { currentDay: 1, completedDays: [] };
      }
      
      if (!planData || !planData.plan28) {
        console.log('⚠️ Home: Plan not found after all attempts, showing "Start quiz" screen');
        setLoading(false);
        return;
      }
      
      const currentDay = progress?.currentDay || 1;
      const plan28 = planData.plan28;
      
      // Находим день плана для текущего дня
      const currentDayPlan = plan28.days.find((d: any) => d.dayIndex === currentDay);
      if (!currentDayPlan) {
        console.log('⚠️ Current day plan not found, redirecting to quiz');
        router.push('/quiz');
            return;
      }
      
      // Собираем все productId из текущего дня (утро, вечер, еженедельные)
      const allProductIds = new Set<number>();
      currentDayPlan.morning.forEach((step: any) => {
        if (step.productId) allProductIds.add(Number(step.productId));
      });
      currentDayPlan.evening.forEach((step: any) => {
        if (step.productId) allProductIds.add(Number(step.productId));
      });
      currentDayPlan.weekly.forEach((step: any) => {
        if (step.productId) allProductIds.add(Number(step.productId));
      });
      
      // Загружаем детали продуктов (используем ту же логику, что и в календаре)
      let productsMap = new Map<number, any>();
      if (allProductIds.size > 0) {
        try {
          const productsResponse = await fetch('/api/products/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Init-Data': typeof window !== 'undefined' ? (window.Telegram?.WebApp?.initData || '') : '',
            },
            body: JSON.stringify({ productIds: Array.from(allProductIds) }),
          });
          
          if (productsResponse.ok) {
            const productsData = await productsResponse.json();
            productsData.products?.forEach((p: any) => {
              if (p && p.id) {
                // Используем ту же структуру, что и в календаре для синхронизации
                productsMap.set(p.id, {
                  id: p.id,
                  name: p.name || 'Неизвестный продукт',
                  brand: { name: p.brand?.name || p.brand || 'Unknown' },
                  price: p.price || null,
                  imageUrl: p.imageUrl || null,
                  // Используем descriptionUser для синхронизации с календарем
                  description: p.descriptionUser || p.description || null,
                });
              }
            });
            
            console.log('✅ Home: Products loaded from plan', {
              requestedIds: allProductIds.size,
              loadedProducts: productsMap.size,
              missingProducts: Array.from(allProductIds).filter(id => !productsMap.has(id)),
            });
            
            // Проверяем, что все продукты загружены
            const missingProducts = Array.from(allProductIds).filter(id => !productsMap.has(id));
            if (missingProducts.length > 0) {
              console.warn('⚠️ Home: Some products not found in database', {
                missingIds: missingProducts,
                currentDay,
              });
            }
          } else {
            const errorText = await productsResponse.text().catch(() => '');
            console.error('❌ Home: Failed to load products from batch endpoint', {
              status: productsResponse.status,
              statusText: productsResponse.statusText,
              error: errorText.substring(0, 200),
            });
          }
        } catch (err) {
          console.error('❌ Home: Error loading product details', err);
        }
      } else {
        console.warn('⚠️ Home: No product IDs found for current day', { currentDay });
      }
      
      // Преобразуем шаги плана в RoutineItem[]
      const morning: RoutineItem[] = [];
      const evening: RoutineItem[] = [];
      
      // Вспомогательная функция для получения названия продукта
      const getProductName = (productId: number | string): string => {
        const product = productsMap.get(Number(productId));
        if (product) {
          return `${product.name}${product.brand?.name ? `, ${product.brand.name}` : ''}`;
        }
        return 'Продукт';
      };
      
      // Вспомогательная функция для получения иконки по категории шага
      const getIconForStep = (stepCategory: string): string => {
        if (stepCategory.startsWith('cleanser')) return ICONS.cleanser;
        if (stepCategory.startsWith('toner')) return ICONS.toner;
        if (stepCategory.startsWith('serum') || stepCategory.startsWith('treatment')) return ICONS.serum;
        if (stepCategory.startsWith('moisturizer')) return ICONS.cream;
        if (stepCategory.startsWith('spf')) return ICONS.spf;
        if (stepCategory.startsWith('mask')) return ICONS.mask;
        return ICONS.cream;
      };
      
      // Вспомогательная функция для получения описания шага
      const getStepHowto = (stepCategory: string, isMorning: boolean): { steps: string[]; volume: string; tip: string } => {
        if (stepCategory.startsWith('cleanser')) {
          return {
            steps: isMorning 
              ? ['Смочите лицо тёплой водой', '1–2 нажатия геля в ладони', 'Массируйте 30–40 сек', 'Смойте, промокните полотенцем']
              : ['1) Масло: сухими руками распределить, эмульгировать водой', '2) Гель: умыть 30–40 сек, смыть'],
            volume: isMorning ? 'Гель: 1–2 пшика' : '1–2 дозы масла + 1–2 пшика геля',
            tip: isMorning ? 'Если кожа сухая утром — можно умыться только водой.' : 'Двойное очищение — в дни макияжа/кислот.',
          };
        }
        if (stepCategory.startsWith('toner')) {
          return {
            steps: ['Нанесите 3–5 капель на руки', 'Распределите похлопывающими движениями', 'Дайте впитаться 30–60 сек'],
            volume: '3–5 капель',
            tip: 'Избегайте ватных дисков — тратите меньше продукта.',
          };
        }
        if (stepCategory.startsWith('serum') || stepCategory.startsWith('treatment')) {
          return {
            steps: isMorning
              ? ['1–2 пипетки на сухую кожу', 'Наносите на T‑зону и щеки', 'Подождите 1–2 минуты до крема']
              : ['3–6 капель', 'Равномерно нанести, дать впитаться 1 мин'],
            volume: isMorning ? '4–6 капель' : '3–6 капель',
            tip: isMorning ? 'Если есть раздражение — пропустите актив на день.' : 'В дни кислот сыворотка — без кислот/ретинола.',
          };
        }
        if (stepCategory.startsWith('moisturizer')) {
          return {
            steps: isMorning
              ? ['Горох крема распределить по лицу', 'Мягко втереть по массажным линиям']
              : ['Горох крема', 'Распределить, не втирая сильно'],
            volume: 'Горошина',
            tip: isMorning ? 'Не забывайте шею и линию подбородка.' : 'Если сухо — добавьте каплю масла локально.',
          };
        }
        if (stepCategory.startsWith('spf')) {
          return {
            steps: ['Нанести 2 пальца SPF (лицо/шея)', 'Обновлять каждые 2–3 часа на улице'],
            volume: '~1.5–2 мл',
            tip: 'При UV > 3 — обязательно SPF даже в облачную погоду.',
          };
        }
        if (stepCategory.startsWith('mask')) {
          return {
            steps: ['Нанести на очищенную кожу', 'Выдержать 10–20 минут', 'Смыть тёплой водой'],
            volume: 'По инструкции',
            tip: 'Используйте маску 1–2 раза в неделю.',
          };
        }
        return {
          steps: ['Нанести на кожу', 'Распределить равномерно'],
          volume: 'По инструкции',
          tip: '',
        };
      };
      
      // УТРЕННЯЯ РУТИНА
      currentDayPlan.morning.forEach((step: any, index: number) => {
        if (step.productId) {
          const productId = Number(step.productId);
          const product = productsMap.get(productId);
          const stepTitle = step.stepCategory.startsWith('cleanser') ? 'Очищение' :
                           step.stepCategory.startsWith('toner') ? 'Тонер' :
                           step.stepCategory.startsWith('serum') ? 'Актив' :
                           step.stepCategory.startsWith('treatment') ? 'Лечение' :
                           step.stepCategory.startsWith('moisturizer') ? 'Крем' :
                           step.stepCategory.startsWith('spf') ? 'SPF-защита' :
                           'Средство';
          
          morning.push({
            id: `morning-${step.stepCategory}-${index}`,
            title: stepTitle,
            subtitle: getProductName(productId),
            icon: getIconForStep(step.stepCategory),
            howto: getStepHowto(step.stepCategory, true),
          done: false,
        });
      }
      });
      
      // ВЕЧЕРНЯЯ РУТИНА
      currentDayPlan.evening.forEach((step: any, index: number) => {
        if (step.productId) {
          const productId = Number(step.productId);
          const stepTitle = step.stepCategory.startsWith('cleanser') ? 'Очищение' :
                           step.stepCategory.startsWith('serum') ? 'Сыворотка' :
                           step.stepCategory.startsWith('treatment') ? 'Лечение' :
                           step.stepCategory.startsWith('moisturizer') ? 'Крем' :
                           'Средство';
          
        evening.push({
            id: `evening-${step.stepCategory}-${index}`,
            title: stepTitle,
            subtitle: getProductName(productId),
            icon: getIconForStep(step.stepCategory),
            howto: getStepHowto(step.stepCategory, false),
          done: false,
        });
      }
      });
      
      // ЕЖЕНЕДЕЛЬНЫЕ СРЕДСТВА (добавляем в вечер, если они есть)
      currentDayPlan.weekly.forEach((step: any, index: number) => {
        if (step.productId) {
          const productId = Number(step.productId);
          const stepTitle = step.stepCategory.startsWith('mask') ? 'Маска' : 'Средство';
          
        evening.push({
            id: `weekly-${step.stepCategory}-${index}`,
            title: stepTitle,
            subtitle: getProductName(productId),
            icon: getIconForStep(step.stepCategory),
            howto: getStepHowto(step.stepCategory, false),
          done: false,
        });
      }
      });
      
      // Создаем фиктивные рекомендации для совместимости с существующим кодом
      const fakeRecommendations: Recommendation = {
        profile_summary: {
          skinType: 'unknown',
          sensitivityLevel: 'low',
          notes: '',
        },
        steps: {},
      };
      setRecommendations(fakeRecommendations);
      setError(null);
      planCheckDoneRef.current = true;
      console.log('✅ Plan loaded and converted to routine items');
      
      setMorningItems(morning);
      setEveningItems(evening);
    } catch (error: any) {
      console.error('❌ Error loading recommendations:', {
        error,
        status: error?.status,
        isNotFound: error?.isNotFound,
        message: error?.message,
        stack: error?.stack,
      });
      
      // Проверяем тип ошибки
      if (error?.status === 404 || error?.isNotFound || 
          error?.message?.includes('404') || 
          error?.message?.includes('Not found') ||
          error?.message?.includes('No skin profile') ||
          error?.message?.includes('Profile not found')) {
        // Профиль не найден - перенаправляем на анкету (не показываем ошибку)
        console.log('ℹ️ Profile not found (404), redirecting to quiz');
        router.push('/quiz');
        return;
      }
      
      if (error?.message?.includes('Unauthorized') || error?.message?.includes('401') || error?.message?.includes('initData')) {
        // Ошибка идентификации - перенаправляем на анкету
        console.log('ℹ️ Unauthorized, redirecting to quiz');
        router.push('/quiz');
        return;
      }
      
      // Другие ошибки - проверяем, есть ли план
      console.error('❌ Unexpected error loading recommendations:', error);
      
      // Если это ошибка KV или другая ошибка, но план может быть доступен - проверяем план
      try {
        const plan = await api.getPlan() as any;
        if (plan && (plan.plan28 || plan.weeks)) {
          // План есть - перенаправляем на страницу плана
          console.log('✅ Plan exists, redirecting to /plan');
          router.push('/plan');
          return;
        }
      } catch (planError) {
        // Не удалось загрузить план - продолжаем с ошибкой
        console.warn('⚠️ Could not load plan:', planError);
      }
      
      // Если план не найден, показываем ошибку
      const errorMessage = error?.message || 'Ошибка загрузки рекомендаций';
      console.error('❌ Setting error state:', errorMessage);
      setError(errorMessage);
      setMorningItems([]);
      setEveningItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Загружаем прогресс плана при монтировании
  useEffect(() => {
    const loadPlanProgress = async () => {
      try {
        const progress = await api.getPlanProgress() as {
          currentDay: number;
          completedDays: number[];
        };
        if (progress) {
          setCurrentDay(progress.currentDay || 1);
          
          // Загружаем сохраненный прогресс шагов из localStorage
          if (typeof window !== 'undefined') {
            const savedSteps = localStorage.getItem(`plan_steps_${progress.currentDay || 1}`);
            if (savedSteps) {
              try {
                const parsed = JSON.parse(savedSteps);
                setCompletedSteps({
                  morning: new Set(parsed.morning || []),
                  evening: new Set(parsed.evening || []),
                });
                
                // Обновляем состояние элементов рутины
                setMorningItems((items) =>
                  items.map((item) => ({
                    ...item,
                    done: parsed.morning?.includes(item.id) || false,
                  }))
                );
                setEveningItems((items) =>
                  items.map((item) => ({
                    ...item,
                    done: parsed.evening?.includes(item.id) || false,
                  }))
                );
              } catch (e) {
                console.warn('Could not parse saved steps:', e);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not load plan progress:', err);
      }
    };
    
    if (mounted && recommendations) {
      loadPlanProgress();
    }
  }, [mounted, recommendations]);


  const toggleItem = async (itemId: string) => {
    const isMorning = tab === 'AM';
    const currentCompleted = isMorning ? completedSteps.morning : completedSteps.evening;
    const isDone = currentCompleted.has(itemId);
    
    // Обновляем локальное состояние
    if (isMorning) {
      setMorningItems((items) =>
        items.map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item
        )
      );
    } else {
      setEveningItems((items) =>
        items.map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item
        )
      );
    }
    
    // Обновляем состояние выполненных шагов
    const newCompletedSet = new Set(currentCompleted);
    if (isDone) {
      newCompletedSet.delete(itemId);
    } else {
      newCompletedSet.add(itemId);
    }
    
    const newCompletedSteps = {
      ...completedSteps,
      [isMorning ? 'morning' : 'evening']: newCompletedSet,
    };
    setCompletedSteps(newCompletedSteps);
    
    // Сохраняем в localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `plan_steps_${currentDay}`,
        JSON.stringify({
          morning: Array.from(newCompletedSteps.morning),
          evening: Array.from(newCompletedSteps.evening),
        })
      );
    }
    
    // Проверяем, все ли шаги утра/вечера выполнены
    const currentItems = isMorning ? morningItems : eveningItems;
    const allCompleted = currentItems.every((item) => {
      if (item.id === itemId) {
        return !isDone; // Проверяем новое состояние
      }
      return newCompletedSet.has(item.id);
    });
    
    // Если все шаги выполнены, проверяем, нужно ли завершить день
    if (allCompleted) {
      const otherCompleted = isMorning ? completedSteps.evening : completedSteps.morning;
      const otherItems = isMorning ? eveningItems : morningItems;
      const otherAllCompleted = otherItems.every((item) => otherCompleted.has(item.id));
      
      // Если и утро, и вечер выполнены - день завершен
      if (otherAllCompleted && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        try {
          const progress = await api.getPlanProgress() as {
            currentDay: number;
            completedDays: number[];
          };
          
          const completedDaysSet = new Set(progress?.completedDays || []);
          if (!completedDaysSet.has(currentDay)) {
            completedDaysSet.add(currentDay);
            const nextDay = Math.min(currentDay + 1, 28);
            
            await api.savePlanProgress(nextDay, Array.from(completedDaysSet));
            setCurrentDay(nextDay);
            
            // Очищаем прогресс шагов для нового дня
            setCompletedSteps({ morning: new Set(), evening: new Set() });
            if (typeof window !== 'undefined') {
              localStorage.removeItem(`plan_steps_${currentDay}`);
            }
            
            toast.success('День завершен! ✨');
          }
        } catch (err) {
          console.warn('Could not save completed day:', err);
        }
      }
    }
  };

  // УДАЛЕНО: useEffect для showResumeScreen больше не нужен
  // Экран "Вы не завершили анкету" теперь только на странице анкеты

  // Вычисляем текущие элементы рутины через useMemo для стабильности
  const routineItems = useMemo(() => {
    return tab === 'AM' ? morningItems : eveningItems;
  }, [tab, morningItems, eveningItems]);
  
  const routineItemsLength = useMemo(() => {
    return routineItems.length;
  }, [routineItems]);

  // Проверяем наличие плана, если рекомендации не загрузились
  // ВАЖНО: Этот useEffect должен быть ПЕРЕД всеми ранними return'ами!
  useEffect(() => {
    // Защита от повторных проверок: если уже проверяли, не проверяем снова
    if (planCheckDoneRef.current) {
      return;
    }
    
    // Проверяем только если рекомендации не загружены, не загружаемся и не проверяем уже план
    if (routineItemsLength === 0 && !loading && !checkingPlan && !hasPlan) {
      console.log('🔍 Checking if plan exists...');
      planCheckDoneRef.current = true; // Помечаем, что проверка началась
      
      const checkPlan = async () => {
        setCheckingPlan(true);
        try {
          const plan = await api.getPlan() as any;
          if (plan && (plan.plan28 || plan.weeks)) {
            console.log('✅ Plan found, redirecting to /plan');
            setHasPlan(true);
            // Если план найден, но рекомендаций нет - редиректим на страницу плана
            // Используем window.location для гарантированного редиректа
            if (typeof window !== 'undefined') {
              window.location.href = '/plan';
            }
            return;
          } else {
            console.log('ℹ️ Plan not found or empty');
            planCheckDoneRef.current = false; // Разрешаем повторную проверку, если план не найден
          }
        } catch (err) {
          console.log('ℹ️ Plan check failed (expected if no plan):', err);
          planCheckDoneRef.current = false; // Разрешаем повторную проверку при ошибке
          // План не найден - это нормально, не показываем ошибку
        } finally {
          setCheckingPlan(false);
        }
      };
      checkPlan();
    }
    // Убираем router из зависимостей, чтобы избежать лишних пересчетов
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineItemsLength, loading, checkingPlan, hasPlan]);

  // Экран незавершенной анкеты
  // УДАЛЕНО: Экран "Вы не завершили анкету" больше не показывается на главной странице
  // Если профиля нет, сразу редиректим на /quiz, где этот экран уже есть

  // ВАЖНО: Если редиректим на анкету, не показываем никакой контент
  if (redirectingToQuiz) {
    return null; // Не показываем ничего во время редиректа
  }

  if (!mounted || loading) {
    // Показываем лоадер во время загрузки
    // Не показываем "Загрузка анкеты..." если профиль уже проверен и есть
    // Это может быть ошибка загрузки плана, а не отсутствие анкеты
    const loadingText = 'Загрузка плана...';
    
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(10, 95, 89, 0.2)',
          borderTop: '4px solid #0A5F59',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ color: '#0A5F59', fontSize: '16px' }}>{loadingText}</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Получаем текущие элементы в зависимости от вкладки (используется в useEffect выше)

  if (routineItems.length === 0) {
    if (checkingPlan) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка...</div>
        </div>
      );
    }
    
    // Если план найден, но рекомендаций нет - показываем загрузку (редирект на /plan уже выполняется)
    // Или показываем сообщение о том, что нужно перейти к плану
    if (hasPlan) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ color: '#0A5F59', fontSize: '16px' }}>Переход к плану...</div>
        </div>
      );
    }
    
    // Если профиль не найден или нет рекомендаций - показываем экран с предложением пройти анкету
    return (
      <div style={{ 
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
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
            fontSize: '48px',
            marginBottom: '16px',
          }}>
            ✨
          </div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '12px',
          }}>
            Создайте свой план ухода
          </h2>
          <p style={{
            color: '#475467',
            marginBottom: '24px',
            lineHeight: '1.6',
          }}>
            Пройдите анкету, чтобы получить персональные рекомендации по уходу за кожей
          </p>
          <button
            onClick={() => router.push('/quiz')}
            style={{
              width: '100%',
              padding: '16px 24px',
              borderRadius: '12px',
              backgroundColor: '#0A5F59',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(10, 95, 89, 0.3)',
            }}
          >
            Пройти анкету
          </button>
        </div>
      </div>
    );
  }

  // Если есть ошибка, не рендерим основной контент
  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)'
      }}>
        <h1 style={{ color: '#0A5F59', marginBottom: '16px' }}>Ошибка загрузки</h1>
        <p style={{ color: '#475467', marginBottom: '24px' }}>{error}</p>
        <button
          onClick={() => router.push('/quiz')}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          Пройти анкету заново
        </button>
      </div>
    );
  }

  const completedCount = routineItems.filter((item) => item.done).length;
  const totalCount = routineItems.length;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      paddingBottom: '120px',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        textAlign: 'center',
      }}>
        <img
          src="/skiniq-logo.png"
          alt="SkinIQ"
          style={{
            height: '140px',
            marginTop: '8px',
            marginBottom: '8px',
          }}
          onError={(e) => {
            console.warn('Logo not found');
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div style={{
          fontSize: '26px',
          fontWeight: 600,
          color: '#374151',
          marginBottom: '8px',
        }}>
          Время заботиться о своей коже
        </div>
        {recommendations?.profile_summary && (
          <div style={{
            fontSize: '16px',
            color: '#475467',
            marginBottom: '16px',
          }}>
            {completedCount}/{totalCount} шагов
          </div>
        )}
      </div>

      {/* Toggle AM/PM */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '24px',
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.42)',
          backdropFilter: 'blur(20px)',
          borderRadius: '28px',
          padding: '6px',
          display: 'flex',
          gap: '6px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
        }}>
          <button
            onClick={() => setTab('AM')}
            style={{
              padding: '8px 20px',
              borderRadius: '22px',
              border: 'none',
              backgroundColor: tab === 'AM' ? 'rgba(10, 95, 89, 0.9)' : 'rgba(255, 255, 255, 0.2)',
              color: tab === 'AM' ? 'white' : '#0A5F59',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            Утро
          </button>
          <button
            onClick={() => setTab('PM')}
            style={{
              padding: '8px 20px',
              borderRadius: '22px',
              border: 'none',
              backgroundColor: tab === 'PM' ? 'rgba(10, 95, 89, 0.9)' : 'rgba(255, 255, 255, 0.2)',
              color: tab === 'PM' ? 'white' : '#0A5F59',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
            }}
          >
            Вечер
          </button>
        </div>
      </div>

      {/* Routine Items */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '0 20px',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        {routineItems.map((item, index) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.56)',
              backdropFilter: 'blur(28px)',
              borderRadius: '20px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              cursor: 'pointer',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              opacity: item.done ? 0.7 : 1,
            }}
          >
            {/* Step Number */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                toggleItem(item.id);
              }}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: item.done ? '#0A5F59' : 'rgba(10, 95, 89, 0.1)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {item.done ? '✓' : index + 1}
            </div>

            {/* Icon */}
            <img
              src={item.icon}
              alt={item.title}
              style={{
                width: '60px',
                height: '60px',
                objectFit: 'contain',
                flexShrink: 0,
              }}
              onError={(e) => {
                // Fallback для отсутствующих иконок
                console.warn('Icon not found:', item.icon);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '17px',
                fontWeight: 'bold',
                color: '#0A5F59',
                marginBottom: '4px',
              }}>
                {item.title}
              </div>
              <div style={{
                fontSize: '14px',
                color: '#475467',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {item.subtitle}
              </div>
            </div>

            {/* Info Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedItem(item);
              }}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                flexShrink: 0,
              }}
            >
              i
            </button>
          </div>
        ))}
      </div>

      {/* BottomSheet для деталей */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setSelectedItem(null)}
          />
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxHeight: '85vh',
              backgroundColor: 'rgba(250, 251, 253, 0.75)',
              backdropFilter: 'blur(32px)',
              borderTopLeftRadius: '28px',
              borderTopRightRadius: '28px',
              padding: '24px',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0A5F59', marginBottom: '16px' }}>
              {selectedItem.title}
            </h3>
            <div style={{ marginBottom: '16px', color: '#475467' }}>
              {selectedItem.subtitle}
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              style={{
                marginTop: '24px',
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              Понятно
            </button>
          </div>
        </div>
      )}

      {/* Кнопки внизу страницы */}
      <div style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        <button
          onClick={() => {
            try {
              router.push('/plan');
            } catch (err) {
              console.error('Error navigating to plan:', err);
              setError('Ошибка при переходе к плану');
            }
          }}
          style={{
            width: '100%',
            padding: '16px 24px',
            borderRadius: '12px',
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          28-дневный план →
        </button>
        <button
          onClick={() => {
            // Устанавливаем флаг о перепрохождении анкеты
            if (typeof window !== 'undefined') {
              localStorage.setItem('is_retaking_quiz', 'true');
            }
            router.push('/quiz');
          }}
          style={{
            width: '100%',
            padding: '16px 24px',
            borderRadius: '12px',
            backgroundColor: 'rgba(10, 95, 89, 0.1)',
            color: '#0A5F59',
            border: '2px solid #0A5F59',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          Перепройти анкету
        </button>
      </div>

      {/* Поп-ап для оценки плана */}
      {showFeedbackPopup && (
        <PlanFeedbackPopup
          onClose={() => {
            setShowFeedbackPopup(false);
            // Сохраняем дату закрытия, чтобы не показывать снова сегодня
            if (typeof window !== 'undefined') {
              localStorage.setItem('feedback_popup_closed', new Date().toISOString());
            }
          }}
        />
      )}
    </div>
  );
}