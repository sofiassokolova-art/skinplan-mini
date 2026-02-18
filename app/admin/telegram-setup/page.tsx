// app/admin/telegram-setup/page.tsx
// Страница для настройки Telegram бота и вебхука

'use client';

import { useState } from 'react';

export default function TelegramSetupPage() {
  const [webhookStatus, setWebhookStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const checkWebhook = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // ИСПРАВЛЕНО (P0): Добавлена админ-авторизация через cookie
      const response = await fetch('/api/telegram/webhook?action=check', {
        credentials: 'include', // Используем cookie для авторизации
      });
      const data = await response.json();
      setWebhookStatus(data);
      
      if (data.ok && data.result?.url) {
        setSuccess(`✅ Вебхук настроен: ${data.result.url}`);
      } else {
        setError('❌ Вебхук не настроен');
      }
    } catch (err: any) {
      setError(`Ошибка: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const setWebhook = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // ИСПРАВЛЕНО (P0): Добавлена админ-авторизация через cookie
      const response = await fetch('/api/telegram/webhook?action=set-webhook', {
        credentials: 'include', // Используем cookie для авторизации
      });
      const data = await response.json();
      
      if (data.ok) {
        setSuccess('✅ Вебхук успешно установлен!');
        setTimeout(checkWebhook, 1000);
      } else {
        setError(`❌ Ошибка: ${data.description || JSON.stringify(data)}`);
      }
    } catch (err: any) {
      setError(`Ошибка: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Настройка Telegram бота
        </h1>

        {/* Настройка домена */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">1. Настройка домена для Login Widget</h2>
          <p className="text-gray-600 mb-4">
            Чтобы убрать ошибку "Bot domain invalid" в админке:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 mb-4">
            <li>Откройте <a href="https://t.me/botfather" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">@BotFather</a> в Telegram</li>
            <li>Отправьте команду: <code className="bg-gray-100 px-2 py-1 rounded">/mybots</code></li>
            <li>Выберите вашего бота</li>
            <li>Выберите "Bot Settings" → "Domain"</li>
            <li>Введите домен: <code className="bg-gray-100 px-2 py-1 rounded">
              {typeof window !== 'undefined' 
                ? new URL(process.env.NEXT_PUBLIC_MINI_APP_URL || window.location.origin).hostname
                : 'skinplan-mini.vercel.app'}
            </code></li>
          </ol>
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-sm text-blue-800">
              <strong>Важно:</strong> Домен должен точно совпадать с доменом вашего приложения на Vercel.
            </p>
          </div>
        </div>

        {/* Настройка вебхука */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">2. Настройка вебхука</h2>
          <p className="text-gray-600 mb-4">
            Вебхук нужен для получения сообщений от пользователей (команда /start).
          </p>
          
          <div className="space-y-4">
            <div className="flex gap-4">
              <button
                onClick={checkWebhook}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
              >
                Проверить статус
              </button>
              <button
                onClick={setWebhook}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Установить вебхук
              </button>
            </div>

            {loading && (
              <div className="text-gray-600">Загрузка...</div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}

            {webhookStatus && (
              <div className="bg-gray-50 rounded p-4">
                <h3 className="font-semibold mb-2">Статус вебхука:</h3>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(webhookStatus, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Переменные окружения */}
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">3. Необходимые переменные окружения</h2>
          <div className="space-y-2 text-sm font-mono bg-gray-50 p-4 rounded">
            <div>TELEGRAM_BOT_TOKEN=ваш_токен_бота</div>
            <div>TELEGRAM_SECRET_TOKEN=ваш_секретный_токен (опционально)</div>
            <div>NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=@skinplanned_bot</div>
            <div>NEXT_PUBLIC_MINI_APP_URL=https://skinplan-mini.vercel.app</div>
          </div>
          <p className="text-gray-600 mt-4 text-sm">
            Эти переменные должны быть добавлены в <code className="bg-gray-100 px-1 rounded">.env</code> локально 
            и в настройках проекта на Vercel.
          </p>
        </div>
      </div>
    </div>
  );
}

