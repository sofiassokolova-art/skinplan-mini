// app/admin/broadcasts/page.tsx
// Страница управления рассылками

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    skinType: '',
    ageGroup: '',
    scheduledAt: '',
  });

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        router.push('/admin/login');
        return;
      }
      
      // Проверяем валидность токена через API
      try {
        const authResponse = await fetch('/api/admin/auth', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });
        
        if (authResponse.ok) {
          const authData = await authResponse.json();
          if (authData.valid) {
    loadBroadcasts();
          } else {
            router.push('/admin/login');
          }
        } else {
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/admin/login');
      }
    };
    
    checkAuthAndLoad();
  }, [router]);

  const loadBroadcasts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      
      if (!token) {
        router.push('/admin/login');
        return;
      }
      
      const response = await fetch('/api/admin/broadcasts', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (response.status === 401) {
        // Токен невалиден - перенаправляем на логин
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error loading broadcasts:', errorData);
        if (response.status === 403 || response.status === 401) {
          router.push('/admin/login');
        }
        return;
      }

      const data = await response.json();
      setBroadcasts(data.broadcasts || []);
    } catch (error) {
      console.error('Error loading broadcasts:', error);
      // При сетевой ошибке не перенаправляем, просто показываем ошибку
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('admin_token');
      const filtersJson: any = {};
      if (formData.skinType) filtersJson.skinType = formData.skinType;
      if (formData.ageGroup) filtersJson.ageGroup = formData.ageGroup;

      if (!token) {
        router.push('/admin/login');
        return;
      }

      const response = await fetch('/api/admin/broadcasts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          message: formData.message,
          filtersJson,
          scheduledAt: formData.scheduledAt || null,
        }),
      });

      if (response.ok) {
        setShowForm(false);
        setFormData({ title: '', message: '', skinType: '', ageGroup: '', scheduledAt: '' });
        loadBroadcasts();
      }
    } catch (error) {
      console.error('Error creating broadcast:', error);
      alert('Ошибка при создании рассылки');
    }
  };

  const handleSend = async (id: string) => {
    if (!confirm('Отправить рассылку сейчас?')) return;

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/broadcasts/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
      });

      if (response.ok) {
        loadBroadcasts();
        alert('Рассылка отправлена!');
      } else {
        alert('Ошибка при отправке рассылки');
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      alert('Ошибка при отправке рассылки');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-600">Загрузка...</div>;
  }

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-black text-gray-900">Рассылки</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all"
        >
          {showForm ? 'Отменить' : '+ Создать рассылку'}
        </button>
      </div>

      {showForm && (
        <div className="glass rounded-3xl p-8 mb-8 bg-white">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Новая рассылка</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Название</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Сообщение</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400"
                rows={5}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Тип кожи (опционально)</label>
                <select
                  value={formData.skinType}
                  onChange={(e) => setFormData({ ...formData, skinType: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-gray-400"
                >
                  <option value="">Все</option>
                  <option value="dry">Сухая</option>
                  <option value="oily">Жирная</option>
                  <option value="combo">Комбинированная</option>
                  <option value="normal">Нормальная</option>
                  <option value="sensitive">Чувствительная</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Возрастная группа (опционально)</label>
                <select
                  value={formData.ageGroup}
                  onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-gray-400"
                >
                  <option value="">Все</option>
                  <option value="18_25">18-25</option>
                  <option value="26_30">26-30</option>
                  <option value="31_40">31-40</option>
                  <option value="41_50">41-50</option>
                  <option value="50_plus">50+</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">Запланировать на (опционально)</label>
              <input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-gray-400"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all"
            >
              Создать
            </button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {broadcasts.length === 0 ? (
          <div className="glass rounded-3xl p-8 text-center text-gray-600 bg-white">
            Пока нет рассылок
          </div>
        ) : (
          broadcasts.map((broadcast) => (
            <div key={broadcast.id} className="glass rounded-3xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">{broadcast.title}</h3>
                  <p className="text-white/80 mb-4 whitespace-pre-wrap">{broadcast.message}</p>
                  
                  <div className="flex gap-4 text-sm text-white/60">
                    <span>
                      Статус: <span className={`font-bold ${
                        broadcast.status === 'completed' ? 'text-emerald-400' :
                        broadcast.status === 'sending' ? 'text-blue-400' :
                        broadcast.status === 'scheduled' ? 'text-yellow-400' :
                        'text-white/60'
                      }`}>
                        {broadcast.status === 'draft' ? 'Черновик' :
                         broadcast.status === 'scheduled' ? 'Запланировано' :
                         broadcast.status === 'sending' ? 'Отправляется' :
                         broadcast.status === 'completed' ? 'Отправлено' :
                         broadcast.status}
                      </span>
                    </span>
                    {broadcast.totalCount > 0 && (
                      <>
                        <span>Получателей: {broadcast.totalCount}</span>
                        <span>Отправлено: {broadcast.sentCount}</span>
                        <span>Ошибок: {broadcast.failedCount}</span>
                      </>
                    )}
                  </div>
                </div>
                
                {broadcast.status === 'draft' && (
                  <button
                    onClick={() => handleSend(broadcast.id)}
                    className="px-4 py-2 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white rounded-xl font-bold hover:shadow-[0_8px_32px_rgba(139,92,246,0.5)] transition-all"
                  >
                    Отправить
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

