// lib/quiz/hooks/useResumeScreenLogic.ts
// Хук для логики показа/скрытия резюм-экрана

import { useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import type { SavedProgress } from '@/lib/quiz/types';

interface UseResumeScreenLogicParams {
  loading: boolean;
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
    
    // ИСПРАВЛЕНО: Не показываем резюм экран, если пользователь уже активно отвечает в текущей сессии
    // Это предотвращает показ резюм экрана для новых пользователей, которые только что ответили на вопросы
    const isActiveSession = currentQuestionIndex > 0 || Object.keys(answers).length > 0;
    if (isActiveSession) {
      // Если пользователь уже отвечает, скрываем резюм экран
      if (showResumeScreen) {
        clientLogger.log('❌ Скрываем резюм экран: пользователь активно отвечает в текущей сессии', {
          currentQuestionIndex,
          answersCount: Object.keys(answers).length,
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
    
    // Если >= 2 ответов → показать резюм экран ТОЛЬКО при первой загрузке (не в активной сессии)
    if (savedAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN) {
      if (!showResumeScreen) {
        clientLogger.log('✅ Показываем резюм экран: есть >= 2 ответов в сохраненном прогрессе (первая загрузка)', {
          savedAnswersCount,
          MIN_ANSWERS: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
          currentQuestionIndex,
          currentAnswersCount: Object.keys(answers).length,
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
  }, [loading, savedProgress, showResumeScreen, isStartingOver, hasResumed, currentQuestionIndex, answers, setShowResumeScreen]);
}
