'use client';

// app/(miniapp)/quiz/hooks/useQuizHandlers.ts
// Хук‑контроллер: инкапсулирует все хендлеры квиза, чтобы упростить QuizRenderer.

import { useCallback, useMemo, useRef } from 'react';
import { useQuizContext } from '../components/QuizProvider';
import type { Question } from '@/lib/quiz/types';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import { filterQuestions } from '@/lib/quiz/filterQuestions';
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
import {
  createQuizProgressSaveQueue,
  type QuizProgressSaveParams,
} from '@/lib/quiz/progress-save-queue';
import { clientLogger } from '@/lib/client-logger';

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

const navigationFilterLogger = {
  log: () => undefined,
  warn: () => undefined,
  error: (message: string, data?: any) => clientLogger.error(`❌ [useQuizHandlers filterQuestions] ${message}`, data),
};

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
    const effectiveQuestionnaire = questionnaireQuery.data || questionnaireRef.current || questionnaire;
    const rawQuestions = effectiveQuestionnaire ? extractQuestionsFromQuestionnaire(effectiveQuestionnaire) : [];
    const allQuestions = rawQuestions.length > 0
      ? filterQuestions({
          questions: rawQuestions,
          answers,
          savedProgressAnswers: savedProgress?.answers,
          isRetakingQuiz,
          showRetakeScreen,
          logger: navigationFilterLogger,
        })
      : [];
    return {
      questionnaireFromQuery: questionnaireQuery.data,
      rawQuestions,
      allQuestions,
      allQuestionsLength: allQuestions.length,
    };
  }, [
    questionnaireQuery.data,
    questionnaire,
    questionnaireRef,
    answers,
    savedProgress?.answers,
    isRetakingQuiz,
    showRetakeScreen,
  ]);

  const {
    questionnaireFromQuery,
    rawQuestions,
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

  const saveProgressMutationRef = useRef(saveProgressMutation);
  saveProgressMutationRef.current = saveProgressMutation;

  const progressSaveQueueRef = useRef<ReturnType<typeof createQuizProgressSaveQueue> | null>(null);
  if (!progressSaveQueueRef.current) {
    progressSaveQueueRef.current = createQuizProgressSaveQueue(
      (params) => saveProgressMutationRef.current.mutateAsync(params),
      {
        onError: (err, params) => {
          const lastSaved = quizState.lastSavedAnswerRef.current;
          const failedAnswer = params.answerValues ?? params.answerValue;
          if (
            lastSaved?.questionId === params.questionId &&
            JSON.stringify(lastSaved.answer) === JSON.stringify(failedAnswer)
          ) {
            quizState.lastSavedAnswerRef.current = null;
          }

          clientLogger.error('❌ Не удалось сохранить прогресс анкеты в фоне', {
            questionId: params.questionId,
            questionnaireId: params.questionnaireId,
            error: err instanceof Error ? err.message : String(err),
          });
        },
      },
    );
  }

  const enqueueProgressSave = useCallback((params: QuizProgressSaveParams) => {
    progressSaveQueueRef.current?.enqueue(params);
  }, []);

  const queuedProgressMutation = useMemo(
    () => ({
      mutateAsync: async (params: QuizProgressSaveParams) => {
        enqueueProgressSave(params);
      },
    }),
    [enqueueProgressSave],
  );

  const saveProgress = useCallback(
    async (_answersToSave: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => {
      if (!questionnaire?.id) return;

      quizState.pendingProgressRef.current = { questionIndex, infoScreenIndex };
      if (quizState.saveProgressTimeoutRef.current) {
        clearTimeout(quizState.saveProgressTimeoutRef.current);
      }

      quizState.saveProgressTimeoutRef.current = setTimeout(() => {
        const pending = quizState.pendingProgressRef.current;
        quizState.pendingProgressRef.current = null;
        quizState.saveProgressTimeoutRef.current = null;

        enqueueProgressSave({
          questionnaireId: questionnaire.id,
          questionId: -1,
          questionIndex: pending?.questionIndex ?? questionIndex,
          infoScreenIndex: pending?.infoScreenIndex ?? infoScreenIndex,
        });
      }, 500);
    },
    [
      enqueueProgressSave,
      questionnaire?.id,
      quizState.pendingProgressRef,
      quizState.saveProgressTimeoutRef,
    ],
  );

  const getAnswersForNavigation = useCallback(
    (answersOverride?: Record<number, string | string[]>) => {
      if (answersOverride) return answersOverride;
      if (answersRef?.current && Object.keys(answersRef.current).length > 0) {
        return answersRef.current;
      }
      return answers;
    },
    [answers, answersRef],
  );

  const getQuestionsForNavigation = useCallback(
    (answersOverride?: Record<number, string | string[]>) => {
      const effectiveQuestionnaire = questionnaireFromQuery || questionnaireRef.current || questionnaire;
      const latestRawQuestions = effectiveQuestionnaire
        ? extractQuestionsFromQuestionnaire(effectiveQuestionnaire)
        : rawQuestions;

      if (latestRawQuestions.length === 0) {
        return allQuestions;
      }

      try {
        const filtered = filterQuestions({
          questions: latestRawQuestions,
          answers: getAnswersForNavigation(answersOverride),
          savedProgressAnswers: savedProgress?.answers,
          isRetakingQuiz,
          showRetakeScreen,
          logger: navigationFilterLogger,
        });

        return filtered.length > 0 ? filtered : latestRawQuestions;
      } catch (err) {
        clientLogger.error('❌ [useQuizHandlers] Не удалось отфильтровать вопросы для навигации', {
          error: err instanceof Error ? err.message : String(err),
          rawQuestionsLength: latestRawQuestions.length,
        });
        return allQuestions.length > 0 ? allQuestions : latestRawQuestions;
      }
    },
    [
      questionnaireFromQuery,
      questionnaireRef,
      questionnaire,
      rawQuestions,
      allQuestions,
      getAnswersForNavigation,
      savedProgress?.answers,
      isRetakingQuiz,
      showRetakeScreen,
    ],
  );

  const handleResume = useCallback(() => {
    if (!savedProgress) return;

    const savedProgressQuestions = getQuestionsForNavigation(savedProgress.answers);

    resumeQuiz({
      savedProgress,
      questionnaire: questionnaireFromQuery || questionnaireRef.current || questionnaire,
      allQuestions: savedProgressQuestions,
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
    getQuestionsForNavigation,
    questionnaireFromQuery,
    questionnaireRef,
    questionnaire,
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
        const nextAnswers = { ...getAnswersForNavigation(), [questionId]: value };
        const questionsForNavigation = getQuestionsForNavigation(nextAnswers);

        await handleAnswer({
          questionId,
          value,
          currentQuestion,
          answers: getAnswersForNavigation(),
          answersRef,
          allQuestions: questionsForNavigation,
          questionnaire,
          setAnswers,
          currentQuestionIndex,
          currentInfoScreenIndex,
          saveQuizProgressMutation: queuedProgressMutation,
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
      getAnswersForNavigation,
      answersRef,
      getQuestionsForNavigation,
      questionnaire,
      setAnswers,
      currentQuestionIndex,
      currentInfoScreenIndex,
      queuedProgressMutation,
      quizState.lastSavedAnswerRef,
      setCurrentQuestionIndex,
      quizState.currentQuestionIndexRef,
      setError,
    ],
  );

  const onNext = useCallback(
    async () => {
      try {
        const latestAnswers = getAnswersForNavigation();
        const questionsForNavigation = getQuestionsForNavigation(latestAnswers);

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
          allQuestions: questionsForNavigation,
          isRetakingQuiz,
          showRetakeScreen,
          hasResumed,
          pendingInfoScreen,
          pendingInfoScreenRef: quizState.pendingInfoScreenRef,
          answers: latestAnswers,
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
      getAnswersForNavigation,
      getQuestionsForNavigation,
      isRetakingQuiz,
      showRetakeScreen,
      hasResumed,
      pendingInfoScreen,
      quizState.pendingInfoScreenRef,
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
        const latestAnswers = getAnswersForNavigation();
        const questionsForNavigation = getQuestionsForNavigation(latestAnswers);

        await handleBack({
          currentQuestionIndex,
          currentInfoScreenIndex,
          allQuestions: questionsForNavigation,
          answers: latestAnswers,
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
      getAnswersForNavigation,
      getQuestionsForNavigation,
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
