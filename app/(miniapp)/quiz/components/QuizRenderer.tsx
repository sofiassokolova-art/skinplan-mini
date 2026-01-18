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
    daysSincePlanGeneration,
    setDaysSincePlanGeneration,
    userPreferencesData,
    setUserPreferencesData,
    currentInitialInfoScreen,
    initialInfoScreens,
    isShowingInitialInfoScreen,
    isLoadingProgress,
    progressLoaded,
    resumeLocked,
    quizStateMachine
  } = quizState;

  // TODO: Implement handlers
  const handleNext = () => Promise.resolve();
  const submitAnswers = () => Promise.resolve();
  const handleBack = () => {};

  const { data: questionnaireFromQuery } = questionnaireQuery;
  const { data: quizProgressFromQuery } = progressQuery;

  // Check for errors
  const quizErrors = checkQuizErrors({
    questionnaire,
    questionnaireFromQuery,
    progressQuery,
    loading,
    error,
  });

  if (quizErrors.length > 0) {
    return (
      <QuizErrorScreen
        errors={quizErrors}
        isDev={isDev}
        debugLogs={debugLogs}
      />
    );
  }

  // Initial loader
  if (shouldShowInitialLoader({
    questionnaire,
    questionnaireFromQuery,
    progressQuery,
    loading,
    isLoadingProgress,
    progressLoaded,
    currentQuestion,
    isShowingInitialInfoScreen,
    currentInitialInfoScreen,
    initialInfoScreens,
    currentInfoScreenIndex,
    isRetakingQuiz,
    pendingInfoScreen,
    savedProgress,
    initCompleted,
  })) {
    return <QuizInitialLoader />;
  }

  // Finalizing loader
  if (finalizing) {
    return (
      <QuizFinalizingLoader
        step={finalizingStep}
        error={finalizeError}
        onRetry={() => {
          setFinalizing(false);
          setFinalizeError(null);
          submitAnswers();
        }}
      />
    );
  }

  // Retake screen
  if (screen === 'RETAKE') {
    return (
      <QuizRetakeScreen
        hasFullRetakePayment={hasFullRetakePayment}
        setHasFullRetakePayment={setHasFullRetakePayment}
        isStartingOver={isStartingOver}
        setIsStartingOver={setIsStartingOver}
        isStartingOverRef={isStartingOverRef}
        daysSincePlanGeneration={daysSincePlanGeneration}
        setDaysSincePlanGeneration={setDaysSincePlanGeneration}
        userPreferencesData={userPreferencesData}
        setUserPreferencesData={setUserPreferencesData}
        handleNext={handleNext}
        isDev={isDev}
        debugLogs={debugLogs}
      />
    );
  }

  // Resume screen
  if (screen === 'RESUME') {
    return (
      <QuizResumeScreen
        savedProgress={savedProgress}
        setSavedProgress={setSavedProgress}
        isRetakingQuiz={isRetakingQuiz}
        setIsRetakingQuiz={setIsRetakingQuiz}
        showRetakeScreen={showRetakeScreen}
        setShowRetakeScreen={setShowRetakeScreen}
        hasResumed={hasResumed}
        setHasResumed={setHasResumed}
        hasResumedRef={hasResumedRef}
        handleNext={handleNext}
        isDev={isDev}
        debugLogs={debugLogs}
      />
    );
  }

  // Info screens
  if (screen === 'INFO') {
    // Проверить, является ли pendingInfoScreen начальным экраном
    const isPendingInitialScreen = pendingInfoScreen ? initialInfoScreens.some(screen => screen.id === pendingInfoScreen.id) : false;

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

  // Initial info screens
  if (screen === 'INITIAL_INFO') {
    return (
      <QuizInfoScreen
        screen={currentInitialInfoScreen!}
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
        handleBack={handleBack}
        isInitialInfoScreen={true}
      />
    );
  }

  // Question screen
  const isQuestionScreen = isQuestionScreenUtil(currentQuestion, pendingInfoScreen, resumeLocked, showRetakeScreen);
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