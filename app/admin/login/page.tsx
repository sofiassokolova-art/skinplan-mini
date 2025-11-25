// app/admin/login/page.tsx
// Страница входа в админ-панель через Telegram

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/lib/telegram-client';

export default function AdminLogin() {
  const router = useRouter();
  const { initialize, initData, isAvailable, user } = useTelegram();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Проверка авторизации...');

  useEffect(() => {
    initialize();
    
    // Проверяем, есть ли уже токен
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (token) {
      router.push('/admin');
      return;
    }

    // Если Telegram доступен, пытаемся авторизоваться
    if (isAvailable && initData) {
      handleTelegramLogin();
    } else {
      setStatus('Ожидание Telegram WebApp...');
      setLoading(false);
    }
  }, [isAvailable, initData, router]);

  const handleTelegramLogin = async () => {
    if (!initData) {
      setError('Telegram WebApp не доступен. Откройте страницу через Telegram Mini App.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Авторизация через Telegram...');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': initData,
        },
        body: JSON.stringify({ initData }),
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
      setStatus('✅ Успешная авторизация! Перенаправление...');
      
      // Перенаправляем в админ-панель
      setTimeout(() => {
        router.push('/admin');
      }, 500);
    } catch (err) {
      console.error('Error during login:', err);
      setError('Ошибка соединения. Проверьте подключение к интернету.');
      setLoading(false);
    }
  };

  if (!isAvailable) {
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
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#0A5F59',
            marginBottom: '16px',
          }}>
            Вход в админ-панель
          </h2>
          <p style={{
            color: '#475467',
            marginBottom: '24px',
            lineHeight: '1.6',
          }}>
            Для доступа к админ-панели необходимо открыть эту страницу через Telegram Mini App.
          </p>
          <div style={{
            backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
          }}>
            <p style={{
              color: '#92400E',
              fontSize: '14px',
              marginBottom: '8px',
            }}>
              <strong>Как открыть:</strong>
            </p>
            <ol style={{
              textAlign: 'left',
              color: '#78350F',
              fontSize: '14px',
              lineHeight: '1.8',
              paddingLeft: '20px',
            }}>
              <li>Откройте бота @skinplanned_bot в Telegram</li>
              <li>Отправьте команду /start или откройте Mini App</li>
              <li>Перейдите на страницу /admin/login</li>
            </ol>
          </div>
        </div>
      </div>
    );
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
          Авторизация через Telegram
        </p>

        {user && (
          <div style={{
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              fontSize: '14px',
              color: '#1E40AF',
              marginBottom: '8px',
            }}>
              <strong>Пользователь:</strong>
            </div>
            <div style={{
              fontSize: '16px',
              color: '#1E3A8A',
              fontWeight: '600',
            }}>
              {user.first_name} {user.last_name || ''}
            </div>
            {user.username && (
              <div style={{
                fontSize: '14px',
                color: '#475467',
                marginTop: '4px',
              }}>
                @{user.username}
              </div>
            )}
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
              {status}
            </div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

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

        {!loading && !error && !initData && (
          <button
            onClick={handleTelegramLogin}
            style={{
              width: '100%',
              padding: '16px 24px',
              backgroundColor: '#0A5F59',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Войти через Telegram
          </button>
        )}
      </div>
    </div>
  );
}
