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

  useEffect(() => {
    setMounted(true);
    
    // Проверяем, есть ли уже токен
    const checkExistingToken = async () => {
      try {
        const response = await fetch('/api/admin/auth', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.valid) {
            router.push('/admin');
            return;
          }
        }
      } catch (error) {
        console.error('Error checking token:', error);
      }
    };
    
    checkExistingToken();
  }, [router]);

  const handleTelegramLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Получаем initData из Telegram WebApp
      const initData = window.Telegram?.WebApp?.initData;

      if (!initData) {
        setError('Telegram WebApp не доступен. Откройте эту страницу через Telegram бота.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ initData }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Ошибка авторизации';
        
        // Красивое сообщение если не в whitelist
        if (errorMessage.includes('whitelist') || errorMessage.includes('Unauthorized')) {
          setError('Вы не в списке администраторов. Обратитесь к владельцу для добавления в whitelist.');
        } else {
          setError(errorMessage);
        }
        setLoading(false);
        return;
      }

      // Сохраняем токен в localStorage для удобства
      if (data.token) {
        localStorage.setItem('admin_token', data.token);
      }

      // Перенаправляем в админ-панель
      router.push('/admin');
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

  return (
    <div className="min-h-screen bg-[#000000] flex items-center justify-center p-4">
      <div className="bg-white/6 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-[0_8px_32px_rgba(139,92,246,0.3)]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">SkinIQ Admin</h1>
          <p className="text-white/60">Вход через Telegram</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-white/80 text-sm mb-2">
              Для входа в админ-панель:
            </p>
            <ol className="text-white/60 text-sm space-y-2 list-decimal list-inside">
              <li>Напишите боту @skiniq_bot команду <code className="bg-white/10 px-1 rounded">/admin</code></li>
              <li>Нажмите кнопку "Открыть админку" в ответе бота</li>
              <li>Или убедитесь, что вы в whitelist администраторов</li>
            </ol>
          </div>

          <button
            onClick={handleTelegramLogin}
            disabled={loading || !window.Telegram?.WebApp?.initData}
            className="w-full bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_8px_32px_rgba(139,92,246,0.5)] transition-all duration-300"
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

          {!window.Telegram?.WebApp?.initData && (
            <p className="text-white/40 text-xs text-center">
              Telegram WebApp не доступен. Откройте через бота.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
