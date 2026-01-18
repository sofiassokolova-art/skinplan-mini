// app/(miniapp)/quiz/page.tsx
// Страница анкеты - базовая структура для миграции

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTelegram } from '@/lib/telegram-client';
import { clientLogger } from '@/lib/client-logger';
import * as userPreferences from '@/lib/user-preferences';

import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';

import { useQuestionnaire, useQuizProgress, useSaveQuizProgress } from '@/hooks/useQuiz';

import { useQuizStateMachine } from '@/lib/quiz/hooks/useQuizStateMachine';
import { useQuizStateExtended } from '@/lib/quiz/hooks/useQuizStateExtended';
import { useQuizComputed } from '@/lib/quiz/hooks/useQuizComputed';
import { useQuizRestorePipeline } from '@/lib/quiz/hooks/useQuizRestorePipeline';
import { useQuestionnaireSync } from '@/lib/quiz/hooks/useQuestionnaireSync';
import { useQuizEffects } from '@/lib/quiz/hooks/useQuizEffects';

import {
  shouldShowInitialLoader,
  getQuizBackgroundColor,
  isQuestionScreen as isQuestionScreenUtil,
} from '@/lib/quiz/utils/quizRenderHelpers';

import { loadQuestionnaire as loadQuestionnaireFn } from '@/lib/quiz/loadQuestionnaire';
import { handleNext as handleNextFn } from '@/lib/quiz/handlers/handleNext';
import { handleAnswer as handleAnswerFn } from '@/lib/quiz/handlers/handleAnswer';
import { handleBack as handleBackFn } from '@/lib/quiz/handlers/handleBack';
import { submitAnswers as submitAnswersFn } from '@/lib/quiz/handlers/submitAnswers';
import { resumeQuiz as resumeQuizFn } from '@/lib/quiz/handlers/resumeQuiz';
import { startOver as startOverFn } from '@/lib/quiz/handlers/startOver';
import { createSaveProgress } from '@/lib/quiz/handlers/saveProgress';
import { createClearProgress } from '@/lib/quiz/handlers/clearProgress';
import { loadSavedProgressFromServer as loadSavedProgressFromServerFn } from '@/lib/quiz/handlers/loadSavedProgress';
import { handleFullRetake } from '@/lib/quiz/handlers/handleFullRetake';

import type { Question } from '@/lib/quiz/types';

import { QuizInfoScreen } from './components/QuizInfoScreen';
import { QuizResumeScreen } from './components/QuizResumeScreen';
import { QuizRetakeScreen } from './components/QuizRetakeScreen';
import { QuizInitialLoader } from './components/QuizInitialLoader';
import { checkQuizErrors } from './components/QuizErrorChecker';
import { QuizPageContent } from './components/QuizPageContent';

type Screen = 'LOADER' | 'ERROR' | 'RETAKE' | 'RESUME' | 'INFO' | 'INITIAL_INFO' | 'QUESTION';

