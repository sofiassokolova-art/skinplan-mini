// app/admin/feedback/page.tsx
// Страница отзывов с разделением по типам: отзывы по продуктам из вишлиста и отзывы по плану

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, ThumbsUp, ThumbsDown, Star, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminPageSkeleton } from '@/components/ui/SkeletonLoader';

interface ProductFeedback {
  id: string;
  userId: string;
  productId: number;
  feedback: 'not_bought' | 'bought_love' | 'bought_ok' | 'bought_bad';
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
  const [productPage, setProductPage] = useState(1);
  const [planPage, setPlanPage] = useState(1);
  const [pageInfo, setPageInfo] = useState({ productTotal: 0, planTotal: 0, limit: 50 });
  const [stats, setStats] = useState({
    products: { all: 0, love: 0, ok: 0, bad: 0 },
    planRecommendations: 0,
    planGeneral: 0,
    service: 0,
  });

  const isPlanSection =
    activeSection === 'plan_recommendations' ||
    activeSection === 'plan_general' ||
    activeSection === 'service';
  const currentPage = isPlanSection ? planPage : productPage;

  // ИСПРАВЛЕНО (P1): Обёрнут в useCallback для предотвращения лишних перезагрузок
  const loadFeedback = useCallback(async () => {
    try {
      setLoading(true);

      // Формируем URL: пагинация + фильтр по типу.
      // Списки и счётчики теперь считаются на сервере (а не по одной странице).
      const params = new URLSearchParams();
      if (isPlanSection) {
        params.set('planFeedbackType', activeSection);
        params.set('page', String(planPage));
      } else {
        params.set('page', String(productPage));
        if (activeProductTab !== 'all') {
          params.set('feedback', `bought_${activeProductTab}`);
        }
      }
      const url = `/api/admin/feedback?${params.toString()}`;

      // ИСПРАВЛЕНО (P0): Используем только cookie для авторизации
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
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

      // not_bought сервер уже исключает; фильтр оставлен как страховка.
      const allProductFeedback = (data.productFeedback || []) as ProductFeedback[];
      setProductFeedback(allProductFeedback.filter((f) => f.feedback !== 'not_bought'));

      // План-отзывы сервер фильтрует по planFeedbackType — отдаём как есть.
      setPlanFeedback((data.planFeedback || []) as PlanFeedback[]);

      // Счётчики бейджей — из серверных агрегатов по всей БД.
      setStats({
        products: {
          all: data.productFeedbackStats?.all || 0,
          love: data.productFeedbackStats?.love || 0,
          ok: data.productFeedbackStats?.ok || 0,
          bad: data.productFeedbackStats?.bad || 0,
        },
        planRecommendations: data.planFeedbackStats?.planRecommendations || 0,
        planGeneral: data.planFeedbackStats?.planGeneral || 0,
        service: data.planFeedbackStats?.service || 0,
      });

      setPageInfo({
        productTotal: data.pagination?.productFeedbackTotal || 0,
        planTotal: data.pagination?.planFeedbackTotal || 0,
        limit: data.pagination?.limit || 50,
      });
    } catch (err: any) {
      console.error('Ошибка загрузки отзывов:', err);
      setError(err.message || 'Ошибка загрузки отзывов');
    } finally {
      setLoading(false);
    }
  }, [activeSection, activeProductTab, isPlanSection, productPage, planPage, router]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  // Серверная выборка уже отфильтрована по активной вкладке/типу — показываем как есть.
  const filteredProductFeedback = productFeedback;

  // Кол-во страниц для текущей секции.
  const totalForSection = isPlanSection ? pageInfo.planTotal : pageInfo.productTotal;
  const totalPages = Math.max(1, Math.ceil(totalForSection / pageInfo.limit));

  // Сброс на первую страницу при смене секции.
  const handleSectionChange = (section: FeedbackSection) => {
    setActiveSection(section);
    setPlanPage(1);
    setProductPage(1);
  };

  // Сброс на первую страницу при смене вкладки продуктов.
  const handleProductTabChange = (tab: 'all' | 'love' | 'ok' | 'bad') => {
    setActiveProductTab(tab);
    setProductPage(1);
  };

  const goToPage = (page: number) => {
    if (isPlanSection) setPlanPage(page);
    else setProductPage(page);
  };

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
    return <AdminPageSkeleton cards={4} rows={5} />;
  }

  return (
    <div className="space-y-6">
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
              onClick={() => handleSectionChange(section.key as FeedbackSection)}
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
                onClick={() => handleProductTabChange(tab.key as any)}
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="space-y-4">
          {activeSection === 'products' ? (
            filteredProductFeedback.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                Нет отзывов в этой категории
              </div>
            ) : (
              filteredProductFeedback.map((f) => (
                <div
                  key={f.id}
                  className="p-4 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-gray-900 mb-1">
                        {f.user.firstName || ''} {f.user.lastName || ''}
                      </div>
                      <div className="text-gray-600 text-sm">
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
                  <div className="text-gray-400 text-xs">
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
              <div className="text-center py-12 text-gray-500">
                Нет отзывов по плану в этой категории
              </div>
            ) : (
              planFeedback.map((f) => (
                <div
                  key={f.id}
                  className="p-4 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-gray-900 mb-1">
                        {f.user.firstName || ''} {f.user.lastName || ''}
                      </div>
                      <div className="text-gray-600 text-xs mb-2">
                        Тип: {f.type === 'plan_recommendations' ? 'По рекомендациям' : f.type === 'plan_general' ? 'Общий по плану' : 'Сервисный'}
                      </div>
                      {f.feedback && (
                        <div className="text-gray-700 text-sm mt-2 whitespace-pre-line">
                          {f.feedback.includes('Причины:') || f.feedback.includes('Комментарий:') ? (
                            <div className="space-y-1">
                              {f.feedback.split('\n').map((line, idx) => {
                                if (line.startsWith('Причины:')) {
                                  return (
                                    <div key={idx} className="font-medium text-gray-800">
                                      {line}
                                    </div>
                                  );
                                } else if (line.startsWith('Комментарий:')) {
                                  return (
                                    <div key={idx} className="text-gray-600 italic">
                                      {line}
                                    </div>
                                  );
                                }
                                return <div key={idx}>{line}</div>;
                              })}
                            </div>
                          ) : (
                            f.feedback
                          )}
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
                      <span className="text-gray-600 text-xs">
                        {f.rating}/5
                      </span>
                    </div>
                  </div>
                  <div className="text-gray-400 text-xs">
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

        {/* Пагинация */}
        {totalForSection > pageInfo.limit && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Назад
            </button>
            <span className="text-sm text-gray-600">
              Страница {currentPage} из {totalPages}
              <span className="text-gray-400"> · всего {totalForSection}</span>
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Вперёд
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
