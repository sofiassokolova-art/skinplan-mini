// app/(miniapp)/quiz/hooks/useQuizScreen.ts
// Хук для определения текущего экрана квиза - вынесен из page.tsx

'use client';

import { useMemo } from 'react';
import { useQuizContext } from '../components/QuizProvider';
import { shouldShowInitialLoader } from '@/lib/quiz/utils/quizRenderHelpers';
import type { Question } from '@/lib/quiz/types';

type Screen = 'LOADER' | 'ERROR' | 'RETAKE' | 'RESUME' | 'INFO' | 'INITIAL_INFO' | 'QUESTION';

export function useQuizScreen(currentQuestion: Question | null) {
  const {
    quizState,
    questionnaireQuery,
    progressQuery,
  } = useQuizContext();

  const {
    questionnaire,
    questionnaireRef,
    loading,
    error,
    currentInfoScreenIndex,
    currentQuestionIndex,
    answers,
    showResumeScreen,
    isSubmitting,
    finalizing,
    pendingInfoScreen,
    savedProgress,
    isRetakingQuiz,
    showRetakeScreen,
    initCompleted,
    currentInitialInfoScreen,
    initialInfoScreens,
    isShowingInitialInfoScreen,
    isLoadingProgress,
    progressLoaded,
    resumeLocked,
  } = quizState;

  const { data: questionnaireFromQuery } = questionnaireQuery;

  return useMemo((): Screen => {
    // Error state has higher priority
    if (error && !isRetakingQuiz) return 'ERROR';

    if (resumeLocked) return 'RESUME';

    if (showRetakeScreen && isRetakingQuiz) return 'RETAKE';

    if (pendingInfoScreen && !isRetakingQuiz) return 'INFO';

    const hasEnoughSavedAnswers = savedProgress?.answers && Object.keys(savedProgress.answers).length >= 2;
    if (
      isShowingInitialInfoScreen &&
      currentInitialInfoScreen &&
      currentInfoScreenIndex < initialInfoScreens.length &&
      !isRetakingQuiz &&
      !pendingInfoScreen &&
      !isLoadingProgress &&
      !hasEnoughSavedAnswers
    ) {
      return 'INITIAL_INFO';
    }

    const baseReady = !!(questionnaireFromQuery || questionnaireRef.current || questionnaire);
    if (!baseReady) return 'LOADER';

    if (shouldShowInitialLoader({
      questionnaire,
      questionnaireFromQuery,
      progressQuery,
      loading,
      isLoadingProgress,
      progressLoaded,
      currentQuestion,
      isShowingInitialInfoScreen,
      currentInitialInfoScreen,
      initialInfoScreens,
      currentInfoScreenIndex,
      isRetakingQuiz,
      pendingInfoScreen,
      savedProgress,
      initCompleted,
    })) return 'LOADER';

    // IMPORTANT: если вопроса нет — не показываем "пустой фон"
    if (!currentQuestion) return 'LOADER';

    return 'QUESTION';
  }, [
    error,
    isRetakingQuiz,
    resumeLocked,
    showRetakeScreen,
    pendingInfoScreen,
    isShowingInitialInfoScreen,
    currentInitialInfoScreen,
    currentInfoScreenIndex,
    initialInfoScreens.length,
    isLoadingProgress,
    savedProgress,
    questionnaireFromQuery,
    questionnaireRef,
    questionnaire,
    loading,
    progressLoaded,
    currentQuestion,
    progressQuery,
    initCompleted,
  ]);
}