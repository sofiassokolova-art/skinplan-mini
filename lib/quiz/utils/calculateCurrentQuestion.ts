// lib/quiz/utils/calculateCurrentQuestion.ts
// Утилита для вычисления текущего вопроса
// Вынесена из useMemo для упрощения зависимостей

import type { Question } from '@/lib/quiz/types';

export interface CalculateCurrentQuestionParams {
  allQuestions: Question[];
  currentQuestionIndex: number;
  currentInfoScreenIndex: number;
  initialInfoScreensLength: number;
  isShowingInitialInfoScreen: boolean;
  currentInitialInfoScreen: any | null;
  pendingInfoScreen: any | null;
  isRetakingQuiz: boolean;
  showResumeScreen: boolean;
  isStillOnInitialScreens: boolean;
}

export function calculateCurrentQuestion(params: CalculateCurrentQuestionParams): Question | null {
  const {
    allQuestions,
    currentQuestionIndex,
    currentInfoScreenIndex,
    initialInfoScreensLength,
    isShowingInitialInfoScreen,
    currentInitialInfoScreen,
    pendingInfoScreen,
    isRetakingQuiz,
    showResumeScreen,
    isStillOnInitialScreens,
  } = params;

  // ВАЖНО: При перепрохождении (retake) мы пропускаем info screens,
  // поэтому pendingInfoScreen не должен блокировать отображение вопросов при retake
  // ВАЖНО: Если показывается экран продолжения (showResumeScreen), не блокируем вопросы
  // ВАЖНО: Блокируем только если действительно есть начальный экран для показа
  // ФИКС: Если currentInfoScreenIndex >= initialInfoScreens.length, значит все начальные экраны пройдены
  // и мы не должны блокировать показ вопросов, даже если isShowingInitialInfoScreen = true
  // КРИТИЧНО: Также проверяем, что questionnaire загружен, чтобы не блокировать вопросы при загрузке
  // ИСПРАВЛЕНО: Используем ref для более точной проверки, так как state может быть устаревшим
  const isPastInitialScreens = currentInfoScreenIndex >= initialInfoScreensLength;
  const shouldBlock = (!isPastInitialScreens && isShowingInitialInfoScreen && currentInitialInfoScreen && isStillOnInitialScreens) || (pendingInfoScreen && !isRetakingQuiz);
  
  if (shouldBlock && !showResumeScreen) {
    return null;
  }
  
  // ФИКС: Защита от некорректного индекса или undefined
  if (currentQuestionIndex < 0 || currentQuestionIndex >= allQuestions.length) {
    return null;
  }
  
  return allQuestions[currentQuestionIndex] || null;
}

