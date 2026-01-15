// app/(miniapp)/quiz/components/QuizPageContent.tsx
// Компонент для рендеринга основного контента страницы анкеты

'use client';

import { QuizDebugPanel } from './QuizDebugPanel';
import { QuizQuestionState } from './QuizQuestionState';
import { QuizQuestion } from './QuizQuestion';
import { QuizFinalizingLoader } from './QuizFinalizingLoader';
import type { Question } from '@/lib/quiz/types';

interface QuizPageContentProps {
  backgroundColor: string;
  isDev: boolean;
  showDebugPanel: boolean;
  debugLogs: Array<{ time: string; message: string; data?: any }>;
  setShowDebugPanel: (show: boolean) => void;
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  currentInfoScreenIndex: number;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  isPastInitialScreens: boolean;
  allQuestionsLength: number;
  initialInfoScreensLength: number;
  isShowingInitialInfoScreen: boolean;
  loading: boolean;
  questionnaire: any;
  questionnaireRef: React.MutableRefObject<any>;
  quizStateMachineQuestionnaire: any;
  pendingInfoScreen: any;
  showResumeScreen: boolean;
  hasResumed: boolean;
  answers: Record<string, any>;
  isRetakingQuiz: boolean;
  isSubmitting: boolean;
  onAnswer: (questionId: number, value: string | string[]) => Promise<void>;
  onNext: () => void;
  onSubmit: () => Promise<void>;
  onBack: () => void;
  finalizing: boolean;
  finalizingStep: 'answers' | 'plan' | 'done';
  finalizeError: string | null;
}

/**
 * Компонент для рендеринга основного контента страницы анкеты
 */
export function QuizPageContent({
  backgroundColor,
  isDev,
  showDebugPanel,
  debugLogs,
  setShowDebugPanel,
  currentQuestion,
  currentQuestionIndex,
  currentInfoScreenIndex,
  currentInfoScreenIndexRef,
  isPastInitialScreens,
  allQuestionsLength,
  initialInfoScreensLength,
  isShowingInitialInfoScreen,
  loading,
  questionnaire,
  questionnaireRef,
  quizStateMachineQuestionnaire,
  pendingInfoScreen,
  showResumeScreen,
  hasResumed,
  answers,
  isRetakingQuiz,
  isSubmitting,
  onAnswer,
  onNext,
  onSubmit,
  onBack,
  finalizing,
  finalizingStep,
  finalizeError,
}: QuizPageContentProps) {
  const isGoalsScreen = currentQuestion?.code === 'skin_goals' && currentQuestion?.type === 'multi_choice';

  return (
    <div style={{ 
      padding: '20px',
      minHeight: '100vh',
      background: backgroundColor,
      position: 'relative',
    }}>
      {/* РЕФАКТОРИНГ: Используем компонент QuizDebugPanel */}
      {(process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true') && (
        <QuizDebugPanel
          showDebugPanel={showDebugPanel}
          debugLogs={debugLogs}
          onToggle={() => setShowDebugPanel(!showDebugPanel)}
        />
      )}
      {/* Контейнер вопроса - все вопросы без blur, белый фон */}
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: isGoalsScreen ? '0' : '24px',
      }}>
        {/* РЕФАКТОРИНГ: Используем компонент QuizQuestionState для отображения состояний */}
        <QuizQuestionState
          currentQuestion={currentQuestion}
          currentQuestionIndex={currentQuestionIndex}
          currentInfoScreenIndex={currentInfoScreenIndex}
          currentInfoScreenIndexRef={currentInfoScreenIndexRef}
          isPastInitialScreens={isPastInitialScreens}
          allQuestionsLength={allQuestionsLength}
          initialInfoScreensLength={initialInfoScreensLength}
          isShowingInitialInfoScreen={isShowingInitialInfoScreen}
          loading={loading}
          questionnaire={questionnaire}
          questionnaireRef={questionnaireRef}
          quizStateMachineQuestionnaire={quizStateMachineQuestionnaire}
          pendingInfoScreen={pendingInfoScreen}
          showResumeScreen={showResumeScreen}
          hasResumed={hasResumed}
          isDev={isDev}
        />
        {/* РЕФАКТОРИНГ: Используем компонент QuizQuestion для рендеринга вопроса */}
        {currentQuestion && currentQuestion.id && (
          <QuizQuestion
            question={currentQuestion}
            currentQuestionIndex={currentQuestionIndex}
            allQuestionsLength={allQuestionsLength}
            answers={answers}
            isRetakingQuiz={isRetakingQuiz}
            isSubmitting={isSubmitting}
            onAnswer={onAnswer}
            onNext={onNext}
            onSubmit={onSubmit}
            onBack={onBack}
            showBackButton={currentQuestionIndex > 0 || currentInfoScreenIndex > 0}
          />
        )}
      </div>
      
      {/* РЕФАКТОРИНГ: Используем компонент QuizFinalizingLoader */}
      <QuizFinalizingLoader
        finalizing={finalizing}
        finalizingStep={finalizingStep}
        finalizeError={finalizeError}
      />
    </div>
  );
}
