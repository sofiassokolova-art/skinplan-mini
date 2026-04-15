// app/(miniapp)/quiz/components/QuizProvider.tsx
// Провайдер состояния квиза - вынесен из page.tsx для разделения ответственности

'use client';

import React, { createContext, useContext, useCallback, memo, useRef, useEffect } from 'react';
import { useQuizStateMachine } from '@/lib/quiz/hooks/useQuizStateMachine';
import { useQuizStateExtended } from '@/lib/quiz/hooks/useQuizStateExtended';
import { useQuestionnaire, useQuizProgress, useSaveQuizProgress } from '@/hooks/useQuiz';
import { useTelegram } from '@/lib/telegram-client';
import { clientLogger } from '@/lib/client-logger';

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