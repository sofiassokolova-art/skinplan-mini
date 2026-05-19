// app/(miniapp)/quiz/components/QuizProvider.tsx
// Провайдер состояния квиза - вынесен из page.tsx для разделения ответственности

'use client';

import React, { createContext, useContext, useCallback, memo, useRef, useEffect, useMemo } from 'react';
import { useQuizStateMachine } from '@/lib/quiz/hooks/useQuizStateMachine';
import { useQuizStateExtended } from '@/lib/quiz/hooks/useQuizStateExtended';
import { useQuizRestorePipeline } from '@/lib/quiz/hooks/useQuizRestorePipeline';
import { useResumeScreenLogic } from '@/lib/quiz/hooks/useResumeScreenLogic';
import { useQuestionnaire, useQuizProgress, useSaveQuizProgress } from '@/hooks/useQuiz';
import { useTelegram } from '@/lib/telegram-client';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import type { Question } from '@/lib/quiz/types';

interface QuizContextType {
  // State machine
  quizStateMachine: ReturnType<typeof useQuizStateMachine>;

  // React Query
  questionnaireQuery: ReturnType<typeof useQuestionnaire>;
  progressQuery: ReturnType<typeof useQuizProgress>;
  saveProgressMutation: ReturnType<typeof useSaveQuizProgress>;

  // Telegram
  telegram: ReturnType<typeof useTelegram>;

  // Extended state
  quizState: ReturnType<typeof useQuizStateExtended>;

  // Computed values
  isDev: boolean;

  // Ревизии для оптимизации (вместо stringify)
  answersRevision: number;
  savedProgressRevision: number;
}

const QuizContext = createContext<QuizContextType | null>(null);

export const QuizProvider = memo(function QuizProvider({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV === 'development';

  // Telegram init
  const telegram = useTelegram();

  // Ревизии для оптимизации пересчетов (вместо stringify)
  const answersRevisionRef = useRef(0);
  const savedProgressRevisionRef = useRef(0);

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

  // Прогрев БД при входе на /quiz (если пользователь попал сюда напрямую, пинг с главной мог не выполниться)
  useEffect(() => {
    fetch('/api/ping').catch(() => undefined);
  }, []);

  // React Query
  const questionnaireQuery = useQuestionnaire();
  const progressQuery = useQuizProgress();
  const saveProgressMutation = useSaveQuizProgress();

  // Global quiz state
  const quizState = useQuizStateExtended();

  const scope =
    quizState.questionnaire?.id?.toString() ||
    questionnaireQuery.data?.id?.toString() ||
    'default';

  const scopedStorageKeys = useMemo(
    () => ({
      CURRENT_INFO_SCREEN: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN, scope),
      CURRENT_QUESTION: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION, scope),
      CURRENT_QUESTION_CODE: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE, scope),
      INIT_CALLED: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.INIT_CALLED, scope),
      JUST_SUBMITTED: QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED, scope),
    }),
    [scope],
  );

  const allQuestionsPrevRef = useRef<Question[]>([]);

  const allQuestions = useMemo(() => {
    const effectiveQuestionnaire = questionnaireQuery.data || quizState.questionnaire;
    if (!effectiveQuestionnaire) return [];
    return extractQuestionsFromQuestionnaire(effectiveQuestionnaire);
  }, [questionnaireQuery.data, quizState.questionnaire]);

  // Синхронизация savedProgress с сервером / sessionStorage (раньше был в useQuizEffects, но не был подключён)
  useQuizRestorePipeline({
    scope,
    scopedStorageKeys,
    questionnaire: quizState.questionnaire,
    questionnaireRef: quizState.questionnaireRef,
    questionnaireFromQuery: questionnaireQuery.data ?? null,
    quizProgressFromQuery: progressQuery.data ?? null,
    isLoadingProgress: progressQuery.isLoading,
    allQuestions,
    allQuestionsPrevRef,
    answers: quizState.answers,
    setAnswers: quizState.setAnswers,
    savedProgress: quizState.savedProgress,
    setSavedProgress: quizState.setSavedProgress,
    currentInfoScreenIndex: quizState.currentInfoScreenIndex,
    setCurrentInfoScreenIndex: quizState.setCurrentInfoScreenIndex,
    currentQuestionIndex: quizState.currentQuestionIndex,
    setCurrentQuestionIndex: quizState.setCurrentQuestionIndex,
    answersRef: quizState.answersRef,
    answersCountRef: quizState.answersCountRef,
    currentInfoScreenIndexRef: quizState.currentInfoScreenIndexRef,
    currentQuestionIndexRef: quizState.currentQuestionIndexRef,
    lastRestoredAnswersIdRef: quizState.lastRestoredAnswersIdRef,
    isStartingOver: quizState.isStartingOver,
    isStartingOverRef: quizState.isStartingOverRef,
    hasResumed: quizState.hasResumed,
    hasResumedRef: quizState.hasResumedRef,
    isDev,
  });

  useResumeScreenLogic({
    loading: quizState.loading,
    isLoadingProgress: progressQuery.isLoading,
    isStartingOver: quizState.isStartingOver,
    hasResumed: quizState.hasResumed,
    currentQuestionIndex: quizState.currentQuestionIndex,
    answers: quizState.answers,
    savedProgress: quizState.savedProgress,
    showResumeScreen: quizState.showResumeScreen,
    setShowResumeScreen: quizState.setShowResumeScreen,
  });

  // Завершённая анкета — не показываем резюм-экран
  useEffect(() => {
    if (progressQuery.data?.isCompleted) {
      quizState.setSavedProgress(null);
      quizState.setShowResumeScreen(false);
    }
  }, [progressQuery.data?.isCompleted, quizState.setSavedProgress, quizState.setShowResumeScreen]);

  // Снимаем глобальный loading после загрузки анкеты и прогресса
  useEffect(() => {
    if (!questionnaireQuery.isLoading && !progressQuery.isLoading) {
      quizState.setLoading(false);
      if (!quizState.initCompleted) {
        quizState.setInitCompleted(true);
        quizState.initCompletedRef.current = true;
      }
    }
  }, [
    questionnaireQuery.isLoading,
    progressQuery.isLoading,
    quizState.initCompleted,
    quizState.setLoading,
    quizState.setInitCompleted,
  ]);

  // Обновляем ревизии при изменениях
  useEffect(() => {
    answersRevisionRef.current++;
  }, [quizState.answers]);

  useEffect(() => {
    savedProgressRevisionRef.current++;
  }, [quizState.savedProgress]);

  const value: QuizContextType = {
    quizStateMachine,
    questionnaireQuery,
    progressQuery,
    saveProgressMutation,
    telegram,
    quizState,
    isDev,
    answersRevision: answersRevisionRef.current,
    savedProgressRevision: savedProgressRevisionRef.current,
  };

  return (
    <QuizContext.Provider value={value}>
      {children}
    </QuizContext.Provider>
  );
});

export function useQuizContext() {
  const context = useContext(QuizContext);
  if (!context) {
    throw new Error('useQuizContext must be used within QuizProvider');
  }
  return context;
}