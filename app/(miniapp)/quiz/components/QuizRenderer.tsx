// app/(miniapp)/quiz/components/QuizRenderer.tsx
// Компонент для рендеринга разных экранов квиза - вынесен из page.tsx

'use client';

import React, { Suspense, lazy, memo, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';

import type { Question } from '@/lib/quiz/types';

// Import handlers
import { handleAnswer } from '@/lib/quiz/handlers/handleAnswer';
import { handleNext } from '@/lib/quiz/handlers/handleNext';
import { submitAnswers } from '@/lib/quiz/handlers/submitAnswers';
import { handleBack } from '@/lib/quiz/handlers/handleBack';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';

type Screen = 'LOADER' | 'ERROR' | 'RETAKE' | 'RESUME' | 'INFO' | 'INITIAL_INFO' | 'QUESTION';

interface QuizRendererProps {
  screen: Screen;
  currentQuestion: Question | null;
  currentInitialInfoScreen?: any; // Для INITIAL_INFO экрана
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
  currentInitialInfoScreen,
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
    saveProgressMutation,
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

  // Дополнительное логгирование после деструктуризации
  console.log('🎨 [QuizRenderer] state destructured', {
    currentInfoScreenIndex,
    currentQuestionIndex
  });

  // Функция для сохранения прогресса - мемоизируем чтобы избежать перерендеринга
  const saveProgress = useCallback(async (answers: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => {
    return await saveProgressMutation.mutateAsync({
      questionnaireId: questionnaire?.id || 0,
      questionId: 0, // Not used for progress saving
      answerValue: undefined,
      answerValues: undefined,
      questionIndex,
      infoScreenIndex,
    });
  }, [saveProgressMutation, questionnaire?.id]);

  // Мониторинг производительности - временно отключен для отладки
  // usePerformanceMonitor('QuizRenderer', isDev);

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
    currentQuestion?.id, // Используем только стабильные свойства вместо всего объекта
    pendingInfoScreen?.id,
    showRetakeScreen,
    questionnaireQuery.data?.id, // Используем только ID вместо всего объекта
    progressQuery.data?.id,
  ]);

  const { isQuestionScreen, backgroundColor, questionnaireFromQuery, quizProgressFromQuery, allQuestions, allQuestionsLength } = memoizedValues;


  // Refs for handleNext/handleBack
  const handleNextInProgressRef = useRef(false);
  const initInProgressRef = useRef(false);

  // Functions for handleNext
  const setIsHandlingNext = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const newValue = typeof value === 'function' ? value(handleNextInProgressRef.current) : value;
    handleNextInProgressRef.current = newValue;
  }, []);

  const loadQuestionnaire = useCallback(async () => {
    // This should trigger questionnaire loading through React Query
    // For now, return current questionnaire
    return questionnaire;
  }, [questionnaire]);

  // Create handlers
  const onAnswer = useCallback(async (questionId: number, value: string | string[]) => {
    try {
      await handleAnswer({
        questionId,
        value,
        currentQuestion,
        answers,
        allQuestions,
        questionnaire,
        setAnswers,
        saveProgress,
        currentQuestionIndex,
        currentInfoScreenIndex,
        saveQuizProgressMutation: saveProgressMutation,
        lastSavedAnswerRef: quizState.lastSavedAnswerRef,
        setCurrentQuestionIndex,
        currentQuestionIndexRef: quizState.currentQuestionIndexRef,
        scopedStorageKeys: { CURRENT_QUESTION_CODE: QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE },
        scope: 'default',
      });
    } catch (err) {
      console.error('❌ [QuizRenderer] Error in onAnswer:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении ответа');
    }
  }, [
    currentQuestion,
    answers,
    allQuestions,
    questionnaire,
    setAnswers,
    saveProgress,
    currentQuestionIndex,
    currentInfoScreenIndex,
    saveProgressMutation,
    quizState.lastSavedAnswerRef,
    setCurrentQuestionIndex,
    quizState.currentQuestionIndexRef,
    setError,
  ]);

  const onNext = useCallback(async () => {
    console.log('🎯 [QuizRenderer] onNext called from button click', {
      currentInfoScreenIndex,
      currentQuestionIndex,
      screen
    });
    try {
      await handleNext({
        handleNextInProgressRef,
        currentInfoScreenIndexRef: quizState.currentInfoScreenIndexRef,
        currentQuestionIndexRef: quizState.currentQuestionIndexRef,
        questionnaireRef,
        initCompletedRef: quizState.initCompletedRef,
        questionnaire,
        loading: false,
        currentInfoScreenIndex,
        currentQuestionIndex,
        allQuestions,
        isRetakingQuiz,
        showRetakeScreen,
        hasResumed,
        pendingInfoScreen,
        pendingInfoScreenRef: quizState.pendingInfoScreenRef,
        answers,
        setIsHandlingNext,
        setCurrentInfoScreenIndex,
        setCurrentQuestionIndex,
        setPendingInfoScreen,
        setLoading,
        setError,
        saveProgress,
        loadQuestionnaire,
        initInProgressRef,
        isDev,
      });
    } catch (err) {
      console.error('❌ [QuizRenderer] Error in onNext:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при переходе к следующему шагу');
    }
  }, [
    quizState.currentInfoScreenIndexRef,
    quizState.currentQuestionIndexRef,
    questionnaireRef,
    quizState.initCompletedRef,
    questionnaire,
    currentInfoScreenIndex,
    currentQuestionIndex,
    allQuestions,
    isRetakingQuiz,
    showRetakeScreen,
    hasResumed,
    pendingInfoScreen,
    quizState.pendingInfoScreenRef,
    answers,
    setCurrentInfoScreenIndex,
    setCurrentQuestionIndex,
    setPendingInfoScreen,
    setAnswers,
    setLoading,
    setError,
    saveProgress,
    saveProgressMutation,
    quizState.lastSavedAnswerRef,
    isDev,
  ]);

  const onSubmit = useCallback(async () => {
    try {
      await submitAnswers({
        answers,
        questionnaire,
        isSubmitting,
        isSubmittingRef,
        isMountedRef: { current: true }, // Will be passed from parent
        initData: null, // Will be passed from parent
        setAnswers,
        setIsSubmitting,
        setLoading,
        setError,
        setFinalizing,
        setFinalizingStep,
        setFinalizeError,
        redirectInProgressRef: { current: false }, // Will be passed from parent
        submitAnswersRef: { current: null }, // Will be passed from parent
        isRetakingQuiz,
        getInitData: async () => null, // Will be passed from parent
        scopedStorageKeys: {
          JUST_SUBMITTED: QUIZ_CONFIG.STORAGE_KEYS.JUST_SUBMITTED,
        },
        isDev,
      });
    } catch (err) {
      console.error('❌ [QuizRenderer] Error in onSubmit:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при отправке ответов');
    }
  }, [
    answers,
    allQuestions,
    questionnaire,
    setIsSubmitting,
    isSubmittingRef,
    saveProgressMutation,
    setError,
    setLoading,
    setFinalizing,
    setFinalizingStep,
    setFinalizeError,
    setAnswers,
    questionnaireRef,
    setCurrentQuestionIndex,
    setCurrentInfoScreenIndex,
    setPendingInfoScreen,
    setSavedProgress,
    setHasFullRetakePayment,
    saveProgress,
    quizState.lastSavedAnswerRef,
    quizState.currentQuestionIndexRef,
    quizState.currentInfoScreenIndexRef,
    isDev,
  ]);

  const onBack = useCallback(async () => {
    try {
      await handleBack({
        currentQuestionIndex,
        currentInfoScreenIndex,
        allQuestions,
        answers,
        questionnaire,
        setCurrentQuestionIndex,
        setCurrentInfoScreenIndex,
        setPendingInfoScreen,
        setAnswers,
        saveProgress,
        questionnaireRef,
        currentInfoScreenIndexRef: quizState.currentInfoScreenIndexRef,
        pendingInfoScreen,
        handleBackInProgressRef: { current: false }, // Will be passed from parent
        isShowingInitialInfoScreen: screen === 'INITIAL_INFO',
        initialInfoScreensLength: getInitialInfoScreens().length,
        scopedStorageKeys: {
          CURRENT_INFO_SCREEN: QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN,
          CURRENT_QUESTION: QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION,
        },
      });
    } catch (err) {
      console.error('❌ [QuizRenderer] Error in onBack:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при возврате назад');
    }
  }, [
    currentQuestionIndex,
    currentInfoScreenIndex,
    allQuestions,
    answers,
    questionnaire,
    setCurrentQuestionIndex,
    setCurrentInfoScreenIndex,
    setPendingInfoScreen,
    setAnswers,
    saveProgress,
    saveProgressMutation,
    setError,
    setLoading,
    questionnaireRef,
    quizState.currentQuestionIndexRef,
    quizState.currentInfoScreenIndexRef,
    quizState.lastSavedAnswerRef,
    isDev,
  ]);

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
          <ScreenErrorBoundary componentName="QuizInfoScreen">
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
          </ScreenErrorBoundary>
        </Suspense>
      </ScreenErrorBoundary>
    );
  }

  // Initial info screens - показываем начальные инфо-экраны перед вопросами
  if (screen === 'INITIAL_INFO') {
    if (!currentInitialInfoScreen) {
      console.warn('⚠️ [QuizRenderer] INITIAL_INFO screen but no currentInitialInfoScreen');
      return <QuizInitialLoader />;
    }

    console.log('📄 [QuizRenderer] rendering INITIAL_INFO screen', {
      currentInitialInfoScreen: currentInitialInfoScreen?.id,
      currentInfoScreenIndex: quizState.currentInfoScreenIndex,
      currentInfoScreenIndexRef: quizState.currentInfoScreenIndexRef.current,
      questionnaireFromQuery: !!questionnaireFromQuery,
      isSubmitting,
      screen
    });

    return (
      <ScreenErrorBoundary componentName="InitialInfoScreen">
        <Suspense fallback={<div>Loading initial info screen...</div>}>
          <ScreenErrorBoundary componentName="QuizInfoScreen">
            <QuizInfoScreen
            screen={currentInitialInfoScreen}
            currentInfoScreenIndex={quizState.currentInfoScreenIndex}
            questionnaire={questionnaireFromQuery || questionnaireRef.current || questionnaire}
            questionnaireRef={questionnaireRef}
            error={error}
            isSubmitting={isSubmitting}
            isHandlingNext={handleNextInProgressRef.current}
            isDev={isDev}
            handleNextInProgressRef={handleNextInProgressRef}
            isSubmittingRef={isSubmittingRef}
            setCurrentInfoScreenIndex={setCurrentInfoScreenIndex}
            setIsSubmitting={setIsSubmitting}
            setError={setError}
            setLoading={setLoading}
            handleNext={onNext}
            submitAnswers={onSubmit}
            pendingInfoScreenRef={quizState.pendingInfoScreenRef}
            handleBack={onBack}
            isInitialInfoScreen={true}
          />
          </ScreenErrorBoundary>
        </Suspense>
      </ScreenErrorBoundary>
    );
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

  // ФИКС: Проверяем что currentQuestion существует перед рендерингом
  if (!currentQuestion) {
    console.warn('⚠️ [QuizRenderer] currentQuestion is null, showing error screen');
    return (
      <QuizErrorScreen
        title="Ошибка загрузки"
        message="Вопрос не найден. Попробуйте обновить страницу."
      />
    );
  }

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
          <QuestionErrorBoundary componentName="QuizQuestion">
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
            showBackButton={currentQuestionIndex > 0}
          />
          </QuestionErrorBoundary>
        </Suspense>
      </div>
    </QuestionErrorBoundary>
  );
});