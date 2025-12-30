// lib/quiz/hooks/useQuizView.ts
// Хук для определения текущего экрана анкеты
// Упрощает условия рендеринга в quiz/page.tsx

import { useMemo } from 'react';
import { INFO_SCREENS, type InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface UseQuizViewParams {
  // State
  showResumeScreen: boolean;
  showRetakeScreen: boolean;
  isRetakingQuiz: boolean;
  pendingInfoScreen: InfoScreen | null;
  currentInfoScreenIndex: number;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  currentQuestionIndex: number;
  currentQuestion: any | null;
  questionnaire: any | null;
  loading: boolean;
  hasResumed: boolean;
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  answers: Record<number, string | string[]>;
  allQuestionsLength: number;
  isDev: boolean;
}

export interface QuizView {
  type: 'resume' | 'retake' | 'pendingInfo' | 'initialInfo' | 'question' | 'loading' | 'error';
  screen?: InfoScreen | null;
  question?: any | null;
}

export function useQuizView(params: UseQuizViewParams): QuizView {
  const {
    showResumeScreen,
    showRetakeScreen,
    isRetakingQuiz,
    pendingInfoScreen,
    currentInfoScreenIndex,
    currentInfoScreenIndexRef,
    currentQuestionIndex,
    currentQuestion,
    questionnaire,
    loading,
    hasResumed,
    savedProgress,
    answers,
    allQuestionsLength,
    isDev,
  } = params;

  return useMemo(() => {
    // 1. Экран продолжения (resume)
    if (showResumeScreen) {
      return { type: 'resume' };
    }

    // 2. Экран выбора тем для перепрохождения (retake)
    if (showRetakeScreen && isRetakingQuiz) {
      return { type: 'retake' };
    }

    // 3. Информационный экран между вопросами (pendingInfoScreen)
    if (pendingInfoScreen && !isRetakingQuiz) {
      return { type: 'pendingInfo', screen: pendingInfoScreen };
    }

    // 4. Начальные информационные экраны
    const initialInfoScreens = INFO_SCREENS.filter(
      screen => !screen.showAfterQuestionCode && !screen.showAfterInfoScreenId
    );

    // Проверяем, нужно ли показывать начальные экраны
    const shouldShowInitialInfoScreen = (() => {
      // Не показываем, если показывается resume screen
      if (showResumeScreen) return false;
      
      // Не показываем, если показывается retake screen
      if (showRetakeScreen && isRetakingQuiz) return false;
      
      // Не показываем, если есть сохраненный прогресс с ответами
      if (savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length > 0) {
        return false;
      }
      
      // Не показываем, если пользователь уже возобновил анкету
      if (hasResumed) return false;
      
      // Не показываем при повторном прохождении без экрана выбора тем
      if (isRetakingQuiz && !showRetakeScreen) return false;
      
      // Не показываем, если уже прошли все начальные экраны
      if (currentInfoScreenIndex >= initialInfoScreens.length) return false;
      if (currentInfoScreenIndexRef.current >= initialInfoScreens.length) return false;
      
      // Не показываем, если пользователь уже начал отвечать
      if (currentQuestionIndex > 0 || Object.keys(answers).length > 0) return false;
      
      // Показываем, если currentInfoScreenIndex < initialInfoScreens.length
      return currentInfoScreenIndex < initialInfoScreens.length;
    })();

    if (shouldShowInitialInfoScreen) {
      const currentInitialInfoScreen = 
        currentInfoScreenIndex >= 0 && 
        currentInfoScreenIndex < initialInfoScreens.length
          ? initialInfoScreens[currentInfoScreenIndex]
          : null;

      if (currentInitialInfoScreen && questionnaire && !pendingInfoScreen) {
        return { type: 'initialInfo', screen: currentInitialInfoScreen };
      }
    }

    // 5. Вопрос
    if (currentQuestion && !loading && questionnaire) {
      return { type: 'question', question: currentQuestion };
    }

    // 6. Загрузка
    if (loading || !questionnaire) {
      return { type: 'loading' };
    }

    // 7. По умолчанию - ошибка или пустое состояние
    return { type: 'error' };
  }, [
    showResumeScreen,
    showRetakeScreen,
    isRetakingQuiz,
    pendingInfoScreen,
    currentInfoScreenIndex,
    currentInfoScreenIndexRef,
    currentQuestionIndex,
    currentQuestion,
    questionnaire,
    loading,
    hasResumed,
    savedProgress,
    answers,
    allQuestionsLength,
    isDev,
  ]);
}

