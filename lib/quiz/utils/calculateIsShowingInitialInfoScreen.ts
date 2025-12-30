// lib/quiz/utils/calculateIsShowingInitialInfoScreen.ts
// Утилита для вычисления, нужно ли показывать начальные info screens
// Вынесена из useMemo для упрощения зависимостей

export interface CalculateIsShowingInitialInfoScreenParams {
  showResumeScreen: boolean;
  showRetakeScreen: boolean;
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  hasResumed: boolean;
  isRetakingQuiz: boolean;
  currentInfoScreenIndex: number;
  initialInfoScreensLength: number;
  currentQuestionIndex: number;
  answers: Record<number, string | string[]>;
  allQuestionsLength: number;
}

export function calculateIsShowingInitialInfoScreen(
  params: CalculateIsShowingInitialInfoScreenParams
): boolean {
  const {
    showResumeScreen,
    showRetakeScreen,
    savedProgress,
    hasResumed,
    isRetakingQuiz,
    currentInfoScreenIndex,
    initialInfoScreensLength,
    currentQuestionIndex,
    answers,
    allQuestionsLength,
  } = params;

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
  if (currentInfoScreenIndex >= initialInfoScreensLength) return false;
  
  // Не показываем, если пользователь уже начал отвечать
  if (currentQuestionIndex > 0 || Object.keys(answers).length > 0) return false;
  
  // Показываем, если currentInfoScreenIndex < initialInfoScreens.length
  return currentInfoScreenIndex < initialInfoScreensLength;
}

