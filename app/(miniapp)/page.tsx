// app/(miniapp)/page.tsx
// Главная страница мини-аппа (рутина ухода) - миграция из Home.tsx

'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import PlanFeedbackPopup from '@/components/PlanFeedbackPopup';
import { PlanCalendar } from '@/components/PlanCalendar';
import { DayView } from '@/components/DayView';
import { PaymentGate } from '@/components/PaymentGate';
import type { Plan28, DayPlan } from '@/lib/plan-types';
import toast from 'react-hot-toast';
import { clientLogger } from '@/lib/client-logger';

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
  const [selectedDay, setSelectedDay] = useState(1); // Выбранный день в календаре
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [plan28, setPlan28] = useState<Plan28 | null>(null);
  const [products, setProducts] = useState<Map<number, {
    id: number;
    name: string;
    brand: { name: string };
    price?: number;
    imageUrl?: string | null;
    description?: string;
  }>>(new Map());
  const [wishlistProductIds, setWishlistProductIds] = useState<Set<number>>(new Set());
  const [cartQuantities, setCartQuantities] = useState<Map<number, number>>(new Map());
  const [completedSteps, setCompletedSteps] = useState<{
    morning: Set<string>;
    evening: Set<string>;
  }>({
    morning: new Set(),
    evening: new Set(),
  });
  const [redirectingToQuiz, setRedirectingToQuiz] = useState(false); // Флаг: редиректим на анкету
  const [hasCheckedProfile, setHasCheckedProfile] = useState(false); // Флаг: проверили ли наличие профиля
  const [paymentKey, setPaymentKey] = useState(0); // Ключ для принудительного обновления PaymentGate
  const profileCheckInProgressRef = useRef(false); // Защита от множественных запросов к getCurrentProfile
  const progressLoadInProgressRef = useRef(false); // ИСПРАВЛЕНО: Защита от множественных запросов к getPlanProgress

  // УДАЛЕНО: Функция checkIncompleteQuiz больше не нужна
  // Если профиля нет, сразу редиректим на /quiz, где есть экран "Вы не завершили анкету"

  useEffect(() => {
    clientLogger.log('🚀 HomePage useEffect started');
    setMounted(true);
    // ИСПРАВЛЕНО: НЕ сбрасываем planCheckDoneRef при монтировании, чтобы избежать повторных проверок
    // Флаг будет установлен при первой проверке плана
    
    // Проверяем доступность Telegram WebApp
    clientLogger.log('📱 Checking Telegram WebApp:', {
      hasWindow: typeof window !== 'undefined',
      hasTelegram: typeof window !== 'undefined' && !!window.Telegram,
      hasWebApp: typeof window !== 'undefined' && !!window.Telegram?.WebApp,
      hasInitData: typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData,
      initDataLength: typeof window !== 'undefined' && window.Telegram?.WebApp?.initData?.length || 0,
    });
    
    // Инициализируем Telegram с обработкой ошибок
    try {
    initialize();
    clientLogger.log('✅ Telegram WebApp initialized');
    } catch (err) {
      console.error('❌ Error initializing Telegram:', err);
      // Продолжаем работу даже при ошибке инициализации
    }
    
    // Загружаем данные (пользователь идентифицируется автоматически через initData)
    const initAndLoad = async () => {
      try {
        clientLogger.log('🔄 initAndLoad started');
        
        // Ждем немного, чтобы Telegram WebApp успел инициализироваться
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Проверяем, что приложение открыто через Telegram
        const hasInitData = typeof window !== 'undefined' && window.Telegram?.WebApp?.initData;
        clientLogger.log('🔍 Checking initData after wait:', {
          hasInitData,
          initDataLength: typeof window !== 'undefined' && window.Telegram?.WebApp?.initData?.length || 0,
        });
        
        if (!hasInitData) {
          clientLogger.warn('⚠️ Telegram WebApp не доступен, redirecting to quiz');
          setRedirectingToQuiz(true);
          setLoading(false);
          if (typeof window !== 'undefined') {
            window.location.href = '/quiz';
          } else {
            router.push('/quiz');
          }
          return;
        }
        
        clientLogger.log('✅ Telegram WebApp available, proceeding with initialization');

        // СНАЧАЛА проверяем наличие профиля (самая надежная проверка)
        // ИСПРАВЛЕНО: Защита от множественных запросов
        if (profileCheckInProgressRef.current) {
          clientLogger.log('⚠️ Profile check already in progress, skipping...');
          return;
        }
        
        // ИСПРАВЛЕНО: Устанавливаем флаг СРАЗУ, чтобы предотвратить повторные вызовы
        profileCheckInProgressRef.current = true;
        clientLogger.log('🔍 Step 1: Checking for existing profile...');
        setHasCheckedProfile(true); // Помечаем, что проверили профиль
        let hasProfile = false;
        try {
          const profile = await api.getCurrentProfile();
          if (profile && (profile as any).id) {
            hasProfile = true;
            clientLogger.log('✅ Profile exists, user has completed quiz');
          } else {
            // Профиль null или без id - считаем, что профиля нет
            clientLogger.log('ℹ️ Profile not found (expected for new users or incomplete quiz)');
            hasProfile = false;
          }
        } catch (err: any) {
          // Проверяем, какая именно ошибка (для обратной совместимости с 404)
          const errorMessage = err?.message || err?.toString() || '';
          const isNotFound = errorMessage.includes('404') || 
                            errorMessage.includes('No skin profile') ||
                            errorMessage.includes('Skin profile not found') ||
                            errorMessage.includes('Profile not found') ||
                            errorMessage.includes('No profile found') ||
                            err?.status === 404 ||
                            err?.isNotFound;
          
          if (isNotFound) {
            clientLogger.log('ℹ️ Profile not found (expected for new users or incomplete quiz)');
            hasProfile = false;
          } else {
            // Другая ошибка (сеть, авторизация и т.д.) - логируем, но продолжаем
            clientLogger.warn('⚠️ Error checking profile:', errorMessage);
            hasProfile = false;
          }
        }
        
        // ИСПРАВЛЕНО: Если профиля нет после проверки, ВСЕГДА редиректим на анкету
        // Убираем все условия - просто проверяем hasProfile
        if (!hasProfile) {
          clientLogger.log('ℹ️ No profile found, redirecting to quiz immediately');
          setRedirectingToQuiz(true);
          setLoading(false);
          // Используем window.location.href для надежного редиректа
          if (typeof window !== 'undefined') {
            window.location.href = '/quiz';
            return;
          } else {
            router.push('/quiz');
          return;
          }
        }

        // Если профиль есть - загружаем рекомендации
        if (hasProfile) {
          clientLogger.log('✅ Profile exists, loading recommendations...');
          try {
            await loadRecommendations();
            clientLogger.log('✅ loadRecommendations completed, checking if we should show feedback popup...');
            
            // Проверяем, нужно ли показывать поп-ап с отзывом (раз в неделю)
            setTimeout(async () => {
              if (!error && recommendations) {
                clientLogger.log('✅ Recommendations loaded, checking feedback popup...');
                await checkFeedbackPopup();
              } else {
                clientLogger.log('⚠️ Skipping feedback popup check:', { error, hasRecommendations: !!recommendations });
              }
            }, 100);
          } catch (recError: any) {
            console.error('❌ Error in loadRecommendations:', recError);
            // Если произошла ошибка загрузки плана (404) - редиректим на анкету
            if (recError?.status === 404 || recError?.isNotFound || 
                recError?.message?.includes('404') || 
                recError?.message?.includes('Plan not found')) {
              clientLogger.log('ℹ️ Plan not found after profile check, redirecting to quiz');
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
          profileCheckInProgressRef.current = false; // Сбрасываем флаг
          return; // Завершаем инициализацию
        }

        // Если профиля нет - просто завершаем загрузку, покажем экран с кнопкой
        clientLogger.log('ℹ️ No profile found, showing "Start quiz" screen');
        setLoading(false);
        profileCheckInProgressRef.current = false; // Сбрасываем флаг
        return;
      } catch (err: any) {
        profileCheckInProgressRef.current = false; // Сбрасываем флаг при ошибке
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
          clientLogger.log('ℹ️ Profile not found in initAndLoad, redirecting to quiz');
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
        clientLogger.log('ℹ️ Profile not found in catch, redirecting to quiz');
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
            clientLogger.log('✅ Plan exists despite error, redirecting to /plan');
            router.push('/plan');
          } else {
            clientLogger.log('ℹ️ No plan found, redirecting to quiz');
            router.push('/quiz');
          }
        }).catch(() => {
          clientLogger.log('ℹ️ Could not load plan, redirecting to quiz');
          router.push('/quiz');
        });
      } catch {
        clientLogger.log('ℹ️ Error in error handler, redirecting to quiz');
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
        clientLogger.log('ℹ️ Profile not found in catch, redirecting to quiz');
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

  // Проверка, нужно ли показывать поп-ап с отзывом (через 3 дня после генерации плана, раз в неделю)
  const checkFeedbackPopup = async () => {
    if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
      return;
    }

    try {
      // ВАЖНО: Сначала проверяем, прошло ли 3 дня с момента генерации плана
      // Получаем профиль, чтобы узнать дату создания плана
      let profileCreatedAt: Date | null = null;
      try {
        const profile = await api.getCurrentProfile() as any;
        if (profile && profile.createdAt) {
          profileCreatedAt = new Date(profile.createdAt);
        }
      } catch (profileError) {
        // Если профиль не найден, не показываем поп-ап
        clientLogger.log('⚠️ Profile not found, skipping feedback popup');
        return;
      }

      // Если профиль не найден или дата создания не определена, не показываем поп-ап
      if (!profileCreatedAt) {
        clientLogger.log('⚠️ Profile creation date not found, skipping feedback popup');
        return;
      }

      const now = new Date();
      const daysSincePlanGeneration = Math.floor((now.getTime() - profileCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      // ВАЖНО: Поп-ап показывается только через 3 дня после генерации плана
      if (daysSincePlanGeneration < 3) {
        clientLogger.log(`⚠️ Plan generated ${daysSincePlanGeneration} days ago, need 3 days. Skipping feedback popup.`);
        return;
      }

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

      if (!lastFeedback) {
        // Если отзывов еще не было, показываем поп-ап (уже прошло 3+ дня)
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
        clientLogger.warn('⚠️ Error checking feedback popup:', err);
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
      // ИСПРАВЛЕНО: Не проверяем профиль повторно, если уже проверили
      // Профиль уже был проверен в initAndLoad, просто продолжаем
      clientLogger.log('✅ loadRecommendations: Proceeding (profile already checked in initAndLoad)...');
      
      clientLogger.log('📥 Loading plan for current day...');
      
      // Загружаем план и прогресс
      let planData: any = null;
      let progress: { currentDay: number; completedDays: number[] } | null = null;
      
      try {
        // Пробуем загрузить план
        planData = await api.getPlan() as any;
        clientLogger.log('📥 Home: Plan loaded', {
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
          // План не найден для текущей версии профиля - пробуем сгенерировать
          // Защита от бесконечных reload'ов: проверяем, сколько раз уже пытались генерировать
          const generateAttemptsKey = 'plan_generate_attempts';
          const generateAttempts = parseInt(sessionStorage.getItem(generateAttemptsKey) || '0', 10);
          
          if (generateAttempts >= 2) {
            console.error('❌ Home: Too many plan generation attempts, stopping to prevent infinite loop');
            sessionStorage.removeItem(generateAttemptsKey);
            setError('Не удалось загрузить план. Попробуйте обновить страницу.');
            setLoading(false);
            return;
          }
          
          clientLogger.log('⚠️ Home: Plan not found (404), but profile exists. Attempting to generate plan...', { attempt: generateAttempts + 1 });
          sessionStorage.setItem(generateAttemptsKey, String(generateAttempts + 1));
          
          try {
            // ИСПРАВЛЕНО: Показываем лоадер во время генерации плана
            setCheckingPlan(true);
            clientLogger.log('🔄 Home: Generating plan...');
            
            // Пробуем сгенерировать план (может быть для новой версии профиля после перепрохождения анкеты)
            const generatedPlan = await api.generatePlan() as any;
            
            // ИСПРАВЛЕНО: Проверяем оба формата плана (plan28 и weeks)
            const hasPlan28 = generatedPlan?.plan28 && generatedPlan.plan28.days && generatedPlan.plan28.days.length > 0;
            const hasWeeks = generatedPlan?.weeks && Array.isArray(generatedPlan.weeks) && generatedPlan.weeks.length > 0;
            
            if (generatedPlan && (hasPlan28 || hasWeeks)) {
              clientLogger.log('✅ Home: Plan generated successfully', {
                hasPlan28,
                hasWeeks,
                plan28Days: generatedPlan?.plan28?.days?.length || 0,
                weeksCount: generatedPlan?.weeks?.length || 0,
              });
              // Очищаем счетчик попыток
              sessionStorage.removeItem(generateAttemptsKey);
              setCheckingPlan(false);
              // Вместо reload - просто перезагружаем данные через функцию loadRecommendations
              await loadRecommendations();
              return;
            } else {
              // План не сгенерировался - показываем экран без плана
              clientLogger.warn('⚠️ Home: Plan could not be generated or is empty', {
                hasPlan: !!generatedPlan,
                hasPlan28,
                hasWeeks,
                planKeys: generatedPlan ? Object.keys(generatedPlan) : [],
              });
              sessionStorage.removeItem(generateAttemptsKey);
              setCheckingPlan(false);
              setError('Не удалось создать план. Попробуйте обновить страницу или пройдите анкету заново.');
              setLoading(false);
              return;
            }
          } catch (genError: any) {
            // Ошибка генерации - показываем экран без плана
            clientLogger.warn('⚠️ Home: Error generating plan:', {
              error: genError?.message,
              status: genError?.status,
              stack: genError?.stack?.substring(0, 200),
            });
            sessionStorage.removeItem(generateAttemptsKey);
            setCheckingPlan(false);
            setError('Ошибка при создании плана. Попробуйте обновить страницу.');
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
      // ИСПРАВЛЕНО: Защита от множественных вызовов
      if (!progressLoadInProgressRef.current) {
        progressLoadInProgressRef.current = true;
      try {
        progress = await api.getPlanProgress() as { currentDay: number; completedDays: number[] };
      } catch (progressErr) {
        clientLogger.warn('⚠️ Home: Error loading progress (non-critical)', progressErr);
          progress = { currentDay: 1, completedDays: [] };
        } finally {
          progressLoadInProgressRef.current = false;
        }
      } else {
        // Если уже загружается, используем дефолтные значения
        progress = { currentDay: 1, completedDays: [] };
      }
      
      // ВАЖНО: Проверяем оба формата - новый (plan28) и старый (weeks)
      // План может быть в новом формате (plan28) или старом (weeks)
      const hasPlan28 = planData?.plan28 && planData.plan28.days && planData.plan28.days.length > 0;
      const hasWeeks = planData?.weeks && Array.isArray(planData.weeks) && planData.weeks.length > 0;
      
      clientLogger.log('📊 Home: Plan validation', {
        hasPlanData: !!planData,
        hasPlan28,
        hasWeeks,
        plan28DaysCount: planData?.plan28?.days?.length || 0,
        weeksCount: planData?.weeks?.length || 0,
        planDataKeys: planData ? Object.keys(planData) : [],
      });
      
      if (!planData || (!hasPlan28 && !hasWeeks)) {
        clientLogger.log('⚠️ Home: Plan not found or invalid format, showing "Start quiz" screen');
        setLoading(false);
        return;
      }
      
      // ВАЖНО: Проверяем, что plan28 существует перед использованием
      if (!hasPlan28) {
        // Если план есть, но в старом формате - пытаемся сгенерировать новый
        if (hasWeeks) {
          clientLogger.log('⚠️ Home: Plan in old format (weeks), attempting to regenerate...');
          const regenerateAttemptsKey = 'plan_regenerate_attempts';
          const regenerateAttempts = parseInt(sessionStorage.getItem(regenerateAttemptsKey) || '0', 10);
          
          if (regenerateAttempts >= 2) {
            clientLogger.warn('⚠️ Too many regeneration attempts, showing old format or redirecting to quiz');
            sessionStorage.removeItem(regenerateAttemptsKey);
            // Показываем экран "Start quiz" или можно показать старый формат
            setLoading(false);
            return;
          } else {
            try {
              // ИСПРАВЛЕНО: Показываем лоадер во время регенерации плана
              setCheckingPlan(true);
              clientLogger.log('🔄 Home: Regenerating plan from old format...');
              
              sessionStorage.setItem(regenerateAttemptsKey, String(regenerateAttempts + 1));
              const generatedPlan = await api.generatePlan() as any;
              
              // ИСПРАВЛЕНО: Проверяем оба формата плана
              const hasPlan28 = generatedPlan?.plan28 && generatedPlan.plan28.days && generatedPlan.plan28.days.length > 0;
              const hasWeeks = generatedPlan?.weeks && Array.isArray(generatedPlan.weeks) && generatedPlan.weeks.length > 0;
              
              if (generatedPlan && (hasPlan28 || hasWeeks)) {
                clientLogger.log('✅ Home: Plan regenerated', {
                  hasPlan28,
                  hasWeeks,
                  plan28Days: generatedPlan?.plan28?.days?.length || 0,
                  weeksCount: generatedPlan?.weeks?.length || 0,
                });
                sessionStorage.removeItem(regenerateAttemptsKey);
                setCheckingPlan(false);
                // Вместо reload - просто перезагружаем данные
                await loadRecommendations();
                return;
              } else {
                sessionStorage.removeItem(regenerateAttemptsKey);
                setLoading(false);
                return;
              }
            } catch (regenerateError) {
              clientLogger.warn('⚠️ Could not regenerate plan:', regenerateError);
              sessionStorage.removeItem(regenerateAttemptsKey);
              setLoading(false);
              return;
            }
          }
        } else {
          // План не в новом формате и не в старом - показываем экран "Start quiz"
          clientLogger.log('⚠️ Home: Plan exists but has no valid format');
          setLoading(false);
          return;
        }
      }
      
      // Теперь мы знаем, что plan28 существует
      const currentDay = progress?.currentDay || 1;
      const plan28 = planData.plan28;
      
      // Проверяем, что plan28 имеет структуру days
      if (!plan28 || !plan28.days || !Array.isArray(plan28.days) || plan28.days.length === 0) {
        console.error('❌ Home: plan28 has invalid structure', {
          hasPlan28: !!plan28,
          hasDays: !!plan28?.days,
          daysLength: plan28?.days?.length || 0,
        });
        setLoading(false);
        return;
      }
      
      // ВАЖНО: Используем ту же логику, что и календарь - находим день по dayIndex
      // Календарь использует: plan28.days.find(d => d.dayIndex === selectedDay)
      let currentDayPlan = plan28.days.find((d: any) => d.dayIndex === currentDay);
      if (!currentDayPlan) {
        clientLogger.log('⚠️ Home: Current day plan not found for day', currentDay, ', using day 1');
        // Вместо редиректа на анкету, пробуем использовать день 1 (как в календаре)
        const day1Plan = plan28.days.find((d: any) => d.dayIndex === 1);
        if (!day1Plan) {
          console.error('❌ Home: No plan found for day 1 either');
          setLoading(false);
          return;
        }
        // Используем план дня 1
        currentDayPlan = day1Plan;
      }
      
      // ВАЖНО: Собираем productId точно так же, как календарь (строки 170-186 в calendar/page.tsx)
      // Календарь также собирает alternatives, но для главной страницы используем только основные продукты
      const allProductIds = new Set<number>();
      currentDayPlan.morning.forEach((step: any) => {
        if (step.productId) allProductIds.add(Number(step.productId));
        // ВАЖНО: Календарь также собирает alternatives, но для главной достаточно основных продуктов
      });
      currentDayPlan.evening.forEach((step: any) => {
        if (step.productId) allProductIds.add(Number(step.productId));
      });
      currentDayPlan.weekly.forEach((step: any) => {
        if (step.productId) allProductIds.add(Number(step.productId));
      });
      
      clientLogger.log('✅ Home: Using same logic as calendar - day plan found', {
        currentDay,
        dayIndex: currentDayPlan.dayIndex,
        morningSteps: currentDayPlan.morning?.length || 0,
        eveningSteps: currentDayPlan.evening?.length || 0,
        weeklySteps: currentDayPlan.weekly?.length || 0,
        totalProductIds: allProductIds.size,
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
            
            clientLogger.log('✅ Home: Products loaded from plan', {
              requestedIds: allProductIds.size,
              loadedProducts: productsMap.size,
              missingProducts: Array.from(allProductIds).filter(id => !productsMap.has(id)),
            });
            
            // Проверяем, что все продукты загружены
            const missingProducts = Array.from(allProductIds).filter(id => !productsMap.has(id));
            if (missingProducts.length > 0) {
              clientLogger.warn('⚠️ Home: Some products not found in database', {
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
        clientLogger.warn('⚠️ Home: No product IDs found for current day', { currentDay });
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
      
      // ВАЖНО: Сохраняем plan28 и продукты для использования с PlanCalendar и DayView
      // Как в календаре - загружаем ВСЕ продукты из всех дней плана
      const allPlanProductIds = new Set<number>();
      plan28.days.forEach((day: DayPlan) => {
        day.morning.forEach(step => {
          if (step.productId) allPlanProductIds.add(Number(step.productId));
          step.alternatives.forEach(alt => allPlanProductIds.add(Number(alt)));
        });
        day.evening.forEach(step => {
          if (step.productId) allPlanProductIds.add(Number(step.productId));
          step.alternatives.forEach(alt => allPlanProductIds.add(Number(alt)));
        });
        day.weekly.forEach(step => {
          if (step.productId) allPlanProductIds.add(Number(step.productId));
          step.alternatives.forEach(alt => allPlanProductIds.add(Number(alt)));
        });
      });

      // Загружаем все продукты из плана (как в календаре)
      const allProductsMap = new Map<number, any>();
      if (allPlanProductIds.size > 0) {
        try {
          const allProductsResponse = await fetch('/api/products/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Init-Data': typeof window !== 'undefined' ? (window.Telegram?.WebApp?.initData || '') : '',
            },
            body: JSON.stringify({ productIds: Array.from(allPlanProductIds) }),
          });

          if (allProductsResponse.ok) {
            const allProductsData = await allProductsResponse.json();
            allProductsData.products?.forEach((p: any) => {
              if (p && p.id) {
                allProductsMap.set(p.id, {
                  id: p.id,
                  name: p.name || 'Неизвестный продукт',
                  brand: { name: p.brand?.name || p.brand || 'Unknown' },
                  price: p.price || null,
                  imageUrl: p.imageUrl || null,
                  description: p.descriptionUser || p.description || null,
                });
              }
            });
            clientLogger.log('✅ Home: All products loaded from plan (like calendar)', {
              requestedIds: allPlanProductIds.size,
              loadedProducts: allProductsMap.size,
            });
          }
        } catch (err) {
          console.error('❌ Home: Error loading all products', err);
        }
      }

      // Сохраняем данные для календаря
      setPlan28(plan28);
      setProducts(allProductsMap);
      setCurrentDay(currentDay);
      setSelectedDay(currentDay);
      setCompletedDays(progress?.completedDays || []);

      // Загружаем wishlist и корзину (как в календаре)
      try {
        const wishlistData = await api.getWishlist() as any;
        const wishlistIds = (wishlistData.items || []).map((item: any) => 
          item.product?.id || item.productId
        ).filter((id: any): id is number => typeof id === 'number');
        setWishlistProductIds(new Set(wishlistIds));
      } catch (err) {
        clientLogger.warn('Could not load wishlist:', err);
      }

      try {
        const cart = await api.getCart() as { items?: Array<{ product: { id: number }; quantity: number }> };
        const items = cart.items || [];
        const quantitiesMap = new Map<number, number>();
        items.forEach((item) => {
          quantitiesMap.set(item.product.id, item.quantity);
        });
        setCartQuantities(quantitiesMap);
      } catch (err) {
        clientLogger.warn('Could not load cart:', err);
      }

      setError(null);
      planCheckDoneRef.current = true;
      setHasPlan(true);
      setLoading(false);
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
        clientLogger.log('ℹ️ Profile not found (404), redirecting to quiz');
        router.push('/quiz');
        return;
      }
      
      if (error?.message?.includes('Unauthorized') || error?.message?.includes('401') || error?.message?.includes('initData')) {
        // Ошибка идентификации - перенаправляем на анкету
        clientLogger.log('ℹ️ Unauthorized, redirecting to quiz');
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
          clientLogger.log('✅ Plan exists, redirecting to /plan');
          router.push('/plan');
          return;
        }
      } catch (planError) {
        // Не удалось загрузить план - продолжаем с ошибкой
        clientLogger.warn('⚠️ Could not load plan:', planError);
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
    // ИСПРАВЛЕНО: Защита от множественных вызовов
    if (progressLoadInProgressRef.current) {
      return;
    }
    progressLoadInProgressRef.current = true;
    
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
                clientLogger.warn('Could not parse saved steps:', e);
              }
            }
          }
        }
      } catch (err) {
        clientLogger.warn('Could not load plan progress:', err);
      } finally {
        progressLoadInProgressRef.current = false;
      }
    };
    
    // ИСПРАВЛЕНО: Защита от множественных вызовов
    if (mounted && recommendations && !loading) {
      loadPlanProgress();
    } else {
      progressLoadInProgressRef.current = false;
    }
  }, [mounted, recommendations, loading]);


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
      // ИСПРАВЛЕНО: Защита от множественных вызовов
      if (otherAllCompleted && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData && !progressLoadInProgressRef.current) {
        progressLoadInProgressRef.current = true;
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
          clientLogger.warn('Could not save completed day:', err);
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
    // ИСПРАВЛЕНО: Защита от повторных проверок и множественных вызовов
    if (planCheckDoneRef.current || checkingPlan || hasPlan) {
      return;
    }
    
    // ИСПРАВЛЕНО: Проверяем план только если рекомендации не загружены И нет загрузки
    // Это предотвращает множественные вызовы при изменении состояния
    if ((routineItemsLength === 0 || (routineItemsLength > 0 && !recommendations)) && !loading && !checkingPlan && !hasPlan) {
      clientLogger.log('🔍 Checking if plan exists...');
      planCheckDoneRef.current = true; // Помечаем, что проверка началась
      
      const checkPlan = async () => {
        setCheckingPlan(true);
        try {
          // ИСПРАВЛЕНО: Добавляем таймаут для проверки плана, чтобы не ждать бесконечно
          const PLAN_CHECK_TIMEOUT = 10000; // 10 секунд
          const checkPromise = api.getPlan() as Promise<any>;
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Plan check timeout')), PLAN_CHECK_TIMEOUT)
          );
          
          const plan = await Promise.race([checkPromise, timeoutPromise]) as any;
          
          // ИСПРАВЛЕНО: Проверяем, что план действительно валидный перед редиректом
          const hasPlan28 = plan?.plan28 && plan.plan28.days && Array.isArray(plan.plan28.days) && plan.plan28.days.length > 0;
          const hasWeeks = plan?.weeks && Array.isArray(plan.weeks) && plan.weeks.length > 0;
          
          if (plan && (hasPlan28 || hasWeeks)) {
            // ИСПРАВЛЕНО: Проверяем, является ли план фолбековым перед редиректом
            // Если план фолбековый (rule.name === 'Базовые рекомендации'), не редиректим
            // Пользователь должен иметь возможность пройти анкету заново для получения правильного плана
            let isFallbackPlan = false;
            try {
              const recommendationsData = await api.getRecommendations() as any;
              if (recommendationsData?.rule?.name === 'Базовые рекомендации') {
                isFallbackPlan = true;
                clientLogger.warn('⚠️ Plan is fallback (Базовые рекомендации), not redirecting to /plan', {
                  ruleName: recommendationsData.rule?.name,
                });
              }
            } catch (recError) {
              // Если не удалось проверить рекомендации, продолжаем с проверкой плана
              clientLogger.warn('⚠️ Could not check recommendations for fallback detection:', recError);
            }
            
            if (!isFallbackPlan) {
              // ИСПРАВЛЕНО: Проверяем, что план не пустой (минимум 3 продукта)
              // Если в плане меньше 3 продуктов, не редиректим - план неполный
              let uniqueProductsCount = 0;
              if (plan?.plan28?.days && Array.isArray(plan.plan28.days)) {
                const productIds = new Set<number>();
                for (const day of plan.plan28.days) {
                  if (day.morning) {
                    for (const step of day.morning) {
                      if (step.productId) productIds.add(Number(step.productId));
                    }
                  }
                  if (day.evening) {
                    for (const step of day.evening) {
                      if (step.productId) productIds.add(Number(step.productId));
                    }
                  }
                  if (day.weekly) {
                    for (const step of day.weekly) {
                      if (step.productId) productIds.add(Number(step.productId));
                    }
                  }
                }
                uniqueProductsCount = productIds.size;
              }
              
              if (uniqueProductsCount >= 3) {
                clientLogger.log('✅ Plan found (not fallback, has enough products), redirecting to /plan', {
                  hasPlan28,
                  hasWeeks,
                  plan28Days: plan?.plan28?.days?.length || 0,
                  uniqueProductsCount,
                });
                setHasPlan(true);
                // Если план найден и не фолбековый и содержит достаточно продуктов - редиректим на страницу плана
                // Используем window.location для гарантированного редиректа
                if (typeof window !== 'undefined') {
                  window.location.href = '/plan';
                }
                return;
              } else {
                clientLogger.warn('⚠️ Plan found but has too few products, not redirecting', {
                  hasPlan28,
                  hasWeeks,
                  plan28Days: plan?.plan28?.days?.length || 0,
                  uniqueProductsCount,
                });
                // План неполный - не редиректим, показываем главную страницу
                // Пользователь может пройти анкету заново для получения полного плана
              }
            } else {
              clientLogger.log('ℹ️ Plan is fallback, staying on home page');
              // План фолбековый - не редиректим, показываем главную страницу
              // Пользователь может пройти анкету заново для получения правильного плана
            }
          } else {
            clientLogger.log('ℹ️ Plan not found or empty', {
              hasPlan: !!plan,
              hasPlan28,
              hasWeeks,
              planKeys: plan ? Object.keys(plan) : [],
            });
            // НЕ сбрасываем planCheckDoneRef, чтобы не делать повторные запросы
            // План не найден - это нормально, не проверяем снова
          }
        } catch (err: any) {
          // ИСПРАВЛЕНО: Если таймаут или план не найден, не показываем ошибку
          // Просто завершаем проверку
          if (err?.message?.includes('timeout')) {
            clientLogger.warn('⚠️ Plan check timeout - plan may still be generating');
          } else {
            clientLogger.log('ℹ️ Plan check failed (expected if no plan):', err?.message || err);
          }
          // НЕ сбрасываем planCheckDoneRef, чтобы не делать повторные запросы
          // План не найден - это нормально, не проверяем снова
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
    
    // ИСПРАВЛЕНО: Если план найден, но рекомендаций нет - НЕ показываем только "Переход к плану..."
    // Вместо этого показываем обычный контент главной страницы (рекомендации или экран начала)
    // Редирект на /plan уже выполняется в useEffect, поэтому не нужно показывать промежуточный экран
    // if (hasPlan) {
    //   return (
    //     <div style={{ padding: '20px', textAlign: 'center' }}>
    //       <div style={{ color: '#0A5F59', fontSize: '16px' }}>Переход к плану...</div>
    //     </div>
    //   );
    // }
    
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
            onClick={() => {
              // ВАЖНО: Очищаем флаги перепрохождения при нажатии "Пройти анкету" на главной
              // Это гарантирует, что пользователь пройдет полную анкету, а не увидит экран "что хотите изменить?"
              if (typeof window !== 'undefined') {
                localStorage.removeItem('is_retaking_quiz');
                localStorage.removeItem('full_retake_from_home');
                clientLogger.log('✅ Флаги перепрохождения очищены перед переходом на /quiz');
              }
              router.push('/quiz');
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

  // Обработчики для календаря (как в calendar/page.tsx)
  const handleDaySelect = (day: number) => {
    setSelectedDay(day);
  };

  const toggleWishlist = async (productId: number) => {
    try {
      const isInWishlist = wishlistProductIds.has(productId);
      
      if (isInWishlist) {
        await api.removeFromWishlist(productId);
        setWishlistProductIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        toast.success('Удалено из избранного');
      } else {
        await api.addToWishlist(productId);
        setWishlistProductIds(prev => new Set(prev).add(productId));
        toast.success('Добавлено в избранное');
      }
    } catch (err: any) {
      console.error('Error toggling wishlist:', err);
      toast.error(err?.message || 'Не удалось изменить избранное');
    }
  };

  const handleAddToCart = async (productId: number) => {
    try {
      await api.addToCart(productId, 1);
      toast.success('Добавлено в корзину');
      
      setCartQuantities((prev) => {
        const newMap = new Map(prev);
        const currentQty = newMap.get(productId) || 0;
        newMap.set(productId, currentQty + 1);
        return newMap;
      });
    } catch (err: any) {
      console.error('Error adding to cart:', err);
      toast.error(err?.message || 'Не удалось добавить в корзину');
    }
  };

  const handleReplace = async (stepCategory: string, productId: number) => {
    // TODO: реализовать замену продукта
    clientLogger.log('Replace product:', stepCategory, productId);
  };

  // Если план загружен - показываем календарь и DayView
  if (plan28 && plan28.days) {
    const selectedDayPlan = plan28.days.find(d => d.dayIndex === selectedDay);

    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        padding: '20px',
        paddingBottom: '100px',
      }}>
        {/* Календарь */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(10, 95, 89, 0.1)',
        }}>
          <PlanCalendar
            currentDay={currentDay}
            completedDays={completedDays}
            onDaySelect={handleDaySelect}
          />
        </div>

        {/* Отображение выбранного дня */}
        {selectedDayPlan && (
          <div style={{ marginBottom: '24px' }}>
            <DayView
              dayPlan={selectedDayPlan}
              mainGoals={plan28.mainGoals}
              products={products}
              wishlistProductIds={wishlistProductIds}
              cartQuantities={cartQuantities}
              onToggleWishlist={toggleWishlist}
              onAddToCart={handleAddToCart}
              onReplace={handleReplace}
            />
          </div>
        )}
      </div>
    );
  }

  // Если план не загружен - показываем старый интерфейс (fallback)
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
            clientLogger.warn('Logo not found');
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

      {/* PaymentGate для рекомендаций - показываем блюр для неоплаченных пользователей */}
      {routineItems.length > 0 ? (
        <PaymentGate
          key={paymentKey}
          price={199}
          isRetaking={false}
          onPaymentComplete={() => {
            // После оплаты обновляем состояние, чтобы снять блюр
            clientLogger.log('✅ Payment completed on home page, blur removed');
            // Обновляем ключ для принудительного перерендера PaymentGate
            setPaymentKey(prev => prev + 1);
          }}
        >
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
                    clientLogger.warn('Icon not found:', item.icon);
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
        </PaymentGate>
      ) : (
        // Если рекомендаций нет, показываем без PaymentGate
        <>
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
                    clientLogger.warn('Icon not found:', item.icon);
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
        </>
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
            // Устанавливаем флаг о полном перепрохождении анкеты с главной страницы
            // Это означает, что нужно пропустить экран выбора тем и сразу начать полное перепрохождение
            if (typeof window !== 'undefined') {
              localStorage.setItem('is_retaking_quiz', 'true');
              localStorage.setItem('full_retake_from_home', 'true'); // Флаг для полного перепрохождения с главной
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