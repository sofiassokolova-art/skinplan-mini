// lib/quiz/hooks/useQuizRenderDebug.ts
// Хук для логирования состояния рендеринга (только для разработки)

import { useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';
import type { Questionnaire, Question } from '@/lib/quiz/types';

interface UseQuizRenderDebugParams {
  isDev: boolean;
  questionnaire: Questionnaire | null;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  quizStateMachineQuestionnaire: Questionnaire | null;
  questionnaireFromQuery: Questionnaire | null | undefined;
  loading: boolean;
  error: string | null;
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  allQuestionsLength: number;
  allQuestionsRawLength: number;
  showResumeScreen: boolean;
  showRetakeScreen: boolean;
  isShowingInitialInfoScreen: boolean;
  pendingInfoScreen: any;
  isRetakingQuiz: boolean;
  hasResumed: boolean;
  initCompletedRef: React.MutableRefObject<boolean>;
  initInProgressRef: React.MutableRefObject<boolean>;
}

/**
 * Хук для логирования состояния рендеринга (только для разработки)
 */
export function useQuizRenderDebug(params: UseQuizRenderDebugParams) {
  const {
    isDev,
    questionnaire,
    questionnaireRef,
    quizStateMachineQuestionnaire,
    questionnaireFromQuery,
    loading,
    error,
    currentQuestion,
    currentQuestionIndex,
    allQuestionsLength,
    allQuestionsRawLength,
    showResumeScreen,
    showRetakeScreen,
    isShowingInitialInfoScreen,
    pendingInfoScreen,
    isRetakingQuiz,
    hasResumed,
    initCompletedRef,
    initInProgressRef,
  } = params;

  useEffect(() => {
    if (!isDev) return;

    const questionnaireToRender = questionnaire || questionnaireRef.current;
    
    // Проверяем, почему анкета может не отображаться
    if (questionnaireToRender && loading) {
      clientLogger.warn('⚠️ CRITICAL: Questionnaire loaded but loading=true - this should be fixed by useEffect', {
        hasQuestionnaire: !!questionnaire,
        hasQuestionnaireRef: !!questionnaireRef.current,
        questionnaireId: questionnaireToRender?.id,
        loading,
        initCompleted: initCompletedRef.current,
        initInProgress: initInProgressRef.current,
      });
    }
    
    // Логируем, что именно показывается пользователю
    if (questionnaireToRender && !loading && !error) {
      clientLogger.log('✅ Questionnaire should be visible - all conditions met', {
        hasQuestionnaire: !!questionnaire,
        hasQuestionnaireRef: !!questionnaireRef.current,
        questionnaireId: questionnaireToRender?.id,
        loading,
        error: error || null,
        showResumeScreen,
        showRetakeScreen,
        isShowingInitialInfoScreen,
        pendingInfoScreen: !!pendingInfoScreen,
        isRetakingQuiz,
        hasResumed,
        initCompleted: initCompletedRef.current,
        currentQuestion: !!currentQuestion,
        currentQuestionIndex,
        allQuestionsLength,
      });
    }
    
    // Логируем состояние перед рендерингом анкеты
    clientLogger.log('🔍 Final render check - what will be displayed?', {
      timestamp: new Date().toISOString(),
      hasQuestionnaire: !!questionnaire,
      hasQuestionnaireRef: !!questionnaireRef.current,
      hasQuestionnaireToRender: !!questionnaireToRender,
      questionnaireId: questionnaire?.id || questionnaireRef.current?.id || null,
      hasCurrentQuestion: !!currentQuestion,
      currentQuestionId: currentQuestion?.id,
      currentQuestionIndex,
      allQuestionsLength,
      allQuestionsRawLength,
      loading,
      error: error || null,
      showResumeScreen,
      showRetakeScreen,
      isShowingInitialInfoScreen,
      pendingInfoScreen: !!pendingInfoScreen,
      initCompleted: initCompletedRef.current,
      initInProgress: initInProgressRef.current,
      willShowLoader: loading && !questionnaireToRender,
      willShowError: !!error && !loading,
      willShowQuestionnaire: !!questionnaireToRender && !loading && !error,
      isRetakingQuiz,
      hasResumed,
    });
  }, [
    isDev,
    questionnaire?.id,
    questionnaireRef,
    loading,
    error,
    currentQuestion?.id,
    currentQuestionIndex,
    allQuestionsLength,
    allQuestionsRawLength,
    showResumeScreen,
    showRetakeScreen,
    isShowingInitialInfoScreen,
    pendingInfoScreen,
    isRetakingQuiz,
    hasResumed,
    initCompletedRef,
    initInProgressRef,
  ]);
}
