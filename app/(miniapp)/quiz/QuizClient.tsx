// app/(miniapp)/quiz/QuizClient.tsx
// Клиентское дерево анкеты. Вынесено из page.tsx, чтобы грузиться через
// next/dynamic с ssr:false — тяжёлый SSR этого дерева на cold-start воркере
// Cloudflare застревал на ~середине стрима (ERR_CONNECTION_CLOSED → белый экран
// у новых пользователей, которые с / редиректятся на /quiz). Квиз полностью
// клиентский (sessionStorage, Telegram initData, React Query), поэтому SSR ему
// не нужен — серверный HTML всё равно выбрасывался при гидрации.

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

  const { screen, currentQuestion, allQuestions, allQuestionsLength, currentInitialInfoScreen, dataError } = useQuizEngine();

  return (
    <QuizRenderer
      screen={screen}
      currentQuestion={currentQuestion}
      allQuestions={allQuestions}
      allQuestionsLength={allQuestionsLength}
      currentInitialInfoScreen={currentInitialInfoScreen}
      debugLogs={debugLogs}
      showDebugPanel={showDebugPanel}
      dataError={dataError}
    />
  );
}

export default function QuizClient() {
  return (
    <QuizErrorBoundary componentName="QuizProvider">
      <QuizProvider>
        <QuizPageContent />
      </QuizProvider>
    </QuizErrorBoundary>
  );
}
