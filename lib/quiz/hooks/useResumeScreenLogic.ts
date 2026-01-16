// lib/quiz/hooks/useResumeScreenLogic.ts
// Хук для логики показа/скрытия резюм-экрана

import { useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import type { SavedProgress } from '@/lib/quiz/types';

interface UseResumeScreenLogicParams {
  loading: boolean;
  isLoadingProgress: boolean;
  isStartingOver: boolean;
  hasResumed: boolean;
  currentQuestionIndex: number;
  answers: Record<string, any>;
  savedProgress: SavedProgress | null;
  showResumeScreen: boolean;
  setShowResumeScreen: (show: boolean) => void;
}

/**
 * Хук для управления логикой показа/скрытия резюм-экрана
 */
export function useResumeScreenLogic({
  loading,
  isLoadingProgress,
  isStartingOver,
  hasResumed,
  currentQuestionIndex,
  answers,
  savedProgress,
  showResumeScreen,
  setShowResumeScreen,
}: UseResumeScreenLogicParams) {
  useEffect(() => {
    // Не проверяем резюм экран во время загрузки или если пользователь начал заново
    if (loading || isStartingOver || hasResumed) {
      return;
    }
    
    // КРИТИЧНО: Если прогресс еще загружается, не принимаем решение о резюм-экране
    // Это предотвращает скрытие резюм-экрана из-за восстановления состояния из sessionStorage
    // до того, как savedProgress загрузится из React Query
    if (isLoadingProgress) {
      return;
    }
    
    // КРИТИЧНО ИСПРАВЛЕНО: Определяем активную сессию правильно
    // Активная сессия = пользователь активно отвечает на вопросы в текущей сессии
    // НЕ считаем пользователя активно отвечающим, если:
    // 1. Есть сохраненный прогресс с >= 2 ответами (это означает повторный заход)
    // 2. currentQuestionIndex или answers восстановлены из sessionStorage, но savedProgress еще не загружен
    const hasSavedProgress = savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
    
    // КРИТИЧНО: Если есть сохраненный прогресс с >= 2 ответами, это повторный заход
    // В этом случае НЕ считаем пользователя активно отвечающим, даже если currentQuestionIndex > 0 или answers не пустые
    // Это исправляет проблему, когда резюм-экран не показывается из-за восстановления состояния из sessionStorage
    const isActivelyAnswering = hasSavedProgress 
      ? false // Если есть сохраненный прогресс, это повторный заход, не активная сессия
      : (currentQuestionIndex > 0 || Object.keys(answers).length > 0);
    
    // КРИТИЧНО: Если пользователь активно отвечает, НЕ показываем резюм-экран
    // Это предотвращает показ резюм-экрана во время активного прохождения анкеты
    if (isActivelyAnswering) {
      if (showResumeScreen) {
        clientLogger.log('❌ Скрываем резюм экран: пользователь активно отвечает в текущей сессии', {
          currentQuestionIndex,
          answersCount: Object.keys(answers).length,
          savedProgressAnswersCount: savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0,
          hasSavedProgress,
        });
        setShowResumeScreen(false);
      }
      return;
    }
    
    // Проверяем, есть ли сохраненный прогресс
    if (!savedProgress || !savedProgress.answers) {
      // Если нет прогресса, убедимся, что резюм экран скрыт
      if (showResumeScreen) {
        setShowResumeScreen(false);
      }
      return;
    }
    
    const savedAnswersCount = Object.keys(savedProgress.answers).length;
    
    // КРИТИЧНО ИСПРАВЛЕНО: Показываем резюм-экран ТОЛЬКО если:
    // 1. Есть >= 2 сохраненных ответов
    // 2. Пользователь НЕ активно отвечает (проверено выше)
    // Это гарантирует, что резюм-экран показывается только при повторном заходе в приложение,
    // а не во время активного прохождения анкеты
    if (savedAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN) {
      if (!showResumeScreen) {
        clientLogger.log('✅ Показываем резюм экран: есть >= 2 ответов в сохраненном прогрессе (повторный заход)', {
          savedAnswersCount,
          MIN_ANSWERS: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
          currentQuestionIndex,
          currentAnswersCount: Object.keys(answers).length,
          isActivelyAnswering: false, // Гарантировано проверкой выше
          hasSavedProgress,
        });
        setShowResumeScreen(true);
      }
    } else {
      // Если < 2 ответов → не показываем резюм экран
      if (showResumeScreen) {
        clientLogger.log('❌ Скрываем резюм экран: < 2 ответов', {
          savedAnswersCount,
          MIN_ANSWERS: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
        });
        setShowResumeScreen(false);
      }
    }
  }, [loading, isLoadingProgress, savedProgress, showResumeScreen, isStartingOver, hasResumed, currentQuestionIndex, answers, setShowResumeScreen]);
}
