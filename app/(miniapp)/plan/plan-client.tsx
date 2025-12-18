// app/(miniapp)/plan/plan-client.tsx
// Client Component для интерактивности страницы плана

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SkinInfographic } from '@/components/SkinInfographic';
import { WeekCalendar } from '@/components/WeekCalendar';
import { DayRoutine } from '@/components/DayRoutine';
import { ProgressHeader } from '@/components/ProgressHeader';
import { AddToCartButton } from '@/components/AddToCartButton';
import { AddToCartButtonNew } from '@/components/AddToCartButtonNew';
import { ReplaceProductModal } from '@/components/ReplaceProductModal';
import { RecommendedProducts } from '@/components/RecommendedProducts';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { clientLogger } from '@/lib/client-logger';

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
        morning: number[];
        evening: number[];
      }>;
    }>;
  };
  progress: {
    currentDay: number;
    completedDays: number[];
  };
  wishlist: number[];
  currentDay: number;
  currentWeek: number;
  todayProducts: Array<{
    id: number;
    name: string;
    brand: { name: string };
    price: number;
    volume: string | null;
    imageUrl: string | null;
    step: string;
    firstIntroducedDay: number;
  }>;
  todayMorning: number[];
  todayEvening: number[];
}

export function PlanPageClient({
  user,
  profile,
  plan,
  progress,
  wishlist,
  currentDay,
  currentWeek,
  todayProducts,
  todayMorning,
  todayEvening,
}: PlanPageClientProps) {
  const router = useRouter();
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [activeTab, setActiveTab] = useState<'morning' | 'evening'>('morning');
  const [replaceProduct, setReplaceProduct] = useState<{ 
    id: number; 
    name: string; 
    brand: { name: string };
    price: number;
    imageUrl: string | null;
  } | null>(null);
  const [wishlistProductIds, setWishlistProductIds] = useState<Set<number>>(new Set(wishlist));
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set(progress.completedDays));

  // Получаем данные выбранной недели и дня
  const selectedWeekData = plan.weeks.find(w => w.week === selectedWeek);
  const selectedDayData = selectedWeekData?.days[0]; // Показываем первый день недели
  const selectedDayProductIds = [...new Set([
    ...(selectedDayData?.morning || []),
    ...(selectedDayData?.evening || []),
  ])];

  const completeCurrentDay = async () => {
    try {
      const newCompleted = new Set(completedDays);
      newCompleted.add(currentDay);
      setCompletedDays(newCompleted);

      const nextDay = Math.min(currentDay + 1, 28);

      // Локальный кеш — чтобы UX был мгновенным даже до ответа сервера
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          'plan_progress',
          JSON.stringify({
            currentDay: nextDay,
            completedDays: Array.from(newCompleted),
          })
        );
      }

      // Сохраняем прогресс в БД для синхронизации между устройствами
      if (
        typeof window !== 'undefined' &&
        window.Telegram?.WebApp?.initData
      ) {
        try {
          await api.savePlanProgress(nextDay, Array.from(newCompleted));
        } catch (err: any) {
          // Если ошибка авторизации — просто логируем, локальный кеш уже обновлён
          clientLogger.warn('Ошибка сохранения прогресса плана на сервере:', err);
        }
      }

      toast.success('День завершен! ✨');

      // Haptic feedback
      if (typeof window !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(200);
      }

      // Переход к следующему дню (если не последний)
      if (currentDay < 28) {
        setTimeout(() => {
          router.refresh();
        }, 1500);
      }
    } catch (err: any) {
      console.error('Error completing day:', err);
      toast.error('Не удалось обновить прогресс. Попробуйте еще раз.');
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

  const openReplaceModal = (product: { 
    id: number; 
    name: string; 
    brand: { name: string };
    price: number;
    imageUrl: string | null;
  }) => {
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

      {/* Шапка с прогрессом и инфографикой */}
      <ProgressHeader 
        currentDay={currentDay}
        totalDays={28}
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
            onWeekChange={setSelectedWeek}
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
            День {currentDay} • Неделя {currentWeek}
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
              {todayMorning.map((productId, index) => {
                const product = todayProducts.find(p => p.id === productId);
                if (!product) return null;

                const isNew = currentDay === product.firstIntroducedDay;
                const isInWishlist = wishlistProductIds.has(product.id);

                return (
                  <DayRoutine key={product.id} product={product} stepNumber={index + 1} isNew={isNew}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 'bold', fontSize: '18px', color: '#0A5F59', marginBottom: '4px' }}>{product.name}</p>
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

                    {/* Кнопка замены */}
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
              })}
            </div>
          )}

          {/* Вечер */}
          {activeTab === 'evening' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {todayEvening.map((productId, index) => {
                const product = todayProducts.find(p => p.id === productId);
                if (!product) return null;

                const isNew = currentDay === product.firstIntroducedDay;
                const isInWishlist = wishlistProductIds.has(product.id);

                return (
                  <DayRoutine key={product.id} product={product} stepNumber={index + 1} isNew={isNew}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 'bold', fontSize: '18px', color: '#0A5F59', marginBottom: '4px' }}>{product.name}</p>
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

                    {/* Кнопка замены */}
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
              })}
            </div>
          )}

          {/* Кнопка завершения дня */}
          <button
            onClick={completeCurrentDay}
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
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.3)';
            }}
          >
            День {currentDay} выполнен
          </button>
        </div>

        {/* Рекомендованные средства */}
        <RecommendedProducts 
          wishlistProductIds={wishlistProductIds}
          onToggleWishlist={toggleWishlist}
          onOpenReplace={openReplaceModal}
        />
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

