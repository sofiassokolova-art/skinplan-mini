// lib/quiz/hooks/useQuizStateExtended.ts
// РЕФАКТОРИНГ: Расширенный хук для управления всеми состояниями анкеты
// Вынесен из quiz/page.tsx для улучшения читаемости и поддержки

import { useState, useRef, useEffect, useMemo } from 'react';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire, InfoScreen } from '@/lib/quiz/types';

export interface UseQuizStateExtendedReturn {
  // Основные состояния
  questionnaire: Questionnaire | null;
  setQuestionnaire: React.Dispatch<React.SetStateAction<Questionnaire | null>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  
  // Навигация
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  currentQuestionIndexRef: React.MutableRefObject<number>;
  currentInfoScreenIndex: number;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  
  // Ответы
  answers: Record<number, string | string[]>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
  
  // UI состояния
  showResumeScreen: boolean;
  setShowResumeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  isSubmittingRef: React.MutableRefObject<boolean>;
  finalizing: boolean;
  setFinalizing: React.Dispatch<React.SetStateAction<boolean>>;
  finalizingStep: 'answers' | 'plan' | 'done';
  setFinalizingStep: React.Dispatch<React.SetStateAction<'answers' | 'plan' | 'done'>>;
  finalizeError: string | null;
  setFinalizeError: React.Dispatch<React.SetStateAction<string | null>>;
  pendingInfoScreen: InfoScreen | null;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<InfoScreen | null>>;
  
  // Прогресс
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  setSavedProgress: React.Dispatch<React.SetStateAction<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>>;
  
  // Retake состояния
  isRetakingQuiz: boolean;
  setIsRetakingQuiz: React.Dispatch<React.SetStateAction<boolean>>;
  showRetakeScreen: boolean;
  setShowRetakeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  hasRetakingPayment: boolean;
  setHasRetakingPayment: React.Dispatch<React.SetStateAction<boolean>>;
  hasFullRetakePayment: boolean;
  setHasFullRetakePayment: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Resume состояния
  hasResumed: boolean;
  setHasResumed: React.Dispatch<React.SetStateAction<boolean>>;
  hasResumedRef: React.MutableRefObject<boolean>;
  
  // User preferences
  userPreferencesData: {
    hasPlanProgress?: boolean;
    isRetakingQuiz?: boolean;
    fullRetakeFromHome?: boolean;
    paymentRetakingCompleted?: boolean;
    paymentFullRetakeCompleted?: boolean;
  } | null;
  setUserPreferencesData: React.Dispatch<React.SetStateAction<{
    hasPlanProgress?: boolean;
    isRetakingQuiz?: boolean;
    fullRetakeFromHome?: boolean;
    paymentRetakingCompleted?: boolean;
    paymentFullRetakeCompleted?: boolean;
  } | null>>;
  
  // Start over состояния
  isStartingOver: boolean;
  setIsStartingOver: React.Dispatch<React.SetStateAction<boolean>>;
  isStartingOverRef: React.MutableRefObject<boolean>;
  daysSincePlanGeneration: number | null;
  setDaysSincePlanGeneration: React.Dispatch<React.SetStateAction<number | null>>;
  
  // Debug состояния
  debugLogs: Array<{ time: string; message: string; data?: any }>;
  setDebugLogs: React.Dispatch<React.SetStateAction<Array<{ time: string; message: string; data?: any }>>>;
  showDebugPanel: boolean;
  setShowDebugPanel: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Auto submit
  autoSubmitTriggered: boolean;
  setAutoSubmitTriggered: React.Dispatch<React.SetStateAction<boolean>>;
  autoSubmitTriggeredRef: React.MutableRefObject<boolean>;
  
  // Refs для синхронизации
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  isMountedRef: React.MutableRefObject<boolean>;
  redirectTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  submitAnswersRef: React.MutableRefObject<(() => Promise<void>) | null>;
  saveProgressTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  lastSavedAnswerRef: React.MutableRefObject<{ questionId: number; answer: string | string[] } | null>;
  pendingProgressRef: React.MutableRefObject<{ questionIndex?: number; infoScreenIndex?: number } | null>;
  progressLoadedRef: React.MutableRefObject<boolean>;
  loadingRefForTimeout: React.MutableRefObject<boolean>;
  loadingStartTimeRef: React.MutableRefObject<number | null>;
  initCompletedRef: React.MutableRefObject<boolean>;
  
