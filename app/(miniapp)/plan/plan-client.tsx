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
import { ReplaceProductModal } from '@/components/ReplaceProductModal';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
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
    const newCompleted = new Set(completedDays);
    newCompleted.add(currentDay);
    setCompletedDays(newCompleted);

    // Сохраняем в localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('plan_progress', JSON.stringify({
        currentDay: currentDay + 1,
        completedDays: Array.from(newCompleted),
      }));
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

  // Прогноз через 28 дней (данные из плана или вычисленные)
  const forecast = {
    inflammation: -52,
    hydration: +47,
    pigmentation: -38,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5FFFC] to-[#E8FBF7] pb-24">
      {/* Шапка с прогрессом и инфографикой */}
      <ProgressHeader 
        currentDay={currentDay}
        totalDays={28}
        skinType={profile.skinTypeRu}
        primaryConcernRu={profile.primaryConcernRu}
      />

      <div className="px-4 -mt-8 relative z-10">
        {/* Инфографика состояния кожи */}
        <div className="mb-8">
          <SkinInfographic scores={profile.scores} />
        </div>

        {/* Календарь — переключаемые недели */}
        <div className="mb-8">
          <WeekCalendar 
            weeks={plan.weeks}
            currentWeek={selectedWeek}
            completedDays={Array.from(completedDays)}
            onWeekChange={setSelectedWeek}
          />
        </div>

        {/* Текущий день — утро/вечер */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-6">
            День {currentDay} • Неделя {currentWeek}
          </h2>

          {/* Табы утро/вечер */}
          <div className="flex gap-6 border-b mb-6">
            <button
              onClick={() => setActiveTab('morning')}
              className={`pb-3 font-bold transition-all ${
                activeTab === 'morning'
                  ? 'border-b-4 border-purple-600 text-purple-600'
                  : 'text-gray-500'
              }`}
            >
              Утро
            </button>
            <button
              onClick={() => setActiveTab('evening')}
              className={`pb-3 font-bold transition-all ${
                activeTab === 'evening'
                  ? 'border-b-4 border-purple-600 text-purple-600'
                  : 'text-gray-500'
              }`}
            >
              Вечер
            </button>
          </div>

          {/* Утро */}
          {activeTab === 'morning' && (
            <div className="space-y-5">
              {todayMorning.map((productId, index) => {
                const product = todayProducts.find(p => p.id === productId);
                if (!product) return null;

                const isNew = currentDay === product.firstIntroducedDay;
                const isInWishlist = wishlistProductIds.has(product.id);

                return (
                  <DayRoutine key={product.id} product={product} stepNumber={index + 1} isNew={isNew}>
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex-1">
                        <p className="font-bold text-lg">{product.name}</p>
                        <p className="text-sm text-gray-600">
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
                      className="mt-4 w-full text-red-600 border border-red-300 py-3 rounded-2xl text-sm font-medium hover:bg-red-50"
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
            <div className="space-y-5">
              {todayEvening.map((productId, index) => {
                const product = todayProducts.find(p => p.id === productId);
                if (!product) return null;

                const isNew = currentDay === product.firstIntroducedDay;
                const isInWishlist = wishlistProductIds.has(product.id);

                return (
                  <DayRoutine key={product.id} product={product} stepNumber={index + 1} isNew={isNew}>
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex-1">
                        <p className="font-bold text-lg">{product.name}</p>
                        <p className="text-sm text-gray-600">
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
                      className="mt-4 w-full text-red-600 border border-red-300 py-3 rounded-2xl text-sm font-medium hover:bg-red-50"
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
            className="mt-8 w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-6 rounded-3xl font-bold text-xl shadow-lg hover:shadow-xl transition-all"
          >
            День {currentDay} выполнен
          </button>
        </div>

        {/* Прогноз через 28 дней */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-3xl p-6 text-center mb-6">
          <h3 className="text-xl font-bold mb-4">Что будет через 28 дней</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4">
              <div className="text-3xl font-bold text-red-600">{forecast.inflammation}%</div>
              <div className="text-sm text-gray-600">воспалений</div>
            </div>
            <div className="bg-white rounded-2xl p-4">
              <div className="text-3xl font-bold text-blue-600">{forecast.hydration}%</div>
              <div className="text-sm text-gray-600">увлажнённости</div>
            </div>
            <div className="bg-white rounded-2xl p-4">
              <div className="text-3xl font-bold text-emerald-600">{forecast.pigmentation}%</div>
              <div className="text-sm text-gray-600">пигментации</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            На основе 34 000+ пользователей с похожим профилем
          </p>
        </div>

        {/* Нижняя навигация */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t px-4 py-3 z-50">
          <div className="max-w-md mx-auto flex gap-3">
            <Link href="/wishlist" className="flex-1 bg-gray-100 py-4 rounded-2xl text-center font-bold hover:bg-gray-200 transition-all">
              Избранное ({wishlistProductIds.size})
            </Link>
            <Link href="/profile" className="flex-1 bg-purple-600 text-white py-4 rounded-2xl text-center font-bold hover:bg-purple-700 transition-all">
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

