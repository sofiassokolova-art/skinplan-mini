// lib/quiz/hooks/useQuizRenderDebug.ts
// Хук для логирования состояния рендеринга (только для разработки)

import { useEffect, useRef } from 'react';
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
 * ИСПРАВЛЕНО: Оптимизированы зависимости для предотвращения бесконечных циклов
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

  // ИСПРАВЛЕНО: Используем ref для хранения предыдущих значений, чтобы избежать лишних логов
  const prevValuesRef = useRef<{
    questionnaireId: number | null;
    currentQuestionId: number | null;
    currentQuestionIndex: number;
    loading: boolean;
    error: string | null;
  }>({
    questionnaireId: null,
    currentQuestionId: null,
    currentQuestionIndex: -1,
    loading: false,
    error: null,
  });

  // ИСПРАВЛЕНО: Уменьшены зависимости - используем только критичные значения
  // Остальные значения читаем из refs или параметров внутри эффекта
  useEffect(() => {
    if (!isDev) return;

    const questionnaireToRender = questionnaire || questionnaireRef.current;
    const questionnaireId = questionnaireToRender?.id || null;
    const currentQuestionId = currentQuestion?.id || null;
    
    // ИСПРАВЛЕНО: Логируем только при реальных изменениях критичных значений
    const hasChanged = 
      prevValuesRef.current.questionnaireId !== questionnaireId ||
      prevValuesRef.current.currentQuestionId !== currentQuestionId ||
      prevValuesRef.current.currentQuestionIndex !== currentQuestionIndex ||
      prevValuesRef.current.loading !== loading ||
      prevValuesRef.current.error !== error;

    if (!hasChanged) {
      return; // Пропускаем логирование, если ничего не изменилось
    }

    // Обновляем предыдущие значения
    prevValuesRef.current = {
      questionnaireId,
      currentQuestionId,
      currentQuestionIndex,
      loading,
      error,
    };
    
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
    
    // Логируем, что именно показывается пользователю (только при важных изменениях)
    if (questionnaireToRender && !loading && !error && (questionnaireId !== null || currentQuestionId !== null)) {
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
    
    // Логируем состояние перед рендерингом анкеты (только при важных изменениях)
    if (questionnaireId !== null || currentQuestionId !== null || loading || error) {
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
    }
  }, [
    // ИСПРАВЛЕНО: Минимальный набор зависимостей - только критичные значения
    isDev,
    questionnaire?.id, // Только ID, не весь объект
    loading,
    error,
    currentQuestion?.id, // Только ID, не весь объект
    currentQuestionIndex,
    // Убраны зависимости, которые часто меняются и не критичны для логирования:
    // - questionnaireRef (ref не меняется)
    // - allQuestionsLength, allQuestionsRawLength (меняются часто, но не критично)
    // - showResumeScreen, showRetakeScreen, isShowingInitialInfoScreen (меняются редко)
    // - pendingInfoScreen (может часто меняться)
    // - isRetakingQuiz, hasResumed (меняются редко)
    // - initCompletedRef, initInProgressRef (refs не меняются)
  ]);
}
