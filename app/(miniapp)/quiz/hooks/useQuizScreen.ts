// app/(miniapp)/quiz/hooks/useQuizScreen.ts
// Хук для определения текущего экрана квиза - вынесен из page.tsx

'use client';

import { useMemo } from 'react';
import { useQuizContext } from '../components/QuizProvider';
import { shouldShowInitialLoader } from '@/lib/quiz/utils/quizRenderHelpers';
import { getInitialInfoScreens } from '../info-screens';
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
  } = quizState;

  // Проверяем состояние загрузки прогресса
  const isLoadingProgress = progressQuery?.isLoading || false;

  const { data: questionnaireFromQuery } = questionnaireQuery;

  return useMemo((): Screen => {
    // Error state has higher priority
    if (error && !isRetakingQuiz) return 'ERROR';

    if (showRetakeScreen && isRetakingQuiz) return 'RETAKE';

    if (pendingInfoScreen && !isRetakingQuiz) return 'INFO';

    // ФИКС: Проверяем нужно ли показывать начальные инфо-экраны
    // Начальные экраны показываем независимо от загрузки прогресса
    const initialInfoScreens = getInitialInfoScreens();
    const onInitial = currentInfoScreenIndex < initialInfoScreens.length && currentInfoScreenIndex >= 0;
    if (onInitial) return 'INITIAL_INFO';

    // Loading progress state - show loader while progress is loading (but not for initial screens)
    if (isLoadingProgress) return 'LOADER';

    const hasEnoughSavedAnswers = savedProgress?.answers && Object.keys(savedProgress.answers).length >= 2;

    const baseReady = !!(questionnaireFromQuery || questionnaireRef.current || questionnaire);
    if (!baseReady) return 'LOADER';

    // IMPORTANT: если вопроса нет — не показываем "пустой фон"
    if (!currentQuestion) return 'LOADER';

    return 'QUESTION';
  }, [
    error,
    isRetakingQuiz,
    showRetakeScreen,
    pendingInfoScreen,
    savedProgress,
    questionnaireFromQuery,
    questionnaireRef,
    questionnaire,
    loading,
    currentQuestion,
    initCompleted,
    isLoadingProgress,
  ]);
}