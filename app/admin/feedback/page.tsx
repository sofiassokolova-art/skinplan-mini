// app/admin/feedback/page.tsx
// Страница отзывов с вкладками Love / OK / Bad

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  feedback: 'bought_love' | 'bought_ok' | 'bought_bad';
  createdAt: string;
}

export default function FeedbackAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allFeedback, setAllFeedback] = useState<Feedback[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'love' | 'ok' | 'bad'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/feedback', {
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
      setAllFeedback(data.feedback || []);
    } catch (err: any) {
      console.error('Ошибка загрузки отзывов:', err);
      setError(err.message || 'Ошибка загрузки отзывов');
    } finally {
      setLoading(false);
    }
  };

  const filteredFeedback = allFeedback.filter((f) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'love') return f.feedback === 'bought_love';
    if (activeTab === 'ok') return f.feedback === 'bought_ok';
    if (activeTab === 'bad') return f.feedback === 'bought_bad';
    return true;
  });

  const stats = {
    all: allFeedback.length,
    love: allFeedback.filter((f) => f.feedback === 'bought_love').length,
    ok: allFeedback.filter((f) => f.feedback === 'bought_ok').length,
    bad: allFeedback.filter((f) => f.feedback === 'bought_bad').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-white/60">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Отзывы</h1>
        <p className="text-white/60">Обратная связь от пользователей</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Вкладки */}
      <div className="flex gap-4 border-b border-white/10">
        {[
          { key: 'all', label: 'Все', icon: null, count: stats.all },
          { key: 'love', label: 'Love', icon: Heart, count: stats.love, color: 'text-pink-400' },
          { key: 'ok', label: 'OK', icon: ThumbsUp, count: stats.ok, color: 'text-blue-400' },
          { key: 'bad', label: 'Bad', icon: ThumbsDown, count: stats.bad, color: 'text-red-400' },
        ].map((tab) => {
          const Icon = tab.icon;
                return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                'px-6 py-3 border-b-2 transition-colors flex items-center gap-2',
                activeTab === tab.key
                  ? 'border-[#8B5CF6] text-white'
                  : 'border-transparent text-white/60 hover:text-white'
              )}
            >
              {Icon && <Icon className={tab.color} size={20} />}
              <span className="font-medium">{tab.label}</span>
              <span className={cn(
                'px-2 py-1 rounded text-xs',
                activeTab === tab.key ? 'bg-white/10' : 'bg-white/5'
              )}>
                {tab.count}
                      </span>
            </button>
                );
              })}
            </div>

      {/* Список отзывов */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="space-y-4">
          {filteredFeedback.length === 0 ? (
            <div className="text-center py-12 text-white/60">
              Нет отзывов в этой категории
            </div>
          ) : (
            filteredFeedback.map((f) => (
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
          )}
        </div>
      </div>
    </div>
  );
}
