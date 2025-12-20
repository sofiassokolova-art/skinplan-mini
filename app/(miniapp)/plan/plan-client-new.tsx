// app/(miniapp)/plan/plan-client-new.tsx
// Обновленный Client Component для плана с использованием новых компонентов

'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlanHeader } from '@/components/PlanHeader';
import { DayView } from '@/components/DayView';
import { PlanCalendar } from '@/components/PlanCalendar';
import { GoalProgressInfographic } from '@/components/GoalProgressInfographic';
import { PlanInfographic } from '@/components/PlanInfographic';
import { FeedbackBlock } from '@/components/FeedbackBlock';
import { PaymentGate } from '@/components/PaymentGate';
import { ReplaceProductModal } from '@/components/ReplaceProductModal';
import { AllProductsList } from '@/components/AllProductsList';
import { SkinIssuesCarousel } from '@/components/SkinIssuesCarousel';
import { api } from '@/lib/api';
import { useAddToWishlist, useRemoveFromWishlist } from '@/hooks/useWishlist';
import { useAddToCart } from '@/hooks/useCart';
import toast from 'react-hot-toast';
import type { Plan28, DayPlan } from '@/lib/plan-types';
import { getPhaseForDay, getPhaseLabel } from '@/lib/plan-types';
import { clientLogger } from '@/lib/client-logger';

interface PlanPageClientNewProps {
  plan28: Plan28;
  products: Map<number, {
    id: number;
    name: string;
    brand: { name: string };
    price?: number;
    imageUrl?: string | null;
    description?: string;
  }>;
  wishlist: number[];
  currentDay: number;
  completedDays: number[];
  planExpired?: boolean; // Флаг истечения плана (28+ дней)
}

