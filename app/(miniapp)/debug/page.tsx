// app/(miniapp)/debug/page.tsx
// Страница для отладки проблем с планом

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '@/lib/telegram-client';
import { api } from '@/lib/api';

export default function DebugPage() {
  const router = useRouter();
  const { initialize, initData, isAvailable } = useTelegram();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [authStatus, setAuthStatus] = useState<string>('Проверка...');

  useEffect(() => {
    setMounted(true);
    
    // Инициализируем Telegram WebApp
    initialize();
    
    // Пытаемся авторизоваться автоматически
    const tryAuth = async () => {
      let token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      // Если токена нет и Telegram доступен, пытаемся авторизоваться
      if (!token && isAvailable && initData) {
        try {
          setAuthStatus('Авторизация через Telegram...');
          const authResult = await api.authTelegram(initData);
          if (authResult.token) {
            token = authResult.token;
            setAuthStatus('✅ Авторизован через Telegram');
          } else {
            setAuthStatus('❌ Не удалось получить токен');
          }
        } catch (err: any) {
          console.error('Auth error:', err);
          setAuthStatus(`❌ Ошибка авторизации: ${err?.message || 'Неизвестная ошибка'}`);
        }
      } else if (token) {
        setAuthStatus('✅ Токен найден в localStorage');
      } else if (!isAvailable) {
        setAuthStatus('⚠️ Telegram WebApp не доступен (откройте через Telegram Mini App)');
      } else {
        setAuthStatus('⚠️ Токен не найден, Telegram WebApp доступен, но initData отсутствует');
      }
    };
    
    // Даем время на инициализацию
    setTimeout(tryAuth, 500);
  }, [initialize, initData, isAvailable]);

  const testPlan = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setError('Токен не найден. Сначала авторизуйтесь.');
        return;
      }

      const response = await fetch('/api/debug/test-plan', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка при проверке');
    } finally {
      setLoading(false);
    }
  };

  const testPlanGeneration = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        setError('Токен не найден. Сначала авторизуйтесь.');
        return;
      }

      const response = await fetch('/api/plan/generate', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setResult({
        success: true,
        plan: {
          weeksCount: data.weeks?.length || 0,
          productsCount: data.products?.length || 0,
          profile: data.profile,
        },
        fullData: data,
      });
    } catch (err: any) {
      setError(err.message || 'Ошибка при генерации плана');
      setResult({ error: err.message, stack: err.stack });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>Отладка плана</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={testPlan}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0A5F59',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Проверка...' : 'Проверить условия'}
        </button>
        
        <button
          onClick={testPlanGeneration}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4A90E2',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Генерация...' : 'Сгенерировать план'}
        </button>
        
        <button
          onClick={() => router.push('/plan')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#28A745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Перейти к плану
        </button>
      </div>

      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '8px',
          marginBottom: '20px',
          color: '#c33',
        }}>
          <strong>Ошибка:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{
          padding: '15px',
          backgroundColor: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: '8px',
          marginTop: '20px',
        }}>
          <h3>Результат:</h3>
          <pre style={{
            overflow: 'auto',
            maxHeight: '500px',
            backgroundColor: 'white',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '12px',
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px' }}>
        <h3>Информация:</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li><strong>Статус авторизации:</strong> {authStatus}</li>
          <li><strong>Токен:</strong> {mounted && typeof window !== 'undefined' ? (localStorage.getItem('auth_token') ? '✅ Найден' : '❌ Не найден') : 'Загрузка...'}</li>
          <li><strong>Telegram WebApp:</strong> {mounted ? (isAvailable ? '✅ Доступен' : '❌ Не доступен') : 'Загрузка...'}</li>
          <li><strong>initData:</strong> {mounted && initData ? `✅ Есть (${initData.length} символов)` : '❌ Нет'}</li>
        </ul>
        
        {!isAvailable && (
          <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffc107' }}>
            <strong>⚠️ Важно:</strong> Эта страница должна быть открыта через Telegram Mini App, чтобы Telegram WebApp был доступен.
            <br /><br />
            <strong>Как открыть правильно:</strong>
            <ol style={{ marginLeft: '20px', marginTop: '8px' }}>
              <li>Откройте бота <code>@skinplanned_bot</code> в Telegram</li>
              <li>Нажмите кнопку "Открыть приложение" или отправьте команду <code>/start</code></li>
              <li>В приложении перейдите на страницу <code>/debug</code></li>
            </ol>
            <br />
            <button
              onClick={async () => {
                try {
                  setAuthStatus('Попытка авторизации...');
                  if (initData) {
                    const authResult = await api.authTelegram(initData);
                    if (authResult.token) {
                      setAuthStatus('✅ Авторизован');
                      window.location.reload();
                    } else {
                      setAuthStatus('❌ Не удалось получить токен');
                    }
                  } else {
                    setAuthStatus('❌ initData не доступен');
                  }
                } catch (err: any) {
                  setAuthStatus(`❌ Ошибка: ${err?.message}`);
                }
              }}
              disabled={!initData}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#0A5F59',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: initData ? 'pointer' : 'not-allowed',
                opacity: initData ? 1 : 0.5,
              }}
            >
              Попробовать авторизоваться
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

