// app/admin/login/page.tsx
// Вход в админку по email + коду. Список допущенных email — в БД (AdminEmailWhitelist), код пользователь задаёт сам.

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [needSetCode, setNeedSetCode] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const checkExistingToken = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      if (!token) {
        setCheckingSession(false);
        return;
      }
      setCheckingSession(true);
      try {
        const headers: HeadersInit = { Authorization: `Bearer ${token}` };
        const response = await fetch('/api/admin/auth', { credentials: 'include', headers });
        if (response.ok) {
          const data = await response.json();
          if (data.valid) {
            router.replace('/admin');
            return;
          }
        }
        // Невалидный или истёкший токен — убираем из localStorage, чтобы показать форму входа
        if (response.status === 401) {
          try { localStorage.removeItem('admin_token'); } catch (_) {}
        }
      } catch (err) {
        console.error('Error checking token:', err);
        try { localStorage.removeItem('admin_token'); } catch (_) {}
      } finally {
        setCheckingSession(false);
      }
    };

    checkExistingToken();
  }, [router, mounted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) {
      setError('Введите email');
      return;
    }

    if (needSetCode) {
      if (newCode.length < 6) {
        setError('Код должен быть не менее 6 символов');
        return;
      }
      if (newCode !== confirmCode) {
        setError('Коды не совпадают');
        return;
      }
    } else if (!code.trim()) {
      // Пустой код — отправим запрос; при первом входе API вернёт needSetCode
    }

    setLoading(true);
    try {
      const body = needSetCode
        ? { email: emailTrim, newCode, confirmCode }
        : { email: emailTrim, code: code.trim() };

      const response = await fetch('/api/admin/login-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        if (typeof data.token === 'string') {
          try {
            localStorage.setItem('admin_token', data.token);
          } catch (_) {}
        }
        router.replace('/admin');
        router.refresh();
        return;
      }

      if (data.needSetCode === true) {
        setNeedSetCode(true);
        setError(data.error || 'Придумайте код не менее 6 символов и введите его дважды.');
      } else {
        setError(data.error || 'Ошибка входа');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Ошибка соединения. Проверьте интернет.');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  if (checkingSession) {
    return (
      <div className="min-h-screen admin-layout flex items-center justify-center p-4" style={{
        background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 30%, #f9fafb 60%, #f3f4f6 100%)',
        backgroundSize: '400% 400%',
      }}>
        <div className="admin-card p-8 max-w-md w-full text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Проверяем доступ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen admin-layout flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 30%, #f9fafb 60%, #f3f4f6 100%)',
      backgroundSize: '400% 400%',
    }}>
      <div className="admin-card p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SkinIQ Admin</h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50/80 border border-red-200/50 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              required
              autoComplete="email"
            />
          </div>

          {needSetCode ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Придумайте код (мин. 6 символов)</label>
                <input
                  type="password"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Повторите код</label>
                <input
                  type="password"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Код доступа</label>
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ваш код"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/80 focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => { setNeedSetCode(true); setError(''); }}
                className="mt-2 text-sm text-gray-500 hover:text-gray-900 underline"
              >
                Первый вход — задать код
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {needSetCode ? 'Сохраняем код...' : 'Вход...'}
              </span>
            ) : needSetCode ? (
              'Задать код и войти'
            ) : (
              'Войти'
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
