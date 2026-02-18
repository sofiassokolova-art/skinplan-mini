// hooks/useQuizNavigation.ts
// Хук для навигации по анкете (handleNext, handleBack)
// Вынесено из quiz/page.tsx для улучшения читаемости

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { handleNext as handleNextFn, type HandleNextParams } from '@/lib/quiz/handlers/handleNext';
import { INFO_SCREENS, type InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import type { Question, Questionnaire } from '@/lib/quiz/types';

export interface UseQuizNavigationParams {
  questionnaire: Questionnaire | null;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  allQuestions: Question[];
  answers: Record<number, string | string[]>;
  pendingInfoScreen: InfoScreen | null;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  hasResumed: boolean;
  loading: boolean;
  initCompletedRef: React.MutableRefObject<boolean>;
  saveProgress: (answers: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => Promise<void>;
  isDev: boolean;
}

export interface UseQuizNavigationReturn {
  handleNext: () => Promise<void>;
  handleBack: () => void;
  isHandlingNext: boolean;
  currentInfoScreenIndex: number;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  pendingInfoScreen: InfoScreen | null;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<InfoScreen | null>>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
}

export function useQuizNavigation(params: UseQuizNavigationParams): UseQuizNavigationReturn {
  const {
    questionnaire,
    questionnaireRef,
    currentInfoScreenIndex: initialInfoScreenIndex,
    currentQuestionIndex: initialQuestionIndex,
    allQuestions,
    answers,
    pendingInfoScreen: initialPendingInfoScreen,
    isRetakingQuiz,
    showRetakeScreen,
    hasResumed,
    loading,
    initCompletedRef,
    saveProgress,
    isDev,
  } = params;

  // State
  const [currentInfoScreenIndex, setCurrentInfoScreenIndex] = useState(initialInfoScreenIndex);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialQuestionIndex);
  const [pendingInfoScreen, setPendingInfoScreen] = useState<InfoScreen | null>(initialPendingInfoScreen);
  const [isHandlingNext, setIsHandlingNext] = useState(false);

  // Refs
  const handleNextInProgressRef = useRef(false);
  const currentInfoScreenIndexRef = useRef(initialInfoScreenIndex);

  // Sync refs
  useEffect(() => {
    currentInfoScreenIndexRef.current = currentInfoScreenIndex;
  }, [currentInfoScreenIndex]);

  // Handle next
  const handleNext = useCallback(async () => {
    await handleNextFn({
      handleNextInProgressRef,
      currentInfoScreenIndexRef,
      questionnaireRef,
      initCompletedRef,
      questionnaire,
      loading,
      currentInfoScreenIndex,
      currentQuestionIndex,
      allQuestions,
      isRetakingQuiz,
      showRetakeScreen,
      hasResumed,
      pendingInfoScreen,
      answers,
      setIsHandlingNext,
      setCurrentInfoScreenIndex,
      setCurrentQuestionIndex,
      setPendingInfoScreen,
      saveProgress,
      isDev,
    });
  }, [
    questionnaire,
    loading,
    currentInfoScreenIndex,
    currentQuestionIndex,
    allQuestions,
    isRetakingQuiz,
    showRetakeScreen,
    hasResumed,
    pendingInfoScreen,
    answers,
    saveProgress,
    isDev,
  ]);

  // Handle back
  const handleBack = useCallback(() => {
    if (!questionnaire) return;

    const initialInfoScreens = INFO_SCREENS.filter(
      screen => !screen.showAfterQuestionCode && !screen.showAfterInfoScreenId
    );

    // Если показывается инфо-экран между вопросами, просто закрываем его
    if (pendingInfoScreen) {
      setPendingInfoScreen(null);
      return;
    }

    // Если мы на первом начальном информационном экране, ничего не делаем
    if (currentInfoScreenIndex === 0) {
      clientLogger.log('ℹ️ Пользователь на первом экране анкеты, но нажал "Назад" - остаемся на странице анкеты');
      return;
    }

    // Если мы на первом вопросе, возвращаемся к последнему начальному инфо-экрану
    if (currentInfoScreenIndex === initialInfoScreens.length && currentQuestionIndex === 0) {
      setCurrentInfoScreenIndex(initialInfoScreens.length - 1);
      return;
    }

    // Если мы на начальных информационных экранах, переходим к предыдущему
    if (currentInfoScreenIndex > 0 && currentInfoScreenIndex < initialInfoScreens.length) {
      setCurrentInfoScreenIndex(currentInfoScreenIndex - 1);
      return;
    }

    // Если мы на вопросах, переходим к предыдущему
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  }, [questionnaire, pendingInfoScreen, currentInfoScreenIndex, currentQuestionIndex]);

  return {
    handleNext,
    handleBack,
    isHandlingNext,
    currentInfoScreenIndex,
    setCurrentInfoScreenIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    pendingInfoScreen,
    setPendingInfoScreen,
    currentInfoScreenIndexRef,
  };
}

