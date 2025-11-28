// app/admin/broadcast/page.tsx
// Страница создания рассылок - премиум верстка 2025

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, RefreshCw, AlertCircle, Image as ImageIcon, Plus, X, ChevronDown, Save, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const TEMPLATES = [
  { label: 'Скидка 20%', text: 'Привет, {name}! Специально для тебя скидка 20% на {product} → {link}' },
  { label: 'Напоминание SPF', text: 'Привет, {name}! Не забудь использовать SPF каждый день! {link}' },
  { label: 'План обновлён', text: 'Привет, {name}! Твой план ухода обновлён. Посмотри изменения → {link}' },
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [buttons, setButtons] = useState<Button[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');

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
      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('filters', JSON.stringify(filters));
      formData.append('message', message);
      if (imageFile) {
        formData.append('image', imageFile);
      } else if (imageUrl) {
        formData.append('imageUrl', imageUrl);
      }
      if (buttons.length > 0) {
        formData.append('buttons', JSON.stringify(buttons));
      }
      formData.append('test', 'true');
      
      // Для тестовой рассылки планирование не применяется

      const response = await fetch('/api/admin/broadcast/send', {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: formData,
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
      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('filters', JSON.stringify(filters));
      formData.append('message', message);
      if (imageFile) {
        formData.append('image', imageFile);
      } else if (imageUrl) {
        formData.append('imageUrl', imageUrl);
      }
      if (buttons.length > 0) {
        formData.append('buttons', JSON.stringify(buttons));
      }
      formData.append('test', 'false');
      
      // Добавляем запланированное время, если включено
      if (scheduleEnabled && scheduledDateTime) {
        const scheduledAtUTC = convertMoscowToUTC(scheduledDateTime);
        if (scheduledAtUTC) {
          formData.append('scheduledAt', scheduledAtUTC.toISOString());
        }
      }

      const response = await fetch('/api/admin/broadcast/send', {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: 'include',
        body: formData,
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
      if (scheduleEnabled && scheduledDateTime) {
        const scheduledAtUTC = convertMoscowToUTC(scheduledDateTime);
        if (scheduledAtUTC) {
          const moscowTime = scheduledAtUTC.toLocaleString('ru-RU', { 
            timeZone: 'Europe/Moscow',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          alert(`✅ Рассылка запланирована на ${moscowTime} МСК! ID: ${data.broadcastId}`);
        } else {
          alert(`✅ Рассылка запущена! ID: ${data.broadcastId}`);
        }
      } else {
        alert(`✅ Рассылка запущена! ID: ${data.broadcastId}`);
      }
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

  const applyTemplate = (templateText: string) => {
    setMessage(templateText);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Проверяем тип файла
      if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) {
        setError('Поддерживаются только файлы PNG и JPEG');
        return;
      }
      
      // Проверяем размер (макс 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Размер файла не должен превышать 10MB');
        return;
      }
      
      setImageFile(file);
      setImageUrl(''); // Очищаем URL, если был
      
      // Создаем превью
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImageUrl('');
    setImagePreview(null);
  };

  // Функция для получения текущей даты/времени в МСК в формате для input datetime-local
  const getMoscowDateTimeLocal = (): string => {
    const now = new Date();
    // МСК = UTC+3
    const moscowOffset = 3 * 60; // минуты
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const moscowTime = new Date(utc + (moscowOffset * 60000));
    
    // Форматируем для input datetime-local (YYYY-MM-DDTHH:mm)
    const year = moscowTime.getFullYear();
    const month = String(moscowTime.getMonth() + 1).padStart(2, '0');
    const day = String(moscowTime.getDate()).padStart(2, '0');
    const hours = String(moscowTime.getHours()).padStart(2, '0');
    const minutes = String(moscowTime.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Конвертируем локальное время МСК в UTC для сохранения в БД
  const convertMoscowToUTC = (moscowDateTimeLocal: string): Date | null => {
    if (!moscowDateTimeLocal) return null;
    
    // Парсим локальное время МСК (YYYY-MM-DDTHH:mm)
    const [datePart, timePart] = moscowDateTimeLocal.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    
    // Создаем строку в формате ISO для МСК (UTC+3)
    // Формат: YYYY-MM-DDTHH:mm:ss+03:00
    const moscowISOString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+03:00`;
    
    // Парсим строку с timezone offset - JavaScript автоматически конвертирует в UTC
    const moscowDate = new Date(moscowISOString);
    
    return moscowDate;
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
    <div className="w-full max-w-5xl mx-auto pb-32">
      {/* Основная карточка-контейнер */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 lg:p-12">
        {/* Шапка */}
        <div className="flex items-start justify-between mb-12">
      <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Новая рассылка</h1>
            <p className="text-gray-600">Персонализированные сообщения пользователям</p>
          </div>
          <button className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2">
            <Save size={16} />
            Сохранить как шаблон
          </button>
      </div>

      {error && (
          <div className="mb-12 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

        {/* Чекбокс "Рассылать всем" */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 mb-12">
          <label className="flex items-center gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.sendToAll || false}
              onChange={(e) => {
                setFilters({ ...filters, sendToAll: e.target.checked });
                if (e.target.checked) {
                  setUserCount(null);
                }
              }}
              className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
            />
            <span className="text-gray-900 font-semibold text-lg">Рассылать всем пользователям</span>
          </label>
        </div>

        {/* Фильтры пользователей */}
        {!filters.sendToAll && (
          <>
            {/* Три колонки фильтров */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              {/* Тип кожи */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Тип кожи</h3>
                <div className="space-y-4">
            {SKIN_TYPES.map((type) => (
                    <label key={type.value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.skinTypes.includes(type.value)}
                  onChange={() => toggleFilter('skinTypes', type.value)}
                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
                />
                      <span className="text-gray-700 group-hover:text-gray-900">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

              {/* Проблемы */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Проблемы</h3>
                <div className="space-y-4">
            {CONCERNS.map((concern) => (
                    <label key={concern.value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.concerns.includes(concern.value)}
                  onChange={() => toggleFilter('concerns', concern.value)}
                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
                />
                      <span className="text-gray-700 group-hover:text-gray-900">{concern.label}</span>
              </label>
            ))}
          </div>
        </div>

              {/* Дополнительно */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Дополнительно</h3>
                <div className="space-y-6">
            <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">День плана</label>
                    <div className="relative">
              <select
                value={filters.planDay || ''}
                onChange={(e) => setFilters({ ...filters, planDay: e.target.value || undefined })}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
              >
                <option value="">Все</option>
                <option value="1-7">1–7 дней</option>
                <option value="8-14">8–14 дней</option>
                <option value="15-28">15–28 дней</option>
                <option value="29+">29+ дней</option>
              </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                    </div>
            </div>

            <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Последняя активность</label>
                    <div className="relative">
              <select
                value={filters.lastActive || ''}
                onChange={(e) => setFilters({ ...filters, lastActive: e.target.value || undefined })}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
              >
                <option value="">Все</option>
                <option value="<7">Менее 7 дней</option>
                <option value="7-30">7–30 дней</option>
                <option value="30+">30+ дней</option>
              </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
                    </div>
            </div>

                  <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.hasPurchases || false}
                onChange={(e) => setFilters({ ...filters, hasPurchases: e.target.checked || undefined })}
                      className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
              />
                    <span className="text-gray-700 group-hover:text-gray-900">Только с покупками по партнёрке</span>
            </label>
          </div>
        </div>
      </div>

            {/* Блок "Найдено пользователей" */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-12">
              <div className="flex items-center justify-between">
        <div>
                  <span className="text-sm text-gray-600 block mb-2">Найдено пользователей:</span>
                  <span className="text-4xl font-bold text-gray-900">
                    {userCount !== null ? userCount.toLocaleString('ru-RU') : '—'}
          </span>
        </div>
        <button
          onClick={handleCount}
          disabled={countLoading}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
                  <RefreshCw className={countLoading ? 'animate-spin' : ''} size={18} />
          Обновить
        </button>
      </div>
            </div>
          </>
        )}

        {/* Текстовое поле */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-12">
          <div className="flex items-start justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Текст сообщения</h3>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => applyTemplate(template.text)}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Привет, {name}! У тебя жирная кожа и акне? Специально для тебя скидка 20% на Effaclar Duo(+) → {link}"
            className="w-full min-h-[200px] px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
        />
          <div className="mt-4 text-sm text-gray-500">
            Поддерживаются переменные:{' '}
            <code className="bg-gray-100 px-2 py-1 rounded text-gray-700">&#123;name&#125;</code>,{' '}
            <code className="bg-gray-100 px-2 py-1 rounded text-gray-700">&#123;skinType&#125;</code>,{' '}
            <code className="bg-gray-100 px-2 py-1 rounded text-gray-700">&#123;concern&#125;</code>,{' '}
            <code className="bg-gray-100 px-2 py-1 rounded text-gray-700">&#123;link&#125;</code>
          </div>
        </div>

        {/* Фото */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-12">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ImageIcon size={20} className="text-gray-600" />
            Фото (опционально)
          </h3>
          <div className="space-y-4">
            {/* Загрузка файла */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Загрузить изображение (PNG или JPEG, макс. 10MB)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handleImageFileChange}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
            
            {/* Или URL (альтернативный способ) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Или введите URL изображения
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  if (e.target.value) {
                    setImageFile(null);
                    setImagePreview(null);
                  }
                }}
                placeholder="https://example.com/image.jpg"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                disabled={!!imageFile}
              />
            </div>
            
            {/* Превью */}
            {(imagePreview || imageUrl) && (
              <div className="mt-4">
                <img 
                  src={imagePreview || imageUrl} 
                  alt="Preview" 
                  className="max-w-md rounded-lg border border-gray-200" 
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="mt-2 text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                >
                  <X size={16} />
                  Удалить фото
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Планирование */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-12">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={20} className="text-gray-600" />
              Планирование рассылки (опционально)
            </h3>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(e) => {
                  setScheduleEnabled(e.target.checked);
                  if (e.target.checked && !scheduledDateTime) {
                    // Устанавливаем время на час вперед по умолчанию
                    const defaultTime = new Date();
                    defaultTime.setHours(defaultTime.getHours() + 1);
                    const moscowTime = getMoscowDateTimeLocal();
                    const [datePart, timePart] = moscowTime.split('T');
                    const [hours, minutes] = timePart.split(':').map(Number);
                    const nextHour = (hours + 1) % 24;
                    setScheduledDateTime(`${datePart}T${String(nextHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
                  }
                }}
                className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-2"
              />
              <span className="text-gray-700 font-medium">Запланировать отправку</span>
            </label>
          </div>
          
          {scheduleEnabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Дата и время отправки (МСК)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  min={getMoscowDateTimeLocal()}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="mt-2 text-sm text-gray-500">
                  Время указывается по московскому времени (МСК, UTC+3)
                </p>
                {scheduledDateTime && (() => {
                  const scheduledAtUTC = convertMoscowToUTC(scheduledDateTime);
                  if (scheduledAtUTC && scheduledAtUTC < new Date()) {
                    return (
                      <p className="mt-2 text-sm text-red-600">
                        ⚠️ Выбранное время уже прошло. Выберите будущее время.
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Кнопки */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Кнопки с диплинками (опционально)</h3>
            <button
              type="button"
              onClick={addButton}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-medium hover:bg-indigo-100 transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              Добавить кнопку
            </button>
          </div>
          {buttons.length === 0 && (
            <p className="text-gray-400 text-sm">Кнопки не добавлены</p>
          )}
          <div className="space-y-4">
            {buttons.map((button, index) => (
              <div key={index} className="flex gap-3 items-start">
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={button.text}
                    onChange={(e) => updateButton(index, 'text', e.target.value)}
                    placeholder="Текст кнопки"
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <input
                    type="url"
                    value={button.url}
                    onChange={(e) => updateButton(index, 'url', e.target.value)}
                    placeholder="https://t.me/skiniq_bot?start=..."
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeButton(index)}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Нижняя фиксированная панель */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-6 px-6 md:px-8 shadow-lg z-50" style={{ marginLeft: '256px' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
        <button
          onClick={handleTestSend}
          disabled={loading || !message.trim()}
            className="px-6 py-3 border-2 border-indigo-600 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
            <Send size={18} />
          Тестовая рассылка мне
        </button>
        <button
          onClick={handleSend}
            disabled={loading || !message.trim() || (!filters.sendToAll && (!userCount || userCount === 0))}
            className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
            <Send size={18} />
          Запустить рассылку
        </button>
        </div>
      </div>
    </div>
  );
}
