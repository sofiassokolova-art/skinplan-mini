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
  const [dailyTip, setDailyTip] = useState<string | null>(null);
  const [loadingTip, setLoadingTip] = useState(false);
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
          console.warn('⚠️ Telegram WebApp не доступен, перенаправляем на анкету');
          setRedirectingToQuiz(true); // Устанавливаем флаг перед редиректом
          setLoading(false);
          router.push('/quiz');
          return;
        }
        
        console.log('✅ Telegram WebApp available, proceeding with initialization');

        // СНАЧАЛА проверяем наличие профиля (самая надежная проверка)
        console.log('🔍 Step 1: Checking for existing profile...');
        setHasCheckedProfile(true); // Помечаем, что начали проверку профиля
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
            // ВАЖНО: Если профиля нет, сразу редиректим на /quiz без показа "Загрузка плана..."
            console.log('ℹ️ No profile found, redirecting to quiz immediately');
            setRedirectingToQuiz(true);
            setLoading(false);
            router.push('/quiz');
            return;
          } else {
            // Другая ошибка (сеть, авторизация и т.д.) - логируем, но продолжаем
            console.warn('⚠️ Error checking profile:', errorMessage);
            hasProfile = false;
          }
        }
        
        // ВАЖНО: Если профиля нет после проверки, сразу редиректим на /quiz
        // без показа "Загрузка плана..."
        if (!hasProfile) {
          console.log('ℹ️ No profile found after check, redirecting to quiz immediately');
          setRedirectingToQuiz(true);
          setLoading(false);
          router.push('/quiz');
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
            // loadRecommendations уже обработал ошибку и вызвал setLoading(false)
            // Если произошел редирект или установлена ошибка, просто завершаем
          }
          // Убеждаемся что loading установлен в false
          setLoading(false);
          return; // Завершаем инициализацию
        }

        // Если профиля нет - сразу перенаправляем на анкету
        // НЕ показываем экран "Вы не завершили анкету" на главной странице
        // Этот экран должен быть только на странице анкеты
        console.log('ℹ️ No profile found, redirecting to quiz immediately');
        setRedirectingToQuiz(true); // Устанавливаем флаг перед редиректом
        setLoading(false); // Убеждаемся, что loading = false
        router.push('/quiz');
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
        // НО: если это 404 (профиль не найден), не показываем ошибку, а перенаправляем
        if (err?.status === 404 || err?.isNotFound || 
            err?.message?.includes('404') || 
            err?.message?.includes('Not found') ||
            err?.message?.includes('No skin profile') ||
            err?.message?.includes('Profile not found')) {
          console.log('ℹ️ Profile not found in initAndLoad, redirecting to quiz');
          // ВАЖНО: Устанавливаем loading = false перед редиректом, чтобы не показывать "Загрузка плана..."
          setRedirectingToQuiz(true); // Устанавливаем флаг перед редиректом
          setLoading(false);
          router.push('/quiz');
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
      // Вместо этого пытаемся перенаправить на план или анкету
      if (err?.status === 404 || err?.isNotFound || 
          err?.message?.includes('404') || 
          err?.message?.includes('Not found') ||
          err?.message?.includes('No skin profile') ||
          err?.message?.includes('Profile not found')) {
        console.log('ℹ️ Profile not found in catch, redirecting to quiz');
        router.push('/quiz');
        setLoading(false);
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
      // Если это 404 (профиль не найден), перенаправляем на анкету
      if (err?.status === 404 || err?.isNotFound || 
          err?.message?.includes('404') || 
          err?.message?.includes('Not found') ||
          err?.message?.includes('No skin profile') ||
          err?.message?.includes('Profile not found')) {
        console.log('ℹ️ Profile not found in catch, redirecting to quiz');
        router.push('/quiz');
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
      // ДОПОЛНИТЕЛЬНАЯ ЗАЩИТА: проверяем наличие профиля перед загрузкой рекомендаций
      console.log('🔍 loadRecommendations: Checking profile before loading...');
      try {
        const profile = await api.getCurrentProfile();
        if (!profile || !(profile as any).id) {
          console.log('⚠️ loadRecommendations: No profile found, redirecting to quiz');
          router.push('/quiz');
          return;
        }
        console.log('✅ loadRecommendations: Profile confirmed, proceeding...');
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
          router.push('/quiz');
          return;
        }
        // Другая ошибка - логируем, но продолжаем (может быть временная проблема)
        console.warn('⚠️ loadRecommendations: Error checking profile, but continuing:', errorMessage);
      }
      
      console.log('📥 Loading recommendations...');
      let data: Recommendation;
      try {
        data = await api.getRecommendations() as Recommendation;
        console.log('✅ Recommendations loaded:', { hasData: !!data, hasSteps: !!data?.steps });
      } catch (recErr: any) {
        console.error('❌ Error loading recommendations API:', recErr);
        // Если ошибка при загрузке рекомендаций, проверяем план
        try {
          const plan = await api.getPlan() as any;
          if (plan && (plan.plan28 || plan.weeks)) {
            console.log('✅ Plan exists, redirecting to /plan');
            // Устанавливаем loading в false перед редиректом
            setLoading(false);
            // Используем window.location для гарантированного редиректа
            if (typeof window !== 'undefined') {
              window.location.href = '/plan';
            } else {
              router.push('/plan');
            }
            return;
          }
        } catch (planError) {
          console.warn('⚠️ Could not load plan:', planError);
        }
        // Если план не найден, пробрасываем ошибку дальше
        throw recErr;
      }
      
      // Проверяем, что данные валидны и содержат хотя бы один шаг
      if (!data || !data.steps || Object.keys(data.steps).length === 0) {
        console.log('⚠️ Invalid or empty recommendations data:', { 
          hasData: !!data, 
          hasSteps: !!data?.steps, 
          stepsCount: data?.steps ? Object.keys(data.steps).length : 0 
        });
        // Если рекомендации пустые, проверяем план
        try {
          const plan = await api.getPlan() as any;
          if (plan && (plan.plan28 || plan.weeks)) {
            console.log('✅ Plan exists, redirecting to /plan');
            setLoading(false);
            if (typeof window !== 'undefined') {
              window.location.href = '/plan';
            } else {
              router.push('/plan');
            }
            return;
          }
        } catch (planError) {
          console.warn('⚠️ Could not load plan:', planError);
        }
        // Если план тоже не найден, редиректим на анкету
        router.push('/quiz');
        return;
      }
      
      setRecommendations(data);
      setError(null); // Очищаем ошибку при успешной загрузке
      planCheckDoneRef.current = true; // Помечаем, что рекомендации загружены, проверка плана не нужна
      console.log('✅ Recommendations set in state');
      
      // Преобразуем рекомендации в RoutineItem[] раздельно для утра и вечера
      const morning: RoutineItem[] = [];
      const evening: RoutineItem[] = [];
      
      // УТРЕННЯЯ РУТИНА
      if (data?.steps?.cleanser) {
        morning.push({
          id: 'morning-cleanser',
          title: 'Очищение',
          subtitle: getProductFullName(data.steps.cleanser[0]) || 'Очищающее средство',
          icon: ICONS.cleanser,
          howto: {
            steps: ['Смочите лицо тёплой водой', '1–2 нажатия геля в ладони', 'Массируйте 30–40 сек', 'Смойте, промокните полотенцем'],
            volume: 'Гель: 1–2 пшика',
            tip: 'Если кожа сухая утром — можно умыться только водой.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.toner) {
        morning.push({
          id: 'morning-toner',
          title: 'Тонер',
          subtitle: getProductFullName(data.steps.toner[0]) || 'Тоник',
          icon: ICONS.toner,
          howto: {
            steps: ['Нанесите 3–5 капель на руки', 'Распределите похлопывающими движениями', 'Дайте впитаться 30–60 сек'],
            volume: '3–5 капель',
            tip: 'Избегайте ватных дисков — тратите меньше продукта.',
          },
          done: false,
        });
      }
      
      // Проверяем treatment, serum, или essence для утреннего актива
      if (data?.steps?.treatment || data?.steps?.serum || data?.steps?.essence) {
        const activeProduct = data.steps.treatment?.[0] || data.steps.serum?.[0] || data.steps.essence?.[0];
        morning.push({
          id: 'morning-active',
          title: 'Актив',
          subtitle: getProductFullName(activeProduct) || 'Активное средство',
          icon: ICONS.serum,
          howto: {
            steps: ['1–2 пипетки на сухую кожу', 'Наносите на T‑зону и щеки', 'Подождите 1–2 минуты до крема'],
            volume: '4–6 капель',
            tip: 'Если есть раздражение — пропустите актив на день.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.moisturizer) {
        morning.push({
          id: 'morning-cream',
          title: 'Крем',
          subtitle: getProductFullName(data.steps.moisturizer[0]) || 'Увлажняющий крем',
          icon: ICONS.cream,
          howto: {
            steps: ['Горох крема распределить по лицу', 'Мягко втереть по массажным линиям'],
            volume: 'Горошина',
            tip: 'Не забывайте шею и линию подбородка.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.spf) {
        morning.push({
          id: 'morning-spf',
          title: 'SPF-защита',
          subtitle: getProductFullName(data.steps.spf[0]) || 'SPF 50',
          icon: ICONS.spf,
          howto: {
            steps: ['Нанести 2 пальца SPF (лицо/шея)', 'Обновлять каждые 2–3 часа на улице'],
            volume: '~1.5–2 мл',
            tip: 'При UV > 3 — обязательно SPF даже в облачную погоду.',
          },
          done: false,
        });
      }
      
      // ВЕЧЕРНЯЯ РУТИНА
      if (data?.steps?.cleanser) {
        evening.push({
          id: 'evening-cleanser',
          title: 'Очищение',
          subtitle: getProductFullName(data.steps.cleanser[0]) || 'Двойное очищение',
          icon: ICONS.cleanser,
          howto: {
            steps: ['1) Масло: сухими руками распределить, эмульгировать водой', '2) Гель: умыть 30–40 сек, смыть'],
            volume: '1–2 дозы масла + 1–2 пшика геля',
            tip: 'Двойное очищение — в дни макияжа/кислот.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.treatment || data?.steps?.acid) {
        const acidProduct = data.steps?.treatment?.[0] || data.steps?.acid?.[0];
        evening.push({
          id: 'evening-acid',
          title: 'Кислоты (по расписанию)',
          subtitle: getProductFullName(acidProduct) || 'AHA/BHA/PHА пилинг',
          icon: ICONS.acid,
          howto: {
            steps: ['Нанести тонким слоем на Т‑зону', 'Выдержать 5–10 минут (по переносимости)', 'Смыть/нейтрализовать, далее крем'],
            volume: 'Тонкий слой',
            tip: 'При покраснении — пауза 3–5 дней.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.treatment || data?.steps?.serum) {
        const serumProduct = data.steps?.treatment?.[0] || data.steps?.serum?.[0];
        evening.push({
          id: 'evening-serum',
          title: 'Сыворотка',
          subtitle: getProductFullName(serumProduct) || 'Пептидная / успокаивающая',
          icon: ICONS.serum,
          howto: {
            steps: ['3–6 капель', 'Равномерно нанести, дать впитаться 1 мин'],
            volume: '3–6 капель',
            tip: 'В дни кислот сыворотка — без кислот/ретинола.',
          },
          done: false,
        });
      }
      
      if (data?.steps?.moisturizer) {
        evening.push({
          id: 'evening-cream',
          title: 'Крем',
          subtitle: getProductFullName(data.steps.moisturizer[0]) || 'Питательный крем',
          icon: ICONS.cream,
          howto: {
            steps: ['Горох крема', 'Распределить, не втирая сильно'],
            volume: 'Горошина',
            tip: 'Если сухо — добавьте каплю масла локально.',
          },
          done: false,
        });
      }
      
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

  // Загружаем ежедневный совет
  useEffect(() => {
    const loadDailyTip = async () => {
      if (!mounted || !recommendations || loadingTip) return;
      
      // Проверяем, загружали ли мы совет сегодня
      if (typeof window !== 'undefined') {
        const lastTipDate = localStorage.getItem('daily_tip_date');
        const today = new Date().toDateString();
        
        if (lastTipDate === today) {
          // Совет уже загружен сегодня, берем из localStorage
          const savedTip = localStorage.getItem('daily_tip');
          if (savedTip) {
            setDailyTip(savedTip);
            return;
          }
        }
      }

      try {
        setLoadingTip(true);
        const profile = await api.getCurrentProfile() as any;
        const progress = await api.getPlanProgress() as any;
        
        const currentProducts = [
          ...(recommendations.steps.cleanser?.[0]?.name || []),
          ...(recommendations.steps.toner?.[0]?.name || []),
          ...(recommendations.steps.serum?.[0]?.name || []),
          ...(recommendations.steps.moisturizer?.[0]?.name || []),
          ...(recommendations.steps.spf?.[0]?.name || []),
        ].filter(Boolean);

        const tipData = await api.getDailyTip({
          currentDay: progress?.currentDay || 1,
          skinType: profile?.skinType || recommendations?.profile_summary?.skinType,
          concerns: (profile?.medicalMarkers as any)?.concerns || [],
          currentProducts,
        });

        if (tipData?.tip) {
          setDailyTip(tipData.tip);
          // Сохраняем в localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('daily_tip', tipData.tip);
            localStorage.setItem('daily_tip_date', new Date().toDateString());
          }
        }
      } catch (err) {
        console.warn('Could not load daily tip:', err);
        // Не критично - просто не показываем виджет
      } finally {
        setLoadingTip(false);
      }
    };

    if (mounted && recommendations && !loading) {
      loadDailyTip();
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
    // Если мы уже проверили профиль и его нет, показываем "Загрузка анкеты..."
    // Иначе показываем "Загрузка плана..." (если профиль есть)
    const loadingText = hasCheckedProfile && !recommendations ? 'Загрузка анкеты...' : 'Загрузка плана...';
    
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
    
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Нет рекомендаций</h1>
        <p>Пройдите анкету, чтобы получить персональные рекомендации</p>
        <button
          onClick={() => router.push('/quiz')}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Пройти анкету
        </button>
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
      {/* Виджет ежедневного совета */}
      {dailyTip && (
        <div style={{
          margin: '20px',
          marginBottom: '24px',
          padding: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          border: '1px solid rgba(10, 95, 89, 0.1)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#0A5F59',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '20px',
            }}>
              💡
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#0A5F59',
                margin: '0 0 8px 0',
              }}>
                Совет дня
              </h3>
              <p style={{
                fontSize: '14px',
                lineHeight: '1.5',
                color: '#475467',
                margin: 0,
              }}>
                {dailyTip}
              </p>
            </div>
          </div>
        </div>
      )}
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
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
              marginTop: '16px',
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
            📅 28-дневный план →
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
              marginTop: '16px',
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: 'rgba(10, 95, 89, 0.1)',
              color: '#0A5F59',
              border: '2px solid #0A5F59',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
          >
            🔄 Перепройти анкету
          </button>
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
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>Как использовать:</h4>
              <ol style={{ paddingLeft: '20px' }}>
                {selectedItem.howto.steps.map((step, i) => (
                  <li key={i} style={{ marginBottom: '8px', color: '#475467' }}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <div style={{ marginBottom: '16px', color: '#475467', fontSize: '14px' }}>
              <strong>Объём:</strong> {selectedItem.howto.volume}
            </div>
            <div style={{ color: '#0A5F59', fontSize: '14px', fontStyle: 'italic' }}>
              💡 {selectedItem.howto.tip}
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