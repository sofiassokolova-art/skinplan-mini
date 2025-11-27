// app/admin/broadcasts/page.tsx
// Главная страница со списком рассылок

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Calendar, Users as UsersIcon, CheckCircle, XCircle, Clock } from 'lucide-react';
import Link from 'next/link';

interface Broadcast {
  id: string;
  title: string;
  message: string;
  filtersJson: any;
  status: string;
  scheduledAt: string | null;
  sentCount: number;
  failedCount: number;
  totalCount: number;
  createdAt: string;
  sentAt: string | null;
}

export default function BroadcastsPage() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBroadcasts();
  }, []);

  const loadBroadcasts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      
      const response = await fetch('/api/admin/broadcasts', {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        // Layout сам обработает редирект
        return;
      }

      if (!response.ok) {
        throw new Error('Ошибка загрузки рассылок');
      }

      const data = await response.json();
      setBroadcasts(data.broadcasts || []);
    } catch (error) {
      console.error('Error loading broadcasts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
      draft: { label: 'Черновик', color: 'text-[#64748b]', bgColor: 'bg-[#f1f5f9]' },
      scheduled: { label: 'Запланировано', color: 'text-[#f59e0b]', bgColor: 'bg-[#fef3c7]' },
      sending: { label: 'Отправляется', color: 'text-[#3b82f6]', bgColor: 'bg-[#dbeafe]' },
      completed: { label: 'Отправлено', color: 'text-[#16a34a]', bgColor: 'bg-[#dcfce7]' },
    };
    
    const statusInfo = statusMap[status] || statusMap.draft;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.bgColor} ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-[#64748b]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="p-10">
      {/* Заголовок и кнопка */}
      <div className="flex items-center justify-between mb-16">
        <div>
          <h1 className="text-[40px] font-bold text-[#1e1e1e] mb-2">Рассылки</h1>
          <p className="text-[#64748b]">Управление рассылками пользователям</p>
        </div>
        <Link
          href="/admin/broadcast"
          className="px-6 py-3 bg-[#8b5cf6] text-white rounded-xl font-semibold hover:bg-[#7c3aed] transition-colors flex items-center gap-2 shadow-lg shadow-[#8b5cf6]/20"
        >
          <Send size={20} />
          + Новая рассылка
        </Link>
      </div>

      {/* Список рассылок */}
      {broadcasts.length === 0 ? (
        <div 
          className="bg-white rounded-[20px] border border-[#e2e8f0] p-12 text-center"
          style={{ boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)' }}
        >
          <Send size={48} className="mx-auto mb-4 text-[#64748b]" />
          <p className="text-[#64748b] text-lg mb-6">Пока нет рассылок</p>
          <Link
            href="/admin/broadcast"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#8b5cf6] text-white rounded-xl font-semibold hover:bg-[#7c3aed] transition-colors"
          >
            <Send size={18} />
            Создать первую рассылку
          </Link>
        </div>
      ) : (
        <div className="space-y-16">
          {broadcasts.map((broadcast) => (
            <div
              key={broadcast.id}
              className="bg-white rounded-[20px] border border-[#e2e8f0] p-6 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-300"
              style={{ boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)' }}
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-bold text-[#1e1e1e]">{broadcast.title}</h3>
                    {getStatusBadge(broadcast.status)}
                  </div>
                  
                  <p className="text-[#64748b] text-sm mb-4 line-clamp-2">{broadcast.message}</p>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 text-[#64748b]">
                      <UsersIcon size={16} />
                      <span className="font-semibold text-[#1e1e1e]">{broadcast.totalCount || 0}</span>
                      <span>пользователей</span>
                    </div>
                    
                    {broadcast.status === 'completed' && (
                      <>
                        <div className="flex items-center gap-2 text-[#16a34a]">
                          <CheckCircle size={16} />
                          <span className="font-semibold">{broadcast.sentCount}</span>
                          <span>отправлено</span>
                        </div>
                        {broadcast.failedCount > 0 && (
                          <div className="flex items-center gap-2 text-[#dc2626]">
                            <XCircle size={16} />
                            <span className="font-semibold">{broadcast.failedCount}</span>
                            <span>ошибок</span>
                          </div>
                        )}
                      </>
                    )}
                    
                    <div className="flex items-center gap-2 text-[#64748b]">
                      <Calendar size={16} />
                      <span>{formatDate(broadcast.sentAt || broadcast.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
