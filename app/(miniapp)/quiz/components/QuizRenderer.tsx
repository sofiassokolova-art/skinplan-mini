// app/(miniapp)/quiz/components/QuizRenderer.tsx
// Компонент для рендеринга разных экранов квиза - вынесен из page.tsx

'use client';

import React, { Suspense, lazy, memo, useEffect, useMemo, useCallback } from 'react';
import { useQuizContext } from './QuizProvider';
import { ScreenErrorBoundary, QuestionErrorBoundary, QuizErrorBoundary } from '@/components/QuizErrorBoundary';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

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

// Import handlers
import { handleAnswer } from '@/lib/quiz/handlers/handleAnswer';
import { handleNext as handleNextFn } from '@/lib/quiz/handlers/handleNext';
import { submitAnswers as submitAnswersFn } from '@/lib/quiz/handlers/submitAnswers';
import { handleBack as handleBackFn } from '@/lib/quiz/handlers/handleBack';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';

type Screen = 'LOADER' | 'ERROR' | 'RETAKE' | 'RESUME' | 'INFO' | 'INITIAL_INFO' | 'QUESTION';

interface QuizRendererProps {
  screen: Screen;
  currentQuestion: Question | null;
  debugLogs: Array<{ time: string; message: string; data?: any }>;
  showDebugPanel: boolean;
}

// Preload критических ресурсов при загрузке компонента
const preloadCriticalResources = () => {
  // Preload основных компонентов квиза
  if (typeof window !== 'undefined') {
    // Preload основных шрифтов
    const fontLink = document.createElement('link');
    fontLink.rel = 'preload';
    fontLink.href = '/fonts/inter-var.woff2';
    fontLink.as = 'font';
    fontLink.type = 'font/woff2';
    fontLink.crossOrigin = 'anonymous';
    document.head.appendChild(fontLink);
  }
};

