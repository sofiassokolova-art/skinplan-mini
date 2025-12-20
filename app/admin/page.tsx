// app/admin/page.tsx
// Дашборд админ-панели - премиум верстка 2025

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Stats {
  users: number;
  products: number;
  plans: number;
  badFeedback: number;
  replacements: number;
  revenue?: number;
  retakingUsers?: number; // Пользователи, которые перепрошли анкету
  newUsersLast7Days?: number;
  newUsersLast30Days?: number;
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
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    users: 0,
    products: 0,
    plans: 0,
    badFeedback: 0,
    replacements: 0,
    revenue: 0,
  });
  const [recentFeedback, setRecentFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userGrowth, setUserGrowth] = useState<{ date: string; users: number }[]>([]);
  const [growthPeriod, setGrowthPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [growthLoading, setGrowthLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadUserGrowth();
  }, [growthPeriod]);

  const loadStats = async () => {
    try {
      setError(null);
      // ИСПРАВЛЕНО (P0): Убрали localStorage и Authorization - cookie-only подход
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // ИСПРАВЛЕНО (P0): Редирект на login при 401
      if (response.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        // ИСПРАВЛЕНО (P1): Нормализация stats с дефолтами вместо {}
        setStats({
          users: data.stats?.users ?? 0,
          products: data.stats?.products ?? 0,
          plans: data.stats?.plans ?? 0,
          badFeedback: data.stats?.badFeedback ?? 0,
          replacements: data.stats?.replacements ?? 0,
          revenue: data.stats?.revenue ?? 0,
          retakingUsers: data.stats?.retakingUsers ?? 0,
          newUsersLast7Days: data.stats?.newUsersLast7Days ?? 0,
          newUsersLast30Days: data.stats?.newUsersLast30Days ?? 0,
        });
        setRecentFeedback(data.recentFeedback || []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.error || 'Ошибка загрузки статистики');
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      setError('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const loadUserGrowth = async () => {
    setGrowthLoading(true);
    try {
      // ИСПРАВЛЕНО (P0): Убрали localStorage и Authorization - cookie-only подход
      const response = await fetch(`/api/admin/stats?period=${growthPeriod}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // ИСПРАВЛЕНО (P0): Редирект на login при 401
      if (response.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.userGrowth && Array.isArray(data.userGrowth)) {
          setUserGrowth(data.userGrowth);
        } else {
          setUserGrowth([]);
        }
      }
    } catch (error) {
      console.error('Error loading user growth:', error);
    } finally {
      setGrowthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-red-600 mb-4">Ошибка: {error}</div>
          <button
            onClick={() => {
              setLoading(true);
              loadStats();
            }}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Форматируем дату
  const currentDate = new Date().toLocaleDateString('ru-RU', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  // Подготовка данных для метрик с изменениями
  const metricsData = [
    { 
      label: 'Всего пользователей', 
      value: stats.users || 0, 
      change: stats.newUsersLast30Days && stats.users > 0 
        ? (() => {
            const previousUsers = Math.max(stats.users - stats.newUsersLast30Days, 1);
            const growthPercent = Math.round((stats.newUsersLast30Days / previousUsers) * 100);
            return `+${growthPercent}%`;
          })()
        : null,
      color: 'from-purple-600 to-purple-400'
    },
    { 
      label: 'Активных планов', 
      value: stats.plans || 0, 
      change: null,
      color: 'from-pink-600 to-rose-400'
    },
    { 
      label: 'Перепрошли анкету', 
      value: stats.retakingUsers || 0, 
      change: null,
      color: 'from-indigo-600 to-blue-400'
    },
    { 
      label: 'Продуктов в базе', 
      value: stats.products || 0, 
      change: null, // ИСПРАВЛЕНО (P1): Убрали хак с products === 120
      color: 'from-emerald-600 to-teal-400'
    },
    { 
      label: 'Плохих отзывов (Bad)', 
      value: stats.badFeedback || 0, 
      change: null,
      color: 'from-red-600 to-orange-500'
    },
    { 
      label: 'Замен продуктов', 
      value: stats.replacements || 0, 
      change: null,
      color: 'from-blue-600 to-cyan-400'
    },
    { 
      label: 'Доход партнёрки', 
      value: stats.revenue ? `₽ ${stats.revenue.toLocaleString('ru-RU')}` : '₽ 0', 
      change: null,
      color: 'from-amber-600 to-yellow-400'
    },
  ];

  return (
    <div className="w-full">
      {/* Заголовок */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Дашборд
        </h1>
        <p className="text-sm text-gray-600">{currentDate}</p>
      </div>
      
      {/* Сетка из 7 метрик */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {metricsData.map((m, i) => (
          <div 
            key={i} 
            className="admin-card p-6 min-h-[180px] flex flex-col justify-between"
          >
            <div className="text-gray-600 text-sm font-medium mb-3">{m.label}</div>
            <div className={`text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${m.color} mb-3`}>
              {m.value}
            </div>
            {m.change && (
              <div className={cn(
                'text-sm font-medium',
                m.change.startsWith('+')
                  ? 'text-emerald-600' 
                  : 'text-red-600'
              )}>
                {m.change + ' за 30 дней'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Блок графика */}
      <div className="admin-card p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Рост пользователей</h2>
            <p className="text-sm text-gray-500 mt-1">
              {growthPeriod === 'day' && 'Всего пользователей за последние 24 часа (накопительно)'}
              {growthPeriod === 'week' && 'Всего пользователей за последние 7 дней (накопительно)'}
              {growthPeriod === 'month' && 'Всего пользователей за последние 30 дней (накопительно)'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGrowthPeriod('day')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 backdrop-blur-sm ${
                growthPeriod === 'day'
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-white/60 text-gray-700 hover:bg-white/80 hover:shadow-sm'
              }`}
            >
              День
            </button>
            <button
              onClick={() => setGrowthPeriod('week')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 backdrop-blur-sm ${
                growthPeriod === 'week'
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-white/60 text-gray-700 hover:bg-white/80 hover:shadow-sm'
              }`}
            >
              Неделя
            </button>
            <button
              onClick={() => setGrowthPeriod('month')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 backdrop-blur-sm ${
                growthPeriod === 'month'
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-white/60 text-gray-700 hover:bg-white/80 hover:shadow-sm'
              }`}
            >
              Месяц
            </button>
          </div>
        </div>
        <div className="h-96">
          {growthLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Загрузка данных...</div>
            </div>
          ) : userGrowth.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <TrendingUp className="mx-auto mb-4 text-gray-400" size={48} />
                <p className="text-gray-500">Нет данных за выбранный период</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  tick={{ fill: '#6b7280', fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  tick={{ fill: '#6b7280', fontSize: '12px' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    color: '#111827',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  labelStyle={{ color: '#111827', fontWeight: 'bold' }}
                />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  dot={{ fill: '#8B5CF6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Блок "Последние действия" */}
      <div className="admin-card p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Последние действия</h2>
        <div className="space-y-4">
          {recentFeedback.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Нет отзывов</p>
          ) : (
            recentFeedback.slice(0, 10).map((f) => (
              <div
                key={f.id}
                className="p-4 rounded-xl bg-white/40 backdrop-blur-sm border border-gray-200/50 hover:bg-white/60 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold flex-shrink-0">
                      {(f.user.firstName?.[0] || f.user.lastName?.[0] || '?').toUpperCase()}
                    </div>
                    <span className="text-gray-900 font-medium">
                      {f.user.firstName || ''} {f.user.lastName || ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium',
                      f.feedback === 'bought_love' 
                        ? 'bg-pink-100 text-pink-700'
                        : f.feedback === 'bought_ok'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                    )}>
                      {f.feedback === 'bought_love' ? 'Love' : f.feedback === 'bought_ok' ? 'OK' : 'Bad'}
                    </span>
                    <span className="text-gray-500 text-xs whitespace-nowrap">
                      {new Date(f.createdAt).toLocaleDateString('ru-RU', { 
                        day: '2-digit', 
                        month: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                </div>
                <p className="text-gray-700 text-sm ml-[52px]">
                  {f.product.brand} {f.product.name}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
