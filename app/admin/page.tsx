// app/admin/page.tsx
// Дашборд админ-панели - премиум верстка 2025

'use client';

import { useEffect, useState } from 'react';
import { Users, Package, FileText, MessageSquare, RefreshCw, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Stats {
  users: number;
  products: number;
  plans: number;
  badFeedback: number;
  replacements: number;
  revenue?: number;
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
  const [userGrowth, setUserGrowth] = useState<{ date: string; users: number }[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

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
        
        if (data.userGrowth && Array.isArray(data.userGrowth)) {
          setUserGrowth(data.userGrowth);
        } else {
          setUserGrowth([]);
        }
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-600">Загрузка...</div>
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
      change: stats.newUsersLast30Days ? `+${Math.round((stats.newUsersLast30Days / Math.max(stats.users - stats.newUsersLast30Days, 1)) * 100)}%` : null,
      color: 'from-purple-600 to-purple-400'
    },
    { 
      label: 'Активных планов', 
      value: stats.plans || 0, 
      change: null,
      color: 'from-pink-600 to-rose-400'
    },
    { 
      label: 'Продуктов в базе', 
      value: stats.products || 0, 
      change: stats.products === 120 ? 'new' : null,
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
      <h1 className="text-4xl font-black text-gray-900 mb-10">
        SkinIQ Admin • {currentDate}
      </h1>
      
      {/* Сетка из 6 метрик */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-12">
        {metricsData.map((m, i) => (
          <div 
            key={i} 
            className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all p-8 min-h-44 flex flex-col justify-between"
          >
            <div className="text-gray-500 text-sm font-medium mb-4">{m.label}</div>
            <div className={`text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${m.color} mb-4`}>
              {m.value}
            </div>
            {m.change && (
              <div className={cn(
                'text-sm font-medium',
                m.change.startsWith('+') || m.change === 'new' 
                  ? 'text-emerald-600' 
                  : 'text-red-600'
              )}>
                {m.change === 'new' ? '✓ Новый сид' : m.change + ' за 28 дней'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Блок графика */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Рост пользователей за 30 дней</h2>
        <div className="h-96">
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
        </div>
      </div>

      {/* Блок "Последние действия" */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Последние действия</h2>
        <div className="space-y-4">
          {recentFeedback.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Нет отзывов</p>
          ) : (
            recentFeedback.slice(0, 10).map((f) => (
              <div
                key={f.id}
                className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
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
