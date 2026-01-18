// app/(miniapp)/quiz/page.tsx
// Страница анкеты - рефакторинг с разделением на компоненты

'use client';

import { useState } from 'react';
import { QuizProvider } from './components/QuizProvider';
import { QuizRenderer } from './components/QuizRenderer';
import { useQuizScreen } from './hooks/useQuizScreen';
import { useQuizComputed } from '@/lib/quiz/hooks/useQuizComputed';
import type { Question } from '@/lib/quiz/types';

function QuizPageContent() {
  // Debug state
  const [debugLogs, setDebugLogs] = useState<Array<{ time: string; message: string; data?: any }>>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // Current question from computed hook
  const { currentQuestion } = useQuizComputed();

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
    <QuizProvider>
      <QuizPageContent />
    </QuizProvider>
  );
}
