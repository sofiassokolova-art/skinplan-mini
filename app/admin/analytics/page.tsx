// app/admin/analytics/page.tsx
// Страница аналитики

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#8B5CF6', '#EC4899', '#6366F1', '#10B981', '#F59E0B'];

// ИСПРАВЛЕНО (P2): Типизация stats
interface AdminStats {
  users?: number;
  products?: number;
  plans?: number;
  badFeedback?: number;
  newUsersLast7Days?: number;
  newUsersLast30Days?: number;
  activeUsersLast7Days?: number;
  activeUsersLast30Days?: number;
}

export default function AnalyticsAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // ИСПРАВЛЕНО (P0): Используем только cookie для авторизации
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Content-Type': 'application/json',
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
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6 pt-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Аналитика</h1>
          <p className="text-gray-600">Детальная статистика системы</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="text-center py-12 text-gray-500">
            Нет данных для отображения
          </div>
        </div>
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
    <div className="space-y-6 pt-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Аналитика</h1>
        <p className="text-gray-600">Детальная статистика системы</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* График распределения */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Распределение данных</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
              <XAxis dataKey="name" stroke="rgba(0,0,0,0.6)" style={{ fontSize: '12px' }} />
              <YAxis stroke="rgba(0,0,0,0.6)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '12px',
                  color: '#000',
                }}
              />
              <Bar dataKey="value" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Круговая диаграмма */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Соотношение</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid rgba(0,0,0,0.1)',
                  borderRadius: '12px',
                  color: '#000',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Дополнительная статистика */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Детальная статистика</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-gray-600 text-sm mb-1">Новые пользователи (7 дней)</div>
            <div className="text-2xl font-bold text-gray-900">{stats?.newUsersLast7Days || 0}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-gray-600 text-sm mb-1">Новые пользователи (30 дней)</div>
            <div className="text-2xl font-bold text-gray-900">{stats?.newUsersLast30Days || 0}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-gray-600 text-sm mb-1">Активные пользователи (7 дней)</div>
            <div className="text-2xl font-bold text-gray-900">{stats?.activeUsersLast7Days || 0}</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="text-gray-600 text-sm mb-1">Активные пользователи (30 дней)</div>
            <div className="text-2xl font-bold text-gray-900">{stats?.activeUsersLast30Days || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

