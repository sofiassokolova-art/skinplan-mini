// app/(miniapp)/quiz/page.tsx
// Страница анкеты - рефакторинг с разделением на компоненты

'use client';

import { useState, useRef } from 'react';
import { QuizProvider } from './components/QuizProvider';
import { QuizRenderer } from './components/QuizRenderer';
import { useQuizScreen } from './hooks/useQuizScreen';
import { useQuizContext } from './components/QuizProvider';
import { useQuizComputed } from '@/lib/quiz/hooks/useQuizComputed';
import { QuizErrorBoundary } from '@/components/QuizErrorBoundary';
import type { Question } from '@/lib/quiz/types';

function QuizPageContent() {
  // Debug state - currently unused but kept for future debugging
  const [debugLogs] = useState<Array<{ time: string; message: string; data?: any }>>([]);
  const [showDebugPanel] = useState(false);

  // Refs for computed hook
  const allQuestionsRawPrevRef = useRef<Question[]>([]);
  const allQuestionsPrevRef = useRef<Question[]>([]);

  const {
    quizState,
    quizStateMachine,
    questionnaireQuery,
    isDev
  } = useQuizContext();

  const {
    questionnaire,
    answers,
    savedProgress,
    currentInfoScreenIndex,
    currentQuestionIndex,
    isRetakingQuiz,
    showRetakeScreen,
    showResumeScreen,
    hasResumed,
    isStartingOver,
    pendingInfoScreen,
    questionnaireRef,
    currentInfoScreenIndexRef,
    pendingInfoScreenRef,
  } = quizState;

  // Current question from computed hook with proper parameters
  const { currentQuestion } = useQuizComputed({
    questionnaire,
    answers,
    savedProgress,
    currentInfoScreenIndex,
    currentQuestionIndex,
    isRetakingQuiz,
    showRetakeScreen,
    showResumeScreen,
    hasResumed,
    isStartingOver,
    pendingInfoScreen,
    isLoadingProgress: false, // TODO: implement proper loading state
    questionnaireRef,
    currentInfoScreenIndexRef,
    allQuestionsRawPrevRef: { current: [] },
    allQuestionsPrevRef: { current: [] },
    pendingInfoScreenRef,
    quizStateMachine,
    isDev,
  });

  // Determine current screen
  const screen = useQuizScreen(currentQuestion);

  return (
    <QuizRenderer
      screen={screen}
      currentQuestion={currentQuestion}
      debugLogs={debugLogs}
      showDebugPanel={showDebugPanel}
    />
  );
}

export default function QuizPage() {
  return (
    <QuizErrorBoundary componentName="QuizProvider">
      <QuizProvider>
        <QuizPageContent />
      </QuizProvider>
    </QuizErrorBoundary>
  );
}
