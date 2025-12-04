// app/(miniapp)/plan/calendar/page.tsx
// Отдельная страница календаря плана с выбором дня

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlanCalendar } from '@/components/PlanCalendar';
import { DayView } from '@/components/DayView';
import { api } from '@/lib/api';
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
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [wishlistProductIds, setWishlistProductIds] = useState<Set<number>>(new Set());
  const [cartQuantities, setCartQuantities] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Загружаем прогресс
      const progress = await api.getPlanProgress() as {
        currentDay: number;
        completedDays: number[];
      };
      
      if (progress) {
        setCurrentDay(progress.currentDay || 1);
        setSelectedDay(progress.currentDay || 1);
        setCompletedDays(progress.completedDays || []);
      }

      // Загружаем план
      let planData: any = null;
      try {
        planData = await api.getPlan() as any;
        console.log('📅 Calendar: Plan loaded', {
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
            }).catch(logErr => console.warn('Failed to log error:', logErr));
          }
        } catch (logError) {
          console.warn('Failed to save error log:', logError);
        }
        
        // Если план не найден (404), попробуем сгенерировать
        if (err?.status === 404 || err?.isNotFound) {
          try {
            console.log('📅 Calendar: Plan not in cache, trying to generate...');
            // Пробуем сгенерировать план напрямую
            planData = await api.generatePlan() as any;
            console.log('📅 Calendar: Plan generated', {
              hasPlan: !!planData,
              hasPlan28: !!planData?.plan28,
              hasWeeks: !!planData?.weeks,
            });
          } catch (genErr: any) {
            console.error('📅 Calendar: Error generating plan', genErr);
            
            // Логируем ошибку генерации
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
                    message: `Calendar: Failed to generate plan - ${genErr?.message || 'Unknown error'}`,
                    context: {
                      error: genErr?.message || String(genErr),
                      status: genErr?.status,
                      stack: genErr?.stack,
                      url: window.location.href,
                    },
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                  }),
                }).catch(logErr => console.warn('Failed to log error:', logErr));
              }
            } catch (logError) {
              console.warn('Failed to save error log:', logError);
            }
            
            // Если генерация не удалась из-за отсутствия профиля - редиректим на анкету
            if (genErr?.status === 404 || genErr?.message?.includes('No skin profile') || genErr?.message?.includes('Profile not found')) {
              toast.error('План не найден. Пожалуйста, пройдите анкету.');
              router.push('/quiz');
              return;
            }
            // Другие ошибки - показываем общую ошибку
            toast.error('Не удалось загрузить план. Попробуйте позже.');
            setLoading(false);
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
          planData: planData,
        });
        // Если план все еще не найден после попытки генерации - редиректим на анкету
        toast.error('План не найден. Пожалуйста, пройдите анкету.');
        router.push('/quiz');
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
        
        console.log('📅 Calendar: Products from plan', {
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
            
            console.log('✅ Calendar: Products loaded from plan', {
              requestedIds: allProductIds.size,
              loadedProducts: productsMap.size,
              missingProducts: Array.from(allProductIds).filter(id => !productsMap.has(id)),
            });
            
            // Проверяем, что все продукты загружены
            const missingProducts = Array.from(allProductIds).filter(id => !productsMap.has(id));
            if (missingProducts.length > 0) {
              console.warn('⚠️ Calendar: Some products not found in database', {
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
        setWishlist(wishlistIds);
        setWishlistProductIds(new Set(wishlistIds));
      } catch (err) {
        console.warn('Could not load wishlist:', err);
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
        console.warn('Could not load cart:', err);
      }
    } catch (err) {
      console.error('Error loading calendar data:', err);
      toast.error('Не удалось загрузить данные плана');
    } finally {
      setLoading(false);
    }
  };

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
    console.log('Replace product:', stepCategory, productId);
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
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#0A5F59', fontSize: '18px', marginBottom: '16px' }}>
            План не найден
          </div>
          <button
            onClick={() => router.push('/plan')}
            style={{
              padding: '12px 24px',
              borderRadius: '12px',
              backgroundColor: '#0A5F59',
              color: 'white',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Вернуться к плану
          </button>
        </div>
      </div>
    );
  }

  const selectedDayPlan = plan28.days.find(d => d.dayIndex === selectedDay);
  const currentPhase = getPhaseForDay(selectedDay);
  const phaseLabel = getPhaseLabel(currentPhase);

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

      {/* Блок текущей стадии */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(10, 95, 89, 0.1)',
      }}>
        <div style={{
          fontSize: '16px',
          color: '#6B7280',
          marginBottom: '8px',
        }}>
          Сейчас вы на стадии:
        </div>
        <div style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: '#0A5F59',
        }}>
          {phaseLabel}
        </div>
      </div>

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

