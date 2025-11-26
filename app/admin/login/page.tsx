// app/admin/login/page.tsx
// Страница входа в админ-панель по секретному слову

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [secretWord, setSecretWord] = useState('');
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
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretWord: secretWord.trim() }),
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        setError(`Ошибка сервера: ${response.status} ${response.statusText}`);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        console.error('Login error:', {
          status: response.status,
          error: data.error,
          statusText: response.statusText,
        });
        
        if (response.status === 401 || response.status === 403) {
          setError(data.error || 'Неверное секретное слово. Доступ запрещен.');
        } else if (response.status === 429) {
          const retryAfter = data.retryAfter || 15;
          setError(`Слишком много попыток. Подождите ${retryAfter} минут(ы) и попробуйте снова.`);
        } else if (response.status === 500) {
          setError(data.error || 'Ошибка сервера. Проверьте настройки ADMIN_SECRET на Vercel.');
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
          Введите секретное слово для доступа
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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '24px' }}>
            <input
              type="password"
              value={secretWord}
              onChange={(e) => setSecretWord(e.target.value)}
              placeholder="Секретное слово"
              disabled={loading}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid rgba(10, 95, 89, 0.2)',
                fontSize: '16px',
                fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
                backgroundColor: 'white',
                color: '#0A5F59',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#0A5F59';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(10, 95, 89, 0.2)';
              }}
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || !secretWord.trim()}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: loading || !secretWord.trim() ? 'rgba(10, 95, 89, 0.5)' : '#0A5F59',
              color: 'white',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading || !secretWord.trim() ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              boxShadow: loading || !secretWord.trim() ? 'none' : '0 4px 12px rgba(10, 95, 89, 0.3)',
            }}
          >
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                }}></div>
                <span>Вход...</span>
              </div>
            ) : (
              'Войти'
            )}
          </button>
        </form>

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>

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
            🔒 Безопасность
          </div>
          <div style={{
            color: '#1E3A8A',
            fontSize: '13px',
            lineHeight: '1.6',
          }}>
            Секретное слово требуется для доступа к админ-панели. 
            Оно хранится в переменных окружения и известно только администраторам.
          </div>
        </div>
      </div>
    </div>
  );
}