  // Refs для синхронизации с State Machine и React Query
  lastSyncedFromQueryIdRef: React.MutableRefObject<string | number | null>;
  setQuestionnaireInStateMachineRef: React.MutableRefObject<((questionnaire: Questionnaire | null) => void) | null>;
  questionnaireForCallbackRef: React.MutableRefObject<Questionnaire | null>;
  lastSyncedQuestionnaireIdRef: React.MutableRefObject<string | number | null>;
  lastSyncedQuestionnaireRef: React.MutableRefObject<Questionnaire | null>;
  isSyncingRef: React.MutableRefObject<boolean>;
  lastLoadingResetIdRef: React.MutableRefObject<string | number | null>;
  questionnaireStateRef: React.MutableRefObject<Questionnaire | null>;
  loadingStateRef: React.MutableRefObject<boolean>;
  stateMachineQuestionnaireRef: React.MutableRefObject<Questionnaire | null>;
  stateMachineQuestionnaireIdRef: React.MutableRefObject<string | number | null>;
}

/**
 * Расширенный хук для управления всеми состояниями анкеты
 * Группирует все useState и useRef из основного компонента
 */
export function useQuizStateExtended(): UseQuizStateExtendedReturn {
  // Восстанавливаем индексы из sessionStorage при инициализации
  const initialInfoScreenIndex = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN);
        if (saved !== null) {
          const savedIndex = parseInt(saved, 10);
          if (!isNaN(savedIndex) && savedIndex >= 0) {
            const initialInfoScreens = getInitialInfoScreens();
            if (savedIndex <= initialInfoScreens.length) {
              return savedIndex;
            }
          }
        }
      } catch (err) {
        // Игнорируем ошибки sessionStorage
      }
    }
    return 0;
  }, []);

  const initialQuestionIndex = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION);
        if (saved !== null) {
          const savedIndex = parseInt(saved, 10);
          if (!isNaN(savedIndex) && savedIndex >= 0) {
            return savedIndex;
          }
        }
      } catch (err) {
        // Игнорируем ошибки sessionStorage
      }
    }
    return 0;
  }, []);

  // Основные состояния
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Навигация
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialQuestionIndex);
  const currentQuestionIndexRef = useRef(initialQuestionIndex);
  const [currentInfoScreenIndex, setCurrentInfoScreenIndex] = useState(initialInfoScreenIndex);
  const currentInfoScreenIndexRef = useRef(initialInfoScreenIndex);
  
  // Ответы
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  
  // UI состояния
  const [showResumeScreen, setShowResumeScreen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizingStep, setFinalizingStep] = useState<'answers' | 'plan' | 'done'>('answers');
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [pendingInfoScreen, setPendingInfoScreen] = useState<InfoScreen | null>(null);
  
  // Прогресс
  const [savedProgress, setSavedProgress] = useState<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>(null);
  
  // Retake состояния
  const [isRetakingQuiz, setIsRetakingQuiz] = useState(false);
  const [showRetakeScreen, setShowRetakeScreen] = useState(false);
  const [hasRetakingPayment, setHasRetakingPayment] = useState(false);
  const [hasFullRetakePayment, setHasFullRetakePayment] = useState(false);
  
  // Resume состояния
  const [hasResumed, setHasResumed] = useState(false);
  const hasResumedRef = useRef(false);
  
  // User preferences
  const [userPreferencesData, setUserPreferencesData] = useState<{
    hasPlanProgress?: boolean;
    isRetakingQuiz?: boolean;
    fullRetakeFromHome?: boolean;
    paymentRetakingCompleted?: boolean;
    paymentFullRetakeCompleted?: boolean;
  } | null>(null);
  
  // Start over состояния
  const [isStartingOver, setIsStartingOver] = useState(false);
  const isStartingOverRef = useRef(false);
  const [daysSincePlanGeneration, setDaysSincePlanGeneration] = useState<number | null>(null);
  
  // Debug состояния
  const [debugLogs, setDebugLogs] = useState<Array<{ time: string; message: string; data?: any }>>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Auto submit
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
  const autoSubmitTriggeredRef = useRef(false);
  
  // Refs для синхронизации
  const questionnaireRef = useRef<Questionnaire | null>(null);
  const isMountedRef = useRef(true);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const submitAnswersRef = useRef<(() => Promise<void>) | null>(null);
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedAnswerRef = useRef<{ questionId: number; answer: string | string[] } | null>(null);
  const pendingProgressRef = useRef<{ questionIndex?: number; infoScreenIndex?: number } | null>(null);
  const progressLoadedRef = useRef(false);
  const loadingRefForTimeout = useRef(true);
  const loadingStartTimeRef = useRef<number | null>(null);
  const initCompletedRef = useRef(false);
  
  // Refs для синхронизации с State Machine и React Query
  const lastSyncedFromQueryIdRef = useRef<string | number | null>(null);
  const setQuestionnaireInStateMachineRef = useRef<((questionnaire: Questionnaire | null) => void) | null>(null);
  const questionnaireForCallbackRef = useRef<Questionnaire | null>(null);
  const lastSyncedQuestionnaireIdRef = useRef<string | number | null>(null);
  const lastSyncedQuestionnaireRef = useRef<Questionnaire | null>(null);
  const isSyncingRef = useRef(false);
  const lastLoadingResetIdRef = useRef<string | number | null>(null);
  const questionnaireStateRef = useRef<Questionnaire | null>(null);
  const loadingStateRef = useRef<boolean>(false);
  const stateMachineQuestionnaireRef = useRef<Questionnaire | null>(null);
  const stateMachineQuestionnaireIdRef = useRef<string | number | null>(null);
  
  // Синхронизация refs с state
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);
  
  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);
  
  useEffect(() => {
    currentInfoScreenIndexRef.current = currentInfoScreenIndex;
  }, [currentInfoScreenIndex]);
  
  useEffect(() => {
    hasResumedRef.current = hasResumed;
  }, [hasResumed]);
  
  useEffect(() => {
    autoSubmitTriggeredRef.current = autoSubmitTriggered;
  }, [autoSubmitTriggered]);
  
  useEffect(() => {
    isStartingOverRef.current = isStartingOver;
  }, [isStartingOver]);
  
  useEffect(() => {
    loadingRefForTimeout.current = loading;
    if (loading && loadingStartTimeRef.current === null) {
      loadingStartTimeRef.current = Date.now();
    } else if (!loading) {
      loadingStartTimeRef.current = null;
    }
  }, [loading]);
  
  useEffect(() => {
    questionnaireStateRef.current = questionnaire;
  }, [questionnaire]);
  
  useEffect(() => {
    loadingStateRef.current = loading;
  }, [loading]);
  
  useEffect(() => {
    questionnaireForCallbackRef.current = questionnaire;
  }, [questionnaire]);
  
  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
        saveProgressTimeoutRef.current = null;
      }
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, []);
  
  return {
    // Основные состояния
    questionnaire,
    setQuestionnaire,
    loading,
    setLoading,
    error,
    setError,
    
    // Навигация
    currentQuestionIndex,
    setCurrentQuestionIndex,
    currentQuestionIndexRef,
    currentInfoScreenIndex,
    setCurrentInfoScreenIndex,
    currentInfoScreenIndexRef,
    
    // Ответы
    answers,
    setAnswers,
    
    // UI состояния
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
    
    // Прогресс
    savedProgress,
    setSavedProgress,
    
    // Retake состояния
    isRetakingQuiz,
    setIsRetakingQuiz,
    showRetakeScreen,
    setShowRetakeScreen,
    hasRetakingPayment,
    setHasRetakingPayment,
    hasFullRetakePayment,
    setHasFullRetakePayment,
    
    // Resume состояния
    hasResumed,
    setHasResumed,
    hasResumedRef,
    
    // User preferences
    userPreferencesData,
    setUserPreferencesData,
    
    // Start over состояния
    isStartingOver,
    setIsStartingOver,
    isStartingOverRef,
    daysSincePlanGeneration,
    setDaysSincePlanGeneration,
    
    // Debug состояния
    debugLogs,
    setDebugLogs,
    showDebugPanel,
    setShowDebugPanel,
    
    // Auto submit
    autoSubmitTriggered,
    setAutoSubmitTriggered,
    autoSubmitTriggeredRef,
    
    // Refs для синхронизации
    questionnaireRef,
    isMountedRef,
    redirectTimeoutRef,
    submitAnswersRef,
    saveProgressTimeoutRef,
    lastSavedAnswerRef,
    pendingProgressRef,
    progressLoadedRef,
    loadingRefForTimeout,
    loadingStartTimeRef,
    initCompletedRef,
    
    // Refs для синхронизации с State Machine и React Query
    lastSyncedFromQueryIdRef,
    setQuestionnaireInStateMachineRef,
    questionnaireForCallbackRef,
    lastSyncedQuestionnaireIdRef,
    lastSyncedQuestionnaireRef,
    isSyncingRef,
    lastLoadingResetIdRef,
    questionnaireStateRef,
    loadingStateRef,
    stateMachineQuestionnaireRef,
    stateMachineQuestionnaireIdRef,
  };
}


