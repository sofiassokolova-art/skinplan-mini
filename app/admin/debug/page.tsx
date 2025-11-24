// app/admin/debug/page.tsx
// Страница для отладки проблем с авторизацией

'use client';

import { useState, useEffect } from 'react';

export default function AdminDebug() {
  const [info, setInfo] = useState<any>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const gatherInfo = async () => {
      const data: any = {
        timestamp: new Date().toISOString(),
        localStorage: {
          admin_token: localStorage.getItem('admin_token') ? 'exists' : 'not found',
        },
        telegram: {
          available: typeof window !== 'undefined' && !!window.Telegram?.WebApp,
          initData: typeof window !== 'undefined' && window.Telegram?.WebApp?.initData ? 'exists' : 'not found',
          user: typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user || null,
        },
      };

      // Проверяем токен если есть
      if (localStorage.getItem('admin_token')) {
        try {
          const response = await fetch('/api/admin/verify', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
            },
          });
          data.tokenVerification = {
            status: response.status,
            ok: response.ok,
            data: await response.json().catch(() => ({ error: 'Failed to parse' })),
          };
        } catch (err) {
          data.tokenVerification = {
            error: err instanceof Error ? err.message : 'Unknown error',
          };
        }
      }

      setInfo(data);
    };

    gatherInfo();
  }, []);

  const testLogin = async () => {
    setError('');
    try {
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) {
        setError('Telegram WebApp initData не доступен. Откройте страницу через Telegram Mini App.');
        return;
      }

      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });

      const data = await response.json();
      setError(JSON.stringify({ status: response.status, data }, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Отладочная информация</h1>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Текущее состояние</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
            {JSON.stringify(info, null, 2)}
          </pre>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Тест авторизации</h2>
          <button
            onClick={testLogin}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            Проверить авторизацию
          </button>
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 p-4 rounded">
              <pre className="text-xs whitespace-pre-wrap">{error}</pre>
            </div>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
          <h3 className="font-semibold mb-2">Возможные проблемы:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Если initData не найден - страница не открыта через Telegram Mini App</li>
            <li>Если токен не валиден - нужно войти заново</li>
            <li>Если админ не найден - нужно создать админа в базе данных</li>
            <li>Если статус 403 - ваш Telegram username не в списке админов</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

