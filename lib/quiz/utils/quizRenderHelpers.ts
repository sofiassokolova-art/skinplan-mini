// lib/quiz/utils/quizRenderHelpers.ts
// Утилиты для определения состояния рендеринга

import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire, Question } from '@/lib/quiz/types';

interface ShouldShowInitialLoaderParams {
  pendingInfoScreen: any;
  currentInfoScreenIndex: number;
  loading: boolean;
  initCompletedRef: React.MutableRefObject<boolean>;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  questionnaire: Questionnaire | null;
  quizStateMachineQuestionnaire: Questionnaire | null;
  questionnaireFromQuery: Questionnaire | null | undefined;
}

/**
 * Определяет, нужно ли показывать начальный лоадер
 */
export function shouldShowInitialLoader(params: ShouldShowInitialLoaderParams): boolean {
  const {
    pendingInfoScreen,
    currentInfoScreenIndex,
    loading,
    initCompletedRef,
    questionnaireRef,
    questionnaire,
    quizStateMachineQuestionnaire,
    questionnaireFromQuery,
  } = params;

  const initialInfoScreensForLoader = getInitialInfoScreens();
  const isOnInitialInfoScreens = currentInfoScreenIndex < initialInfoScreensForLoader.length;
  const hasQuestionnaireAnywhere = !!questionnaireRef.current || 
                                   !!questionnaire || 
                                   !!quizStateMachineQuestionnaire || 
                                   !!questionnaireFromQuery;
  
  return !pendingInfoScreen && 
         !isOnInitialInfoScreens && 
         !hasQuestionnaireAnywhere && 
         (loading || !initCompletedRef.current);
}

const LIME_GRADIENT = 'linear-gradient(135deg, #F5FFFC 0%, #E8FBF7 100%)';

/**
 * Определяет цвет фона страницы.
 * На экранах вопросов с лаймовым стилем (skin_type, skin_goals) фон лаймовый до конца.
 */
export function getQuizBackgroundColor(
  isQuestionScreen: boolean,
  currentQuestion?: Question | null
): string {
  if (!isQuestionScreen) return LIME_GRADIENT;
  const code = currentQuestion?.code;
  if (code === 'skin_type' || code === 'skin_goals') return LIME_GRADIENT;
  return '#FFFFFF';
}

/**
 * Определяет, является ли текущий экран экраном вопроса
 */
export function isQuestionScreen(
  currentQuestion: Question | null,
  pendingInfoScreen: any,
  showResumeScreen: boolean,
  showRetakeScreen: boolean
): boolean {
  return !!currentQuestion && !pendingInfoScreen && !showResumeScreen && !showRetakeScreen;
}
