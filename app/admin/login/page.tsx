// app/admin/login/page.tsx
// Страница входа в админ-панель через Telegram

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Тип Telegram уже объявлен в lib/telegram-client.ts

export default function AdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true); // ИСПРАВЛЕНО (P1): Состояние проверки сессии
  const [isTelegramReady, setIsTelegramReady] = useState(false); // ИСПРАВЛЕНО (P1): Состояние готовности Telegram

  useEffect(() => {
    setMounted(true);

    // ИСПРАВЛЕНО (P1): Проверяем готовность Telegram WebApp с polling
    const checkTelegramReady = () => {
      if (window.Telegram?.WebApp?.initData) {
        setIsTelegramReady(true);
        return true;
      }
      return false;
    };

    // Проверяем сразу
    if (checkTelegramReady()) {
      return;
    }

    // Polling каждые 200ms на 2 секунды
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      attempts++;
      if (checkTelegramReady() || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // ИСПРАВЛЕНО (P1): Проверяем, есть ли уже валидная сессия
    const checkExistingToken = async () => {
      setCheckingSession(true);
      try {
        const response = await fetch('/api/admin/auth', {
          credentials: 'include',
        });
          
        if (response.ok) {
          const data = await response.json();
          if (data.valid) {
            // ИСПРАВЛЕНО: Используем replace для более быстрого редиректа
            router.replace('/admin');
            return;
          }
        } else if (response.status === 500) {
          // ИСПРАВЛЕНО: Проверяем ошибки конфигурации при проверке сессии
          const data = await response.json().catch(() => ({}));
          if (data.code === 'CONFIG_ERROR' || data.code === 'JWT_CONFIG_ERROR') {
            setError('Ошибка конфигурации сервера. Обратитесь к администратору для настройки JWT_SECRET.');
            setCheckingSession(false);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking token:', error);
        // ИСПРАВЛЕНО: Не показываем ошибку при проверке сессии, только при логине
      } finally {
        setCheckingSession(false);
      }
    };
    
    checkExistingToken();
  }, [router, mounted]);

  const handleTelegramLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Получаем initData из Telegram WebApp
      const initData = window.Telegram?.WebApp?.initData;
      const userData = window.Telegram?.WebApp?.initDataUnsafe?.user;

      // Временно логируем telegramId для отладки (можно удалить после добавления в whitelist)
      if (userData?.id) {
        console.log('🔍 Ваш Telegram ID:', userData.id);
        console.log('💡 Скопируйте этот ID и запустите:');
        console.log(`   npx tsx scripts/add-admin.ts ${userData.id} "София"`);
      }

      if (!initData) {
        setError('Telegram WebApp не доступен. Откройте эту страницу через Telegram бота.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        credentials: 'include',
        body: JSON.stringify({}), // initData передаётся только через headers
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Ошибка авторизации';
        const errorCode = data.code;
        
        // ИСПРАВЛЕНО: Различаем ошибки конфигурации сервера и ошибки авторизации
        if (errorCode === 'CONFIG_ERROR' || errorCode === 'JWT_CONFIG_ERROR') {
          setError('Ошибка конфигурации сервера. Обратитесь к администратору для настройки JWT_SECRET или TELEGRAM_BOT_TOKEN.');
        } else if (errorMessage.includes('whitelist') || errorMessage.includes('Unauthorized') || errorCode === 'AUTH_UNAUTHORIZED') {
          setError('Вы не в списке администраторов. Обратитесь к владельцу для добавления в whitelist.');
        } else if (errorCode === 'DB_ERROR') {
          setError('Ошибка подключения к базе данных. Попробуйте позже.');
        } else {
          setError(errorMessage);
        }
        setLoading(false);
        return;
      }

      // ИСПРАВЛЕНО (P0): Убрали сохранение token в localStorage - используем только cookie
      // Токен уже установлен в httpOnly cookie на бэке
      
      // Перенаправляем в админ-панель
      // ИСПРАВЛЕНО: Используем replace для более быстрого редиректа
      router.replace('/admin');
      router.refresh();
    } catch (err) {
      console.error('Error during login:', err);
      setError('Ошибка соединения. Проверьте подключение к интернету.');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

  // ИСПРАВЛЕНО (P1): Показываем "Проверяем доступ..." при проверке сессии
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-[#8B5CF6] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Проверяем доступ...</p>
          </div>
        </div>
      </div>
    );
  }

  // ИСПРАВЛЕНО (P0): Приведено к светлой теме админки
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SkinIQ Admin</h1>
          <p className="text-gray-600">Вход через Telegram</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm space-y-2">
            <p>{error}</p>
            {window.Telegram?.WebApp?.initDataUnsafe?.user?.id && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-700 text-xs mb-2">Ваш Telegram ID (для добавления в whitelist):</p>
                <code className="text-gray-900 font-mono text-sm bg-gray-100 px-2 py-1 rounded block">
                  {window.Telegram.WebApp.initDataUnsafe.user.id}
                </code>
                <p className="text-gray-600 text-xs mt-2">
                  Скопируйте этот ID и запустите:<br/>
                  <code className="bg-gray-100 px-1 rounded text-xs">
                    npx tsx scripts/add-admin.ts {window.Telegram.WebApp.initDataUnsafe.user.id} "София"
                  </code>
                </p>
            </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-gray-700 text-sm mb-2">
              Для входа в админ-панель:
            </p>
            <ol className="text-gray-600 text-sm space-y-2 list-decimal list-inside">
              <li>Напишите боту @skiniq_bot команду <code className="bg-gray-100 px-1 rounded">/admin</code></li>
              <li>Нажмите кнопку "Открыть админку" в ответе бота</li>
              <li>Или убедитесь, что вы в whitelist администраторов</li>
            </ol>
          </div>

          <button
            onClick={handleTelegramLogin}
            disabled={loading || !isTelegramReady} // ИСПРАВЛЕНО (P1): Используем isTelegramReady вместо прямого проверки
            className="w-full bg-[#8B5CF6] text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#7C3AED] transition-all duration-300"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Вход...
              </span>
            ) : (
              'Войти через Telegram'
            )}
          </button>

          {!isTelegramReady && (
            <p className="text-gray-500 text-xs text-center">
              Telegram WebApp не доступен. Откройте через бота.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
