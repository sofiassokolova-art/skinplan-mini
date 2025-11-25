// app/admin/login/page.tsx
// Страница входа в админ-панель через Telegram

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    TelegramLoginWidget?: {
      onAuth: (user: any) => void;
    };
  }
}

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const scriptLoaded = useRef(false);
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '';

  useEffect(() => {
    // Проверяем, есть ли уже токен
    const token = localStorage.getItem('admin_token');
    if (token) {
      router.push('/admin');
      return;
    }
  }, [router]);

  // Загружаем скрипт Telegram Login Widget
  useEffect(() => {
    if (typeof window === 'undefined' || scriptLoaded.current) return;

    // Глобальная функция для обработки авторизации через Telegram Login Widget
    window.TelegramLoginWidget = {
      onAuth: async (user: any) => {
        setError('');
        setLoading(true);

        try {
          const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramUser: user,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            setError(data.error || `Ошибка входа (${response.status}). У вас нет доступа к админ-панели.`);
            setLoading(false);
            return;
          }

          localStorage.setItem('admin_token', data.token);
          router.push('/admin');
        } catch (err) {
          console.error('Error during Telegram login:', err);
          setError('Ошибка соединения или обработки запроса.');
          setLoading(false);
        }
      },
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername || 'your_bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'TelegramLoginWidget.onAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.onload = () => {
      scriptLoaded.current = true;
    };
    
    const container = document.getElementById('telegram-login-container');
    if (container) {
      container.appendChild(script);
    }

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete (window as any).TelegramLoginWidget;
    };
  }, [botUsername, router]);

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

        {/* Telegram Login Widget будет загружен через скрипт */}
        <div className="flex flex-col items-center space-y-4">
          <div id="telegram-login-container" className="w-full flex justify-center">
            {/* Здесь появится кнопка Telegram Login Widget */}
          </div>

        </div>

        <div className="text-center text-xs text-gray-500 space-y-2">
          <div>Авторизуйтесь через Telegram для доступа к админ-панели</div>
          {!botUsername && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mt-2">
              <p className="font-semibold mb-2 text-sm">📋 Требуется настройка:</p>
              <p className="text-xs mb-2">Добавьте переменную окружения <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code></p>
              <div className="text-xs space-y-1">
                <p className="font-semibold">Локально (.env файл):</p>
                <code className="block bg-blue-100 px-2 py-1 rounded font-mono text-xs">
                  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=@ваш_бот
                </code>
                <p className="font-semibold mt-2">На Vercel (Settings → Environment Variables):</p>
                <p className="text-xs">Ключ: <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code></p>
                <p className="text-xs">Значение: <code className="bg-blue-100 px-1 rounded">@ваш_бот</code> (username вашего бота от BotFather)</p>
              </div>
            </div>
          )}
          {error && error.includes('domain') && (
            <div className="text-red-600 mt-2 text-xs">
              ⚠️ Bot domain invalid: добавьте домен в BotFather → Bot Settings → Domain
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

