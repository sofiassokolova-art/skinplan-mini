// app/admin/page.tsx
// Дашборд админ-панели в премиальном SaaS-стиле 2025

'use client';

import { useEffect, useState } from 'react';
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
        <div className="text-[#64748b]">Загрузка...</div>
      </div>
    );
  }

  // Форматируем дату
  const currentDate = new Date().toLocaleDateString('ru-RU', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });

  // Подготовка данных для метрик
  const metricsData = [
    { 
      label: 'Всего пользователей', 
      value: stats.users || 0, 
      change: stats.newUsersLast30Days ? `+${Math.round((stats.newUsersLast30Days / Math.max(stats.users - stats.newUsersLast30Days, 1)) * 100)}%` : null,
    },
    { 
      label: 'Активных планов', 
      value: stats.plans || 0, 
      change: null,
    },
    { 
      label: 'Продуктов в базе', 
      value: stats.products || 0, 
      change: stats.products === 120 ? 'new' : null,
    },
    { 
      label: 'Плохих отзывов (Bad)', 
      value: stats.badFeedback || 0, 
      change: null,
    },
    { 
      label: 'Замен продуктов', 
      value: stats.replacements || 0, 
      change: null,
    },
    { 
      label: 'Доход партнёрки', 
      value: stats.revenue ? `₽ ${stats.revenue.toLocaleString('ru-RU')}` : '₽ 0', 
      change: null,
    },
  ];

  return (
    <div className="p-10">
      {/* Заголовок */}
      <h1 className="text-[40px] font-bold text-[#1e1e1e] mb-10">
        Admin • {currentDate}
      </h1>
      
      {/* 6 больших метрик - сетка 3×2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-10">
        {metricsData.map((m, i) => (
          <div 
            key={i} 
            className="bg-white rounded-[20px] border border-[#e2e8f0] p-8 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
            style={{
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)'
            }}
          >
            <div className="text-[#64748b] text-sm font-medium mb-3">{m.label}</div>
            <div className="flex items-end justify-between">
              <div className="text-[56px] font-bold text-[#1e1e1e] leading-none">
                {m.value}
              </div>
              {m.change && (
                <div className={`px-3 py-1 rounded-full text-xs font-semibold mb-2 ${
                  m.change.startsWith('+') || m.change === 'new'
                    ? 'bg-[#dcfce7] text-[#16a34a]'
                    : 'bg-[#fee2e2] text-[#dc2626]'
                }`}>
                  {m.change === 'new' ? 'new' : m.change}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* График роста пользователей */}
      <div 
        className="bg-white rounded-[20px] border border-[#e2e8f0] p-8 mb-10"
        style={{
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)'
        }}
      >
        <h2 className="text-2xl font-bold text-[#1e1e1e] mb-8">Рост пользователей за 30 дней</h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={userGrowth}>
            <defs>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1} />
                <stop offset="100%" stopColor="#ec4899" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="date" 
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: '12px', fontFamily: 'Inter' }}
            />
            <YAxis 
              stroke="#94a3b8"
              tick={{ fill: '#64748b', fontSize: '12px', fontFamily: 'Inter' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                color: '#1e1e1e',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
                fontFamily: 'Inter',
              }}
              labelStyle={{ color: '#1e1e1e', fontWeight: 600, fontFamily: 'Inter' }}
            />
            <Line
              type="monotone"
              dataKey="users"
              stroke="url(#colorUsers)"
              strokeWidth={3}
              dot={{ fill: '#8b5cf6', r: 5 }}
              activeDot={{ r: 7, fill: '#8b5cf6' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Последние действия (отзывы) */}
      <div 
        className="bg-white rounded-[20px] border border-[#e2e8f0] p-8"
        style={{
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)'
        }}
      >
        <h2 className="text-2xl font-bold text-[#1e1e1e] mb-8">Последние действия</h2>
        <div className="space-y-3">
          {recentFeedback.length === 0 ? (
            <p className="text-[#64748b] text-center py-12">Нет отзывов</p>
          ) : (
            recentFeedback.slice(0, 10).map((f) => (
              <div
                key={f.id}
                className="p-4 rounded-xl border border-[#e2e8f0] hover:bg-[#f8f9fa] transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] flex items-center justify-center text-white font-semibold text-sm">
                      {(f.user.firstName?.[0] || f.user.lastName?.[0] || '?').toUpperCase()}
                    </div>
                    <span className="text-[#1e1e1e] font-semibold">
                      {f.user.firstName || ''} {f.user.lastName || ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      f.feedback === 'bought_love' 
                        ? 'bg-[#fce7f3] text-[#be185d]'
                        : f.feedback === 'bought_ok'
                        ? 'bg-[#dbeafe] text-[#1e40af]'
                        : 'bg-[#fee2e2] text-[#dc2626]'
                    }`}>
                      {f.feedback === 'bought_love' ? 'Love' : f.feedback === 'bought_ok' ? 'OK' : 'Bad'}
                    </span>
                    <span className="text-[#64748b] text-xs">
                      {new Date(f.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                <p className="text-[#64748b] text-sm ml-[52px]">
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
