// app/(miniapp)/quiz/components/QuizProvider.tsx
// Провайдер состояния квиза - вынесен из page.tsx для разделения ответственности

'use client';

import React, { createContext, useContext, useCallback, memo } from 'react';
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
}

const QuizContext = createContext<QuizContextType | null>(null);

export const QuizProvider = memo(function QuizProvider({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV === 'development';

  // Telegram init
  const telegram = useTelegram();

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
  const questionnaireQuery = useQuestionnaire();
  const progressQuery = useQuizProgress();
  const saveProgressMutation = useSaveQuizProgress();

  // Global quiz state
  const quizState = useQuizStateExtended();

  const value: QuizContextType = {
    quizStateMachine,
    questionnaireQuery,
    progressQuery,
    saveProgressMutation,
    telegram,
    quizState,
    isDev,
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