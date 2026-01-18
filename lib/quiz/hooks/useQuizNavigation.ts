// lib/quiz/hooks/useQuizNavigation.ts
// Хук для управления навигацией по анкете (индексы вопросов и инфо-экранов)
// Вынесен из useQuizStateExtended для разделения ответственности

import { useState, useRef, useEffect, useMemo } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';

export interface UseQuizNavigationReturn {
  // Навигация
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  currentQuestionIndexRef: React.MutableRefObject<number>;
  currentInfoScreenIndex: number;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
}

/**
 * Хук для управления навигацией по анкете
 * Управляет индексами текущего вопроса и инфо-экрана
 */
export function useQuizNavigation(): UseQuizNavigationReturn {
  // КРИТИЧНО ИСПРАВЛЕНО: Все useState должны вызываться в стабильном порядке
  // Вычисляем начальные значения с помощью функции-инициализатора useState вместо useMemo
  // Это гарантирует стабильный порядок хуков и предотвращает React Error #300
  
  // Навигация - используем функцию-инициализатор для стабильности
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    // Восстанавливаем индекс из sessionStorage при инициализации
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
        if (saved !== null) {
          const savedIndex = parseInt(saved, 10);
          if (!isNaN(savedIndex) && savedIndex >= 0) {
            return savedIndex;
          }
        }
      } catch (err) {
        // Игнорируем ошибки sessionStorage
      }
    }
    return 0;
  });
  
  const [currentInfoScreenIndex, setCurrentInfoScreenIndex] = useState(() => {
    // Восстанавливаем индекс из sessionStorage при инициализации
    // ИСПРАВЛЕНО: Для нового пользователя всегда начинаем с 0, чтобы показать все начальные инфо-экраны
    if (typeof window !== 'undefined') {
      try {
        // Проверяем, есть ли сохраненные ответы - если нет или только 1 (имя), это новый пользователь
        // ИСПРАВЛЕНО: Используем правильный ключ для сохраненных ответов
        const savedAnswersStr = sessionStorage.getItem('quiz_answers_backup');
        let savedAnswersCount = 0;
        if (savedAnswersStr && savedAnswersStr !== '{}' && savedAnswersStr !== 'null') {
          try {
            const parsed = JSON.parse(savedAnswersStr);
            savedAnswersCount = Object.keys(parsed || {}).length;
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }

        clientLogger.log('🔍 useQuizNavigation: инициализация currentInfoScreenIndex', {
          savedAnswersStr: savedAnswersStr?.substring(0, 100),
          savedAnswersCount,
          hasAnswersBackup: !!savedAnswersStr,
        });

        // ИСПРАВЛЕНО: Если нет ответов или только 1 ответ (имя), это новый пользователь - всегда начинаем с 0
        if (savedAnswersCount <= 1) {
          clientLogger.log('🆕 useQuizNavigation: новый пользователь, начинаем с 0');
          // Очищаем сохраненный индекс для нового пользователя
          sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
          sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
          return 0;
        }
        
        // Для пользователя с сохраненными ответами (> 1) восстанавливаем индекс
        const saved = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
        clientLogger.log('🔍 useQuizNavigation: проверка сохраненного индекса', {
          saved,
          storageKey: QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN,
        });

        if (saved !== null) {
          const savedIndex = parseInt(saved, 10);
          if (!isNaN(savedIndex) && savedIndex >= 0) {
            const initialInfoScreens = getInitialInfoScreens();
            clientLogger.log('🔍 useQuizNavigation: анализ сохраненного индекса', {
              savedIndex,
              initialInfoScreensLength: initialInfoScreens.length,
              savedAnswersCount,
            });

            // ИСПРАВЛЕНО: Если индекс >= длины начальных экранов, это означает, что пользователь уже прошел их
            // Но если <= 1 ответ, это ошибка - сбрасываем на 0
            if (savedIndex < initialInfoScreens.length) {
              clientLogger.log('✅ useQuizNavigation: восстанавливаем сохраненный индекс', savedIndex);
              return savedIndex;
            } else if (savedIndex >= initialInfoScreens.length && savedAnswersCount > 1) {
              // Пользователь уже прошел начальные экраны и есть ответы (> 1) - это нормально
              clientLogger.log('✅ useQuizNavigation: пользователь уже прошел инфо-экраны', savedIndex);
              return savedIndex;
            } else {
              // Индекс >= длины начальных экранов, но <= 1 ответ - это ошибка, сбрасываем на 0
              clientLogger.log('🔄 useQuizNavigation: некорректный индекс, сбрасываем на 0');
              sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
              return 0;
            }
          }
        }

        // Нет сохраненного индекса - начинаем с 0
        clientLogger.log('🆕 useQuizNavigation: нет сохраненного индекса, начинаем с 0');
        return 0;
      } catch (err) {
        // Игнорируем ошибки sessionStorage
      }
    }
    return 0;
  });
  
  // Refs для синхронизации - используем начальные значения из state
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  const currentInfoScreenIndexRef = useRef(currentInfoScreenIndex);

  // Синхронизация refs с state
  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  useEffect(() => {
    currentInfoScreenIndexRef.current = currentInfoScreenIndex;
  }, [currentInfoScreenIndex]);

  return {
    // Навигация
    currentQuestionIndex,
    setCurrentQuestionIndex,
    currentQuestionIndexRef,
    currentInfoScreenIndex,
    setCurrentInfoScreenIndex,
    currentInfoScreenIndexRef,
  };
}
