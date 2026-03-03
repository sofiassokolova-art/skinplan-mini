'use client';

// app/(miniapp)/quiz/hooks/useQuizHandlers.ts
// Хук‑контроллер: инкапсулирует все хендлеры квиза, чтобы упростить QuizRenderer.

import { useCallback, useMemo, useRef } from 'react';
import { useQuizContext } from '../components/QuizProvider';
import type { Question } from '@/lib/quiz/types';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import { loadQuestionnaire as loadQuestionnaireHandler } from '@/lib/quiz/loadQuestionnaire';
import * as userPreferences from '@/lib/user-preferences';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import { createClearProgress } from '@/lib/quiz/handlers/clearProgress';
import { handleAnswer } from '@/lib/quiz/handlers/handleAnswer';
import { handleBack } from '@/lib/quiz/handlers/handleBack';
import { handleFullRetake } from '@/lib/quiz/handlers/handleFullRetake';
import { handleNext } from '@/lib/quiz/handlers/handleNext';
import { resumeQuiz } from '@/lib/quiz/handlers/resumeQuiz';
import { startOver } from '@/lib/quiz/handlers/startOver';
import { submitAnswers } from '@/lib/quiz/handlers/submitAnswers';

export type Screen =
  | 'LOADER'
  | 'ERROR'
  | 'RETAKE'
  | 'RESUME'
  | 'INFO'
  | 'INITIAL_INFO'
  | 'QUESTION';

interface UseQuizHandlersParams {
  currentQuestion: Question | null;
  screen: Screen;
}

