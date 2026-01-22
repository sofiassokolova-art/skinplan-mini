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
    
    // ИСПРАВЛЕНО: НЕ ждем загрузки прогресса из React Query, если есть savedProgress из sessionStorage
    // Это позволяет показать резюм-экран сразу, даже если React Query еще загружается
    // Проверяем только если savedProgress пустой И прогресс еще загружается
    // НО: если answers уже восстановлены из sessionStorage, значит savedProgress тоже должен быть восстановлен
    const hasAnswersFromStorage = Object.keys(answers).length > 0;
    if (isLoadingProgress && (!savedProgress || !savedProgress.answers || Object.keys(savedProgress.answers).length === 0) && !hasAnswersFromStorage) {
      return;
    }
    
    // ИСПРАВЛЕНО: Определяем активную сессию правильно
    // Активная сессия = пользователь активно отвечает на вопросы в текущей сессии
    const currentAnswersCount = Object.keys(answers).length;
    const savedAnswersCount = savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0;
    const hasSavedProgress = savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
    
    // ИСПРАВЛЕНО: Пользователь активно отвечает ТОЛЬКО если:
    // 1. Есть ответы в текущей сессии (answers не пустые) И
    // 2. Текущие ответы совпадают с сохраненными (пользователь продолжает текущую сессию)
    // НЕ используем currentQuestionIndex > 0, так как он может быть восстановлен из sessionStorage
    // даже если пользователь не активно отвечает (например, после перезагрузки страницы)
    const isActivelyAnswering = currentAnswersCount > 0;
    
    // Проверяем, совпадают ли текущие ответы с сохраненными
    // Если совпадают, это означает, что пользователь продолжает текущую сессию
    let answersMatchSaved = false;
    if (hasSavedProgress && currentAnswersCount > 0 && savedProgress.answers) {
      // Проверяем, что все текущие ответы есть в savedProgress и совпадают
      answersMatchSaved = Object.keys(answers).every(key => {
        const answerKey = Number(key);
        return savedProgress.answers && savedProgress.answers[answerKey] !== undefined && 
               savedProgress.answers[answerKey] === answers[answerKey];
      });
    }
    
    // Если ответы совпадают с сохраненными ИЛИ текущих ответов больше/равно сохраненным, это активная сессия
    const isContinuingSession = answersMatchSaved || (currentAnswersCount > 0 && currentAnswersCount >= savedAnswersCount);
    
    // КРИТИЧНО: Если пользователь активно отвечает или продолжает сессию, НЕ показываем резюм-экран
    // Это предотвращает показ резюм-экрана во время активного прохождения анкеты
    if (isActivelyAnswering || isContinuingSession) {
      if (showResumeScreen) {
        clientLogger.log('❌ Скрываем резюм экран: пользователь активно отвечает в текущей сессии', {
          currentQuestionIndex,
          currentAnswersCount,
          savedAnswersCount,
          hasSavedProgress,
          isActivelyAnswering,
          isContinuingSession,
          answersMatchSaved,
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
    
    // ИСПРАВЛЕНО: savedAnswersCount уже объявлен выше, не объявляем повторно
    
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
