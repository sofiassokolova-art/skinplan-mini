// app/(miniapp)/quiz/page.tsx
// Страница анкеты - рефакторинг с разделением на компоненты

'use client';

import { useState } from 'react';
import { QuizProvider } from './components/QuizProvider';
import { QuizRenderer } from './components/QuizRenderer';
import { QuizErrorBoundary } from '@/components/QuizErrorBoundary';
import { useQuizEngine } from './hooks/useQuizEngine';

function QuizPageContent() {
  // Debug state - currently unused but kept for future debugging
  const [debugLogs] = useState<Array<{ time: string; message: string; data?: any }>>([]);
  const [showDebugPanel] = useState(false);

  const { screen, currentQuestion, currentInitialInfoScreen, dataError } = useQuizEngine();

  return (
    <QuizRenderer
      screen={screen}
      currentQuestion={currentQuestion}
      currentInitialInfoScreen={currentInitialInfoScreen}
      debugLogs={debugLogs}
      showDebugPanel={showDebugPanel}
      dataError={dataError}
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
