// app/admin/broadcast/page.tsx
// Страница создания рассылок

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, RefreshCw, AlertCircle, Image as ImageIcon, Plus, X } from 'lucide-react';
import { cn, glassCard } from '@/lib/utils';

interface Filters {
  sendToAll?: boolean;
  skinTypes: string[];
  concerns: string[];
  planDay?: string;
  lastActive?: string;
  hasPurchases?: boolean;
}

interface Button {
  text: string;
  url: string;
}

const SKIN_TYPES = [
  { value: 'oily', label: 'Жирная' },
  { value: 'dry', label: 'Сухая' },
  { value: 'combo', label: 'Комбинированная' },
  { value: 'sensitive', label: 'Чувствительная' },
  { value: 'normal', label: 'Нормальная' },
];

const CONCERNS = [
  { value: 'acne', label: 'Акне' },
  { value: 'pigmentation', label: 'Пигментация' },
  { value: 'barrier', label: 'Барьер' },
  { value: 'dehydration', label: 'Обезвоженность' },
  { value: 'wrinkles', label: 'Морщины' },
  { value: 'pores', label: 'Поры' },
  { value: 'redness', label: 'Покраснения' },
];

export default function BroadcastAdmin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [countLoading, setCountLoading] = useState(false);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>({
    sendToAll: false,
    skinTypes: [],
    concerns: [],
  });
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [buttons, setButtons] = useState<Button[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleCount = async () => {
    setCountLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/broadcast/count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify({ filters }),
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Ошибка подсчета пользователей');
      }

      const data = await response.json();
      setUserCount(data.count);
    } catch (err: any) {
      setError(err.message || 'Ошибка подсчета');
    } finally {
      setCountLoading(false);
    }
  };

  const handleTestSend = async () => {
    if (!message.trim()) {
      setError('Введите текст сообщения');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/broadcast/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify({
          filters,
          message,
          imageUrl: imageUrl || undefined,
          buttons: buttons.length > 0 ? buttons : undefined,
          test: true,
        }),
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка отправки');
      }

      alert('✅ Тестовое сообщение отправлено!');
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      setError('Введите текст сообщения');
      return;
    }

    if (!filters.sendToAll && (!userCount || userCount === 0)) {
      setError('Нет пользователей для рассылки. Обновите количество или выберите "Всем пользователям".');
      return;
    }

    const countText = filters.sendToAll ? 'всем пользователям' : `${userCount} пользователям`;
    if (!confirm(`Отправить рассылку ${countText}?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/broadcast/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: JSON.stringify({
          filters,
          message,
          imageUrl: imageUrl || undefined,
          buttons: buttons.length > 0 ? buttons : undefined,
          test: false,
        }),
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка отправки');
      }

      const data = await response.json();
      alert(`✅ Рассылка запущена! ID: ${data.broadcastId}`);
      router.push('/admin/broadcasts');
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (type: 'skinTypes' | 'concerns', value: string) => {
    setFilters((prev) => {
      const current = prev[type] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  const addButton = () => {
    setButtons([...buttons, { text: '', url: '' }]);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, field: 'text' | 'url', value: string) => {
    const updated = [...buttons];
    updated[index] = { ...updated[index], [field]: value };
    setButtons(updated);
  };

  // Автоматически подсчитываем при изменении фильтров (кроме sendToAll)
  useEffect(() => {
    if (!filters.sendToAll) {
      handleCount();
    } else {
      setUserCount(null);
    }
  }, [filters.skinTypes, filters.concerns, filters.planDay, filters.lastActive, filters.hasPurchases]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Новая рассылка</h1>
        <p className="text-white/60">Персонализированные сообщения пользователям</p>
      </div>

      {error && (
        <div className={cn(glassCard, 'p-4 bg-red-500/20 border-red-500/50 flex items-center gap-2')}>
          <AlertCircle className="text-red-400" size={20} />
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Опция "Всем пользователям" */}
      <div className={cn(glassCard, 'p-6 mb-6')}>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.sendToAll || false}
            onChange={(e) => {
              setFilters({ ...filters, sendToAll: e.target.checked });
              if (e.target.checked) {
                setUserCount(null);
              }
            }}
            className="w-5 h-5 rounded border-white/20 bg-white/10 checked:bg-[#8B5CF6]"
          />
          <span className="text-white font-bold text-lg">Рассылать всем пользователям</span>
        </label>
      </div>

      {/* 1. Фильтры пользователей */}
      {!filters.sendToAll && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className={cn(glassCard, 'p-6')}>
          <h3 className="text-xl font-bold text-white mb-4">Тип кожи</h3>
          <div className="space-y-2">
            {SKIN_TYPES.map((type) => (
              <label key={type.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.skinTypes.includes(type.value)}
                  onChange={() => toggleFilter('skinTypes', type.value)}
                  className="w-5 h-5 rounded border-white/20 bg-white/10 checked:bg-[#8B5CF6]"
                />
                <span className="text-white/80">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={cn(glassCard, 'p-6')}>
          <h3 className="text-xl font-bold text-white mb-4">Проблемы</h3>
          <div className="space-y-2">
            {CONCERNS.map((concern) => (
              <label key={concern.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.concerns.includes(concern.value)}
                  onChange={() => toggleFilter('concerns', concern.value)}
                  className="w-5 h-5 rounded border-white/20 bg-white/10 checked:bg-[#8B5CF6]"
                />
                <span className="text-white/80">{concern.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={cn(glassCard, 'p-6')}>
          <h3 className="text-xl font-bold text-white mb-4">Дополнительно</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">День плана</label>
              <select
                value={filters.planDay || ''}
                onChange={(e) => setFilters({ ...filters, planDay: e.target.value || undefined })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-white/40"
              >
                <option value="">Все</option>
                <option value="1-7">1–7 дней</option>
                <option value="8-14">8–14 дней</option>
                <option value="15-28">15–28 дней</option>
                <option value="29+">29+ дней</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-2">Последняя активность</label>
              <select
                value={filters.lastActive || ''}
                onChange={(e) => setFilters({ ...filters, lastActive: e.target.value || undefined })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-white/40"
              >
                <option value="">Все</option>
                <option value="<7">Менее 7 дней</option>
                <option value="7-30">7–30 дней</option>
                <option value="30+">30+ дней</option>
              </select>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasPurchases || false}
                onChange={(e) => setFilters({ ...filters, hasPurchases: e.target.checked || undefined })}
                className="w-5 h-5 rounded border-white/20 bg-white/10 checked:bg-[#8B5CF6]"
              />
              <span className="text-white/80">Только с покупками по партнёрке</span>
            </label>
          </div>
        </div>
      </div>

      {/* 2. Превью количества */}
          <div className={cn(glassCard, 'p-6 flex items-center justify-between mb-6')}>
        <div>
          <span className="text-2xl font-bold bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] bg-clip-text text-transparent">
            Найдено пользователей: {userCount !== null ? userCount.toLocaleString('ru-RU') : '—'}
          </span>
        </div>
        <button
          onClick={handleCount}
          disabled={countLoading}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={countLoading ? 'animate-spin' : ''} size={20} />
          Обновить
        </button>
      </div>
        </>
      )}

      {/* 3. Текст сообщения */}
      <div className={cn(glassCard, 'p-6')}>
        <h3 className="text-xl font-bold text-white mb-4">Текст сообщения</h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Привет, {name}! У тебя жирная кожа и акне? Специально для тебя скидка 20% на Effaclar Duo(+) → {link}"
          rows={8}
          className="w-full px-4 py-3 bg-[#050505] border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/20 resize-none"
        />
        <div className="text-sm text-white/40 mt-4">
          Поддерживаются переменные: <code className="bg-white/10 px-2 py-1 rounded">&#123;name&#125;</code>,{' '}
          <code className="bg-white/10 px-2 py-1 rounded">&#123;skinType&#125;</code>,{' '}
          <code className="bg-white/10 px-2 py-1 rounded">&#123;concern&#125;</code>,{' '}
          <code className="bg-white/10 px-2 py-1 rounded">&#123;link&#125;</code>
        </div>
      </div>

      {/* 4. Фото */}
      <div className={cn(glassCard, 'p-6')}>
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <ImageIcon size={20} />
          Фото (опционально)
        </h3>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="w-full px-4 py-3 bg-[#050505] border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/20"
        />
        {imageUrl && (
          <div className="mt-4">
            <img src={imageUrl} alt="Preview" className="max-w-md rounded-xl border border-white/10" />
            <button
              type="button"
              onClick={() => setImageUrl('')}
              className="mt-2 text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
            >
              <X size={16} />
              Удалить фото
            </button>
          </div>
        )}
      </div>

      {/* 5. Кнопки */}
      <div className={cn(glassCard, 'p-6')}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Кнопки с диплинками (опционально)</h3>
          <button
            type="button"
            onClick={addButton}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            Добавить кнопку
          </button>
        </div>
        {buttons.length === 0 && (
          <p className="text-white/40 text-sm">Кнопки не добавлены</p>
        )}
        <div className="space-y-3">
          {buttons.map((button, index) => (
            <div key={index} className="flex gap-3 items-start">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={button.text}
                  onChange={(e) => updateButton(index, 'text', e.target.value)}
                  placeholder="Текст кнопки"
                  className="w-full px-4 py-2 bg-[#050505] border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/20"
                />
                <input
                  type="url"
                  value={button.url}
                  onChange={(e) => updateButton(index, 'url', e.target.value)}
                  placeholder="https://t.me/skiniq_bot?start=..."
                  className="w-full px-4 py-2 bg-[#050505] border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/20"
                />
              </div>
              <button
                type="button"
                onClick={() => removeButton(index)}
                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Кнопки действий */}
      <div className="flex gap-6 mt-6">
        <button
          onClick={handleTestSend}
          disabled={loading || !message.trim()}
          className="flex-1 px-12 py-5 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white rounded-2xl font-bold text-xl hover:shadow-[0_8px_32px_rgba(139,92,246,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Send size={24} />
          Тестовая рассылка мне
        </button>
        <button
          onClick={handleSend}
          disabled={loading || !message.trim() || (!filters.sendToAll && (!userCount || userCount === 0))}
          className="flex-1 px-12 py-5 bg-gradient-to-r from-[#EC4899] to-[#8B5CF6] text-white rounded-2xl font-bold text-xl hover:shadow-[0_8px_32px_rgba(236,72,153,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Send size={24} />
          Запустить рассылку
        </button>
      </div>
    </div>
  );
}