export const QuizRenderer = memo(function QuizRenderer({
  screen,
  currentQuestion,
  debugLogs,
  showDebugPanel
}: QuizRendererProps) {
  console.log('🎨 [QuizRenderer] rendering', {
    screen,
    currentQuestionId: currentQuestion?.id,
    currentQuestionCode: currentQuestion?.code,
    currentQuestionText: currentQuestion?.text?.substring(0, 50),
    showDebugPanel
  });

  const {
    quizState,
    questionnaireQuery,
    progressQuery,
    isDev
  } = useQuizContext();

  // Деструктуризация из quizState
  const {
    questionnaire,
    questionnaireRef,
    pendingInfoScreen,
    currentInfoScreenIndex,
    answers,
    showResumeScreen,
    isSubmitting,
    setIsSubmitting,
    isSubmittingRef,
    finalizing,
    finalizingStep,
    finalizeError,
    savedProgress,
    isRetakingQuiz,
    showRetakeScreen,
    hasResumed,
    error,
    setError,
    setCurrentInfoScreenIndex,
    setCurrentQuestionIndex,
    setLoading,
    setFinalizing,
    setFinalizingStep,
    setFinalizeError,
    setPendingInfoScreen,
    setSavedProgress,
    setIsRetakingQuiz,
    setShowRetakeScreen,
    setHasFullRetakePayment,
    setAnswers,
    setShowResumeScreen,
    hasFullRetakePayment,
    initCompleted,
    setInitCompleted,
    currentQuestionIndex,
  } = quizState;

  // Мониторинг производительности
  usePerformanceMonitor('QuizRenderer', isDev);

  // Preload критических ресурсов при монтировании
  useEffect(() => {
    preloadCriticalResources();
  }, []);

  // Мемоизация вычислений для оптимизации рендеринга
  const memoizedValues = useMemo(() => {
    const isQuestionScreen = isQuestionScreenUtil(currentQuestion, pendingInfoScreen, false, showRetakeScreen);
    const backgroundColor = getQuizBackgroundColor(isQuestionScreen);
    const effectiveQuestionnaire = questionnaireQuery.data;
    const allQuestions = effectiveQuestionnaire ? extractQuestionsFromQuestionnaire(effectiveQuestionnaire) : [];
    const allQuestionsLength = allQuestions.length;

    return {
      isQuestionScreen,
      backgroundColor,
      questionnaireFromQuery: questionnaireQuery.data,
      quizProgressFromQuery: progressQuery.data,
      allQuestions,
      allQuestionsLength,
    };
  }, [
    currentQuestion,
    pendingInfoScreen,
    showRetakeScreen,
    questionnaireQuery.data,
    progressQuery.data,
  ]);

  const { isQuestionScreen, backgroundColor, questionnaireFromQuery, quizProgressFromQuery, allQuestions, allQuestionsLength } = memoizedValues;


  // Create handlers
  const onAnswer = useCallback(async (questionId: number, value: string | string[]) => {
    console.log('📝 [QuizRenderer] onAnswer called', {
      questionId,
      value,
      valueType: Array.isArray(value) ? 'array' : 'string',
      currentQuestionId: currentQuestion?.id
    });
    // TODO: implement onAnswer
  }, [currentQuestion]);

  const onNext = useCallback(async () => {
    console.log('➡️ [QuizRenderer] onNext called', {
      currentQuestionIndex,
      allQuestionsLength,
      currentQuestionId: currentQuestion?.id
    });
    // TODO: implement onNext
  }, [currentQuestionIndex, allQuestionsLength, currentQuestion]);

  const onSubmit = useCallback(async () => {
    console.log('✅ [QuizRenderer] onSubmit called', {
      answersCount: Object.keys(answers).length,
      isSubmitting,
      currentQuestionIndex,
      allQuestionsLength
    });
    // TODO: implement onSubmit
  }, [answers, isSubmitting, currentQuestionIndex, allQuestionsLength]);

  const onBack = useCallback(() => {
    console.log('⬅️ [QuizRenderer] onBack called', {
      currentQuestionIndex,
      canGoBack: currentQuestionIndex > 0,
      currentQuestionId: currentQuestion?.id
    });
    // TODO: implement onBack
  }, [currentQuestionIndex, currentQuestion]);

  // Используем memoized значения

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

  // Loader screen - показывается когда данные еще загружаются
  if (screen === 'LOADER') {
    console.log('⏳ [QuizRenderer] rendering LOADER screen');
    return <QuizInitialLoader />;
  }

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
    console.log('📄 [QuizRenderer] rendering INFO screen', {
      pendingInfoScreen,
      currentInfoScreenIndex,
      questionnaireFromQuery: !!questionnaireFromQuery,
      isSubmitting
    });

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
            handleNext={onNext}
            submitAnswers={onSubmit}
            pendingInfoScreenRef={quizState.pendingInfoScreenRef}
            handleBack={onBack}
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

  // Question screen - используем memoized значения
  console.log('❓ [QuizRenderer] rendering QUESTION screen', {
    currentQuestion: !!currentQuestion,
    currentQuestionId: currentQuestion?.id,
    currentQuestionIndex,
    allQuestionsLength,
    answersCount: Object.keys(answers).length,
    isRetakingQuiz,
    isSubmitting,
    backgroundColor
  });

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
        <Suspense fallback={<div>Loading question...</div>}>
          <QuizQuestion
            question={currentQuestion!}
            currentQuestionIndex={currentQuestionIndex}
            allQuestionsLength={allQuestionsLength}
            answers={answers}
            isRetakingQuiz={isRetakingQuiz}
            isSubmitting={isSubmitting}
            onAnswer={onAnswer}
            onNext={onNext}
            onSubmit={onSubmit}
            onBack={onBack}
            showBackButton={currentQuestionIndex > 0}
          />
        </Suspense>
      </div>
    </QuestionErrorBoundary>
  );
});