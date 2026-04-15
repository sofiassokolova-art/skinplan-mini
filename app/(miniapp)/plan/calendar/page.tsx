export const runtime = 'edge';
// app/(miniapp)/plan/calendar/page.tsx
// Отдельная страница календаря плана с выбором дня

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PlanCalendar } from '@/components/PlanCalendar';
import { DayView } from '@/components/DayView';
import { api } from '@/lib/api';
import { useAddToCart } from '@/hooks/useCart';
import { clientLogger } from '@/lib/client-logger';
import type { Plan28, DayPlan } from '@/lib/plan-types';
import { getPhaseForDay, getPhaseLabel } from '@/lib/plan-types';
import toast from 'react-hot-toast';

export default function PlanCalendarPage() {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState(1);
  const [currentDay, setCurrentDay] = useState(1);
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
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

  // ИСПРАВЛЕНО: Защита от множественных вызовов прогресса
  const progressLoadInProgressRef = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Загружаем прогресс (может быть ошибка, но это не критично)
      // ИСПРАВЛЕНО: Защита от множественных вызовов
      let progress: { currentDay: number; completedDays: number[] } | null = null;
      if (!progressLoadInProgressRef.current) {
        progressLoadInProgressRef.current = true;
      try {
        progress = await api.getPlanProgress() as {
        currentDay: number;
        completedDays: number[];
      };
      } catch (progressErr) {
        clientLogger.warn('📅 Calendar: Error loading progress (non-critical)', progressErr);
          progress = { currentDay: 1, completedDays: [] };
        } finally {
          progressLoadInProgressRef.current = false;
        }
      } else {
        progress = { currentDay: 1, completedDays: [] };
      }
      
      if (progress) {
        setCurrentDay(progress.currentDay || 1);
        setSelectedDay(progress.currentDay || 1);
        setCompletedDays(progress.completedDays || []);
      }

      // Загружаем план
      let planData: any = null;
      try {
        planData = await api.getPlan() as any;
        clientLogger.log('📅 Calendar: Plan loaded', {
          hasPlan: !!planData,
          hasPlan28: !!planData?.plan28,
          hasWeeks: !!planData?.weeks,
          planKeys: planData ? Object.keys(planData) : [],
        });
      } catch (err: any) {
        console.error('📅 Calendar: Error loading plan', err);
        
        // Логируем ошибку в БД для техподдержки
        try {
          if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
            await fetch('/api/logs', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': window.Telegram.WebApp.initData,
              },
              body: JSON.stringify({
                level: 'error',
                message: `Calendar: Failed to load plan - ${err?.message || 'Unknown error'}`,
                context: {
                  error: err?.message || String(err),
                  status: err?.status,
                  stack: err?.stack,
                  url: window.location.href,
                },
                url: window.location.href,
                userAgent: navigator.userAgent,
              }),
            }).catch(logErr => clientLogger.warn('Failed to log error:', logErr));
          }
        } catch (logError) {
          clientLogger.warn('Failed to save error log:', logError);
        }
        
        // Если план не найден - проверяем, есть ли профиль
        // Если профиль есть, но план не найден - это ошибка, нужно регенерировать план
        if (err?.status === 404 || err?.isNotFound) {
          clientLogger.log('📅 Calendar: Plan not found (404), checking if profile exists...');
          
          // Проверяем наличие профиля
          try {
            const profile = await api.getCurrentProfile();
            if (profile && (profile as any).id) {
              // Профиль есть, но план не найден - это странно, но не критично
              // Показываем ошибку и предлагаем вернуться к плану или пройти анкету заново
              clientLogger.warn('📅 Calendar: Profile exists but plan not found - plan may need regeneration');
              toast.error('План не найден. Попробуйте обновить страницу или пройдите анкету заново.');
              setLoading(false);
              return;
            } else {
              // Профиля нет - редиректим на анкету
              clientLogger.log('📅 Calendar: No profile found, redirecting to quiz');
              toast.error('План не найден. Пожалуйста, пройдите анкету.');
              setLoading(false);
              setTimeout(() => {
              router.push('/quiz');
              }, 1500);
              return;
            }
          } catch (profileErr: any) {
            // Ошибка при проверке профиля - редиректим на анкету
            console.error('📅 Calendar: Error checking profile:', profileErr);
            toast.error('План не найден. Пожалуйста, пройдите анкету.');
            setLoading(false);
            setTimeout(() => {
              router.push('/quiz');
            }, 1500);
            return;
          }
        } else {
          // Другие ошибки (не 404) - показываем общую ошибку
          console.error('📅 Calendar: Unexpected error loading plan', err);
          toast.error('Не удалось загрузить план. Попробуйте позже.');
          setLoading(false);
          return;
        }
      }
      
      // Проверяем наличие plan28
      if (!planData || !planData.plan28) {
        console.error('📅 Calendar: Plan not found or invalid format', {
          hasPlan: !!planData,
          hasPlan28: !!planData?.plan28,
          hasWeeks: !!planData?.weeks,
          planKeys: planData ? Object.keys(planData) : [],
        });
        // Если план все еще не найден после попытки генерации - показываем ошибку, но не редиректим
        toast.error('План не найден. Попробуйте обновить страницу или вернуться к плану.');
        setLoading(false);
        return;
      }
      
      if (planData?.plan28) {
        setPlan28(planData.plan28);
        
        // ВАЖНО: Календарь использует продукты из плана, раскиданные на 28 дней по логике фаз
        // План уже содержит все продукты, распределенные по дням согласно фазам:
        // - Дни 1-7: Адаптация (adaptation)
        // - Дни 8-21: Активная фаза (active)
        // - Дни 22-28: Поддержка (support)
        // Продукты распределяются автоматически при генерации плана
        
        // Загружаем продукты из плана (все продукты из всех дней)
        const allProductIds = new Set<number>();
        planData.plan28.days.forEach((day: DayPlan) => {
          // Утренние шаги
          day.morning.forEach(step => {
            if (step.productId) allProductIds.add(Number(step.productId));
            step.alternatives.forEach(alt => allProductIds.add(Number(alt)));
          });
          // Вечерние шаги
          day.evening.forEach(step => {
            if (step.productId) allProductIds.add(Number(step.productId));
            step.alternatives.forEach(alt => allProductIds.add(Number(alt)));
          });
          // Еженедельные шаги (маски, пилинги)
          day.weekly.forEach(step => {
            if (step.productId) allProductIds.add(Number(step.productId));
            step.alternatives.forEach(alt => allProductIds.add(Number(alt)));
          });
        });
        
        clientLogger.log('📅 Calendar: Products from plan', {
          totalDays: planData.plan28.days.length,
          totalProductIds: allProductIds.size,
          productIds: Array.from(allProductIds).slice(0, 10),
        });

        if (allProductIds.size > 0) {
          const productsResponse = await fetch('/api/products/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData || '',
            },
            body: JSON.stringify({ productIds: Array.from(allProductIds) }),
          });

          if (productsResponse.ok) {
            const productsData = await productsResponse.json();
            const productsMap = new Map();
            productsData.products?.forEach((p: any) => {
              if (p && p.id) {
                productsMap.set(p.id, {
                  id: p.id,
                  name: p.name || 'Неизвестный продукт',
                  brand: { name: p.brand?.name || p.brand || 'Unknown' },
                  price: p.price || null,
                  imageUrl: p.imageUrl || null,
                  // Используем descriptionUser для синхронизации с главной страницей
                  description: p.descriptionUser || p.description || null,
                });
              }
            });
            
            clientLogger.log('✅ Calendar: Products loaded from plan', {
              requestedIds: allProductIds.size,
              loadedProducts: productsMap.size,
              missingProducts: Array.from(allProductIds).filter(id => !productsMap.has(id)),
            });
            
            // Проверяем, что все продукты загружены
            const missingProducts = Array.from(allProductIds).filter(id => !productsMap.has(id));
            if (missingProducts.length > 0) {
              clientLogger.warn('⚠️ Calendar: Some products not found in database', {
                missingIds: missingProducts,
              });
            }
            
            setProducts(productsMap);
          } else {
            const errorText = await productsResponse.text().catch(() => '');
            console.error('❌ Calendar: Failed to load products from batch endpoint', {
              status: productsResponse.status,
              statusText: productsResponse.statusText,
              error: errorText.substring(0, 200),
            });
            toast.error('Не удалось загрузить продукты. Попробуйте позже.');
          }
        }
      }

      // Загружаем wishlist
      try {
        const wishlistData = await api.getWishlist() as any;
        const wishlistIds = (wishlistData.items || []).map((item: any) =>
          item.product?.id || item.productId
        ).filter((id: any): id is number => typeof id === 'number');
        setWishlistProductIds(new Set(wishlistIds));
      } catch (err) {
        clientLogger.warn('Could not load wishlist:', err);
      }

      // Загружаем корзину
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
    } catch (err) {
      console.error('Error loading calendar data:', err);
      toast.error('Не удалось загрузить данные плана');
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

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

  // ИСПРАВЛЕНО: Используем React Query хук для автоматической инвалидации кэша
  const addToCartMutation = useAddToCart();

  const handleAddToCart = async (productId: number) => {
    try {
      await addToCartMutation.mutateAsync({ productId, quantity: 1 });
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

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      }}>
        <div style={{ color: '#0A5F59', fontSize: '16px' }}>Загрузка...</div>
      </div>
    );
  }

  if (!plan28) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        padding: '20px',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ 
            color: '#0A5F59', 
            fontSize: '20px', 
            fontWeight: '600',
            marginBottom: '12px' 
          }}>
            План не найден
          </div>
          <div style={{ 
            color: '#6B7280', 
            fontSize: '14px', 
            marginBottom: '24px',
            lineHeight: '1.5',
          }}>
            План еще не создан. Пожалуйста, пройдите анкету для создания персонального плана ухода.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
              onClick={() => router.push('/quiz')}
            style={{
                padding: '14px 24px',
              borderRadius: '12px',
              backgroundColor: '#0A5F59',
              color: 'white',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
                width: '100%',
              }}
            >
              Пройти анкету
            </button>
            <button
              onClick={() => router.push('/plan')}
              style={{
                padding: '14px 24px',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                color: '#0A5F59',
                border: '2px solid #0A5F59',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                width: '100%',
            }}
          >
            Вернуться к плану
          </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedDayPlan = plan28.days.find(d => d.dayIndex === selectedDay);
  const currentPhase = getPhaseForDay(selectedDay);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
      paddingBottom: '100px',
    }}>
      {/* Календарь с увеличенным скроллом */}
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

