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
  // Используем fallback на бота, если переменная окружения не установлена
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'skinplanned_bot';
  const [widgetReady, setWidgetReady] = useState(false);

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
    if (typeof window === 'undefined') return;
    
    console.log('🔧 Initializing Telegram Login Widget...', {
      botUsername,
      scriptLoaded: scriptLoaded.current,
    });

    // Глобальная функция для обработки авторизации через Telegram Login Widget
    window.TelegramLoginWidget = {
      onAuth: async (user: any) => {
        console.log('📱 Telegram Login Widget callback:', user);
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

    // Очищаем контейнер перед добавлением скрипта
    const container = document.getElementById('telegram-login-container');
    if (!container) {
      console.error('❌ Container not found');
      return;
    }

    // Удаляем старый скрипт, если есть
    const oldScript = container.querySelector('script[src*="telegram-widget"]');
    if (oldScript) {
      oldScript.remove();
    }

    // Создаем и добавляем новый скрипт
    // Используем data-auth-url (рекомендуется) - Telegram перенаправит на callback URL
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername.replace('@', '')); // Убираем @ если есть
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    // Используем auth-url вместо onauth для более надежной работы
    const authUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/admin/telegram-callback`
      : '/admin/telegram-callback';
    script.setAttribute('data-auth-url', authUrl);
    script.setAttribute('data-request-access', 'write');
    
    script.onload = () => {
      console.log('✅ Telegram Login Widget script loaded');
      scriptLoaded.current = true;
      setWidgetReady(true);
    };
    
    script.onerror = () => {
      console.error('❌ Failed to load Telegram Login Widget script');
      setError('Не удалось загрузить виджет Telegram. Проверьте подключение к интернету.');
    };

    container.appendChild(script);
    console.log('📦 Script element added to container');

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete (window as any).TelegramLoginWidget;
      scriptLoaded.current = false;
      setWidgetReady(false);
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
          <div 
            id="telegram-login-container" 
            className="w-full flex justify-center min-h-[60px] items-center"
            style={{ minHeight: '60px' }}
          >
            {loading && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Обработка авторизации...</p>
              </div>
            )}
            {!loading && !widgetReady && (
              <div className="text-center text-gray-500 text-sm">
                Загрузка виджета...
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-gray-500 space-y-2">
          <div>Авторизуйтесь через Telegram для доступа к админ-панели</div>
          <div className="text-xs text-gray-400 mt-1">
            Используется бот: <code className="bg-gray-100 px-1 rounded">@{botUsername.replace('@', '')}</code>
          </div>
          
          {!widgetReady && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-left">
              <p className="font-semibold text-yellow-800 mb-2 text-sm">⚠️ Важно: Настройка Login URL</p>
              <p className="text-xs text-yellow-700 mb-2">
                Чтобы виджет работал, нужно настроить Login URL в @BotFather:
              </p>
              <ol className="text-xs text-yellow-700 list-decimal list-inside space-y-1 ml-2">
                <li>Откройте @BotFather в Telegram</li>
                <li>Отправьте <code className="bg-yellow-100 px-1 rounded">/mybots</code></li>
                <li>Выберите вашего бота</li>
                <li>Выберите "Payments & Login" → "Login URL"</li>
                <li>Укажите: <code className="bg-yellow-100 px-1 rounded">https://skinplan-mini.vercel.app</code></li>
              </ol>
              <p className="text-xs text-yellow-600 mt-2">
                После настройки обновите страницу
              </p>
            </div>
          )}
          
          {error && error.includes('domain') && (
            <div className="text-red-600 mt-2 text-xs">
              ⚠️ Bot domain invalid: добавьте домен в BotFather → Payments & Login → Login URL
            </div>
          )}
          {error && !error.includes('domain') && (
            <div className="text-red-600 mt-2 text-xs">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

