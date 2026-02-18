'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function ClearStoragePage() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'clearing' | 'success' | 'error'>('idle');
  const [removedKeys, setRemovedKeys] = useState<{
    localStorage: string[];
    sessionStorage: string[];
  }>({ localStorage: [], sessionStorage: [] });
  const [dbResults, setDbResults] = useState<any>(null);

  const clearStorage = useCallback(async () => {
    setStatus('clearing');

    const localStorageKeys = [
      'is_retaking_quiz',
      'full_retake_from_home',
      'quiz_progress',
      'profile_check_cache',
      'profile_check_cache_timestamp',
    ];

    const sessionStorageKeys = [
      'quiz_just_submitted',
      'profile_check_cache',
      'profile_check_cache_timestamp',
    ];

    const removed: { localStorage: string[]; sessionStorage: string[] } = {
      localStorage: [],
      sessionStorage: [],
    };

    try {
      // 1. Очищаем localStorage
      localStorageKeys.forEach(key => {
        try {
          if (localStorage.getItem(key) !== null) {
            localStorage.removeItem(key);
            removed.localStorage.push(key);
          }
        } catch (keyError) {
          console.warn(`Ошибка при удалении ключа localStorage ${key}:`, keyError);
        }
      });

      // 2. Очищаем sessionStorage
      sessionStorageKeys.forEach(key => {
        try {
          if (sessionStorage.getItem(key) !== null) {
            sessionStorage.removeItem(key);
            removed.sessionStorage.push(key);
          }
        } catch (keyError) {
          console.warn(`Ошибка при удалении ключа sessionStorage ${key}:`, keyError);
        }
      });

      setRemovedKeys(removed);

      // 3. Удаляем данные из БД через API
      try {
        const response = await fetch('/api/user/clear-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(typeof window !== 'undefined' && window.Telegram?.WebApp?.initData
              ? { 'X-Telegram-Init-Data': window.Telegram.WebApp.initData }
              : {}),
          },
        });

        if (response.ok) {
          const data = await response.json();
          setDbResults(data.results || null);
        } else {
          console.warn('Не удалось очистить данные из БД, но localStorage очищен');
        }
      } catch (dbError) {
        console.warn('Ошибка при очистке БД (не критично):', dbError);
        // Продолжаем даже если БД не очистилась
      }

      setStatus('success');

      // Автоматически перенаправляем на главную через 3 секунды
      setTimeout(() => {
        router.push('/home');
      }, 3000);
    } catch (error: any) {
      console.error('Ошибка при очистке:', error);
      setStatus('error');
    }
  }, [router]);

  useEffect(() => {
    // Автоматически очищаем при загрузке страницы
    clearStorage();
  }, [clearStorage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center">
          {status === 'idle' || status === 'clearing' ? (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                Очистка данных...
              </h1>
              <p className="text-gray-600">
                Удаление данных анкеты из браузера
              </p>
            </>
          ) : status === 'success' ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-4">
                ✅ Данные очищены!
              </h1>
              
              {removedKeys.localStorage.length > 0 && (
                <div className="mb-3 text-left bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    Удалено из localStorage:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {removedKeys.localStorage.map(key => (
                      <li key={key}>• {key}</li>
                    ))}
                  </ul>
                </div>
              )}

              {removedKeys.sessionStorage.length > 0 && (
                <div className="mb-3 text-left bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    Удалено из sessionStorage:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {removedKeys.sessionStorage.map(key => (
                      <li key={key}>• {key}</li>
                    ))}
                  </ul>
                </div>
              )}

              {removedKeys.localStorage.length === 0 && removedKeys.sessionStorage.length === 0 && !dbResults && (
                <p className="text-gray-600 mb-4">
                  Данные уже были очищены ранее
                </p>
              )}

              {dbResults && (
                <div className="mb-3 text-left bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    Удалено из базы данных:
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {dbResults.skinProfiles > 0 && <li>• Профилей: {dbResults.skinProfiles}</li>}
                    {dbResults.userAnswers > 0 && <li>• Ответов: {dbResults.userAnswers}</li>}
                    {dbResults.recommendationSessions > 0 && <li>• Сессий рекомендаций: {dbResults.recommendationSessions}</li>}
                    {dbResults.plan28 > 0 && <li>• Планов: {dbResults.plan28}</li>}
                    {dbResults.clientLogs > 0 && <li>• Логов: {dbResults.clientLogs}</li>}
                  </ul>
                </div>
              )}

              <p className="text-sm text-gray-500 mt-4">
                Перенаправление на главную страницу...
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                ❌ Ошибка
              </h1>
              <p className="text-gray-600 mb-4">
                Не удалось очистить данные
              </p>
              <button
                onClick={clearStorage}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Попробовать снова
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
