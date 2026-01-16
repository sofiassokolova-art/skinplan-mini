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
 * КРИТИЧНО ИСПРАВЛЕНО: Полностью отключен в продакшене для предотвращения React Error #300
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

  // КРИТИЧНО ИСПРАВЛЕНО: НЕ используем ранний return - это вызывает React Error #300!
  // Хуки должны вызываться всегда в одном порядке, независимо от условий
  // Вместо этого проверяем isDev внутри useEffect

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
  // КРИТИЧНО: Отключаем хук в продакшене, чтобы избежать React Error #300
  // КРИТИЧНО: Используем ref для предотвращения бесконечных циклов
  const lastCallTimeRef = useRef<number>(0);
  
  useEffect(() => {
    // КРИТИЧНО ИСПРАВЛЕНО: Полностью отключаем логирование в продакшене для предотвращения React Error #300
    // В продакшене не выполняем никакой логики вообще
    if (!isDev) return;
    
    // КРИТИЧНО: Используем ref для предотвращения бесконечных циклов
    // Если хук вызывается слишком часто, пропускаем выполнение
    const now = Date.now();
    // УВЕЛИЧИВАЕМ интервал до 5000мс для кардинального уменьшения нагрузки
    if (now - lastCallTimeRef.current < 5000) {
      return; // Пропускаем, если вызывается слишком часто (менее 5000мс)
    }
    lastCallTimeRef.current = now;

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
    
    // КРИТИЧНО ИСПРАВЛЕНО: УБРАНО избыточное логирование, которое вызывает тысячи логов
    // Оставляем только критичные логи
    // УБРАНО: Логирование "Final render check" вызывает слишком много логов и React Error #300
    // Этот блок логирования был полностью удален для предотвращения бесконечных циклов
  }, [
    // КРИТИЧНО ИСПРАВЛЕНО: Минимальный набор зависимостей для предотвращения React Error #300
    // УБРАНЫ questionnaire?.id, currentQuestion?.id, currentQuestionIndex - они меняются слишком часто
    // и вызывают бесконечные циклы логирования
    isDev,
    // КРИТИЧНО: Оставляем только loading и error, которые меняются редко
    loading,
    error,
    // УБРАНО: questionnaire?.id, currentQuestion?.id, currentQuestionIndex - вызывают бесконечные циклы
    // Эти значения читаем внутри эффекта из параметров, но не включаем в зависимости
    // Убраны зависимости, которые часто меняются и не критичны для логирования:
    // - questionnaireRef (ref не меняется, читаем внутри эффекта)
    // - allQuestionsLength, allQuestionsRawLength (меняются часто, но не критично)
    // - showResumeScreen, showRetakeScreen, isShowingInitialInfoScreen (меняются редко, читаем внутри эффекта)
    // - pendingInfoScreen (может часто меняться, читаем внутри эффекта)
    // - isRetakingQuiz, hasResumed (меняются редко, читаем внутри эффекта)
    // - initCompletedRef, initInProgressRef (refs не меняются, читаем внутри эффекта)
    // КРИТИЧНО: lastCallTimeRef не включен в зависимости, так как это ref
  ]);
}
