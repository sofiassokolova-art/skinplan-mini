// app/admin/login/page.tsx
// Страница входа в админ-панель через Telegram

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [telegramAvailable, setTelegramAvailable] = useState(false);

  useEffect(() => {
    // Проверяем доступность Telegram WebApp
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      setTelegramAvailable(true);
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  const handleTelegramLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) {
        setError('Telegram WebApp не доступен. Откройте страницу через Telegram Mini App.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Login error:', {
          status: response.status,
          error: data.error,
          initDataAvailable: !!initData,
        });
        setError(data.error || `Ошибка входа (${response.status}). У вас нет доступа к админ-панели.`);
        return;
      }

      // Сохраняем токен
      localStorage.setItem('admin_token', data.token);
      router.push('/admin');
    } catch (err) {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Вход в админ-панель
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Доступ только для администраторов
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {!telegramAvailable && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
            ⚠️ Эта страница должна быть открыта через Telegram Mini App. 
            Текущий пользователь будет проверен автоматически.
          </div>
        )}

        <div>
          <button
            onClick={handleTelegramLogin}
            disabled={loading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Проверка доступа...' : 'Войти через Telegram'}
          </button>
        </div>

        <div className="text-center text-xs text-gray-500">
          Авторизация выполняется автоматически при входе через Telegram Mini App
        </div>
      </div>
    </div>
  );
}

