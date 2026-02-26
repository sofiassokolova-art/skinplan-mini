// lib/quiz/hooks/useQuizNavigation.ts
// Хук для управления навигацией по анкете (индексы вопросов и инфо-экранов)
// Вынесен из useQuizStateExtended для разделения ответственности

import { useState, useRef, useEffect } from 'react';
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
  // Всегда начинаем с 0 — одинаково на сервере и клиенте (нет hydration mismatch)
  // Восстановление из sessionStorage происходит в useEffect после гидрации
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentInfoScreenIndex, setCurrentInfoScreenIndex] = useState(0);

  // Refs для синхронизации
  const currentQuestionIndexRef = useRef(0);
  const currentInfoScreenIndexRef = useRef(0);

  // Восстанавливаем индексы из sessionStorage только на клиенте после гидрации
  useEffect(() => {
    try {
      const savedAnswersStr = sessionStorage.getItem('quiz_answers_backup');
      let savedAnswersCount = 0;
      if (savedAnswersStr && savedAnswersStr !== '{}' && savedAnswersStr !== 'null') {
        try {
          const parsed = JSON.parse(savedAnswersStr);
          savedAnswersCount = Object.keys(parsed || {}).length;
        } catch (e) { /* ignore */ }
      }

      clientLogger.log('🔍 useQuizNavigation: инициализация currentInfoScreenIndex', {
        savedAnswersStr: savedAnswersStr?.substring(0, 100),
        savedAnswersCount,
        hasAnswersBackup: !!savedAnswersStr,
      });

      // Новый пользователь (0-1 ответов) — сбрасываем всё на 0
      if (savedAnswersCount <= 1) {
        clientLogger.log('🆕 useQuizNavigation: новый пользователь, начинаем с 0');
        sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
        sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
        return;
      }

      // Пользователь с прогрессом — НЕ восстанавливаем currentQuestionIndex если >= MIN_ANSWERS
      // (резюм-экран сам установит правильный индекс)
      if (savedAnswersCount < QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN) {
        const savedQ = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
        if (savedQ !== null) {
          const idx = parseInt(savedQ, 10);
          if (!isNaN(idx) && idx >= 0) {
            setCurrentQuestionIndex(idx);
            currentQuestionIndexRef.current = idx;
          }
        }
      } else {
        clientLogger.log('⏸️ useQuizNavigation: пропускаем восстановление currentQuestionIndex — резюм-экран установит индекс', {
          savedAnswersCount,
          minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
        });
      }

      // Восстанавливаем currentInfoScreenIndex
      const savedInfo = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
      clientLogger.log('🔍 useQuizNavigation: проверка сохраненного индекса', {
        saved: savedInfo,
        storageKey: QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN,
      });
      if (savedInfo !== null) {
        const savedIndex = parseInt(savedInfo, 10);
        if (!isNaN(savedIndex) && savedIndex >= 0) {
          const initialInfoScreens = getInitialInfoScreens();
          clientLogger.log('🔍 useQuizNavigation: анализ сохраненного индекса', {
            savedIndex,
            initialInfoScreensLength: initialInfoScreens.length,
            savedAnswersCount,
          });
          if (savedIndex < initialInfoScreens.length || savedAnswersCount > 1) {
            clientLogger.log('✅ useQuizNavigation: восстанавливаем сохраненный индекс', savedIndex);
            setCurrentInfoScreenIndex(savedIndex);
            currentInfoScreenIndexRef.current = savedIndex;
          } else {
            clientLogger.log('🔄 useQuizNavigation: некорректный индекс, сбрасываем на 0');
            sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
          }
        }
      } else {
        clientLogger.log('🆕 useQuizNavigation: нет сохраненного индекса, начинаем с 0');
      }
    } catch (err) {
      // Игнорируем ошибки sessionStorage
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