export default function QuizPage() {
  const isDev = process.env.NODE_ENV === 'development';

  // Telegram init
  const { initData } = useTelegram();

  // State machine (UI only)
  const quizStateMachine = useQuizStateMachine({
    initialState: 'LOADING',
    onStateChange: useCallback(
      (next: unknown, prev: unknown) => {
        if (isDev) clientLogger.log('🔄 State Machine transition', { from: prev, to: next });
      },
      [isDev]
    ),
    onTransitionError: useCallback(
      (event: unknown, from: unknown) => {
        if (isDev) clientLogger.warn('⚠️ Invalid State Machine transition', { event, from });
      },
      [isDev]
    ),
  });

  // React Query
  const {
    data: questionnaireFromQuery,
    isLoading: isLoadingQuestionnaire,
    error: questionnaireError,
  } = useQuestionnaire();

  const {
    data: quizProgressFromQuery,
    isLoading: isLoadingProgress,
    error: progressError,
  } = useQuizProgress();

  const saveQuizProgressMutation = useSaveQuizProgress();

  // Global quiz state
  const quizState = useQuizStateExtended();
  const {
    questionnaire,
    setQuestionnaire,
    questionnaireRef,
    loading,
    setLoading,
    error,
    setError,

    currentInfoScreenIndex,
    setCurrentInfoScreenIndex,
    currentInfoScreenIndexRef,

    currentQuestionIndex,
    setCurrentQuestionIndex,
    currentQuestionIndexRef,

    answers,
    setAnswers,

    showResumeScreen,
    setShowResumeScreen,

    isSubmitting,
    setIsSubmitting,
    isSubmittingRef,

    finalizing,
    setFinalizing,
    finalizingStep,
    setFinalizingStep,
    finalizeError,
    setFinalizeError,

    pendingInfoScreen,
    setPendingInfoScreen,

    savedProgress,
    setSavedProgress,

    isRetakingQuiz,
    setIsRetakingQuiz,
    showRetakeScreen,
    setShowRetakeScreen,
    hasFullRetakePayment,
    setHasFullRetakePayment,

    hasResumed,
    setHasResumed,
    hasResumedRef,

    isStartingOver,
    setIsStartingOver,
    isStartingOverRef,

    initCompleted,
    setInitCompleted,
    initCompletedRef,

    debugLogs,
    setDebugLogs,
    showDebugPanel,
    setShowDebugPanel,

    autoSubmitTriggered,
    setAutoSubmitTriggered,
    autoSubmitTriggeredRef,

    isMountedRef,
    redirectTimeoutRef,
    submitAnswersRef,
    saveProgressTimeoutRef,
    lastSavedAnswerRef,
    pendingProgressRef,
    progressLoadedRef,
  } = quizState;

  /**
   * ✅ scope должен быть state, иначе scoped keys "навсегда global"
   */
  const [scope, setScope] = useState<string>('global');
  const scopeFrozenRef = useRef(false);

  // State для progress loaded (триггерит ререндеры в отличие от ref)
  const [progressLoaded, setProgressLoaded] = useState(false);

  const scopedStorageKeys = useMemo(
    () => ({
      CURRENT_INFO_SCREEN: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN, scope),
      CURRENT_QUESTION: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION, scope),
      CURRENT_QUESTION_CODE: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE, scope),
      INIT_CALLED: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.INIT_CALLED, scope),
      JUST_SUBMITTED: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED, scope),
      QUIZ_COMPLETED: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.QUIZ_COMPLETED, scope),
    }),
    [scope]
  );

  // Questionnaire sync (query -> state/ref + state machine protection)
  const { setQuestionnaireWithStateMachine } = useQuestionnaireSync({
    questionnaireFromQuery,
    questionnaire,
    questionnaireRef,
    setQuestionnaire,
    quizStateMachine,
    isLoadingQuestionnaire,
    questionnaireError,
    setLoading,
    setError,
  });

  // stable refs for restore pipeline / handlers
  const allQuestionsRawPrevRef = useRef<Question[]>([]);
  const allQuestionsPrevRef = useRef<Question[]>([]);

  const lastRestoredAnswersIdRef = useRef<string | null>(null);
  const answersRef = useRef<Record<number, string | string[]>>({});
  const answersCountRef = useRef<number>(0);

  useEffect(() => {
    answersRef.current = answers;
    answersCountRef.current = Object.keys(answers).length;
  }, [answers]);

  // computed versions
  const [answersVersion, setAnswersVersion] = useState(0);
  const [savedProgressVersion, setSavedProgressVersion] = useState(0);

  useEffect(() => {
    setAnswersVersion((v) => v + 1);
  }, [answers]);

  useEffect(() => {
    setSavedProgressVersion((v) => v + 1);
  }, [savedProgress]);

  const {
    answersCount,
    allQuestionsRaw,
    allQuestions,
    initialInfoScreens,
    isShowingInitialInfoScreen,
    currentInitialInfoScreen,
    currentQuestion,
  } = useQuizComputed({
    questionnaire,
    answers,
    answersVersion,
    savedProgress,
    savedProgressVersion,
    currentInfoScreenIndex,
    currentQuestionIndex,
    isRetakingQuiz,
    showRetakeScreen,
    showResumeScreen,
    hasResumed,
    isStartingOver,
    pendingInfoScreen,
    isLoadingProgress,
    questionnaireRef,
    currentInfoScreenIndexRef,
    allQuestionsRawPrevRef,
    allQuestionsPrevRef,
    pendingInfoScreenRef: quizState.pendingInfoScreenRef,
    quizStateMachine,
    isDev,
  });

  // keep prev questions for fallback
  useEffect(() => {
    if (allQuestions.length > 0) allQuestionsPrevRef.current = allQuestions;
  }, [allQuestions]);

  /**
   * ✅ Mount/unmount guard
   */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
        saveProgressTimeoutRef.current = null;
      }
    };
  }, [isMountedRef, redirectTimeoutRef, saveProgressTimeoutRef]);

  /**
   * ✅ Fix sticky flags on enter /quiz
   */
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const justSubmitted = sessionStorage.getItem(scopedStorageKeys.JUST_SUBMITTED);
      if (justSubmitted === 'true') sessionStorage.removeItem(scopedStorageKeys.JUST_SUBMITTED);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    } catch {
      // ignore
    }
  }, [scopedStorageKeys.JUST_SUBMITTED, setIsSubmitting, isSubmittingRef]);

  /**
   * ✅ Clamp currentQuestionIndex after question filtering
   * Fixes "sticking" after retinoid/adapalene answers when allQuestions gets filtered
   */
  useEffect(() => {
    if (allQuestions.length > 0 && currentQuestionIndex >= allQuestions.length) {
      const clampedIndex = Math.min(currentQuestionIndex, allQuestions.length - 1);
      if (clampedIndex !== currentQuestionIndex) {
        if (isDev) clientLogger.log('🔧 Clamping currentQuestionIndex after filtering', {
          before: currentQuestionIndex,
          after: clampedIndex,
          allQuestionsLength: allQuestions.length,
        });
        setCurrentQuestionIndex(clampedIndex);
        currentQuestionIndexRef.current = clampedIndex;
      }
    }
  }, [allQuestions.length, currentQuestionIndex, setCurrentQuestionIndex, currentQuestionIndexRef, isDev]);

  /**
   * ✅ Freeze scope once questionnaire id is known
   */
  useEffect(() => {
    const qid =
      questionnaireFromQuery?.id ||
      questionnaireRef.current?.id ||
      questionnaire?.id ||
      quizStateMachine.questionnaire?.id;

    if (!qid) return;

    if (!scopeFrozenRef.current) {
      scopeFrozenRef.current = true;
      setScope(String(qid));
      if (isDev) clientLogger.log('🔒 Scope fixed', { scope: String(qid) });
    }
  }, [questionnaireFromQuery?.id, questionnaire?.id, quizStateMachine.questionnaire?.id, isDev, questionnaireRef]);

  /**
   * ✅ SaveProgress / ClearProgress factories
   */
  const saveProgress = useMemo(
    () =>
      createSaveProgress({
        questionnaire,
        currentQuestionIndexRef,
        currentInfoScreenIndexRef,
        saveQuizProgressMutation,
        pendingProgressRef,
        saveProgressTimeoutRef,
        isDev,
      }),
    [
      questionnaire,
      currentQuestionIndexRef,
      currentInfoScreenIndexRef,
      saveQuizProgressMutation,
      pendingProgressRef,
      saveProgressTimeoutRef,
      isDev,
    ]
  );

  const clearProgress = useMemo(
    () =>
      createClearProgress({
        setSavedProgress,
        setShowResumeScreen,
        hasResumedRef,
        setHasResumed,
        lastSavedAnswerRef,
      }),
    [setSavedProgress, setShowResumeScreen, hasResumedRef, setHasResumed, lastSavedAnswerRef]
  );

  /**
   * ✅ Restore pipeline
   */
  useQuizRestorePipeline({
    scope,
    scopedStorageKeys,
    questionnaire: questionnaireFromQuery || questionnaireRef.current || questionnaire,
    questionnaireRef,
    questionnaireFromQuery,
    quizProgressFromQuery,
    isLoadingProgress,
    allQuestions,
    allQuestionsPrevRef,
    answers,
    setAnswers,
    savedProgress,
    setSavedProgress,
    currentInfoScreenIndex,
    setCurrentInfoScreenIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answersRef,
    answersCountRef,
    currentInfoScreenIndexRef,
    currentQuestionIndexRef,
    lastRestoredAnswersIdRef,
    isStartingOver,
    isStartingOverRef,
    hasResumed,
    hasResumedRef,
    isDev,
  });

  /**
   * ✅ Storage-derived flags
   */
  const completedKey = useMemo(
    () => QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.QUIZ_COMPLETED, scope),
    [scope]
  );

  const isQuizCompleted = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(completedKey) === 'true';
  }, [completedKey]);

  const progressClearedKey = useMemo(() => QUIZ_CONFIG.getScopedKey('quiz_progress_cleared', scope), [scope]);

  const [isProgressCleared, setIsProgressCleared] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(progressClearedKey) === 'true';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsProgressCleared(sessionStorage.getItem(progressClearedKey) === 'true');

    const onStorage = (e: StorageEvent) => {
      if (e.key === progressClearedKey) {
        setIsProgressCleared(sessionStorage.getItem(progressClearedKey) === 'true');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [progressClearedKey]);

  /**
   * ✅ Load saved progress wrapper
   */
  const loadSavedProgressFromServer = useCallback(async () => {
    return loadSavedProgressFromServerFn({
      currentInfoScreenIndexRef,
      currentQuestionIndexRef,
      hasResumedRef,
      isStartingOverRef,
      progressLoadedRef,
      loadProgressInProgressRef: quizState.loadProgressInProgressRef,
      progressLoadInProgressRef: quizState.progressLoadInProgressRef,
      currentInfoScreenIndex,
      currentQuestionIndex,
      hasResumed,
      isStartingOver,
      allQuestions,
      savedProgress,
      showResumeScreen,
      setCurrentInfoScreenIndex,
      setCurrentQuestionIndex,
      setSavedProgress,
      setShowResumeScreen,
      setLoading,
      setProgressLoaded,
      quizProgressFromQuery,
      isLoadingProgress,
    });
  }, [
    currentInfoScreenIndexRef,
    currentQuestionIndexRef,
    hasResumedRef,
    isStartingOverRef,
    progressLoadedRef,
    quizState.loadProgressInProgressRef,
    quizState.progressLoadInProgressRef,
    currentInfoScreenIndex,
    currentQuestionIndex,
    hasResumed,
    isStartingOver,
    allQuestions,
    savedProgress,
    showResumeScreen,
    setCurrentInfoScreenIndex,
    setCurrentQuestionIndex,
    setSavedProgress,
    setShowResumeScreen,
    setLoading,
    setProgressLoaded,
    quizProgressFromQuery,
    isLoadingProgress,
  ]);

  /**
   * ✅ loadQuestionnaire
   */
  const loadQuestionnaire = useCallback(async () => {
    return loadQuestionnaireFn({
      setQuestionnaire: setQuestionnaireWithStateMachine,
      questionnaireRef,
      loadQuestionnaireInProgressRef: quizState.loadQuestionnaireInProgressRef,
      loadQuestionnaireAttemptedRef: quizState.loadQuestionnaireAttemptedRef,
      redirectInProgressRef: quizState.redirectInProgressRef,
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
      setLoading,
      setError,
      setCurrentQuestionIndex,
      setUserPreferencesData: quizState.setUserPreferencesData,
      setIsRetakingQuiz,
      setShowRetakeScreen,
      setHasRetakingPayment: quizState.setHasRetakingPayment,
      setHasFullRetakePayment,
      isDev,
      userPreferences,
      addDebugLog: (msg: string, data?: unknown) => {
        const time = new Date().toLocaleTimeString();
        clientLogger.log(`[${time}] ${msg}`, data ?? '');
        if (isDev) {
          const log = { time, message: msg, data: data ? JSON.stringify(data, null, 2) : undefined };
          setDebugLogs((prev) => [...prev.slice(-19), log]);
        }
      },
    });
  }, [
    setQuestionnaireWithStateMachine,
    questionnaireRef,
    quizState.loadQuestionnaireInProgressRef,
    quizState.loadQuestionnaireAttemptedRef,
    quizState.redirectInProgressRef,
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
    setLoading,
    setError,
    setCurrentQuestionIndex,
    quizState.setUserPreferencesData,
    setIsRetakingQuiz,
    setShowRetakeScreen,
    setHasFullRetakePayment,
    isDev,
    setDebugLogs,
    quizState.setHasRetakingPayment,
  ]);

  /**
   * ✅ init (single, safe)
   */
  const initInProgressRef = useRef(false);
  const initCalledRef = useRef(false);

  const init = useCallback(async () => {
    if (initInProgressRef.current) return;
    initInProgressRef.current = true;

    try {
      setLoading(true);

      const q = await loadQuestionnaire();
      if (!q) throw new Error('Questionnaire not loaded');

      if (!scopeFrozenRef.current && q.id) {
        scopeFrozenRef.current = true;
        setScope(String(q.id));
      }

      await loadSavedProgressFromServer();

      initCompletedRef.current = true;
      setInitCompleted(true);

      if (typeof window !== 'undefined' && q.id) {
        const initDoneKey = QUIZ_CONFIG.getScopedKey('quiz_init_done:v2', String(q.id));
        sessionStorage.setItem(initDoneKey, 'true');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Init failed';
      setError(msg);
      clientLogger.error('❌ init() failed', e);
    } finally {
      setLoading(false);
      initInProgressRef.current = false;
    }
  }, [loadQuestionnaire, loadSavedProgressFromServer, setLoading, setInitCompleted, setError, initCompletedRef]);

  /**
   * ✅ init trigger: только когда scope уже НЕ global
   */
  useEffect(() => {
    if (scope === 'global') return;
    if (initCalledRef.current) return;
    initCalledRef.current = true;

    try {
      if (typeof window !== 'undefined') {
        const initDoneKey = QUIZ_CONFIG.getScopedKey('quiz_init_done:v2', scope);
        const alreadyInit = sessionStorage.getItem(initDoneKey) === 'true';
        if (alreadyInit) return;
      }
    } catch {
      // ignore
    }

    init().catch(() => {});
  }, [scope, init]);

  /**
   * ✅ handlers
   */
  const handleAnswer = useCallback(
    async (questionId: number, value: string | string[]) => {
      if (typeof window !== 'undefined') {
        const k = QUIZ_CONFIG.getScopedKey('quiz_progress_cleared', scope);
        if (sessionStorage.getItem(k) === 'true') {
          sessionStorage.removeItem(k);
          setIsProgressCleared(false);
        }
      }

      answersRef.current = { ...answersRef.current, [questionId]: value };
      answersCountRef.current = Object.keys(answersRef.current).length;

      return handleAnswerFn({
        questionId,
        value,
        currentQuestion,
        answers,
        allQuestions,
        questionnaire: questionnaireFromQuery || questionnaireRef.current || questionnaire,
        setAnswers,
        saveProgress,
        currentQuestionIndex,
        currentInfoScreenIndex,
        saveQuizProgressMutation,
        lastSavedAnswerRef,
        answersRef,
        addDebugLog: (msg: string, data?: unknown) => {
          const time = new Date().toLocaleTimeString();
          clientLogger.log(`[${time}] ${msg}`, data ?? '');
          if (isDev) {
            const log = { time, message: msg, data: data ? JSON.stringify(data, null, 2) : undefined };
            setDebugLogs((prev) => [...prev.slice(-19), log]);
          }
        },
        setCurrentQuestionIndex,
        currentQuestionIndexRef,
        scopedStorageKeys,
        scope,
      });
    },
    [
      scope,
      isDev,
      questionnaireFromQuery,
      questionnaireRef,
      questionnaire,
      currentQuestion,
      answers,
      allQuestions,
      saveProgress,
      currentQuestionIndex,
      currentInfoScreenIndex,
      saveQuizProgressMutation,
      lastSavedAnswerRef,
      setAnswers,
      setCurrentQuestionIndex,
      currentQuestionIndexRef,
      scopedStorageKeys,
      setDebugLogs,
    ]
  );

  const handleNextInProgressRef = useRef(false);
  const [isHandlingNext, setIsHandlingNext] = useState(false);

  const handleNext = useCallback(async () => {
    return handleNextFn({
      handleNextInProgressRef,
      currentInfoScreenIndexRef,
      currentQuestionIndexRef,
      questionnaireRef,
      initCompletedRef,
      answersRef,
      questionnaire: questionnaireFromQuery || questionnaireRef.current || questionnaire,
      loading,
      currentInfoScreenIndex,
      currentQuestionIndex,
      allQuestions,
      isRetakingQuiz,
      showRetakeScreen,
      hasResumed,
      pendingInfoScreen,
      pendingInfoScreenRef: quizState.pendingInfoScreenRef,
      answers,
      setIsHandlingNext,
      setCurrentInfoScreenIndex,
      setCurrentQuestionIndex,
      setPendingInfoScreen,
      setError,
      saveProgress,
      loadQuestionnaire,
      initInProgressRef,
      setLoading,
      isDev,
    });
  }, [
    handleNextInProgressRef,
    currentInfoScreenIndexRef,
    currentQuestionIndexRef,
    questionnaireRef,
    initCompletedRef,
    answersRef,
    questionnaireFromQuery,
    questionnaire,
    loading,
    currentInfoScreenIndex,
    currentQuestionIndex,
    allQuestions,
    isRetakingQuiz,
    showRetakeScreen,
    hasResumed,
    pendingInfoScreen,
    quizState.pendingInfoScreenRef,
    answers,
    setCurrentInfoScreenIndex,
    setCurrentQuestionIndex,
    setPendingInfoScreen,
    setError,
    saveProgress,
    loadQuestionnaire,
    initInProgressRef,
    setLoading,
    isDev,
  ]);

  const handleBackInProgressRef = useRef(false);

  const handleBack = useCallback(async () => {
    return handleBackFn({
      currentInfoScreenIndex,
      currentQuestionIndex,
      questionnaire,
      questionnaireRef,
      pendingInfoScreen,
      currentInfoScreenIndexRef,
      allQuestions,
      answers,
      handleBackInProgressRef,
      setCurrentInfoScreenIndex,
      setCurrentQuestionIndex,
      setPendingInfoScreen,
      setAnswers,
      isShowingInitialInfoScreen,
      initialInfoScreensLength: initialInfoScreens.length,
      saveProgress,
      scopedStorageKeys,
    });
  }, [
    currentInfoScreenIndex,
    currentQuestionIndex,
    questionnaire,
    questionnaireRef,
    pendingInfoScreen,
    currentInfoScreenIndexRef,
    allQuestions,
    answers,
    setCurrentInfoScreenIndex,
    setCurrentQuestionIndex,
    setPendingInfoScreen,
    setAnswers,
    isShowingInitialInfoScreen,
    initialInfoScreens,
    saveProgress,
    scopedStorageKeys,
  ]);

  // submit uses refs only
  const isRetakingQuizRef = useRef(false);
  useEffect(() => {
    isRetakingQuizRef.current = isRetakingQuiz;
  }, [isRetakingQuiz]);

  const submitAnswers = useCallback(async () => {
    const currentQuestionnaire = questionnaireRef.current;
    const currentAnswers = answersRef.current || {};
    const currentInitData = initData || null;

    await submitAnswersFn({
      questionnaire: currentQuestionnaire,
      answers: currentAnswers,
      isSubmitting: isSubmittingRef.current,
      isSubmittingRef,
      isMountedRef,
      isDev,
      initData: currentInitData,
      setAnswers,
      setIsSubmitting,
      setLoading,
      setError,
      setFinalizing,
      setFinalizingStep,
      setFinalizeError,
      redirectInProgressRef: quizState.redirectInProgressRef,
      submitAnswersRef,
      isRetakingQuiz: isRetakingQuizRef.current,
      getInitData: () => Promise.resolve(currentInitData),
      scopedStorageKeys,
    });
  }, [
    questionnaireRef,
    initData,
    isSubmittingRef,
    isMountedRef,
    isDev,
    setAnswers,
    setIsSubmitting,
    setLoading,
    setError,
    setFinalizing,
    setFinalizingStep,
    setFinalizeError,
    quizState.redirectInProgressRef,
    submitAnswersRef,
  ]);

  useEffect(() => {
    submitAnswersRef.current = submitAnswers;
  }, [submitAnswers, submitAnswersRef]);

  const resumeCompletedRef = useRef(false);

  const resumeQuiz = useCallback(() => {
    resumeQuizFn({
      savedProgress,
      questionnaire: questionnaireFromQuery || questionnaireRef.current || questionnaire,
      allQuestions,
      redirectInProgressRef: quizState.redirectInProgressRef,
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
      loadProgressInProgressRef: quizState.loadProgressInProgressRef,
      progressLoadInProgressRef: quizState.progressLoadInProgressRef,
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
    quizState.redirectInProgressRef,
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
    quizState.loadProgressInProgressRef,
    quizState.progressLoadInProgressRef,
    setAnswers,
    setCurrentQuestionIndex,
    setCurrentInfoScreenIndex,
    setPendingInfoScreen,
    quizState.pendingInfoScreenRef,
  ]);

  const startOver = useCallback(async () => {
    await startOverFn({
      scope,
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
      currentInfoScreenIndexRef,
      setShowResumeScreen,
      hasResumedRef,
      setHasResumed,
      setSavedProgress,
      setPendingInfoScreen,
      setIsRetakingQuiz,
      setShowRetakeScreen,
      firstScreenResetRef: quizState.firstScreenResetRef,
      setLoading,
      setError,
      setIsProgressCleared,
      questionnaire,
    });
  }, [
    scope,
    isStartingOverRef,
    setIsStartingOver,
    initCompletedRef,
    setInitCompleted,
    clearProgress,
    setAnswers,
    setCurrentQuestionIndex,
    setCurrentInfoScreenIndex,
    currentInfoScreenIndexRef,
    setShowResumeScreen,
    hasResumedRef,
    setHasResumed,
    setSavedProgress,
    setPendingInfoScreen,
    setIsRetakingQuiz,
    setShowRetakeScreen,
    quizState.firstScreenResetRef,
    setLoading,
    setError,
    setIsProgressCleared,
    questionnaire,
  ]);

  /**
   * ✅ auto-submit after completion
   */
  useEffect(() => {
    if (!initCompleted) return;

    if (
      !autoSubmitTriggeredRef.current &&
      questionnaire &&
      allQuestions.length > 0 &&
      currentQuestionIndex >= allQuestions.length &&
      Object.keys(answers).length > 0 &&
      !isSubmitting &&
      !error &&
      !pendingInfoScreen
    ) {
      autoSubmitTriggeredRef.current = true;
      setAutoSubmitTriggered(true);

      const t = setTimeout(() => {
        if (!isMountedRef.current) return;
        if (!submitAnswersRef.current) return;
        if (isSubmittingRef.current) return;

        isSubmittingRef.current = true;
        setIsSubmitting(true);

        submitAnswersRef.current().catch((err: unknown) => {
          if (!isMountedRef.current) return;
          autoSubmitTriggeredRef.current = false;
          setAutoSubmitTriggered(false);
          isSubmittingRef.current = false;
          setIsSubmitting(false);
          const msg = err instanceof Error ? err.message : 'Ошибка отправки ответов';
          setError(String(msg));
        });
      }, 5000);

      return () => clearTimeout(t);
    }
  }, [
    initCompleted,
    questionnaire,
    allQuestions.length,
    currentQuestionIndex,
    answers,
    isSubmitting,
    error,
    pendingInfoScreen,
    isMountedRef,
    submitAnswersRef,
    isSubmittingRef,
    autoSubmitTriggeredRef,
    setAutoSubmitTriggered,
    setIsSubmitting,
    setError,
  ]);

  /**
   * ✅ Redirect to plan after submit - moved inside submitAnswers handler
   * Now happens after successful response, not just when isSubmitting=true
   */

  /**
   * ✅ useQuizEffects (kept)
   */
  useQuizEffects({
    questionnaire,
    setQuestionnaire,
    loading,
    setLoading,
    error,
    setError,
    currentInfoScreenIndex,
    setCurrentInfoScreenIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    setAnswers,
    showResumeScreen,
    isSubmitting,
    setIsSubmitting,
    savedProgress,
    setSavedProgress,
    isRetakingQuiz,
    showRetakeScreen,
    setHasRetakingPayment: quizState.setHasRetakingPayment,
    setHasFullRetakePayment,
    setPendingInfoScreen,
    userPreferencesData: quizState.userPreferencesData,
    allQuestions,
    allQuestionsRaw,
    pendingInfoScreen,
    autoSubmitTriggered,
    setAutoSubmitTriggered,
    autoSubmitTriggeredRef,
    submitAnswers,
    questionnaireRef,
    currentInfoScreenIndexRef,
    currentQuestionIndexRef,
    hasResumedRef,
    isSubmittingRef,
    isStartingOverRef,
    initCompletedRef,
    setInitCompleted,
    initCalledRef,
    initInProgressRef,
    isMountedRef,
    progressLoadedRef,
    loadProgressInProgressRef: quizState.loadProgressInProgressRef,
    progressLoadInProgressRef: quizState.progressLoadInProgressRef,
    loadQuestionnaireInProgressRef: quizState.loadQuestionnaireInProgressRef,
    loadQuestionnaireAttemptedRef: quizState.loadQuestionnaireAttemptedRef,
    redirectInProgressRef: quizState.redirectInProgressRef,
    profileCheckInProgressRef: quizState.profileCheckInProgressRef,
    resumeCompletedRef,
    initCompletedTimeRef: quizState.initCompletedTimeRef,
    allQuestionsPrevRef,
    answersRef,
    answersCountRef,
    lastRestoredAnswersIdRef,
    saveProgressTimeoutRef,
    submitAnswersRef,
    firstScreenResetRef: quizState.firstScreenResetRef,
    questionnaireFromQuery,
    isLoadingQuestionnaire,
    questionnaireError,
    quizProgressFromQuery,
    isLoadingProgress,
    quizStateMachine,
    setQuestionnaireInStateMachine: quizStateMachine.setQuestionnaire,
    init,
    loadQuestionnaire,
    loadSavedProgressFromServer,
    isDev,
    hasResumed,
    isStartingOver,
    answersCount,
    scope,
  });

  /**
   * ✅ Error screen
   */
  const errorScreen = checkQuizErrors({
    questionnaire,
    questionnaireRef,
    allQuestionsRaw,
    allQuestions,
    answers,
    loading,
    error: error || (questionnaireError as any)?.message || (progressError as any)?.message || null,
    isRetakingQuiz,
    showRetakeScreen,
    currentQuestion,
    showResumeScreen,
    isShowingInitialInfoScreen,
    pendingInfoScreen,
    hasResumed,
  });

  /**
   * ✅ loader
   */
  const shouldShowLoader = shouldShowInitialLoader({
    pendingInfoScreen,
    currentInfoScreenIndex,
    loading,
    initCompletedRef,
    questionnaireRef,
    questionnaire,
    quizStateMachineQuestionnaire: quizStateMachine.questionnaire,
    questionnaireFromQuery,
  });

  /**
   * ✅ Resume decision + LOCK (фикс мигания)
   */
  const startedThisSessionRef = useRef(false);

  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      startedThisSessionRef.current = true;
    }
  }, [answers]);

  const savedAnswersCount = useMemo(() => {
    if (!savedProgress?.answers) return 0;
    return Object.keys(savedProgress.answers).length;
  }, [savedProgress]);

  const shouldResumeNow = useMemo(() => {
    return (
      !!savedProgress &&
      savedAnswersCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN &&
      !startedThisSessionRef.current &&   // ✅ вот это главное
      !isStartingOver &&
      !hasResumed &&
      !isRetakingQuiz &&
      !showRetakeScreen &&
      !isLoadingProgress &&
      !isQuizCompleted &&
      !isProgressCleared
    );
  }, [
    savedProgress,
    savedAnswersCount,
    isStartingOver,
    hasResumed,
    isRetakingQuiz,
    showRetakeScreen,
    isLoadingProgress,
    isQuizCompleted,
    isProgressCleared,
  ]);

  const [resumeLocked, setResumeLocked] = useState(false);

  const resumeInvalidated =
    isStartingOver ||
    hasResumed ||
    isRetakingQuiz ||
    showRetakeScreen ||
    isLoadingProgress ||
    isQuizCompleted ||
    isProgressCleared;

  useEffect(() => {
    if (shouldResumeNow && !resumeLocked) setResumeLocked(true);
    if (resumeLocked && resumeInvalidated) setResumeLocked(false);
  }, [shouldResumeNow, resumeLocked, resumeInvalidated]);

  // держим showResumeScreen синхронизированным (чтобы не ломать другие хуки)
  useEffect(() => {
    if (showResumeScreen !== resumeLocked) {
      setShowResumeScreen(resumeLocked);
    }
  }, [resumeLocked, showResumeScreen, setShowResumeScreen]);

  /**
   * ✅ Screen resolver (single source)
   * + gate: не рендерим QUESTION пока currentQuestion отсутствует
   */
  const screen: Screen = useMemo(() => {
    if (errorScreen) return 'ERROR';

    // ЖЕСТКИЙ ГЕЙТ: пока грузится прогресс - показываем только LOADER
    if (isLoadingProgress || !progressLoaded) return 'LOADER';

    if (resumeLocked) return 'RESUME';

    if (showRetakeScreen && isRetakingQuiz) return 'RETAKE';

    if (pendingInfoScreen && !isRetakingQuiz) return 'INFO';

    const hasEnoughSavedAnswers = savedProgress?.answers && Object.keys(savedProgress.answers).length >= 2;
    if (
      isShowingInitialInfoScreen &&
      currentInitialInfoScreen &&
      currentInfoScreenIndex < initialInfoScreens.length &&
      !isRetakingQuiz &&
      !pendingInfoScreen &&
      !isLoadingProgress &&
      !hasEnoughSavedAnswers
    ) {
      return 'INITIAL_INFO';
    }

    const baseReady = !!(questionnaireFromQuery || questionnaireRef.current || questionnaire);
    if (!baseReady) return 'LOADER';

    if (shouldShowLoader) return 'LOADER';

    // IMPORTANT: если вопроса нет — не показываем "пустой фон"
    if (!currentQuestion) return 'LOADER';

    return 'QUESTION';
  }, [
    errorScreen,
    resumeLocked,
    showRetakeScreen,
    isRetakingQuiz,
    pendingInfoScreen,
    isShowingInitialInfoScreen,
    currentInitialInfoScreen,
    currentInfoScreenIndex,
    initialInfoScreens.length,
    isLoadingProgress,
    progressLoaded,
    savedProgress,
    questionnaireFromQuery,
    questionnaireRef,
    questionnaire,
    shouldShowLoader,
    currentQuestion,
  ]);

  /**
   * ✅ Render
   */
  if (screen === 'ERROR') return errorScreen;

  if (screen === 'LOADER') return <QuizInitialLoader />;

  if (screen === 'RETAKE') {
    const onFullRetake = async () => {
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
    };

    return (
      <QuizRetakeScreen
        questionnaire={questionnaire}
        hasFullRetakePayment={hasFullRetakePayment}
        setShowRetakeScreen={setShowRetakeScreen}
        setIsRetakingQuiz={setIsRetakingQuiz}
        setIsStartingOver={setIsStartingOver}
        isStartingOverRef={isStartingOverRef}
        setAnswers={setAnswers}
        setSavedProgress={setSavedProgress}
        setShowResumeScreen={setShowResumeScreen}
        setHasResumed={setHasResumed}
        hasResumedRef={hasResumedRef}
        setAutoSubmitTriggered={setAutoSubmitTriggered}
        autoSubmitTriggeredRef={autoSubmitTriggeredRef}
        setError={setError}
        setCurrentInfoScreenIndex={setCurrentInfoScreenIndex}
        setCurrentQuestionIndex={setCurrentQuestionIndex}
        setPendingInfoScreen={setPendingInfoScreen}
        setHasFullRetakePayment={setHasFullRetakePayment}
        onFullRetake={onFullRetake}
      />
    );
  }

  if (screen === 'RESUME') {
    const isBusy = loading || isLoadingProgress;
    return (
      <QuizResumeScreen
        savedProgress={savedProgress!}
        questionnaire={questionnaire}
        answers={answers}
        isRetakingQuiz={isRetakingQuiz}
        showRetakeScreen={showRetakeScreen}
        onResume={resumeQuiz}
        onStartOver={startOver}
        isBusy={isBusy}
      />
    );
  }

  if (screen === 'INFO') {
    return (
      <QuizInfoScreen
        screen={pendingInfoScreen!}
        currentInfoScreenIndex={currentInfoScreenIndex}
        questionnaire={questionnaireFromQuery || questionnaireRef.current || questionnaire}
        questionnaireRef={questionnaireRef}
        error={error}
        isSubmitting={isSubmitting}
        isHandlingNext={isHandlingNext}
        isDev={isDev}
        handleNextInProgressRef={handleNextInProgressRef}
        isSubmittingRef={isSubmittingRef}
        setCurrentInfoScreenIndex={setCurrentInfoScreenIndex}
        setIsSubmitting={setIsSubmitting}
        setError={setError}
        setLoading={setLoading}
        handleNext={handleNext}
        submitAnswers={submitAnswers}
        pendingInfoScreenRef={quizState.pendingInfoScreenRef}
        handleBack={handleBack}
      />
    );
  }

  if (screen === 'INITIAL_INFO') {
    return (
      <QuizInfoScreen
        screen={currentInitialInfoScreen!}
        currentInfoScreenIndex={currentInfoScreenIndex}
        questionnaire={questionnaireFromQuery || questionnaireRef.current || questionnaire}
        questionnaireRef={questionnaireRef}
        error={error}
        isSubmitting={isSubmitting}
        isHandlingNext={isHandlingNext}
        isDev={isDev}
        handleNextInProgressRef={handleNextInProgressRef}
        isSubmittingRef={isSubmittingRef}
        setCurrentInfoScreenIndex={setCurrentInfoScreenIndex}
        setIsSubmitting={setIsSubmitting}
        setError={setError}
        setLoading={setLoading}
        handleNext={handleNext}
        submitAnswers={submitAnswers}
        handleBack={handleBack}
      />
    );
  }

  // QUESTION
  const isQuestionScreen = isQuestionScreenUtil(currentQuestion, pendingInfoScreen, resumeLocked, showRetakeScreen);
  const backgroundColor = getQuizBackgroundColor(isQuestionScreen);

  return (
    <QuizPageContent
      backgroundColor={backgroundColor}
      isDev={isDev}
      showDebugPanel={showDebugPanel}
      debugLogs={debugLogs}
      setShowDebugPanel={setShowDebugPanel}
      currentQuestion={currentQuestion}
      currentQuestionIndex={currentQuestionIndex}
      currentInfoScreenIndex={currentInfoScreenIndex}
      currentInfoScreenIndexRef={currentInfoScreenIndexRef}
      isPastInitialScreens={currentInfoScreenIndex >= initialInfoScreens.length}
      allQuestionsLength={allQuestions.length}
      initialInfoScreensLength={initialInfoScreens.length}
      isShowingInitialInfoScreen={isShowingInitialInfoScreen}
      loading={loading}
      questionnaire={questionnaire}
      questionnaireRef={questionnaireRef}
      quizStateMachineQuestionnaire={quizStateMachine.questionnaire}
      pendingInfoScreen={pendingInfoScreen}
      showResumeScreen={resumeLocked}
      hasResumed={hasResumed}
      answers={answers}
      isRetakingQuiz={isRetakingQuiz}
      isSubmitting={isSubmitting}
      onAnswer={handleAnswer}
      onNext={handleNext}
      onSubmit={submitAnswers}
      onBack={handleBack}
      finalizing={finalizing}
      finalizingStep={finalizingStep}
      finalizeError={finalizeError}
    />
  );
}