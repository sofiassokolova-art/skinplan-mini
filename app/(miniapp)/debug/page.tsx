// app/(miniapp)/debug/page.tsx
// Страница для отладки проблем с планом

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DebugPage() {
  const router = useRouter();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        <ul>
          <li>Токен: {mounted && typeof window !== 'undefined' ? (localStorage.getItem('auth_token') ? '✅ Найден' : '❌ Не найден') : 'Загрузка...'}</li>
          <li>Telegram WebApp: {mounted && typeof window !== 'undefined' && window.Telegram?.WebApp ? '✅ Доступен' : '❌ Не доступен'}</li>
        </ul>
      </div>
    </div>
  );
}

