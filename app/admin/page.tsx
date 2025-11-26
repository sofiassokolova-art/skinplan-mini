// app/admin/page.tsx
// Главная страница админ-панели (дашборд)

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MetricsDashboard from '@/components/MetricsDashboard';

interface Stats {
  users: number;
  products: number;
  plans: number;
  badFeedback: number;
  replacements: number;
  churnRate?: number;
  avgLTV?: number;
  newUsersLast7Days?: number;
  newUsersLast30Days?: number;
  activeUsersLast7Days?: number;
  activeUsersLast30Days?: number;
  totalWishlistItems?: number;
  totalProductFeedback?: number;
  avgFeedbackRating?: number;
}

interface TopProduct {
  id: number;
  name: string;
  brand: string;
  wishlistCount: number;
  feedbackCount: number;
  avgRating: number;
}

interface Feedback {
  id: string;
  user: {
    firstName: string | null;
    lastName: string | null;
  };
  product: {
    name: string;
    brand: string;
  };
  feedback: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    users: 0,
    products: 0,
    plans: 0,
    badFeedback: 0,
    replacements: 0,
  });
  const [recentFeedback, setRecentFeedback] = useState<Feedback[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        const response = await fetch('/api/admin/stats', {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setStats(data.stats || {});
          setRecentFeedback(data.recentFeedback || []);
          setTopProducts(data.topProducts || []);
        }
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>;
  }

  // Формируем данные для дашборда метрик
  const metricsData = {
    users: stats.users,
    products: stats.products,
    plans: stats.plans,
    badFeedback: stats.badFeedback,
    replacements: stats.replacements,
    churnRate: stats.churnRate || 0,
    avgLTV: stats.avgLTV || 0,
    topProducts: topProducts,
    newUsersLast7Days: stats.newUsersLast7Days || 0,
    newUsersLast30Days: stats.newUsersLast30Days || 0,
    activeUsersLast7Days: stats.activeUsersLast7Days || 0,
    activeUsersLast30Days: stats.activeUsersLast30Days || 0,
    totalWishlistItems: stats.totalWishlistItems || 0,
    totalProductFeedback: stats.totalProductFeedback || 0,
    avgFeedbackRating: stats.avgFeedbackRating || 0,
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Админ-панель SkinIQ</h1>
      
      {/* Дашборд метрик */}
      <MetricsDashboard data={metricsData} />
      
      {/* Ключевые метрики */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-10">
        <div className="bg-gradient-to-br from-purple-600 to-pink-600 text-white p-6 rounded-3xl">
          <div className="text-4xl font-bold">{stats.users.toLocaleString()}</div>
          <div>Пользователей</div>
        </div>
        <div className="bg-emerald-600 text-white p-6 rounded-3xl">
          <div className="text-4xl font-bold">{stats.plans}</div>
          <div>Активных планов</div>
        </div>
        <div className="bg-blue-600 text-white p-6 rounded-3xl">
          <div className="text-4xl font-bold">{stats.products}</div>
          <div>Продуктов в базе</div>
        </div>
        <div className="bg-red-600 text-white p-6 rounded-3xl">
          <div className="text-4xl font-bold">{stats.badFeedback}</div>
          <div>Плохих отзывов</div>
        </div>
        <div className="bg-orange-600 text-white p-6 rounded-3xl">
          <div className="text-4xl font-bold">{stats.replacements}</div>
          <div>Замен продуктов</div>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <Link href="/admin/products" className="bg-white border-2 border-purple-600 text-purple-600 p-8 rounded-3xl text-center font-bold text-xl hover:bg-purple-50 transition">
          Управление продуктами
        </Link>
        <Link href="/admin/rules" className="bg-white border-2 border-emerald-600 text-emerald-600 p-8 rounded-3xl text-center font-bold text-xl hover:bg-emerald-50 transition">
          Правила рекомендаций
        </Link>
        <Link href="/admin/users" className="bg-white border-2 border-blue-600 text-blue-600 p-8 rounded-3xl text-center font-bold text-xl hover:bg-blue-50 transition">
          Пользователи и планы
        </Link>
        <Link href="/admin/broadcasts" className="bg-white border-2 border-orange-600 text-orange-600 p-8 rounded-3xl text-center font-bold text-xl hover:bg-orange-50 transition">
          Рассылки
        </Link>
      </div>

      {/* Последние отзывы */}
      <div className="bg-white rounded-3xl p-6 shadow-lg">
        <h2 className="text-xl font-bold mb-4">Последняя обратная связь</h2>
        {recentFeedback.length === 0 ? (
          <p className="text-gray-500">Пока нет отзывов</p>
        ) : (
          <div className="space-y-3">
            {recentFeedback.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-3 border-b">
                <div>
                  <span className="font-medium">
                    {f.user.firstName || ''} {f.user.lastName || ''}
                  </span>
                  <span className="text-gray-500">
                    {' → '}
                    {f.product.brand} {f.product.name}
                  </span>
                </div>
                <span
                  className={`px-4 py-2 rounded-full text-white text-sm font-bold ${
                    f.feedback === 'bought_love'
                      ? 'bg-pink-500'
                      : f.feedback === 'bought_ok'
                      ? 'bg-blue-500'
                      : 'bg-gray-700'
                  }`}
                >
                  {f.feedback === 'bought_love'
                    ? 'Love'
                    : f.feedback === 'bought_ok'
                    ? 'OK'
                    : 'Bad'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