export function PlanPageClientNew({
  plan28,
  products: productsProp,
  wishlist,
  currentDay: initialCurrentDay,
  completedDays: initialCompletedDays,
  planExpired = false,
}: PlanPageClientNewProps) {
  // Защита от undefined products
  const products = productsProp || new Map();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Состояние для проблем кожи
  const [skinIssues, setSkinIssues] = useState<any[]>([]);
  
  // Состояние для информации о пользователе
  const [userInfo, setUserInfo] = useState<{
    skinType?: string | null;
  } | null>(null);
  
  // Состояние для имени пользователя
  const [userName, setUserName] = useState<string | null>(null);
  
  // Загружаем проблемы кожи и информацию о пользователе при монтировании
  useEffect(() => {
    const loadSkinIssues = async () => {
      try {
        const analysisData = await api.getAnalysis();
        if (analysisData?.issues && Array.isArray(analysisData.issues)) {
          setSkinIssues(analysisData.issues);
        }
      } catch (err) {
        // Игнорируем ошибки - проблемы не критичны для отображения плана
        clientLogger.warn('Could not load skin issues:', err);
      }
    };
    
    const loadUserInfo = async () => {
      try {
        const profile = await api.getCurrentProfile();
        if (profile) {
          // ИСПРАВЛЕНО: Используем функции форматирования для единообразия
          const { formatSkinType } = await import('@/lib/format-helpers');
          
          // Форматируем тип кожи: приоритет profile.skinTypeRu, затем profile.skinType
          const skinType = profile.skinTypeRu 
            ? formatSkinType(profile.skinTypeRu) 
            : formatSkinType(profile.skinType);
          
          setUserInfo({
            skinType,
          });
        }
      } catch (err) {
        clientLogger.warn('Could not load user info:', err);
      }
    };
    
    const loadUserName = async () => {
      try {
        // ИСПРАВЛЕНО: Имя всегда берется с сервера, не из localStorage
        // Приоритет: ответ USER_NAME > профиль
        // Сначала проверяем кэш ответов пользователя (быстрее, чем запрос к API)
        const cachedAnswers = typeof window !== 'undefined' ? localStorage.getItem('user_answers_cache') : null;
        if (cachedAnswers) {
          try {
            const userAnswers = JSON.parse(cachedAnswers);
            if (Array.isArray(userAnswers)) {
              const nameAnswer = userAnswers.find((a: any) => a.question?.code === 'USER_NAME');
              if (nameAnswer && nameAnswer.answerValue && String(nameAnswer.answerValue).trim().length > 0) {
                const userNameFromAnswer = String(nameAnswer.answerValue).trim();
                setUserName(userNameFromAnswer);
                clientLogger.log('✅ User name loaded from cached answers:', userNameFromAnswer);
                return;
              }
            }
          } catch (parseError) {
            // Если кэш поврежден, игнорируем и продолжаем
            clientLogger.log('⚠️ Failed to parse cached answers, will fetch from API');
          }
        }
        
        // Если кэша ответов нет, запрашиваем ответы из API
        const userAnswers = await api.getUserAnswers() as any;
        if (userAnswers && Array.isArray(userAnswers)) {
          // Сохраняем ответы в кэш для будущих запросов
          if (typeof window !== 'undefined') {
            localStorage.setItem('user_answers_cache', JSON.stringify(userAnswers));
          }
          
          const nameAnswer = userAnswers.find((a: any) => a.question?.code === 'USER_NAME');
          if (nameAnswer && nameAnswer.answerValue && String(nameAnswer.answerValue).trim().length > 0) {
            const userNameFromAnswer = String(nameAnswer.answerValue).trim();
            setUserName(userNameFromAnswer);
            clientLogger.log('✅ User name loaded from USER_NAME answer:', userNameFromAnswer);
            return;
          }
        }
        // Если имени нет в ответах, пробуем из профиля
        const userProfile = await api.getUserProfile();
        if (userProfile?.firstName) {
          setUserName(userProfile.firstName);
          clientLogger.log('✅ User name loaded from profile:', userProfile.firstName);
        }
      } catch (err: any) {
        // ИСПРАВЛЕНО: Не логируем 429 и 405 ошибки как warning
        // 429 - это нормально при rate limiting
        // 405 - может быть временной проблемой с endpoint
        if (err?.status !== 429 && err?.status !== 405) {
          clientLogger.warn('Could not load user name:', err);
        } else if (err?.status === 405) {
          // HTTP 405 - логируем только в development, это проблема с endpoint
          if (process.env.NODE_ENV === 'development') {
            clientLogger.warn('HTTP 405 when loading user name - check endpoint:', err);
          }
        }
      }
    };
    
    loadSkinIssues();
    loadUserInfo();
    loadUserName();
  }, []);
  
  // Инициализируем selectedDay без зависимости от searchParams в useState
  // searchParams будет обработан в useEffect
  const [selectedDay, setSelectedDay] = useState(initialCurrentDay);
  const [wishlistProductIds, setWishlistProductIds] = useState<Set<number>>(new Set(wishlist));
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set(initialCompletedDays));
  const [completedMorning, setCompletedMorning] = useState(false);
  const [completedEvening, setCompletedEvening] = useState(false);
  const [cartQuantities, setCartQuantities] = useState<Map<number, number>>(new Map());
  // ИСПРАВЛЕНО: needsFirstPayment должен быть false по умолчанию - убираем блюр для покупки
  // Платеж не должен показываться автоматически при первой генерации плана
  const [needsFirstPayment, setNeedsFirstPayment] = useState(false);

  const currentDayPlan = useMemo(() => {
    // ИСПРАВЛЕНО: Ищем день по dayIndex, с защитой от undefined
    const day = plan28.days.find(d => d.dayIndex === selectedDay);
    if (!day) {
      clientLogger.warn('Day not found for selectedDay:', {
        selectedDay,
        availableDays: plan28.days.map(d => d.dayIndex).slice(0, 10),
        totalDays: plan28.days.length,
      });
      // Возвращаем первый день как fallback
      return plan28.days[0] || null;
    }
    return day;
  }, [plan28.days, selectedDay]);

  // Обновляем выбранный день при изменении параметра в URL
  // ВАЖНО: Обрабатываем searchParams в useEffect, а не в useState, чтобы избежать проблем с порядком хуков
  useEffect(() => {
    const dayFromUrl = searchParams?.get('day');
    if (dayFromUrl) {
      const day = parseInt(dayFromUrl, 10);
      if (day >= 1 && day <= 28) {
        setSelectedDay(day);
      }
    } else {
      // Если параметра нет, используем initialCurrentDay
      setSelectedDay(initialCurrentDay);
    }
  }, [searchParams, initialCurrentDay]);

  // ИСПРАВЛЕНО: Защита от множественных вызовов корзины
  const cartLoadInProgressRef = useRef(false);

  // Загружаем данные корзине при монтировании
  useEffect(() => {
    // ИСПРАВЛЕНО: Защита от множественных вызовов
    if (cartLoadInProgressRef.current) {
      return;
    }
    cartLoadInProgressRef.current = true;
    loadCart();
  }, [plan28]);

  // ИСПРАВЛЕНО: План - это платный продукт, поэтому PaymentGate показывается ВСЕГДА до оплаты
  // PaymentGate показывается если:
  // - Пользователь еще не оплатил план (проверяется через PaymentGate компонент)
  // - Это первая генерация плана или перепрохождение - нужна оплата
  // PaymentGate сам проверяет статус оплаты через localStorage и БД
  // Мы просто всегда показываем PaymentGate - он сам решит, нужен ли блюр

  const loadCart = async () => {
    // ИСПРАВЛЕНО: Защита от множественных вызовов
    if (cartLoadInProgressRef.current) {
      return;
    }
    cartLoadInProgressRef.current = true;
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
    } finally {
      cartLoadInProgressRef.current = false;
    }
  };


  const handleFeedbackSubmit = async (feedback: {
    isRelevant: boolean;
    reasons?: string[];
    comment?: string;
  }) => {
    try {
      await api.submitAnalysisFeedback({
        ...feedback,
        type: 'plan_recommendations', // Указываем тип отзыва
      });
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      toast.error(err?.message || 'Не удалось отправить отзыв');
      throw err; // Пробрасываем ошибку, чтобы FeedbackBlock мог обработать её
    }
  };

  // ИСПРАВЛЕНО: Используем React Query хуки для автоматической инвалидации кэша
  const addToWishlistMutation = useAddToWishlist();
  const removeFromWishlistMutation = useRemoveFromWishlist();
  const addToCartMutation = useAddToCart();

  const toggleWishlist = async (productId: number) => {
    try {
      if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
        toast.error('Откройте приложение через Telegram Mini App');
        return;
      }

      const isInWishlist = wishlistProductIds.has(productId);
      
      if (isInWishlist) {
        await removeFromWishlistMutation.mutateAsync(productId);
        setWishlistProductIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        toast.success('Удалено из избранного');
      } else {
        await addToWishlistMutation.mutateAsync(productId);
        setWishlistProductIds(prev => {
          const newSet = new Set(prev);
          newSet.add(productId);
          return newSet;
        });
        toast.success('Добавлено в избранное');
      }
    } catch (err: any) {
      console.error('Error toggling wishlist:', err);
      toast.error(err?.message || 'Не удалось изменить избранное');
    }
  };

  const handleAddToCart = async (productId: number) => {
    try {
      if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
        toast.error('Откройте приложение через Telegram Mini App');
        return;
      }

      // ИСПРАВЛЕНО: Используем React Query хук для автоматической инвалидации кэша
      await addToCartMutation.mutateAsync({ productId, quantity: 1 });
      toast.success('Добавлено в корзину');
      
      // Обновляем количество в корзине
      setCartQuantities((prev) => {
        const newMap = new Map(prev);
        const currentQty = newMap.get(productId) || 0;
        newMap.set(productId, currentQty + 1);
        return newMap;
      });
      
      // Перезагружаем корзину для актуальных данных
      await loadCart();
    } catch (err: any) {
      console.error('Error adding to cart:', err);
      toast.error(err?.message || 'Не удалось добавить в корзину');
    }
  };

  const [replaceProduct, setReplaceProduct] = useState<{
    id: number;
    name: string;
    brand: { name: string };
    price: number | null;
    imageUrl: string | null;
  } | null>(null);

  const handleReplace = (stepCategory: string, oldProductId: number) => {
    // Проверяем, что products является Map
    if (!(products instanceof Map)) {
      console.error('❌ products is not a Map instance:', typeof products);
      toast.error('Ошибка: данные продуктов не загружены');
      return;
    }
    
    // Находим продукт в productsMap для показа в модалке
    const product = products.get(oldProductId);
    if (!product) {
      toast.error('Продукт не найден');
      return;
    }
    
    // Показываем модалку замены
    setReplaceProduct({
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: product.price ?? null, // Преобразуем undefined в null
      imageUrl: product.imageUrl ?? null, // Преобразуем undefined в null
    });
  };

  const handleReplaceConfirm = async (oldProductId: number, newProductId: number) => {
    try {
      if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
        toast.error('Откройте приложение через Telegram Mini App');
        return;
      }
      
      // Заменяем продукт через API
      await api.replaceProductInPlan(oldProductId, newProductId);
      
      toast.success('Продукт заменен');
      setReplaceProduct(null);
      router.refresh();
    } catch (err: any) {
      console.error('Error replacing product:', err);
      toast.error(err?.message || 'Не удалось заменить продукт');
    }
  };

  const handleCompleteMorning = async () => {
    setCompletedMorning(true);
    // Можно добавить логику сохранения прогресса
  };

  const handleCompleteEvening = async () => {
    setCompletedEvening(true);
    
    // Если и утро, и вечер выполнены - день завершен
    if (completedMorning) {
      const newCompleted = new Set(completedDays);
      newCompleted.add(selectedDay);
      setCompletedDays(newCompleted);

      const nextDay = Math.min(selectedDay + 1, 28);

      // Сохраняем прогресс
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
        try {
          await api.savePlanProgress(nextDay, Array.from(newCompleted));
        } catch (err: any) {
          clientLogger.warn('Ошибка сохранения прогресса:', err);
        }
      }

      toast.success('День завершен! ✨');
      
      if (selectedDay < 28) {
        setTimeout(() => {
          setSelectedDay(nextDay);
          setCompletedMorning(false);
          setCompletedEvening(false);
        }, 1500);
      }
    }
  };

  if (!currentDayPlan) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{ color: '#0A5F59', fontSize: '16px' }}>День не найден</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
      paddingBottom: '100px',
    }}>
      {/* Логотип */}
      <div style={{
        padding: '20px',
        textAlign: 'center',
        marginBottom: '20px',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-block',
          }}
        >
          <img
            src="/skiniq-logo.png"
            alt="SkinIQ"
            style={{
              height: '140px',
              marginTop: '8px',
              marginBottom: '8px',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          />
        </button>
      </div>

      {/* Header с целями */}
      <PlanHeader 
        mainGoals={plan28.mainGoals || []}
        userInfo={userInfo || undefined}
        userName={userName}
      />

      {/* Основные проблемы кожи */}
      {skinIssues.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <SkinIssuesCarousel issues={skinIssues} />
        </div>
      )}

      {/* ИСПРАВЛЕНО: PaymentGate показывается ВСЕГДА - план это платный продукт */}
      {/* PaymentGate сам проверяет статус оплаты и показывает блюр только если не оплачено */}
      <PaymentGate
        price={199}
        productCode="plan_access"
        isRetaking={typeof window !== 'undefined' ? 
          (localStorage.getItem('is_retaking_quiz') === 'true' || 
           localStorage.getItem('full_retake_from_home') === 'true') : false}
        onPaymentComplete={() => {
          setNeedsFirstPayment(false);
          clientLogger.log('✅ Payment completed on plan page');
        }}
        retakeCta={planExpired ? { text: 'Изменились цели? Перепройти анкету', href: '/quiz' } : undefined}
      >
        {/* Контент внутри PaymentGate (показывается с блюром до оплаты, без блюра после оплаты) */}
        {/* Инфографика плана */}
        <PlanInfographic 
          plan28={plan28} 
          products={products}
          wishlistProductIds={wishlistProductIds}
          cartQuantities={cartQuantities}
          onToggleWishlist={toggleWishlist}
          onAddToCart={handleAddToCart}
          onReplace={(product) => {
            // Обертка для handleReplace - передаем только productId, stepCategory не нужен для PlanInfographic
            handleReplace('', product.id);
          }}
        />

        {/* Инфографика прогресса по целям */}
        <GoalProgressInfographic
          goals={plan28.mainGoals}
          currentDay={selectedDay}
        />

        {/* Календарь */}
        <div style={{ marginBottom: '24px' }}>
          <PlanCalendar
            currentDay={initialCurrentDay}
            completedDays={Array.from(completedDays)}
            onDaySelect={(day) => {
              setSelectedDay(day);
              // Прокручиваем к DayView при выборе дня
              setTimeout(() => {
                const dayViewElement = document.getElementById(`day-view-${day}`);
                if (dayViewElement) {
                  dayViewElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 100);
            }}
          />
        </div>

        {/* Отображение выбранного дня */}
        {currentDayPlan && (
          <div id={`day-view-${selectedDay}`} style={{ marginBottom: '24px' }}>
            <DayView
              dayPlan={currentDayPlan}
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

        {/* Блок обратной связи в конце страницы */}
        <div style={{ marginTop: '48px', marginBottom: '24px' }}>
          <FeedbackBlock onSubmit={handleFeedbackSubmit} feedbackType="plan_recommendations" />
        </div>

        {/* Модалка замены продукта */}
        <ReplaceProductModal
          product={replaceProduct}
          isOpen={!!replaceProduct}
          onClose={() => setReplaceProduct(null)}
          onReplace={handleReplaceConfirm}
        />
      </PaymentGate>
    </div>
  );
}

