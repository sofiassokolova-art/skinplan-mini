// app/admin/feedback/page.tsx
// Страница отзывов с разделением по типам: отзывы по продуктам из вишлиста и отзывы по плану

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, ThumbsUp, ThumbsDown, Star, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductFeedback {
  id: string;
  userId: string;
  productId: number;
  feedback: 'bought_love' | 'bought_ok' | 'bought_bad';
  createdAt: string;
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
  product: {
    id: number;
    name: string;
    brand: string;
  };
}

interface PlanFeedback {
  id: string;
  userId: string;
  rating: number;
  feedback: string | null;
  type: 'plan_recommendations' | 'plan_general' | 'service';
  createdAt: string;
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  };
}

type FeedbackSection = 'products' | 'plan_recommendations' | 'plan_general' | 'service';

export default function FeedbackAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [productFeedback, setProductFeedback] = useState<ProductFeedback[]>([]);
  const [planFeedback, setPlanFeedback] = useState<PlanFeedback[]>([]);
  const [activeSection, setActiveSection] = useState<FeedbackSection>('products');
  const [activeProductTab, setActiveProductTab] = useState<'all' | 'love' | 'ok' | 'bad'>('all');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    products: { all: 0, love: 0, ok: 0, bad: 0 },
    planRecommendations: 0,
    planGeneral: 0,
    service: 0,
  });

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      
      // Формируем URL с параметром типа для plan feedback
      let url = '/api/admin/feedback';
      if (activeSection === 'plan_recommendations' || activeSection === 'plan_general' || activeSection === 'service') {
        url += `?planFeedbackType=${activeSection}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Ошибка загрузки отзывов');
      }

      const data = await response.json();
      setProductFeedback(data.productFeedback || []);
      
      // Фильтруем отзывы по плану по типу в зависимости от активной секции
      const allPlanFeedback = data.planFeedback || [];
      let filteredPlanFeedback = allPlanFeedback;
      
      if (activeSection === 'plan_recommendations') {
        filteredPlanFeedback = allPlanFeedback.filter((f: PlanFeedback) => f.type === 'plan_recommendations');
      } else if (activeSection === 'plan_general') {
        filteredPlanFeedback = allPlanFeedback.filter((f: PlanFeedback) => f.type === 'plan_general');
      } else if (activeSection === 'service') {
        filteredPlanFeedback = allPlanFeedback.filter((f: PlanFeedback) => f.type === 'service');
      }
      
      setPlanFeedback(filteredPlanFeedback);
      
      // Обновляем статистику
      const productStats = {
        all: data.productFeedback?.length || 0,
        love: data.productFeedback?.filter((f: ProductFeedback) => f.feedback === 'bought_love').length || 0,
        ok: data.productFeedback?.filter((f: ProductFeedback) => f.feedback === 'bought_ok').length || 0,
        bad: data.productFeedback?.filter((f: ProductFeedback) => f.feedback === 'bought_bad').length || 0,
      };
      
      setStats({
        products: productStats,
        planRecommendations: data.planFeedbackStats?.planRecommendations || 0,
        planGeneral: data.planFeedbackStats?.planGeneral || 0,
        service: data.planFeedbackStats?.service || 0,
      });
    } catch (err: any) {
      console.error('Ошибка загрузки отзывов:', err);
      setError(err.message || 'Ошибка загрузки отзывов');
    } finally {
      setLoading(false);
    }
  };

  // Перезагружаем данные при смене секции для plan feedback
  useEffect(() => {
    if (!loading && (activeSection === 'plan_recommendations' || activeSection === 'plan_general' || activeSection === 'service')) {
      loadFeedback();
    }
  }, [activeSection]);

  const filteredProductFeedback = productFeedback.filter((f) => {
    if (activeProductTab === 'all') return true;
    if (activeProductTab === 'love') return f.feedback === 'bought_love';
    if (activeProductTab === 'ok') return f.feedback === 'bought_ok';
    if (activeProductTab === 'bad') return f.feedback === 'bought_bad';
    return true;
  });

  const getSectionLabel = (section: FeedbackSection) => {
    switch (section) {
      case 'products':
        return 'По продуктам (вишлист)';
      case 'plan_recommendations':
        return 'По рекомендациям плана';
      case 'plan_general':
        return 'Общие по плану';
      case 'service':
        return 'Сервисные отзывы';
      default:
        return section;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-white/60">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Отзывы</h1>
        <p className="text-gray-600">Обратная связь от пользователей</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Секции отзывов */}
      <div className="flex gap-2 border-b border-gray-200 flex-wrap">
        {[
          { key: 'products', label: 'По продуктам', icon: Heart, count: stats.products.all },
          { key: 'plan_recommendations', label: 'По рекомендациям', icon: Star, count: stats.planRecommendations },
          { key: 'plan_general', label: 'Общие по плану', icon: MessageSquare, count: stats.planGeneral },
          { key: 'service', label: 'Сервисные', icon: MessageSquare, count: stats.service },
        ].map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key as FeedbackSection)}
              className={cn(
                'px-4 py-2 border-b-2 transition-colors flex items-center gap-2',
                activeSection === section.key
                  ? 'border-[#8B5CF6] text-gray-900'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              {Icon && <Icon size={18} />}
              <span className="font-medium text-sm">{section.label}</span>
              <span className={cn(
                'px-2 py-1 rounded text-xs',
                activeSection === section.key ? 'bg-gray-100' : 'bg-gray-50'
              )}>
                {section.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Вкладки для отзывов по продуктам */}
      {activeSection === 'products' && (
        <div className="flex gap-4 border-b border-gray-200">
          {[
            { key: 'all', label: 'Все', icon: null, count: stats.products.all },
            { key: 'love', label: 'Love', icon: Heart, count: stats.products.love, color: 'text-pink-400' },
            { key: 'ok', label: 'OK', icon: ThumbsUp, count: stats.products.ok, color: 'text-blue-400' },
            { key: 'bad', label: 'Bad', icon: ThumbsDown, count: stats.products.bad, color: 'text-red-400' },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveProductTab(tab.key as any)}
                className={cn(
                  'px-6 py-3 border-b-2 transition-colors flex items-center gap-2',
                  activeProductTab === tab.key
                    ? 'border-[#8B5CF6] text-gray-900'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                )}
              >
                {Icon && <Icon className={tab.color} size={20} />}
                <span className="font-medium">{tab.label}</span>
                <span className={cn(
                  'px-2 py-1 rounded text-xs',
                  activeProductTab === tab.key ? 'bg-gray-100' : 'bg-gray-50'
                )}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Список отзывов */}
      <div className="bg-transparent rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="space-y-4">
          {activeSection === 'products' ? (
            filteredProductFeedback.length === 0 ? (
              <div className="text-center py-12 text-white/60">
                Нет отзывов в этой категории
              </div>
            ) : (
              filteredProductFeedback.map((f) => (
                <div
                  key={f.id}
                  className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-white mb-1">
                        {f.user.firstName || ''} {f.user.lastName || ''}
                      </div>
                      <div className="text-white/80 text-sm">
                        {f.product.brand} {f.product.name}
                      </div>
                    </div>
                    <div className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2',
                      f.feedback === 'bought_love'
                        ? 'bg-pink-500/20 text-pink-300'
                        : f.feedback === 'bought_ok'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-red-500/20 text-red-300'
                    )}>
                      {f.feedback === 'bought_love' && <Heart size={14} />}
                      {f.feedback === 'bought_ok' && <ThumbsUp size={14} />}
                      {f.feedback === 'bought_bad' && <ThumbsDown size={14} />}
                      {f.feedback === 'bought_love' ? 'Love' : f.feedback === 'bought_ok' ? 'OK' : 'Bad'}
                    </div>
                  </div>
                  <div className="text-white/40 text-xs">
                    {new Date(f.createdAt).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))
            )
          ) : (
            planFeedback.length === 0 ? (
              <div className="text-center py-12 text-white/60">
                Нет отзывов по плану в этой категории
              </div>
            ) : (
              planFeedback.map((f) => (
                <div
                  key={f.id}
                  className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-white mb-1">
                        {f.user.firstName || ''} {f.user.lastName || ''}
                      </div>
                      <div className="text-white/60 text-xs mb-2">
                        Тип: {f.type === 'plan_recommendations' ? 'По рекомендациям' : f.type === 'plan_general' ? 'Общий по плану' : 'Сервисный'}
                      </div>
                      {f.feedback && (
                        <div className="text-white/80 text-sm mt-2">
                          {f.feedback}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className={i < f.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'}
                          />
                        ))}
                      </div>
                      <span className="text-white/60 text-xs">
                        {f.rating}/5
                      </span>
                    </div>
                  </div>
                  <div className="text-white/40 text-xs">
                    {new Date(f.createdAt).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}
