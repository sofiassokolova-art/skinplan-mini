// lib/quiz/utils/calculateCorrectedQuestionIndex.ts
// Утилита для вычисления скорректированного индекса вопроса
// Вынесена из useMemo для упрощения зависимостей

export interface CalculateCorrectedQuestionIndexParams {
  currentQuestionIndex: number;
  allQuestionsLength: number;
  answers: Record<number, string | string[]>;
  isSubmitting: boolean;
  hasResumed: boolean;
  showResumeScreen: boolean;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  allQuestionsRawLength: number;
}

export interface CorrectedQuestionIndexResult {
  correctedIndex: number;
  needsCorrection: boolean;
  isQuizCompleted: boolean;
}

export function calculateCorrectedQuestionIndex(
  params: CalculateCorrectedQuestionIndexParams
): CorrectedQuestionIndexResult {
  const {
    currentQuestionIndex,
    allQuestionsLength,
    answers,
    isSubmitting,
    hasResumed,
    showResumeScreen,
    isRetakingQuiz,
    showRetakeScreen,
    savedProgress,
    allQuestionsRawLength,
  } = params;

  // Если нет вопросов, возвращаем 0
  if (allQuestionsLength === 0) {
    return {
      correctedIndex: 0,
      needsCorrection: false,
      isQuizCompleted: false,
    };
  }

  // Проверяем, завершена ли анкета
  const answersCount = Object.keys(answers).length;
  const isQuizCompleted = currentQuestionIndex >= allQuestionsLength && answersCount > 0;
  
  // Если анкета завершена и идет отправка, не корректируем индекс
  if (isQuizCompleted && isSubmitting) {
    return {
      correctedIndex: currentQuestionIndex,
      needsCorrection: false,
      isQuizCompleted: true,
    };
  }

  // Если индекс в пределах массива, не корректируем
  if (currentQuestionIndex >= 0 && currentQuestionIndex < allQuestionsLength) {
    return {
      correctedIndex: currentQuestionIndex,
      needsCorrection: false,
      isQuizCompleted: false,
    };
  }

  // Вычисляем скорректированный индекс
  const hasNoSavedProgress = !savedProgress || Object.keys(savedProgress.answers || {}).length === 0;
  const correctedIndex = isQuizCompleted
    ? allQuestionsLength
    : (hasNoSavedProgress && answersCount === 0 ? 0 : Math.max(0, Math.min(currentQuestionIndex, allQuestionsLength - 1)));

  return {
    correctedIndex,
    needsCorrection: correctedIndex !== currentQuestionIndex,
    isQuizCompleted,
  };
}