export function useQuizHandlers({ currentQuestion, screen }: UseQuizHandlersParams) {
  const {
    quizState,
    questionnaireQuery,
    progressQuery,
    saveProgressMutation,
    isDev,
  } = useQuizContext();

  const {
    questionnaire,
    questionnaireRef,
    setQuestionnaire,
    pendingInfoScreen,
    currentInfoScreenIndex,
    answers,
    isSubmitting,
    setIsSubmitting,
    isSubmittingRef,
    savedProgress,
    isRetakingQuiz,
    showRetakeScreen,
    hasResumed,
    hasResumedRef,
    setHasResumed,
    error,
    setError,
    loading,
    setCurrentInfoScreenIndex,
    setCurrentQuestionIndex,
    setLoading,
    setPendingInfoScreen,
    setSavedProgress,
    setIsRetakingQuiz,
    setShowRetakeScreen,
    setHasRetakingPayment,
    setHasFullRetakePayment,
    setAnswers,
    setShowResumeScreen,
    hasFullRetakePayment,
    setInitCompleted,
    currentQuestionIndex,
    isStartingOver,
    setIsStartingOver,
    isStartingOverRef,
    autoSubmitTriggeredRef,
    setAutoSubmitTriggered,
    initCalledRef,
    redirectInProgressRef,
    loadProgressInProgressRef,
    progressLoadInProgressRef,
    loadQuestionnaireInProgressRef,
    loadQuestionnaireAttemptedRef,
    initCompletedRef,
    resumeCompletedRef,
    answersRef,
    answersCountRef,
    lastRestoredAnswersIdRef,
    firstScreenResetRef,
    setIsProgressCleared,
  } = quizState;

  // memo: all questions & questionnaireFromQuery
  const memoized = useMemo(() => {
    const effectiveQuestionnaire = questionnaireQuery.data;
    const allQuestions = effectiveQuestionnaire ? extractQuestionsFromQuestionnaire(effectiveQuestionnaire) : [];
    return {
      questionnaireFromQuery: questionnaireQuery.data,
      allQuestions,
      allQuestionsLength: allQuestions.length,
    };
  }, [questionnaireQuery.data]);

  const {
    questionnaireFromQuery,
    allQuestions,
    allQuestionsLength,
  } = memoized;

  const clearProgress = useMemo(
    () =>
      createClearProgress({
        setSavedProgress,
        setShowResumeScreen,
        hasResumedRef,
        setHasResumed,
        lastSavedAnswerRef: quizState.lastSavedAnswerRef,
      }),
    [setSavedProgress, setShowResumeScreen, hasResumedRef, setHasResumed, quizState.lastSavedAnswerRef],
  );

  const saveProgress = useCallback(
    async (answersToSave: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => {
      return await saveProgressMutation.mutateAsync({
        questionnaireId: questionnaire?.id || 0,
        questionId: -1,
        answerValue: undefined,
        answerValues: undefined,
        questionIndex,
        infoScreenIndex,
      });
    },
    [saveProgressMutation, questionnaire?.id],
  );

  const handleResume = useCallback(() => {
    if (!savedProgress) return;

    resumeQuiz({
      savedProgress,
      questionnaire: questionnaireFromQuery || questionnaireRef.current || questionnaire,
      allQuestions,
      redirectInProgressRef,
      initCompletedRef,
      setInitCompleted,
      setLoading,
      hasResumed,
      currentInfoScreenIndex,
      currentQuestionIndex,
      hasResumedRef,
      setHasResumed,
      setShowResumeScreen,
      setSavedProgress,
      loadProgressInProgressRef,
      progressLoadInProgressRef,
      setAnswers,
      setCurrentQuestionIndex,
      setCurrentInfoScreenIndex,
      setPendingInfoScreen,
      pendingInfoScreenRef: quizState.pendingInfoScreenRef,
      resumeCompletedRef,
    });
  }, [
    savedProgress,
    questionnaireFromQuery,
    questionnaireRef,
    questionnaire,
    allQuestions,
    redirectInProgressRef,
    initCompletedRef,
    setInitCompleted,
    setLoading,
    hasResumed,
    currentInfoScreenIndex,
    currentQuestionIndex,
    hasResumedRef,
    setHasResumed,
    setShowResumeScreen,
    setSavedProgress,
    loadProgressInProgressRef,
    progressLoadInProgressRef,
    setAnswers,
    setCurrentQuestionIndex,
    setCurrentInfoScreenIndex,
    setPendingInfoScreen,
    quizState.pendingInfoScreenRef,
    resumeCompletedRef,
  ]);

  const handleStartOver = useCallback(async () => {
    await startOver({
      scope: 'default',
      isStartingOverRef,
      setIsStartingOver,
      initCompletedRef,
      setInitCompleted,
      initCalledRef,
      clearProgress,
      setAnswers,
      answersRef,
      answersCountRef,
      lastRestoredAnswersIdRef,
      setCurrentQuestionIndex,
      setCurrentInfoScreenIndex,
      currentInfoScreenIndexRef: quizState.currentInfoScreenIndexRef,
      currentQuestionIndexRef: quizState.currentQuestionIndexRef,
      setShowResumeScreen,
      hasResumedRef,
      setHasResumed,
      setSavedProgress,
      setPendingInfoScreen,
      setIsRetakingQuiz,
      setShowRetakeScreen,
      firstScreenResetRef,
      setLoading,
      setError,
      setIsProgressCleared,
      questionnaire,
      savedProgress,
    });
  }, [
    isStartingOverRef,
    setIsStartingOver,
    initCompletedRef,
    setInitCompleted,
    initCalledRef,
    clearProgress,
    setAnswers,
    answersRef,
    answersCountRef,
    lastRestoredAnswersIdRef,
    setCurrentQuestionIndex,
    setCurrentInfoScreenIndex,
    quizState.currentInfoScreenIndexRef,
    setShowResumeScreen,
    hasResumedRef,
    setHasResumed,
    setSavedProgress,
    setPendingInfoScreen,
    setIsRetakingQuiz,
    setShowRetakeScreen,
    firstScreenResetRef,
    setLoading,
    setError,
    setIsProgressCleared,
    questionnaire,
    savedProgress,
  ]);

  const handleFullRetakeSelection = useCallback(async () => {
    await handleFullRetake({
      hasFullRetakePayment,
      setShowRetakeScreen,
      setIsRetakingQuiz,
      setIsStartingOver,
      isStartingOverRef,
      setAnswers,
      setSavedProgress,
      setShowResumeScreen,
      setHasResumed,
      hasResumedRef,
      autoSubmitTriggeredRef,
      setAutoSubmitTriggered,
      setError,
      questionnaire,
      setCurrentInfoScreenIndex,
      setCurrentQuestionIndex,
      setPendingInfoScreen,
    });
  }, [
    hasFullRetakePayment,
    setShowRetakeScreen,
    setIsRetakingQuiz,
    setIsStartingOver,
    isStartingOverRef,
    setAnswers,
    setSavedProgress,
    setShowResumeScreen,
    setHasResumed,
    hasResumedRef,
    autoSubmitTriggeredRef,
    setAutoSubmitTriggered,
    setError,
    questionnaire,
    setCurrentInfoScreenIndex,
    setCurrentQuestionIndex,
    setPendingInfoScreen,
  ]);

  const handleNextInProgressRef = useRef(false);
  const initInProgressRef = useRef(false);

  const setIsHandlingNext = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const newValue = typeof value === 'function' ? value(handleNextInProgressRef.current) : value;
    handleNextInProgressRef.current = newValue;
  }, []);

  const loadQuestionnaire = useCallback(async () => {
    if (questionnaireRef.current?.questions?.length) {
      return questionnaireRef.current;
    }

    if (questionnaireQuery.data) {
      const normalizedQuestionnaire = {
        ...questionnaireQuery.data,
        questions: extractQuestionsFromQuestionnaire(questionnaireQuery.data),
      };
      setQuestionnaire(normalizedQuestionnaire);
      questionnaireRef.current = normalizedQuestionnaire;
      if (normalizedQuestionnaire.questions.length > 0) {
        return normalizedQuestionnaire;
      }
    }

    return await loadQuestionnaireHandler({
      questionnaireRef,
      loadQuestionnaireInProgressRef,
      loadQuestionnaireAttemptedRef,
      redirectInProgressRef,
      initCompletedRef,
      setInitCompleted,
      questionnaire,
      loading,
      error,
      isRetakingQuiz,
      showRetakeScreen,
      savedProgress,
      currentQuestionIndex,
      hasResumed,
      setQuestionnaire,
      setLoading,
      setError,
      setCurrentQuestionIndex,
      setUserPreferencesData: quizState.setUserPreferencesData,
      setIsRetakingQuiz,
      setShowRetakeScreen,
      setHasRetakingPayment,
      setHasFullRetakePayment,
      isDev,
      userPreferences,
      addDebugLog: () => undefined,
    });
  }, [
    questionnaireRef,
    questionnaireQuery.data,
    loadQuestionnaireInProgressRef,
    loadQuestionnaireAttemptedRef,
    redirectInProgressRef,
    initCompletedRef,
    setInitCompleted,
    questionnaire,
    loading,
    error,
    isRetakingQuiz,
    showRetakeScreen,
    savedProgress,
    currentQuestionIndex,
    hasResumed,
    setQuestionnaire,
    setLoading,
    setError,
    setCurrentQuestionIndex,
    quizState.setUserPreferencesData,
    setIsRetakingQuiz,
    setShowRetakeScreen,
    setHasRetakingPayment,
    setHasFullRetakePayment,
    isDev,
  ]);

  const onAnswer = useCallback(
    async (questionId: number, value: string | string[]) => {
      if (!questionId || questionId <= 0) {
        console.error('❌ [useQuizHandlers] Invalid questionId in onAnswer:', {
          questionId,
          currentQuestionId: currentQuestion?.id,
          currentQuestionCode: currentQuestion?.code,
        });
        setError('Ошибка: невалидный ID вопроса');
        return;
      }

      try {
        await handleAnswer({
          questionId,
          value,
          currentQuestion,
          answers,
          answersRef,
          allQuestions,
          questionnaire,
          setAnswers,
          saveProgress,
          currentQuestionIndex,
          currentInfoScreenIndex,
          saveQuizProgressMutation: saveProgressMutation,
          lastSavedAnswerRef: quizState.lastSavedAnswerRef,
          setCurrentQuestionIndex,
          currentQuestionIndexRef: quizState.currentQuestionIndexRef,
          scopedStorageKeys: { CURRENT_QUESTION_CODE: QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE },
          scope: 'default',
        });
      } catch (err) {
        console.error('❌ [useQuizHandlers] Error in onAnswer:', err);
        setError(err instanceof Error ? err.message : 'Ошибка при сохранении ответа');
      }
    },
    [
      currentQuestion,
      answers,
      answersRef,
      allQuestions,
      questionnaire,
      setAnswers,
      saveProgress,
      currentQuestionIndex,
      currentInfoScreenIndex,
      saveProgressMutation,
      quizState.lastSavedAnswerRef,
      setCurrentQuestionIndex,
      quizState.currentQuestionIndexRef,
      setError,
    ],
  );

  const onNext = useCallback(
    async () => {
      try {
        await handleNext({
          handleNextInProgressRef,
          currentInfoScreenIndexRef: quizState.currentInfoScreenIndexRef,
          currentQuestionIndexRef: quizState.currentQuestionIndexRef,
          questionnaireRef,
          initCompletedRef: quizState.initCompletedRef,
          questionnaire,
          loading: false,
          currentInfoScreenIndex,
          currentQuestionIndex,
          allQuestions,
          isRetakingQuiz,
          showRetakeScreen,
          hasResumed,
          pendingInfoScreen,
          pendingInfoScreenRef: quizState.pendingInfoScreenRef,
          answers,
          answersRef,
          setIsHandlingNext,
          setCurrentInfoScreenIndex,
          setCurrentQuestionIndex,
          setPendingInfoScreen,
          setLoading,
          setError,
          saveProgress,
          loadQuestionnaire,
          initInProgressRef,
          isDev,
        });
      } catch (err) {
        console.error('❌ [useQuizHandlers] Error in onNext:', err);
        setError(err instanceof Error ? err.message : 'Ошибка при переходе к следующему шагу');
      }
    },
    [
      quizState.currentInfoScreenIndexRef,
      quizState.currentQuestionIndexRef,
      questionnaireRef,
      quizState.initCompletedRef,
      questionnaire,
      currentInfoScreenIndex,
      currentQuestionIndex,
      allQuestions,
      isRetakingQuiz,
      showRetakeScreen,
      hasResumed,
      pendingInfoScreen,
      quizState.pendingInfoScreenRef,
      answers,
      answersRef,
      setCurrentInfoScreenIndex,
      setCurrentQuestionIndex,
      setPendingInfoScreen,
      setLoading,
      setError,
      saveProgress,
      loadQuestionnaire,
      isDev,
      setIsHandlingNext,
    ],
  );

  const onSubmit = useCallback(
    async () => {
      try {
        await submitAnswers({
          answers,
          questionnaire,
          isSubmitting,
          isSubmittingRef,
          isMountedRef: { current: true },
          initData: null,
          setAnswers,
          setIsSubmitting,
          setLoading,
          setError,
          setFinalizing: quizState.setFinalizing,
          setFinalizingStep: quizState.setFinalizingStep,
          setFinalizeError: quizState.setFinalizeError,
          redirectInProgressRef: { current: false },
          submitAnswersRef: { current: null },
          isRetakingQuiz,
          getInitData: async () => null,
          scopedStorageKeys: {
            JUST_SUBMITTED: QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED,
          },
          isDev,
        });
      } catch (err) {
        console.error('❌ [useQuizHandlers] Error in onSubmit:', err);
        setError(err instanceof Error ? err.message : 'Ошибка при отправке ответов');
      }
    },
    [
      answers,
      questionnaire,
      isSubmitting,
      setIsSubmitting,
      isSubmittingRef,
      setError,
      setLoading,
      setAnswers,
      isRetakingQuiz,
      isDev,
      quizState.setFinalizing,
      quizState.setFinalizingStep,
      quizState.setFinalizeError,
    ],
  );

  const onBack = useCallback(
    async () => {
      try {
        await handleBack({
          currentQuestionIndex,
          currentInfoScreenIndex,
          allQuestions,
          answers,
          questionnaire,
          setCurrentQuestionIndex,
          setCurrentInfoScreenIndex,
          setPendingInfoScreen,
          setAnswers,
          saveProgress,
          questionnaireRef,
          currentInfoScreenIndexRef: quizState.currentInfoScreenIndexRef,
          currentQuestionIndexRef: quizState.currentQuestionIndexRef,
          pendingInfoScreenRef: quizState.pendingInfoScreenRef,
          pendingInfoScreen,
          handleBackInProgressRef: { current: false },
          isShowingInitialInfoScreen: screen === 'INITIAL_INFO',
          initialInfoScreensLength: getInitialInfoScreens().length,
          scopedStorageKeys: {
            CURRENT_INFO_SCREEN: QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN,
            CURRENT_QUESTION: QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION,
          },
        });
      } catch (err) {
        console.error('❌ [useQuizHandlers] Error in onBack:', err);
        setError(err instanceof Error ? err.message : 'Ошибка при возврате назад');
      }
    },
    [
      currentQuestionIndex,
      currentInfoScreenIndex,
      allQuestions,
      answers,
      questionnaire,
      setCurrentQuestionIndex,
      setCurrentInfoScreenIndex,
      setPendingInfoScreen,
      setAnswers,
      saveProgress,
      questionnaireRef,
      quizState.currentQuestionIndexRef,
      quizState.currentInfoScreenIndexRef,
      quizState.pendingInfoScreenRef,
      isDev,
      pendingInfoScreen,
      screen,
      setError,
    ],
  );

  return {
    questionnaireFromQuery,
    allQuestionsLength,
    handleResume,
    handleStartOver,
    handleFullRetakeSelection,
    handleNextInProgressRef,
    onAnswer,
    onNext,
    onBack,
    onSubmit,
  };
}

