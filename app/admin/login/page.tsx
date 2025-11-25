// app/admin/login/page.tsx
// Страница входа в админ-панель через Telegram Login Widget

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    onTelegramAuth?: (user: any) => void;
  }
}

const TELEGRAM_BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'skinplanned_bot';

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Проверяем, есть ли уже токен
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (token) {
      router.push('/admin');
      return;
    }

    // Настраиваем callback для Telegram Login Widget
    window.onTelegramAuth = (user: any) => {
      handleTelegramAuth(user);
    };

    // Загружаем скрипт Telegram Login Widget
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', TELEGRAM_BOT_NAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    
    const container = document.getElementById('telegram-login-container');
    if (container && !container.hasChildNodes()) {
      container.appendChild(script);
    }

    return () => {
      // Cleanup
      if (window.onTelegramAuth) {
        delete window.onTelegramAuth;
      }
    };
  }, [router]);

  const handleTelegramAuth = async (user: any) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/telegram-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setError('Доступ запрещен. Ваш аккаунт не в списке администраторов.');
        } else {
          setError(data.error || `Ошибка входа (${response.status})`);
        }
        setLoading(false);
        return;
      }

      // Сохраняем токен
      localStorage.setItem('admin_token', data.token);
      
      // Перенаправляем в админ-панель
      router.push('/admin');
    } catch (err) {
      console.error('Error during login:', err);
      setError('Ошибка соединения. Проверьте подключение к интернету.');
      setLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '24px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
      }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#0A5F59',
          marginBottom: '8px',
        }}>
          Вход в админ-панель
        </h2>
        <p style={{
          color: '#475467',
          marginBottom: '24px',
        }}>
          Авторизуйтесь через Telegram для доступа
        </p>

        {error && (
          <div style={{
            backgroundColor: '#FEE2E2',
            border: '1px solid #FCA5A5',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              color: '#DC2626',
              fontWeight: '600',
              marginBottom: '4px',
            }}>
              ❌ Ошибка
            </div>
            <div style={{ color: '#991B1B', fontSize: '14px' }}>
              {error}
            </div>
          </div>
        )}

        {loading && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid rgba(10, 95, 89, 0.2)',
              borderTop: '4px solid #0A5F59',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}></div>
            <div style={{ color: '#0A5F59', fontSize: '14px' }}>
              Авторизация...
            </div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {!loading && (
          <div id="telegram-login-container" style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '24px',
          }}>
            {/* Telegram Login Widget будет встроен сюда */}
          </div>
        )}

        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#EFF6FF',
          borderRadius: '12px',
          border: '1px solid #BFDBFE',
        }}>
          <div style={{
            color: '#1E40AF',
            fontWeight: '600',
            marginBottom: '8px',
            fontSize: '14px',
          }}>
            💡 Как работает авторизация:
          </div>
          <ol style={{
            textAlign: 'left',
            color: '#1E3A8A',
            fontSize: '13px',
            lineHeight: '1.8',
            paddingLeft: '20px',
            margin: 0,
          }}>
            <li>Нажмите кнопку "Войти через Telegram" выше</li>
            <li>Выберите ваш Telegram аккаунт</li>
            <li>Если ваш аккаунт в списке администраторов - вы автоматически войдете в панель</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
