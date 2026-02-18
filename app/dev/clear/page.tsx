'use client';

// Страница сброса: очищает localStorage, sessionStorage и прогресс на сервере.
// Открой /dev/clear в браузере, чтобы войти в приложение как новый пользователь.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const QUIZ_KEYS = [
  'quiz_progress',
  'quiz_just_submitted',
  'quiz_retake',
  'quiz_full_retake_from_home',
  'quiz_progress_cleared',
  'quiz_initCalled',
  'quiz_completed',
  'quiz_currentInfoScreenIndex',
  'quiz_currentQuestionIndex',
  'quiz_currentQuestionCode',
  'quiz_answers_backup',
  'default:quiz_progress_cleared',
  'user_preferences_cache',
  'profile_check_cache',
  'profile_check_cache_timestamp',
  'is_retaking_quiz',
  'full_retake_from_home',
  'currentInfoScreenIndex',
];

function clearAllStorage(): number {
  if (typeof window === 'undefined') return 0;
  let removed = 0;
  try {
    for (const key of QUIZ_KEYS) {
      try {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          removed++;
        }
        if (sessionStorage.getItem(key) !== null) {
          sessionStorage.removeItem(key);
          removed++;
        }
      } catch (_) {}
    }
    try {
      const sessionKeys = Object.keys(sessionStorage);
      for (const key of sessionKeys) {
        if (
          key.includes('quiz') ||
          key.includes('Quiz') ||
          key.includes('currentQuestion') ||
          key.includes('currentInfoScreen') ||
          key.includes('questionnaire') ||
          key.includes('profile_check') ||
          key.includes('user_preferences')
        ) {
          sessionStorage.removeItem(key);
          removed++;
        }
      }
    } catch (_) {}
    try {
      const localKeys = Object.keys(localStorage);
      for (const key of localKeys) {
        if (
          key.includes('quiz') ||
          key.includes('Quiz') ||
          key.includes('questionnaire') ||
          key.includes('profile_check') ||
          key === 'user_preferences_cache'
        ) {
          localStorage.removeItem(key);
          removed++;
        }
      }
    } catch (_) {}
  } catch (_) {}
  return removed;
}

export default function DevClearPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'clearing' | 'done' | 'error'>('clearing');
  const [message, setMessage] = useState('Очищаем данные...');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const removed = clearAllStorage();
        if (cancelled) return;
        setMessage(`Очищено ключей в браузере: ${removed}. Очистка прогресса на сервере...`);

        try {
          const initData = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : '';
          const res = await fetch('/api/questionnaire/progress', {
            method: 'DELETE',
            headers: initData ? { 'X-Telegram-Init-Data': initData } : {},
          });
          if (cancelled) return;
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            setMessage(
              `Готово. Удалено ответов на сервере: ${data.deletedCount ?? 0}. Редирект на главную...`
            );
          } else {
            await res.text();
            setMessage(
              'Локальные данные очищены. Прогресс на сервере не изменён (откройте анкету в Mini App для полного сброса). Редирект...'
            );
          }
        } catch (_) {
          if (!cancelled) {
            setMessage('Локальные данные очищены. Сервер недоступен. Редирект на главную...');
          }
        }

        if (!cancelled) setStatus('done');
        setTimeout(() => {
          if (!cancelled) router.replace('/');
        }, 2000);
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setMessage(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <p style={{ margin: 0, fontSize: 18, color: '#0A5F59' }}>{message}</p>
      {status === 'error' && (
        <a href="/" style={{ marginTop: 16, color: '#0A5F59', textDecoration: 'underline' }}>
          На главную
        </a>
      )}
    </div>
  );
}
