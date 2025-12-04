// app/(miniapp)/plan/plan-client-new.tsx
// Обновленный Client Component для плана с использованием новых компонентов

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlanHeader } from '@/components/PlanHeader';
import { PlanCalendar } from '@/components/PlanCalendar';
import { DayView } from '@/components/DayView';
import { GoalProgressInfographic } from '@/components/GoalProgressInfographic';
import { FeedbackBlock } from '@/components/FeedbackBlock';
import { PaymentGate } from '@/components/PaymentGate';
import { ReplaceProductModal } from '@/components/ReplaceProductModal';
import { AllProductsList } from '@/components/AllProductsList';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import type { Plan28, DayPlan } from '@/lib/plan-types';

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
  const [selectedDay, setSelectedDay] = useState(initialCurrentDay);
  const [wishlistProductIds, setWishlistProductIds] = useState<Set<number>>(new Set(wishlist));
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set(initialCompletedDays));
  const [completedMorning, setCompletedMorning] = useState(false);
  const [completedEvening, setCompletedEvening] = useState(false);
  const [cartQuantities, setCartQuantities] = useState<Map<number, number>>(new Map());
  const [needsFirstPayment, setNeedsFirstPayment] = useState(false);

  const currentDayPlan = useMemo(() => {
    return plan28.days.find(d => d.dayIndex === selectedDay);
  }, [plan28.days, selectedDay]);

  // Загружаем данные корзине при монтировании
  useEffect(() => {
    loadCart();
    // Проверяем статус первой оплаты
    // ВАЖНО: НЕ устанавливаем автоматически payment_first_completed при наличии плана
    // Платеж должен быть показан при первом прохождении анкеты, даже если план уже сгенерирован
    if (typeof window !== 'undefined') {
      const hasFirstPayment = localStorage.getItem('payment_first_completed') === 'true';
      setNeedsFirstPayment(!hasFirstPayment);
    }
  }, [plan28]);

  const loadCart = async () => {
    try {
      const cart = await api.getCart() as { items?: Array<{ product: { id: number }; quantity: number }> };
      const items = cart.items || [];
      const quantitiesMap = new Map<number, number>();
      items.forEach((item) => {
        quantitiesMap.set(item.product.id, item.quantity);
      });
      setCartQuantities(quantitiesMap);
    } catch (err) {
      console.warn('Could not load cart:', err);
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
          console.warn('Ошибка сохранения прогресса:', err);
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
      {/* Header с целями */}
      <PlanHeader mainGoals={plan28.mainGoals} />

      {/* Основной контент плана - обернут в PaymentGate только при первой оплате */}
      {needsFirstPayment ? (
        <PaymentGate
          price={199}
          isRetaking={false}
          onPaymentComplete={() => {
            // После оплаты обновляем страницу
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }}
        >
          {/* Инфографика прогресса по целям */}
          <GoalProgressInfographic
            goals={plan28.mainGoals}
            currentDay={selectedDay}
          />

          {/* Календарная навигация */}
          <div style={{ marginBottom: '24px' }}>
            <PlanCalendar
              currentDay={selectedDay}
              completedDays={Array.from(completedDays)}
              onDaySelect={setSelectedDay}
            />
          </div>

          {/* Переключатель между днем и всеми продуктами */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          }}>
            <button
              onClick={() => setShowAllProducts(false)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: !showAllProducts ? '#0A5F59' : 'transparent',
                color: !showAllProducts ? 'white' : '#6B7280',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              День {selectedDay}
            </button>
            <button
              onClick={() => setShowAllProducts(true)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: showAllProducts ? '#0A5F59' : 'transparent',
                color: showAllProducts ? 'white' : '#6B7280',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Все средства
            </button>
          </div>

          {/* Отображение выбранного дня или всех продуктов */}
          {showAllProducts ? (
            <AllProductsList
              plan28={plan28}
              products={products}
              wishlistProductIds={wishlistProductIds}
              cartQuantities={cartQuantities}
              onToggleWishlist={toggleWishlist}
              onAddToCart={handleAddToCart}
            />
          ) : (
            <DayView
              dayPlan={currentDayPlan}
              mainGoals={plan28.mainGoals}
              products={products}
              wishlistProductIds={wishlistProductIds}
              cartQuantities={cartQuantities}
              onToggleWishlist={toggleWishlist}
              onAddToCart={handleAddToCart}
              onReplace={handleReplace}
              // Чекбоксы "Выполнено" не нужны на странице плана - они только на главной
            />
          )}

          {/* Блок обратной связи в конце страницы */}
          <div style={{ marginTop: '48px', marginBottom: '24px' }}>
            <FeedbackBlock onSubmit={handleFeedbackSubmit} feedbackType="plan_recommendations" />
          </div>
        </PaymentGate>
      ) : (
        <>
          {/* Инфографика прогресса по целям */}
          <GoalProgressInfographic
            goals={plan28.mainGoals}
            currentDay={selectedDay}
          />

          {/* Календарная навигация */}
          <div style={{ marginBottom: '24px' }}>
            <PlanCalendar
              currentDay={selectedDay}
              completedDays={Array.from(completedDays)}
              onDaySelect={setSelectedDay}
            />
          </div>

          {/* Переключатель между днем и всеми продуктами */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          }}>
            <button
              onClick={() => setShowAllProducts(false)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: !showAllProducts ? '#0A5F59' : 'transparent',
                color: !showAllProducts ? 'white' : '#6B7280',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              День {selectedDay}
            </button>
            <button
              onClick={() => setShowAllProducts(true)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: showAllProducts ? '#0A5F59' : 'transparent',
                color: showAllProducts ? 'white' : '#6B7280',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Все средства
            </button>
          </div>

          {/* Отображение выбранного дня или всех продуктов */}
          {showAllProducts ? (
            <AllProductsList
              plan28={plan28}
              products={products}
              wishlistProductIds={wishlistProductIds}
              cartQuantities={cartQuantities}
              onToggleWishlist={toggleWishlist}
              onAddToCart={handleAddToCart}
            />
          ) : (
            <DayView
              dayPlan={currentDayPlan}
              mainGoals={plan28.mainGoals}
              products={products}
              wishlistProductIds={wishlistProductIds}
              cartQuantities={cartQuantities}
              onToggleWishlist={toggleWishlist}
              onAddToCart={handleAddToCart}
              onReplace={handleReplace}
              // Чекбоксы "Выполнено" не нужны на странице плана - они только на главной
            />
          )}

          {/* Блок обратной связи в конце страницы */}
          <div style={{ marginTop: '48px', marginBottom: '24px' }}>
            <FeedbackBlock onSubmit={handleFeedbackSubmit} feedbackType="plan_recommendations" />
          </div>
        </>
      )}

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

