// app/admin/page.tsx
// Дашборд админ-панели в glassmorphism стиле

'use client';

import { useEffect, useState } from 'react';
import { Users, Package, FileText, MessageSquare, RefreshCw, TrendingUp } from 'lucide-react';
import { cn, glassCard, glassCardHover } from '@/lib/utils';
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

const metricCards = [
  { key: 'users', label: 'Пользователей', icon: Users, color: 'from-[#8B5CF6] to-[#EC4899]' },
  { key: 'plans', label: 'Активных планов', icon: FileText, color: 'from-[#EC4899] to-[#8B5CF6]' },
  { key: 'products', label: 'Продуктов', icon: Package, color: 'from-[#8B5CF6] to-[#6366F1]' },
  { key: 'badFeedback', label: 'Плохих отзывов', icon: MessageSquare, color: 'from-[#EF4444] to-[#F97316]' },
  { key: 'replacements', label: 'Замен продуктов', icon: RefreshCw, color: 'from-[#10B981] to-[#3B82F6]' },
  { key: 'revenue', label: 'Доход (₽)', icon: TrendingUp, color: 'from-[#F59E0B] to-[#EF4444]' },
];

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
        
        // Генерируем данные для графика (за последние 7 дней)
        const growthData = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          growthData.push({
            date: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
            users: Math.floor(Math.random() * 50) + (data.stats?.users || 0) - 25,
          });
        }
        setUserGrowth(growthData);
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
        <div className="text-white/60">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Дашборд</h1>
          <p className="text-white/60">Обзор системы SkinIQ</p>
        </div>
        <button
          onClick={loadStats}
          className={cn(
            glassCard,
            'px-6 py-3 text-white/80 hover:text-white transition-colors'
          )}
        >
          Обновить
        </button>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metricCards.map((card) => {
          const Icon = card.icon;
          const value = stats[card.key as keyof Stats] || 0;
          
          return (
            <div
              key={card.key}
              className={cn(
                glassCard,
                glassCardHover,
                'p-6'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn('p-3 rounded-xl bg-gradient-to-r', card.color)}>
                  <Icon className="text-white" size={24} />
                </div>
                <span className="text-3xl font-bold text-white">{value.toLocaleString()}</span>
              </div>
              <p className="text-white/60 text-sm">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* График роста пользователей */}
      <div className={cn(glassCard, 'p-6')}>
        <h2 className="text-xl font-bold text-white mb-6">Рост пользователей</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={userGrowth}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255,255,255,0.6)"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.6)"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                color: '#fff',
              }}
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

      {/* Последние отзывы */}
      <div className={cn(glassCard, 'p-6')}>
        <h2 className="text-xl font-bold text-white mb-6">Последние отзывы</h2>
        <div className="space-y-4">
          {recentFeedback.length === 0 ? (
            <p className="text-white/60 text-center py-8">Нет отзывов</p>
          ) : (
            recentFeedback.slice(0, 10).map((f) => (
              <div
                key={f.id}
                className="p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">
                    {f.user.firstName || ''} {f.user.lastName || ''}
                  </span>
                  <span className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium',
                    f.feedback === 'bought_love' 
                      ? 'bg-pink-500/20 text-pink-300'
                      : f.feedback === 'bought_ok'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-red-500/20 text-red-300'
                  )}>
                    {f.feedback === 'bought_love' ? 'Love' : f.feedback === 'bought_ok' ? 'OK' : 'Bad'}
                  </span>
                </div>
                <p className="text-white/80 text-sm mb-1">
                  {f.product.brand} {f.product.name}
                </p>
                <p className="text-white/40 text-xs">
                  {new Date(f.createdAt).toLocaleDateString('ru-RU')}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
