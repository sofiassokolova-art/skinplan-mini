// app/(miniapp)/quiz/components/QuizPageContent.tsx
// Компонент для рендеринга основного контента страницы анкеты

'use client';

import type React from 'react';
import { Suspense, lazy } from 'react';
import { QuizDebugPanel } from './QuizDebugPanel';
import { QuizQuestionState } from './QuizQuestionState';
import { QuizFinalizingLoader } from './QuizFinalizingLoader';
import type { Question } from '@/lib/quiz/types';

// Lazy loading для тяжелого компонента QuizQuestion
const QuizQuestion = lazy(() => import('./QuizQuestion').then(mod => ({ default: mod.QuizQuestion })));

interface QuizPageContentProps {
  backgroundColor: string;
  showDebugPanel: boolean;
  debugLogs: Array<{ time: string; message: string; data?: any }>;
  setShowDebugPanel: (show: boolean) => void;
  children?: React.ReactNode;
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
  showResumeScreen: boolean;
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
export function QuizPageContent(props: QuizPageContentProps) {
  const {
    backgroundColor,
    showDebugPanel,
    debugLogs,
    setShowDebugPanel,
    children,
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
    showResumeScreen,
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
  } = props;

  // Экраны с лаймовым контейнером во всю ширину
  const isGoalsScreen =
    currentQuestion?.code === 'skin_goals' && currentQuestion?.type === 'multi_choice';

  // skin_type может быть single_choice или multi_choice
  const isSkinTypeScreen = currentQuestion?.code === 'skin_type';

  // Верстка "во всю ширину"
  const isLimeFullWidthScreen = isGoalsScreen || isSkinTypeScreen;

  const shouldShowDevTools =
    process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true';

  const shouldShowQuestion =
    Boolean(currentQuestion?.id) && !isShowingInitialInfoScreen && !showResumeScreen;

  return (
    <div
      style={{
        padding: isLimeFullWidthScreen ? '0' : '20px',
        minHeight: '100vh',
        background: backgroundColor,
        position: 'relative',
      }}
    >
      {shouldShowDevTools && (
        <QuizDebugPanel
          showDebugPanel={showDebugPanel}
          debugLogs={debugLogs}
          onToggle={() => setShowDebugPanel(!showDebugPanel)}
        />
      )}

      {/* Контейнер вопроса */}
      <div
        style={{
          maxWidth: isLimeFullWidthScreen ? '100%' : '600px',
          margin: isLimeFullWidthScreen ? '0' : '0 auto',
          padding: isLimeFullWidthScreen ? '0' : '24px',
          minHeight: isLimeFullWidthScreen ? '100vh' : 'auto',
        }}
      >
        <QuizQuestionState
          currentQuestion={currentQuestion}
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
        />

        {shouldShowQuestion && (
          <Suspense fallback={<div>Loading question...</div>}>
            <QuizQuestion
              question={currentQuestion as Question}
              currentQuestionIndex={currentQuestionIndex}
              allQuestionsLength={allQuestionsLength}
              answers={answers}
              isRetakingQuiz={isRetakingQuiz}
              isSubmitting={isSubmitting}
              onAnswer={onAnswer}
              onNext={onNext}
              onSubmit={onSubmit}
              onBack={onBack}
              showBackButton={
                currentQuestionIndex > 0 || isPastInitialScreens
              }
            />
          </Suspense>
        )}
      </div>

      {children}

      <QuizFinalizingLoader
        finalizing={finalizing}
        finalizingStep={finalizingStep}
        finalizeError={finalizeError}
      />
    </div>
  );
}
