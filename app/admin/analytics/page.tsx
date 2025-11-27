// app/admin/analytics/page.tsx
// Страница аналитики

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn, glassCard } from '@/lib/utils';

const COLORS = ['#8B5CF6', '#EC4899', '#6366F1', '#10B981', '#F59E0B'];

export default function AnalyticsAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/stats', {
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

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-white/60">Загрузка...</div>
      </div>
    );
  }

  const chartData = [
    { name: 'Пользователи', value: stats?.users || 0 },
    { name: 'Продукты', value: stats?.products || 0 },
    { name: 'Планы', value: stats?.plans || 0 },
    { name: 'Отзывы', value: stats?.badFeedback || 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Аналитика</h1>
        <p className="text-white/60">Детальная статистика системы</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* График распределения */}
        <div className={cn(glassCard, 'p-6')}>
          <h2 className="text-xl font-bold text-white mb-6">Распределение данных</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.6)" style={{ fontSize: '12px' }} />
              <YAxis stroke="rgba(255,255,255,0.6)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
              />
              <Bar dataKey="value" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Круговая диаграмма */}
        <div className={cn(glassCard, 'p-6')}>
          <h2 className="text-xl font-bold text-white mb-6">Соотношение</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Дополнительная статистика */}
      <div className={cn(glassCard, 'p-6')}>
        <h2 className="text-xl font-bold text-white mb-6">Детальная статистика</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="text-white/60 text-sm mb-1">Новые пользователи (7 дней)</div>
            <div className="text-2xl font-bold text-white">{stats?.newUsersLast7Days || 0}</div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="text-white/60 text-sm mb-1">Новые пользователи (30 дней)</div>
            <div className="text-2xl font-bold text-white">{stats?.newUsersLast30Days || 0}</div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="text-white/60 text-sm mb-1">Активные пользователи (7 дней)</div>
            <div className="text-2xl font-bold text-white">{stats?.activeUsersLast7Days || 0}</div>
          </div>
          <div className="p-4 bg-white/5 rounded-xl">
            <div className="text-white/60 text-sm mb-1">Активные пользователи (30 дней)</div>
            <div className="text-2xl font-bold text-white">{stats?.activeUsersLast30Days || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

