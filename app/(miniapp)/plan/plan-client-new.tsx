// app/(miniapp)/plan/plan-client-new.tsx
// Обновленный Client Component для плана с использованием новых компонентов

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PlanHeader } from '@/components/PlanHeader';
import { PlanCalendar } from '@/components/PlanCalendar';
import { DayView } from '@/components/DayView';
import { GoalProgressInfographic } from '@/components/GoalProgressInfographic';
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
  products,
  wishlist,
  currentDay: initialCurrentDay,
  completedDays: initialCompletedDays,
}: PlanPageClientNewProps) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState(initialCurrentDay);
  const [wishlistProductIds, setWishlistProductIds] = useState<Set<number>>(new Set(wishlist));
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set(initialCompletedDays));
  const [completedMorning, setCompletedMorning] = useState(false);
  const [completedEvening, setCompletedEvening] = useState(false);

  const currentDayPlan = useMemo(() => {
    return plan28.days.find(d => d.dayIndex === selectedDay);
  }, [plan28.days, selectedDay]);

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
    } catch (err: any) {
      console.error('Error adding to cart:', err);
      toast.error(err?.message || 'Не удалось добавить в корзину');
    }
  };

  const handleReplace = async (stepCategory: string, oldProductId: number) => {
    try {
      if (typeof window === 'undefined' || !window.Telegram?.WebApp?.initData) {
        toast.error('Откройте приложение через Telegram Mini App');
        return;
      }

      // Находим альтернативы для этого шага
      const currentDayPlan = plan28.days.find(d => d.dayIndex === selectedDay);
      if (!currentDayPlan) {
        toast.error('День не найден');
        return;
      }

      // Ищем шаг с этим stepCategory
      const allSteps = [...currentDayPlan.morning, ...currentDayPlan.evening, ...currentDayPlan.weekly];
      const step = allSteps.find(s => s.stepCategory === stepCategory && s.productId === String(oldProductId));
      
      if (!step || step.alternatives.length === 0) {
        toast.error('Нет доступных альтернатив для замены');
        return;
      }

      // Показываем модалку выбора (пока просто берем первую альтернативу)
      // TODO: Создать компонент ReplaceProductModal для выбора из альтернатив
      const newProductId = Number(step.alternatives[0]);
      
      // Заменяем продукт через API
      await api.replaceProductInPlan(oldProductId, newProductId);
      
      toast.success('Продукт заменен');
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
      paddingBottom: '120px',
    }}>
      {/* Логотип */}
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
      </div>

      {/* Header с целями */}
      <PlanHeader mainGoals={plan28.mainGoals} />

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

      {/* Отображение выбранного дня */}
      <DayView
        dayPlan={currentDayPlan}
        mainGoals={plan28.mainGoals}
        products={products}
        wishlistProductIds={wishlistProductIds}
        onToggleWishlist={toggleWishlist}
        onAddToCart={handleAddToCart}
        onReplace={handleReplace}
        completedMorning={completedMorning}
        completedEvening={completedEvening}
        onCompleteMorning={handleCompleteMorning}
        onCompleteEvening={handleCompleteEvening}
      />

      {/* Нижняя навигация */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(28px)',
        borderTop: '1px solid rgba(10, 95, 89, 0.1)',
        padding: '12px 16px',
        zIndex: 50,
      }}>
        <div style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', gap: '12px' }}>
          <button
            onClick={() => router.push('/wishlist')}
            style={{
              flex: 1,
              backgroundColor: '#F3F4F6',
              padding: '16px',
              borderRadius: '16px',
              textAlign: 'center',
              fontWeight: 'bold',
              color: '#0A5F59',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Избранное ({wishlistProductIds.size})
          </button>
          <button
            onClick={() => router.push('/profile')}
            style={{
              flex: 1,
              backgroundColor: '#9333EA',
              padding: '16px',
              borderRadius: '16px',
              textAlign: 'center',
              fontWeight: 'bold',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Профиль кожи
          </button>
        </div>
      </div>
    </div>
  );
}

