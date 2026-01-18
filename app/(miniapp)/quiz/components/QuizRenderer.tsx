// app/(miniapp)/quiz/components/QuizRenderer.tsx
// Компонент для рендеринга разных экранов квиза - вынесен из page.tsx

'use client';

import React from 'react';
import { useQuizContext } from './QuizProvider';
import { QuizInfoScreen } from './QuizInfoScreen';
import { QuizResumeScreen } from './QuizResumeScreen';
import { QuizRetakeScreen } from './QuizRetakeScreen';
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
    <QuizPageContent
      backgroundColor={backgroundColor}
      isDev={isDev}
      showDebugPanel={showDebugPanel}
      debugLogs={debugLogs}
    >
      {/* Question content will be rendered here */}
      <div>Question content goes here</div>
    </QuizPageContent>
  );
}