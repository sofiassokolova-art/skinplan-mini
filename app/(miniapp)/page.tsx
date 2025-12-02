// app/(miniapp)/page.tsx
// Главная страница мини-аппа (рутина ухода) - миграция из Home.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';
import PlanFeedbackPopup from '@/components/PlanFeedbackPopup';

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
  const { initialize, isAvailable } = useTelegram();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation | null>(null);
  const [morningItems, setMorningItems] = useState<RoutineItem[]>([]);
  const [eveningItems, setEveningItems] = useState<RoutineItem[]>([]);
  const [tab, setTab] = useState<'AM' | 'PM'>('AM');
  const [selectedItem, setSelectedItem] = useState<RoutineItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResumeScreen, setShowResumeScreen] = useState(false);
  const [savedProgress, setSavedProgress] = useState<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>(null);
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);

  // Проверка незавершённой анкеты (объявляем до использования)
  const checkIncompleteQuiz = async (): Promise<boolean> => {
    try {
      // СНАЧАЛА проверяем, есть ли уже профиль кожи (анкета завершена)
      // Это самая надежная проверка - если профиль есть, анкета точно завершена
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        try {
          // Пробуем загрузить профиль напрямую - это более надежный способ проверки
          const profile = await api.getCurrentProfile();
          
          // Если профиль загрузился, значит анкета завершена
          // Очищаем весь прогресс (локально и состояние)
          if (profile && (profile as any).id) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('quiz_progress');
            }
            setSavedProgress(null);
            setShowResumeScreen(false);
            console.log('✅ Quiz completed, profile exists:', (profile as any).id);
            return false; // Анкета завершена, нет незавершенной анкеты
          }
        } catch (err: any) {
          // Проверяем, какая именно ошибка
          const errorMessage = err?.message || err?.toString() || '';
          
          // Если 404 или "No skin profile" - значит анкета не завершена, продолжаем проверку прогресса
          if (errorMessage.includes('404') || 
              errorMessage.includes('No skin profile') ||
              errorMessage.includes('Skin profile not found') ||
              errorMessage.includes('Profile not found')) {
            console.log('ℹ️ No profile found, checking for incomplete quiz...');
            // Продолжаем проверку прогресса ниже
          } else {
            // Другая ошибка (сеть, авторизация и т.д.) - логируем
            console.warn('⚠️ Error checking profile:', errorMessage);
            // Продолжаем проверку прогресса, так как ошибка может быть временной
          }
        }
      }

      // Если профиля нет, проверяем незавершённую анкету
      // Сначала очищаем localStorage, если там остался старый прогресс
      if (typeof window !== 'undefined') {
        const savedProgressStr = localStorage.getItem('quiz_progress');
        if (savedProgressStr) {
          try {
            const progress = JSON.parse(savedProgressStr);
            // Проверяем, не старый ли это прогресс (больше 24 часов)
            if (progress.timestamp && Date.now() - progress.timestamp > 24 * 60 * 60 * 1000) {
              localStorage.removeItem('quiz_progress');
              console.log('🗑️ Removed old quiz progress from localStorage (>24h)');
            } else if (progress.answers && Object.keys(progress.answers).length > 0) {
              // Проверяем на сервере, есть ли уже профиль
              // Если профиль есть, очищаем локальный прогресс
              if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
                try {
                  const serverProgress = await api.getQuizProgress() as {
                    progress?: {
                      answers: Record<number, string | string[]>;
                      questionIndex: number;
                      infoScreenIndex: number;
                    } | null;
                  };
                  
                  // Если сервер не возвращает прогресс (null), значит профиль есть или прогресс очищен
                  if (!serverProgress?.progress) {
                    localStorage.removeItem('quiz_progress');
                    setSavedProgress(null);
                    setShowResumeScreen(false);
                    console.log('✅ Server has no progress, clearing local progress');
                    return false;
                  }
                  
                  // Если сервер возвращает прогресс, используем его (более актуальный)
                  if (serverProgress.progress && serverProgress.progress.answers && Object.keys(serverProgress.progress.answers).length > 0) {
                    setSavedProgress(serverProgress.progress);
                    setShowResumeScreen(true);
                    setLoading(false);
                    return true; // Есть незавершенная анкета
                  }
                } catch (err) {
                  // Игнорируем ошибки загрузки прогресса с сервера
                }
              }
              
              // Если серверный прогресс недоступен, используем локальный
              setSavedProgress(progress);
              setShowResumeScreen(true);
              setLoading(false);
              return true; // Есть незавершенная анкета
            }
          } catch (e) {
            // Игнорируем ошибки парсинга
            localStorage.removeItem('quiz_progress');
          }
        }
      }

      // Проверяем на сервере (только если Telegram WebApp доступен)
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        try {
          // Сначала еще раз проверяем наличие профиля через API прогресса
          // (API прогресса уже проверяет наличие профиля и возвращает null, если профиль есть)
          const response = await api.getQuizProgress() as {
            progress?: {
              answers: Record<number, string | string[]>;
              questionIndex: number;
              infoScreenIndex: number;
            } | null;
          };
          
          // Если сервер не возвращает прогресс (null), значит профиль есть или прогресс очищен
          // Это означает, что анкета завершена
          if (!response || !response.progress) {
            // Очищаем локальный прогресс тоже
            if (typeof window !== 'undefined') {
              localStorage.removeItem('quiz_progress');
            }
            setSavedProgress(null);
            setShowResumeScreen(false);
            console.log('✅ No progress from server - quiz completed or no progress');
            return false; // Анкета завершена или нет прогресса
          }
          
          // Если есть прогресс и есть ответы - показываем экран продолжения
          if (response.progress && response.progress.answers && Object.keys(response.progress.answers).length > 0) {
            // Сохраняем в localStorage для офлайн доступа
            if (typeof window !== 'undefined') {
              localStorage.setItem('quiz_progress', JSON.stringify({
                ...response.progress,
                timestamp: Date.now(),
              }));
            }
            setSavedProgress(response.progress);
            setShowResumeScreen(true);
            setLoading(false);
            console.log('ℹ️ Incomplete quiz found:', Object.keys(response.progress.answers).length, 'answers');
            return true; // Есть незавершенная анкета
          }
        } catch (err) {
          // Игнорируем ошибки загрузки прогресса - продолжаем загрузку рекомендаций
          console.warn('⚠️ Error loading quiz progress from server:', err);
        }
      }
      
      // Нет незавершенной анкеты, можно загружать рекомендации
      // Очищаем локальный прогресс на всякий случай
      if (typeof window !== 'undefined') {
        localStorage.removeItem('quiz_progress');
      }
      setSavedProgress(null);
      setShowResumeScreen(false);
      return false;
    } catch (err) {
      // В случае ошибки продолжаем загрузку рекомендаций
      console.error('❌ Error in checkIncompleteQuiz:', err);
      return false;
    }
  };

  useEffect(() => {
    console.log('🚀 HomePage useEffect started');
    setMounted(true);
    
    // Проверяем доступность Telegram WebApp
    console.log('📱 Checking Telegram WebApp:', {
      hasWindow: typeof window !== 'undefined',
      hasTelegram: typeof window !== 'undefined' && !!window.Telegram,
      hasWebApp: typeof window !== 'undefined' && !!window.Telegram?.WebApp,
      hasInitData: typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData,
      initDataLength: typeof window !== 'undefined' && window.Telegram?.WebApp?.initData?.length || 0,
    });
    
    initialize();
    console.log('✅ Telegram WebApp initialized');
    
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
          router.push('/quiz');
          return;
        }
        
        console.log('✅ Telegram WebApp available, proceeding with initialization');

        // Сначала проверяем, есть ли незавершенная анкета
        console.log('🔍 Checking for incomplete quiz...');
        const hasIncompleteQuiz = await checkIncompleteQuiz();
        console.log('✅ checkIncompleteQuiz result:', hasIncompleteQuiz);
        
        // Если есть незавершенная анкета, не загружаем рекомендации
        if (hasIncompleteQuiz) {
          console.log('ℹ️ Incomplete quiz found, stopping initialization');
          return;
        }
        
        console.log('✅ No incomplete quiz, proceeding to load recommendations');

        // Загружаем рекомендации (initData передается автоматически в запросе)
        // Если профиля нет (404), loadRecommendations перенаправит на /quiz
        console.log('🔄 Starting loadRecommendations...');
        await loadRecommendations();
        console.log('✅ loadRecommendations completed, checking if we should show feedback popup...');
        
        // Проверяем, нужно ли показывать поп-ап с отзывом (раз в неделю)
        // Только если рекомендации загрузились успешно и нет ошибки
        // Используем setTimeout, чтобы дать React обновить состояние
        setTimeout(async () => {
          if (!error && recommendations) {
            console.log('✅ Recommendations loaded, checking feedback popup...');
            await checkFeedbackPopup();
          } else {
            console.log('⚠️ Skipping feedback popup check:', { error, hasRecommendations: !!recommendations });
          }
        }, 100);
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

  const resumeQuiz = () => {
    router.push('/quiz');
  };

  const startOver = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('quiz_progress');
    }
    setShowResumeScreen(false);
    setSavedProgress(null);
    router.push('/quiz');
  };

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
      console.log('📥 Loading recommendations...');
      const data = await api.getRecommendations() as Recommendation;
      console.log('✅ Recommendations loaded:', { hasData: !!data, hasSteps: !!data?.steps });
      
      // Проверяем, что данные валидны
      if (!data || !data.steps) {
        console.log('⚠️ Invalid recommendations data, redirecting to quiz');
        router.push('/quiz');
        return;
      }
      
      setRecommendations(data);
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
      
      // Другие ошибки - показываем сообщение только если это не связано с отсутствием профиля
      console.error('❌ Unexpected error loading recommendations:', error);
      setError(error?.message || 'Ошибка загрузки рекомендаций');
      setMorningItems([]);
      setEveningItems([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (itemId: string) => {
    if (tab === 'AM') {
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
  };

  // Устанавливаем query параметр для скрытия навигации (вынесено на верхний уровень)
  useEffect(() => {
    if (showResumeScreen && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('resume', 'true');
      window.history.replaceState({}, '', url.toString());
    } else if (!showResumeScreen && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('resume');
      window.history.replaceState({}, '', url.toString());
    }
  }, [showResumeScreen]);

  // Экран незавершенной анкеты
  if (showResumeScreen && savedProgress) {
    const answeredCount = Object.keys(savedProgress.answers).length;
    // Используем реальное количество вопросов из анкеты, если доступно, иначе 22
    const totalQuestions = 22; // Можно улучшить, загрузив анкету
    const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

    return (
      <div style={{ 
        padding: '20px',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '88%',
          maxWidth: '420px',
          backgroundColor: 'rgba(255, 255, 255, 0.58)',
          backdropFilter: 'blur(26px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '44px',
          padding: '36px 28px 32px 28px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
        }}>
          <h1 style={{
            fontFamily: "'Satoshi', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            fontSize: '32px',
            lineHeight: '38px',
            color: '#0A5F59',
            margin: '0 0 16px 0',
            textAlign: 'center',
          }}>
            Вы не завершили анкету
          </h1>

          <p style={{
            fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: '1.5',
            color: '#475467',
            margin: '0 0 24px 0',
            textAlign: 'center',
          }}>
            Продолжите, чтобы получить персональный план ухода
          </p>

          <div style={{
            marginBottom: '28px',
            padding: '16px',
            backgroundColor: 'rgba(10, 95, 89, 0.08)',
            borderRadius: '16px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px',
              fontSize: '14px',
              color: '#0A5F59',
              fontWeight: 600,
            }}>
              <span>Прогресс</span>
              <span>{answeredCount} из {totalQuestions} вопросов</span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'rgba(10, 95, 89, 0.2)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: '#0A5F59',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>

          <div style={{
            marginBottom: '28px',
            padding: '0',
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#0A5F59',
              marginBottom: '12px',
            }}>
              Что вы получите:
            </h3>
            {[
              'Персональный план ухода на 12 недель',
              'Рекомендации от косметолога-дерматолога',
              'Точная диагностика типа и состояния кожи',
            ].map((benefit, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: index < 2 ? '12px' : '0',
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#0A5F59',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px',
                }}>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span style={{
                  fontSize: '15px',
                  color: '#1F2A44',
                  lineHeight: '1.5',
                }}>
                  {benefit}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <button
              onClick={resumeQuiz}
              style={{
                width: '100%',
                height: '64px',
                background: '#0A5F59',
                color: 'white',
                border: 'none',
                borderRadius: '32px',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 500,
                fontSize: '19px',
                boxShadow: '0 8px 24px rgba(10, 95, 89, 0.3), 0 4px 12px rgba(10, 95, 89, 0.2)',
                cursor: 'pointer',
              }}
            >
              Продолжить с вопроса {savedProgress.questionIndex + 1} →
            </button>
            
            <button
              onClick={startOver}
              style={{
                width: '100%',
                height: '48px',
                background: 'transparent',
                color: '#0A5F59',
                border: '1px solid rgba(10, 95, 89, 0.3)',
                borderRadius: '24px',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 500,
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Начать заново
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!mounted || loading) {
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

  // Получаем текущие элементы в зависимости от вкладки
  const routineItems = tab === 'AM' ? morningItems : eveningItems;
  
  if (error && routineItems.length === 0) {
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

  if (routineItems.length === 0) {
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
            onClick={() => router.push('/plan')}
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
            onClick={() => router.push('/quiz')}
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