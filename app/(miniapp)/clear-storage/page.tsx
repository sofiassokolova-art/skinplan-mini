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

  const clearStorage = useCallback(() => {
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
      // Очистка localStorage
      localStorageKeys.forEach(key => {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          removed.localStorage.push(key);
        }
      });

      // Очистка sessionStorage
      sessionStorageKeys.forEach(key => {
        if (sessionStorage.getItem(key) !== null) {
          sessionStorage.removeItem(key);
          removed.sessionStorage.push(key);
        }
      });

      setRemovedKeys(removed);
      setStatus('success');

      // Автоматически перенаправляем на главную через 2 секунды
      setTimeout(() => {
        router.push('/');
      }, 2000);
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

              {removedKeys.localStorage.length === 0 && removedKeys.sessionStorage.length === 0 && (
                <p className="text-gray-600 mb-4">
                  Данные уже были очищены ранее
                </p>
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
