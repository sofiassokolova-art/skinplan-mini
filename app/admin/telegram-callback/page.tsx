export const runtime = 'edge';
// app/admin/telegram-callback/page.tsx
// Callback страница для Telegram Login Widget (используется как data-auth-url)
// Telegram перенаправляет пользователя на эту страницу с данными в URL параметрах

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TelegramCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Обработка авторизации...');

  useEffect(() => {
    // Получаем данные из URL параметров (Telegram передает их через GET)
    const id = searchParams.get('id');
    const firstName = searchParams.get('first_name');
    const lastName = searchParams.get('last_name');
    const username = searchParams.get('username');
    const photoUrl = searchParams.get('photo_url');
    const authDate = searchParams.get('auth_date');
    const hash = searchParams.get('hash');

    console.log('📱 Telegram callback received:', { id, firstName, username, authDate, hash });

    if (!id || !hash || !authDate) {
      console.error('❌ Missing required Telegram login data');
      setStatus('error');
      setMessage('Неполные данные от Telegram. Пожалуйста, попробуйте снова.');
      setTimeout(() => router.push('/admin/login'), 3000);
      return;
    }

    // Формируем объект пользователя
    const telegramUser = {
      id: parseInt(id),
      first_name: firstName || '',
      last_name: lastName || undefined,
      username: username || undefined,
      photo_url: photoUrl || undefined,
      auth_date: parseInt(authDate),
      hash: hash,
    };

    console.log('📤 Sending Telegram user data to API...');

    // Отправляем данные на сервер для проверки и авторизации
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUser }),
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          console.error('❌ Login API error:', data);
          throw new Error(data.error || 'Ошибка авторизации');
        }

        console.log('✅ Login successful:', data);

        // Сохраняем токен
        if (typeof window !== 'undefined') {
          localStorage.setItem('admin_token', data.token);
        }
        
        setStatus('success');
        setMessage('Авторизация успешна! Перенаправление...');

        // Перенаправляем на админ-панель
        setTimeout(() => {
          router.push('/admin');
        }, 1000);
      })
      .catch((error) => {
        console.error('❌ Telegram callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Ошибка авторизации. Доступ запрещён.');
        setTimeout(() => router.push('/admin/login'), 3000);
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center p-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Авторизация</h2>
          {status === 'loading' && (
            <div className="mt-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4 text-gray-600">{message}</p>
            </div>
          )}
          {status === 'success' && (
            <div className="mt-4">
              <div className="text-green-500 text-4xl mb-4">✓</div>
              <p className="text-gray-600">{message}</p>
            </div>
          )}
          {status === 'error' && (
            <div className="mt-4">
              <div className="text-red-500 text-4xl mb-4">✗</div>
              <p className="text-red-600">{message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

