// app/(miniapp)/quiz/components/QuizRenderer.tsx
// Компонент для рендеринга разных экранов квиза - вынесен из page.tsx

'use client';

import React, { Suspense, lazy } from 'react';
import { useQuizContext } from './QuizProvider';
import { ScreenErrorBoundary, QuestionErrorBoundary, QuizErrorBoundary } from '@/components/QuizErrorBoundary';

// Lazy loading для тяжелых компонентов
const QuizInfoScreen = lazy(() => import('./QuizInfoScreen').then(mod => ({ default: mod.QuizInfoScreen })));
const QuizQuestion = lazy(() => import('./QuizQuestion').then(mod => ({ default: mod.QuizQuestion })));
const QuizResumeScreen = lazy(() => import('./QuizResumeScreen').then(mod => ({ default: mod.QuizResumeScreen })));
const QuizRetakeScreen = lazy(() => import('./QuizRetakeScreen').then(mod => ({ default: mod.QuizRetakeScreen })));

// Не ленивые импорты для часто используемых компонентов
import { QuizInitialLoader } from './QuizInitialLoader';
import { checkQuizErrors } from './QuizErrorChecker';
import { QuizPageContent } from './QuizPageContent';
import { QuizErrorScreen } from './QuizErrorScreen';
import { QuizFinalizingLoader } from './QuizFinalizingLoader';

import {
  shouldShowInitialLoader,
  getQuizBackgroundColor,
  isQuestionScreen as isQuestionScreenUtil,
} from '@/lib/quiz/utils/quizRenderHelpers';

import type { Question } from '@/lib/quiz/types';

type Screen = 'LOADER' | 'ERROR' | 'RETAKE' | 'RESUME' | 'INFO' | 'INITIAL_INFO' | 'QUESTION';

interface QuizRendererProps {
  screen: Screen;
  currentQuestion: Question | null;
  debugLogs: Array<{ time: string; message: string; data?: any }>;
  showDebugPanel: boolean;
}

export function QuizRenderer({
  screen,
  currentQuestion,
  debugLogs,
  showDebugPanel
}: QuizRendererProps) {
  const {
    quizState,
    questionnaireQuery,
    progressQuery,
    isDev
  } = useQuizContext();

  const {
    questionnaire,
    questionnaireRef,
    loading,
    setLoading,
    error,
    setError,
    currentInfoScreenIndex,
    setCurrentInfoScreenIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    setAnswers,
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
    savedProgress,
    setSavedProgress,
    isRetakingQuiz,
    setIsRetakingQuiz,
    showRetakeScreen,
    setShowRetakeScreen,
    hasFullRetakePayment,
    setHasFullRetakePayment,
    hasResumed,
    setHasResumed,
    hasResumedRef,
    isStartingOver,
    setIsStartingOver,
    isStartingOverRef,
    initCompleted,
    setInitCompleted,
    initCompletedRef,
    userPreferencesData,
    setUserPreferencesData
  } = quizState;

  // TODO: Implement handlers
  const handleNext = () => Promise.resolve();
  const submitAnswers = () => Promise.resolve();
  const handleBack = () => {};

  const { data: questionnaireFromQuery } = questionnaireQuery;
  const { data: quizProgressFromQuery } = progressQuery;

  // TODO: Implement error checking
  // const quizErrors = checkQuizErrors({
  //   questionnaire,
  //   questionnaireRef,
  //   allQuestionsRaw: [],
  //   allQuestions: [],
  //   answers,
  //   loading,
  //   error,
  //   isRetakingQuiz,
  //   showRetakeScreen,
  //   currentQuestion,
  //   showResumeScreen,
  //   isShowingInitialInfoScreen: false,
  //   pendingInfoScreen,
  //   hasResumed,
  // });

  // if (quizErrors.length > 0) {
  //   return (
  //     <QuizErrorScreen
  //       errors={quizErrors}
  //       isDev={isDev}
  //       debugLogs={debugLogs}
  //     />
  //   );
  // }

  // TODO: Implement initial loader logic
  // if (shouldShowInitialLoader({...})) {
  //   return <QuizInitialLoader />;
  // }

  // Finalizing loader
  if (finalizing) {
    return (
      <QuizFinalizingLoader
        finalizing={true}
        finalizingStep={finalizingStep}
        finalizeError={finalizeError}
      />
    );
  }

  // TODO: Implement retake screen
  // if (screen === 'RETAKE') {
  //   return <QuizRetakeScreen {...} />;
  // }

  // TODO: Implement resume screen
  // if (screen === 'RESUME' && savedProgress) {
  //   return <QuizResumeScreen {...} />;
  // }

  // Info screens
  if (screen === 'INFO') {
    // TODO: Проверить, является ли pendingInfoScreen начальным экраном
    const isPendingInitialScreen = false;

    return (
      <ScreenErrorBoundary componentName="InfoScreen">
        <Suspense fallback={<div>Loading info screen...</div>}>
          <QuizInfoScreen
            screen={pendingInfoScreen!}
            currentInfoScreenIndex={currentInfoScreenIndex}
            questionnaire={questionnaireFromQuery || questionnaireRef.current || questionnaire}
            questionnaireRef={questionnaireRef}
            error={error}
            isSubmitting={isSubmitting}
            isHandlingNext={false} // Will be passed from parent
            isDev={isDev}
            handleNextInProgressRef={{ current: false }} // Will be passed from parent
            isSubmittingRef={isSubmittingRef}
            setCurrentInfoScreenIndex={setCurrentInfoScreenIndex}
            setIsSubmitting={setIsSubmitting}
            setError={setError}
            setLoading={setLoading}
            handleNext={handleNext}
            submitAnswers={submitAnswers}
            pendingInfoScreenRef={quizState.pendingInfoScreenRef}
            handleBack={handleBack}
            isInitialInfoScreen={isPendingInitialScreen}
          />
        </Suspense>
      </ScreenErrorBoundary>
    );
  }

  // Initial info screens - TODO: implement when needed
  if (screen === 'INITIAL_INFO') {
    return <div>Initial info screen not implemented</div>;
  }

  // Question screen
  const isQuestionScreen = isQuestionScreenUtil(currentQuestion, pendingInfoScreen, false, showRetakeScreen);
  const backgroundColor = getQuizBackgroundColor(isQuestionScreen);

  return (
    <QuestionErrorBoundary componentName="QuestionScreen">
      <div
        style={{
          minHeight: '100vh',
          backgroundColor,
          paddingTop: '60px',
          paddingBottom: '20px',
        }}
      >
        <div>Question content goes here</div>
      </div>
    </QuestionErrorBoundary>
  );
}