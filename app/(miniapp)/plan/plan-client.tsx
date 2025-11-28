// app/(miniapp)/plan/plan-client.tsx
// Client Component для интерактивности страницы плана

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SkinInfographic } from '@/components/SkinInfographic';
import { WeekCalendar } from '@/components/WeekCalendar';
import { DayRoutine } from '@/components/DayRoutine';
import { ProgressHeader } from '@/components/ProgressHeader';
import { AddToCartButton } from '@/components/AddToCartButton';
import { ReplaceProductModal } from '@/components/ReplaceProductModal';
import { RecommendedProducts } from '@/components/RecommendedProducts';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

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
import { useRouter } from 'next/navigation';

interface PlanPageClientProps {
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
      days: Array<{
        dayNumber?: number;
        morning: number[];
        evening: number[];
      }>;
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
  onProgressUpdate?: (progress: {
    currentDay: number;
    currentWeek: number;
    completedDays: number[];
  }) => void;
}

export function PlanPageClient({
  user,
  profile,
  plan,
  planProducts,
  progress,
  wishlist,
  onProgressUpdate,
}: PlanPageClientProps) {
  const router = useRouter();
  const weeks = plan.weeks || [];
  const [activeTab, setActiveTab] = useState<'morning' | 'evening'>('morning');
  const [selectedWeek, setSelectedWeek] = useState(progress.currentWeek);
  const [wishlistProductIds, setWishlistProductIds] = useState<Set<number>>(
    new Set(wishlist)
  );
  const [completedDays, setCompletedDays] = useState<Set<number>>(
    new Set(progress.completedDays)
  );
  const [replaceProduct, setReplaceProduct] = useState<PlanProduct | null>(null);
  const [isCompletingDay, setIsCompletingDay] = useState(false);
  const planProductMap = useMemo(() => {
    const map = new Map<number, PlanProduct>();
    planProducts.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [planProducts]);

  useEffect(() => {
    setSelectedWeek(progress.currentWeek);
  }, [progress.currentWeek]);

  useEffect(() => {
    setWishlistProductIds(new Set(wishlist));
  }, [wishlist]);

  useEffect(() => {
    setCompletedDays(new Set(progress.completedDays));
  }, [progress.completedDays]);

  const currentWeekNumber = progress.currentWeek;
  const currentDayNumber = progress.currentDay;
  const totalDays = progress.totalDays || 28;

  const selectedWeekData =
    weeks.find((week) => week.week === selectedWeek) ??
    weeks.find((week) => week.week === currentWeekNumber) ??
    weeks[0];

  const isCurrentWeekSelected =
    selectedWeekData && selectedWeekData.week === currentWeekNumber;

  const selectedDayIndex =
    selectedWeekData && selectedWeekData.days.length > 0
      ? Math.min(
          isCurrentWeekSelected ? Math.max((currentDayNumber - 1) % 7, 0) : 0,
          selectedWeekData.days.length - 1
        )
      : 0;

  const selectedDayData = selectedWeekData?.days[selectedDayIndex];
  const morningSteps = selectedDayData?.morning ?? [];
  const eveningSteps = selectedDayData?.evening ?? [];
  const displayDayNumber =
    selectedDayData?.dayNumber ??
    ((selectedWeekData?.week ?? 1) - 1) * 7 + selectedDayIndex + 1;
  const headingDayNumber = isCurrentWeekSelected ? currentDayNumber : displayDayNumber;
  const headingWeekNumber = selectedWeekData?.week ?? currentWeekNumber;
  const canCompleteDay =
    !!selectedWeekData &&
    isCurrentWeekSelected &&
    !isCompletingDay &&
    currentDayNumber <= totalDays;

  const completeCurrentDay = async () => {
    if (!isCurrentWeekSelected) {
      toast.error('Вернитесь к текущей неделе, чтобы отметить прогресс');
      return;
    }
    if (isCompletingDay) return;
    if (currentDayNumber > totalDays) return;

    setIsCompletingDay(true);
    try {
      const updatedSet = new Set(completedDays);
      updatedSet.add(currentDayNumber);
      const updatedArray = Array.from(updatedSet)
        .filter((day) => day >= 1 && day <= totalDays)
        .sort((a, b) => a - b);

      const nextDay = Math.min(currentDayNumber + 1, totalDays);
      await api.updatePlanProgress({
        currentDay: nextDay,
        completedDays: updatedArray,
      });

      setCompletedDays(new Set(updatedArray));
      onProgressUpdate?.({
        currentDay: nextDay,
        currentWeek: Math.min(Math.ceil(nextDay / 7), weeks.length || 1),
        completedDays: updatedArray,
      });

      toast.success(
        nextDay > currentDayNumber ? 'День завершен! ✨' : 'План завершен 🎉'
      );

      if (typeof window !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(200);
      }

      if (nextDay !== currentDayNumber) {
        const nextWeek = Math.min(Math.ceil(nextDay / 7), weeks.length || 1);
        setSelectedWeek(nextWeek);
        setActiveTab('morning');
      }
    } catch (err: any) {
      console.error('Error updating progress:', err);
      toast.error(err?.message || 'Не удалось сохранить прогресс');
    } finally {
      setIsCompletingDay(false);
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

  const openReplaceModal = (product: PlanProduct) => {
    setReplaceProduct(product);
  };

  const handleReplace = async (oldProductId: number, newProductId: number) => {
    try {
      await api.replaceProductInPlan(oldProductId, newProductId);
      toast.success('Продукт заменен в плане');
      setReplaceProduct(null);
      router.refresh();
    } catch (err: any) {
      console.error('Error replacing product:', err);
      toast.error('Не удалось заменить продукт');
    }
  };

  const renderRoutine = (productIds: number[]) => {
    if (productIds.length === 0) {
      return (
        <div style={{ color: '#6B7280', fontSize: '15px' }}>
          Нет продуктов для этого блока
        </div>
      );
    }

    return productIds.map((productId, index) => {
      const product = planProductMap.get(productId);
      if (!product) return null;

      const isNew = product.firstIntroducedDay === displayDayNumber;
      const isInWishlist = wishlistProductIds.has(product.id);

      return (
        <DayRoutine
          key={`${product.id}-${index}`}
          product={product}
          stepNumber={index + 1}
          isNew={isNew}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '16px',
            }}
          >
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontWeight: 'bold',
                  fontSize: '18px',
                  color: '#0A5F59',
                  marginBottom: '4px',
                }}
              >
                {product.name}
              </p>
              <p style={{ fontSize: '14px', color: '#6B7280' }}>
                {product.brand.name} • {product.price} ₽
              </p>
            </div>

            <AddToCartButton
              productId={product.id}
              isActive={isInWishlist}
              onToggle={toggleWishlist}
            />
          </div>

          <button
            onClick={() => openReplaceModal(product)}
            style={{
              marginTop: '16px',
              width: '100%',
              color: '#DC2626',
              border: '1px solid #FCA5A5',
              padding: '12px',
              borderRadius: '16px',
              fontSize: '14px',
              fontWeight: '500',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FEE2E2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Не подошло — заменить
          </button>
        </DayRoutine>
      );
    });
  };


  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
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

      {/* Шапка с прогрессом и инфографикой */}
      <ProgressHeader 
        currentDay={progress.currentDay}
        totalDays={progress.totalDays}
        skinType={profile.skinTypeRu}
        primaryConcernRu={profile.primaryConcernRu}
      />

      <div style={{ padding: '20px', marginTop: '-32px', position: 'relative', zIndex: 10 }}>
        {/* Инфографика состояния кожи */}
        <div style={{ marginBottom: '32px' }}>
          <SkinInfographic 
            scores={profile.scores} 
            skinType={profile.skinType}
            skinTypeRu={profile.skinTypeRu}
            sensitivityLevel={profile.sensitivityLevel}
            acneLevel={profile.acneLevel}
          />
        </div>

        {/* Календарь — переключаемые недели */}
        <div style={{ marginBottom: '32px' }}>
          <WeekCalendar 
            weeks={plan.weeks}
            currentWeek={selectedWeek}
            completedDays={Array.from(completedDays)}
            onWeekChange={(week) => {
              setSelectedWeek(week);
              setActiveTab('morning');
            }}
          />
        </div>

        {/* Текущий день — утро/вечер */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(28px)',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(10, 95, 89, 0.1)',
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '24px',
            color: '#0A5F59',
          }}>
            День {headingDayNumber} • Неделя {headingWeekNumber}
          </h2>

          {/* Табы утро/вечер */}
          <div style={{ display: 'flex', gap: '24px', borderBottom: '2px solid #E5E7EB', marginBottom: '24px' }}>
            <button
              onClick={() => setActiveTab('morning')}
              style={{
                paddingBottom: '12px',
                fontWeight: 'bold',
                fontSize: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'morning' ? '#9333EA' : '#6B7280',
                borderBottom: activeTab === 'morning' ? '4px solid #9333EA' : '4px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              Утро
            </button>
            <button
              onClick={() => setActiveTab('evening')}
              style={{
                paddingBottom: '12px',
                fontWeight: 'bold',
                fontSize: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: activeTab === 'evening' ? '#9333EA' : '#6B7280',
                borderBottom: activeTab === 'evening' ? '4px solid #9333EA' : '4px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              Вечер
            </button>
          </div>

          {/* Утро */}
          {activeTab === 'morning' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {renderRoutine(morningSteps)}
            </div>
          )}

          {/* Вечер */}
          {activeTab === 'evening' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {renderRoutine(eveningSteps)}
            </div>
          )}

          {/* Кнопка завершения дня */}
          <button
            onClick={completeCurrentDay}
            disabled={!canCompleteDay}
            style={{
              marginTop: '32px',
              width: '100%',
              background: 'linear-gradient(to right, #10B981, #14B8A6)',
              color: 'white',
              padding: '24px',
              borderRadius: '24px',
              fontWeight: 'bold',
              fontSize: '20px',
              border: 'none',
              cursor: canCompleteDay ? 'pointer' : 'not-allowed',
              boxShadow: canCompleteDay
                ? '0 8px 24px rgba(16, 185, 129, 0.3)'
                : '0 4px 12px rgba(16, 185, 129, 0.15)',
              opacity: canCompleteDay ? 1 : 0.6,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (canCompleteDay) {
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (canCompleteDay) {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.3)';
              }
            }}
          >
            {canCompleteDay
              ? `День ${headingDayNumber} выполнен`
              : 'Доступно только для текущего дня'}
          </button>
        </div>

        {/* Рекомендованные средства */}
        <RecommendedProducts 
          wishlistProductIds={wishlistProductIds}
          onToggleWishlist={toggleWishlist}
          onOpenReplace={openReplaceModal}
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
            <Link 
              href="/wishlist" 
              style={{
                flex: 1,
                backgroundColor: '#F3F4F6',
                padding: '16px',
                borderRadius: '16px',
                textAlign: 'center',
                fontWeight: 'bold',
                color: '#0A5F59',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E5E7EB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F3F4F6';
              }}
            >
              Избранное ({wishlistProductIds.size})
            </Link>
            <Link 
              href="/profile" 
              style={{
                flex: 1,
                backgroundColor: '#9333EA',
                padding: '16px',
                borderRadius: '16px',
                textAlign: 'center',
                fontWeight: 'bold',
                color: 'white',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#7E22CE';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#9333EA';
              }}
            >
              Профиль кожи
            </Link>
          </div>
        </div>
      </div>

      {/* Модалка замены продукта */}
      {replaceProduct && (
        <ReplaceProductModal
          product={replaceProduct}
          isOpen={!!replaceProduct}
          onClose={() => setReplaceProduct(null)}
          onReplace={handleReplace}
        />
      )}
    </div>
  );
}

