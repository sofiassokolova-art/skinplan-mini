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
}

export function PlanPageClientNew({
  plan28,
  products: productsProp,
  wishlist,
  currentDay: initialCurrentDay,
  completedDays: initialCompletedDays,
}: PlanPageClientNewProps) {
  // Защита от undefined products
  const products = productsProp || new Map();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Состояние для проблем кожи
  const [skinIssues, setSkinIssues] = useState<any[]>([]);
  
  // Состояние для информации о пользователе
  const [userInfo, setUserInfo] = useState<{
    gender?: string | null;
    age?: string | null;
    skinType?: string | null;
    mainConcern?: string | null;
  } | null>(null);
  
  // Загружаем проблемы кожи и информацию о пользователе при монтировании
  useEffect(() => {
    const loadSkinIssues = async () => {
      try {
        const analysisData = await api.getAnalysis() as any;
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
        const profile = await api.getCurrentProfile() as any;
        if (profile) {
          // Получаем пол и возраст из ответов
          const analysis = await api.getAnalysis() as any;
          const gender = analysis?.gender || null;
          const age = analysis?.age ? `${analysis.age} лет` : profile.ageGroup || null;
          const skinType = profile.skinTypeRu || profile.skinType || null;
          const mainConcern = plan28.mainGoals?.[0] || null;
          
          setUserInfo({
            gender: gender === 'female' ? 'Девушка' : gender === 'male' ? 'Парень' : null,
            age,
            skinType,
            mainConcern,
          });
        }
      } catch (err) {
        clientLogger.warn('Could not load user info:', err);
      }
    };
    
    loadSkinIssues();
    loadUserInfo();
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

  // ИСПРАВЛЕНО: Убрана автоматическая проверка needsFirstPayment - блюр не должен показываться автоматически
  // Платеж должен показываться только при явном запросе пользователя
  // useEffect(() => {
  //   // Проверяем статус первой оплаты (обновляем при изменении plan28)
  //   // ВАЖНО: НЕ устанавливаем автоматически payment_first_completed при наличии плана
  //   // Платеж должен быть показан при первом прохождении анкеты, даже если план уже сгенерирован
  //   if (typeof window !== 'undefined' && plan28 && plan28.days && plan28.days.length > 0) {
  //     const hasFirstPayment = localStorage.getItem('payment_first_completed') === 'true';
  //     const newNeedsFirstPayment = !hasFirstPayment;
  //     
  //     clientLogger.log('💳 Payment status check (update on plan28 change):', {
  //       hasFirstPayment,
  //       needsFirstPayment: newNeedsFirstPayment,
  //       paymentKey: 'payment_first_completed',
  //       hasPlan28: !!plan28,
  //       plan28Days: plan28?.days?.length || 0,
  //       plan28MainGoals: plan28?.mainGoals?.length || 0,
  //     });
  //     
  //     // ИСПРАВЛЕНО: Обновляем needsFirstPayment только если значение изменилось
  //     // Это предотвращает лишние ре-рендеры
  //     // ВАЖНО: При первой генерации плана (когда plan28 появляется) нужно обновить needsFirstPayment
  //     setNeedsFirstPayment(prev => {
  //       if (prev !== newNeedsFirstPayment) {
  //         clientLogger.log('💳 Updating needsFirstPayment:', {
  //           from: prev,
  //           to: newNeedsFirstPayment,
  //           reason: 'plan28 changed or initialized',
  //         });
  //         return newNeedsFirstPayment;
  //       }
  //       return prev;
  //     });
  //   } else if (typeof window !== 'undefined' && !plan28) {
  //     // ИСПРАВЛЕНО: Если plan28 еще не загружен, не меняем needsFirstPayment
      // Это предотвращает преждевременное скрытие блюра
      clientLogger.log('💳 Plan28 not ready yet, keeping current needsFirstPayment state');
    }
  }, [plan28]);

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

  const toggleWishlist = async (productId: number) => {
    try {
      if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
        toast.error('Откройте приложение через Telegram Mini App');
        return;
      }

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
      if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
        toast.error('Откройте приложение через Telegram Mini App');
        return;
      }

      await api.addToCart(productId, 1);
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
        mainGoals={plan28.mainGoals}
        userInfo={userInfo || undefined}
      />

      {/* Основные проблемы кожи */}
      {skinIssues.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <SkinIssuesCarousel issues={skinIssues} />
        </div>
      )}

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

      {/* ИСПРАВЛЕНО: Убран PaymentGate - блюр для покупки не должен показываться автоматически */}
      {/* Основной контент плана - показываем контент сразу без блюра */}
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
    </div>
  );
}

