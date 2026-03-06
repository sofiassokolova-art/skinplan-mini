// app/(miniapp)/quiz/components/QuizRenderer.tsx
// Компонент для рендеринга разных экранов квиза - вынесен из page.tsx

'use client';

import React, { Suspense, lazy, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuizContext } from './QuizProvider';
import { ScreenErrorBoundary, QuestionErrorBoundary } from '@/components/QuizErrorBoundary';

// Lazy loading для тяжелых компонентов
const QuizInfoScreen = lazy(() => import('./QuizInfoScreen').then(mod => ({ default: mod.QuizInfoScreen })));
const QuizQuestion = lazy(() => import('./QuizQuestion').then(mod => ({ default: mod.QuizQuestion })));
const QuizResumeScreen = lazy(() => import('./QuizResumeScreen').then(mod => ({ default: mod.QuizResumeScreen })));
const QuizRetakeScreen = lazy(() => import('./QuizRetakeScreen').then(mod => ({ default: mod.QuizRetakeScreen })));

// Не ленивые импорты для часто используемых компонентов
import { QuizInitialLoader } from './QuizInitialLoader';
import { QuizErrorScreen } from './QuizErrorScreen';

import {
  getQuizBackgroundColor,
  isQuestionScreen as isQuestionScreenUtil,
} from '@/lib/quiz/utils/quizRenderHelpers';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';

import type { Question } from '@/lib/quiz/types';

import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import { getInitialInfoScreens, getInfoScreenAfterQuestion } from '@/app/(miniapp)/quiz/info-screens';
import { useQuizHandlers } from '../hooks/useQuizHandlers';
type Screen = 'LOADER' | 'ERROR' | 'RETAKE' | 'RESUME' | 'INFO' | 'INITIAL_INFO' | 'QUESTION';

/** Откладывает рендер QuizResumeScreen до после монтирования — один и тот же вывод на сервере и при первом клиентском рендере (loader), устраняет hydration mismatch. */
function ResumeScreenDeferred(props: {
  savedProgress: any;
  questionnaire: any;
  answers: Record<number, string | string[]>;
  answersRef: React.MutableRefObject<Record<number, string | string[]>>;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  onResume: () => void;
  onStartOver: () => Promise<void>;
  isBusy: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !props.savedProgress) {
    return <QuizInitialLoader />;
  }
  return (
    <Suspense fallback={<QuizInitialLoader />}>
      <ScreenErrorBoundary componentName="QuizResumeScreen">
        <QuizResumeScreen
          savedProgress={props.savedProgress}
          questionnaire={props.questionnaire}
          answers={props.answers}
          isRetakingQuiz={props.isRetakingQuiz}
          showRetakeScreen={props.showRetakeScreen}
          onResume={props.onResume}
          onStartOver={props.onStartOver}
          isBusy={props.isBusy}
        />
      </ScreenErrorBoundary>
    </Suspense>
  );
}

interface QuizRendererProps {
  screen: Screen;
  currentQuestion: Question | null;
  currentInitialInfoScreen?: any; // Для INITIAL_INFO экрана
  debugLogs: Array<{ time: string; message: string; data?: any }>;
  showDebugPanel: boolean;
  dataError?: Error | null; // Информация об ошибке для отображения в ERROR экране
}

// Preload критических ресурсов при загрузке компонента
// Шрифт Inter уже подключается через next/font в layout (inter-regular, inter-semibold, inter-bold).
// Файла inter-var.woff2 в public/fonts нет — не прелоадим, чтобы не было 404.
const preloadCriticalResources = () => {};

const isDevEnv = process.env.NODE_ENV === 'development';
const devLog = (...args: any[]) => {
  if (isDevEnv) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

export const QuizRenderer = memo(function QuizRenderer({
  screen,
  currentQuestion,
  currentInitialInfoScreen,
  debugLogs: _debugLogs,
  showDebugPanel,
  dataError
}: QuizRendererProps) {
  devLog('🎨 [QuizRenderer] rendering', {
    screen,
    currentQuestionId: currentQuestion?.id,
    currentQuestionCode: currentQuestion?.code,
    currentQuestionText: currentQuestion?.text?.substring(0, 50),
    showDebugPanel,
    screenType: typeof screen,
    hasCurrentQuestion: !!currentQuestion,
    currentInitialInfoScreen: currentInitialInfoScreen?.id
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
    setQuestionnaire,
    pendingInfoScreen,
    currentInfoScreenIndex,
    answers,
    showResumeScreen: _showResumeScreen,
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
    hasResumedRef,
    setHasResumed,
    error,
    setError,
    loading,
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
    setHasRetakingPayment,
    setHasFullRetakePayment,
    setAnswers,
    setShowResumeScreen,
    hasFullRetakePayment,
    initCompleted: _initCompleted,
    setInitCompleted,
    currentQuestionIndex,
    isStartingOver,
    setIsStartingOver,
    isStartingOverRef,
    autoSubmitTriggeredRef,
    setAutoSubmitTriggered,
    initCalledRef,
    redirectInProgressRef,
    loadProgressInProgressRef,
    progressLoadInProgressRef,
    loadQuestionnaireInProgressRef,
    loadQuestionnaireAttemptedRef,
    initCompletedRef,
    resumeCompletedRef,
    answersRef,
    answersCountRef,
    lastRestoredAnswersIdRef,
    firstScreenResetRef,
    setIsProgressCleared,
    setUserPreferencesData,
  } = quizState;

  // Дополнительное логгирование после деструктуризации
  devLog('🎨 [QuizRenderer] state destructured', {
    currentInfoScreenIndex,
    currentQuestionIndex
  });

  // Мемоизация вычислений для оптимизации рендеринга
  const memoizedValues = useMemo(() => {
    const isQuestionScreen = isQuestionScreenUtil(currentQuestion, pendingInfoScreen, false, showRetakeScreen);
    const backgroundColor = getQuizBackgroundColor(isQuestionScreen, currentQuestion);
    const effectiveQuestionnaire = questionnaireQuery.data;
    const allQuestions = effectiveQuestionnaire ? extractQuestionsFromQuestionnaire(effectiveQuestionnaire) : [];
    const allQuestionsLength = allQuestions.length;

    return {
      backgroundColor,
      questionnaireFromQuery: questionnaireQuery.data,
      quizProgressFromQuery: progressQuery.data,
      allQuestions,
      allQuestionsLength,
    };
  }, [currentQuestion, pendingInfoScreen, showRetakeScreen, questionnaireQuery.data, progressQuery.data]);

  const {
    backgroundColor,
    questionnaireFromQuery,
    quizProgressFromQuery: _quizProgressFromQuery,
    allQuestions,
    allQuestionsLength,
  } = memoizedValues;

  // Preload критических ресурсов при монтировании
  useEffect(() => {
    preloadCriticalResources();
  }, []);

  useEffect(() => {
    if (questionnaireQuery.data) {
      const normalizedQuestionnaire = {
        ...questionnaireQuery.data,
        questions: extractQuestionsFromQuestionnaire(questionnaireQuery.data),
      };
      setQuestionnaire(normalizedQuestionnaire);
      questionnaireRef.current = normalizedQuestionnaire;
    }
  }, [questionnaireQuery.data, questionnaireRef, setQuestionnaire]);

  // Синхронизация состояния, когда инфо-экран показан только из ref (useQuizComputed поставил ref, state ещё null).
  // Чтобы при «Продолжить» handleNext видел currentPendingInfoScreen и вёл в habits_matter, а не в следующий вопрос.
  // Массив зависимостей — строго 6 примитивов/стабильных ссылок, чтобы размер не менялся между рендерами (React rule).
  const pendingInfoScreenId = pendingInfoScreen?.id ?? null;
  const syncRef = useRef({
    setPendingInfoScreen,
    setCurrentQuestionIndex,
    pendingInfoScreenRef: quizState.pendingInfoScreenRef,
    currentQuestionIndexRef: quizState.currentQuestionIndexRef,
    allQuestions,
  });
  syncRef.current = {
    setPendingInfoScreen,
    setCurrentQuestionIndex,
    pendingInfoScreenRef: quizState.pendingInfoScreenRef,
    currentQuestionIndexRef: quizState.currentQuestionIndexRef,
    allQuestions,
  };
  useLayoutEffect(() => {
    const refScreen = syncRef.current.pendingInfoScreenRef?.current;
    if (
      screen !== 'INFO' ||
      !refScreen ||
      pendingInfoScreenId !== null ||
      refScreen.id !== 'ai_showcase' ||
      currentQuestionIndex <= 0 ||
      allQuestions.length === 0 ||
      isRetakingQuiz
    ) {
      return;
    }
    const currentQ = syncRef.current.allQuestions[Math.min(currentQuestionIndex, syncRef.current.allQuestions.length - 1)];
    const prevQ = syncRef.current.allQuestions[currentQuestionIndex - 1];
    if ((currentQ?.code || '').toLowerCase() !== 'makeup_frequency' || (prevQ?.code || '').toLowerCase() !== 'avoid_ingredients') {
      return;
    }
    const prevIndex = currentQuestionIndex - 1;
    syncRef.current.setPendingInfoScreen(refScreen);
    syncRef.current.setCurrentQuestionIndex(prevIndex);
    if (syncRef.current.currentQuestionIndexRef) {
      syncRef.current.currentQuestionIndexRef.current = prevIndex;
    }
  }, [screen, currentQuestionIndex, pendingInfoScreenId, allQuestions.length, isRetakingQuiz, syncRef]);

  // Коррекция: если по какой-то причине показывается вопрос про косметику сразу после avoid_ingredients —
  // откатываем на инфо-цепочку (ai_showcase → habits_matter) и не показываем makeup_frequency, пока пользователь не пройдёт экраны.
  // useLayoutEffect чтобы применить до отрисовки и избежать мигания вопроса.
  useLayoutEffect(() => {
    if (
      screen !== 'QUESTION' ||
      !currentQuestion ||
      (currentQuestion.code || '').toLowerCase() !== 'makeup_frequency' ||
      currentQuestionIndex <= 0 ||
      allQuestions.length === 0 ||
      isRetakingQuiz ||
      pendingInfoScreen
    ) {
      return;
    }
    const prevQuestion = allQuestions[currentQuestionIndex - 1];
    if (!prevQuestion || (prevQuestion.code || '').toLowerCase() !== 'avoid_ingredients') {
      return;
    }
    const infoScreen = getInfoScreenAfterQuestion('avoid_ingredients');
    if (!infoScreen) return;
    const prevIndex = currentQuestionIndex - 1;
    if (quizState.pendingInfoScreenRef) {
      quizState.pendingInfoScreenRef.current = infoScreen;
    }
    setPendingInfoScreen(infoScreen);
    setCurrentQuestionIndex(prevIndex);
    if (quizState.currentQuestionIndexRef) {
      quizState.currentQuestionIndexRef.current = prevIndex;
    }
  }, [
    screen,
    currentQuestion?.id,
    currentQuestion?.code,
    currentQuestionIndex,
    allQuestions.length,
    isRetakingQuiz,
    pendingInfoScreen,
    setPendingInfoScreen,
    setCurrentQuestionIndex,
    quizState.pendingInfoScreenRef,
    quizState.currentQuestionIndexRef,
  ]);

  // Коррекция: если показывается «Какой тип ухода вам ближе?» сразу после «Ваши привычки» —
  // откатываем на инфо-цепочку (ai_comparison → preferences_intro) и не показываем care_type, пока пользователь не пройдёт экраны.
  useLayoutEffect(() => {
    if (
      screen !== 'QUESTION' ||
      !currentQuestion ||
      (currentQuestion.code || '').toLowerCase() !== 'care_type' ||
      currentQuestionIndex <= 0 ||
      allQuestions.length === 0 ||
      isRetakingQuiz ||
      pendingInfoScreen
    ) {
      return;
    }
    const prevQuestion = allQuestions[currentQuestionIndex - 1];
    if (!prevQuestion || (prevQuestion.code || '').toLowerCase() !== 'lifestyle_habits') {
      return;
    }
    const infoScreen = getInfoScreenAfterQuestion('lifestyle_habits');
    if (!infoScreen) return;
    const prevIndex = currentQuestionIndex - 1;
    if (quizState.pendingInfoScreenRef) {
      quizState.pendingInfoScreenRef.current = infoScreen;
    }
    setPendingInfoScreen(infoScreen);
    setCurrentQuestionIndex(prevIndex);
    if (quizState.currentQuestionIndexRef) {
      quizState.currentQuestionIndexRef.current = prevIndex;
    }
  }, [
    screen,
    currentQuestion?.id,
    currentQuestion?.code,
    currentQuestionIndex,
    allQuestions.length,
    isRetakingQuiz,
    pendingInfoScreen,
    setPendingInfoScreen,
    setCurrentQuestionIndex,
    quizState.pendingInfoScreenRef,
    quizState.currentQuestionIndexRef,
  ]);

  const {
    handleResume,
    handleStartOver,
    handleFullRetakeSelection,
    handleNextInProgressRef,
    onAnswer,
    onNext,
    onBack,
    onSubmit,
  } = useQuizHandlers({ currentQuestion, screen });

  // Используем memoized значения

  // Обработка ошибок загрузки данных
  if (screen === 'ERROR') {
    devLog('❌ [QuizRenderer] rendering ERROR screen', {
      dataError: dataError,
      hasQuestionnaire: !!questionnaire,
      isTelegramUser: !!(typeof window !== 'undefined' && window.Telegram?.WebApp?.initData)
    });

    // Специальная обработка для 403 ошибки
    if ((dataError as any)?.status === 403) {
      return (
        <QuizErrorScreen
          title="Требуется авторизация"
          message="Для работы с анкетой необходимо открыть приложение через Telegram Mini App. Пожалуйста, перейдите по ссылке из Telegram."
          buttonText="Обновить страницу"
          onReload={() => window.location.reload()}
        />
      );
    }

    return (
      <QuizErrorScreen
        title="Ошибка загрузки"
        message="Не удалось загрузить анкету. Пожалуйста, попробуйте обновить страницу."
        buttonText="Обновить страницу"
        onReload={() => window.location.reload()}
      />
    );
  }

  // Между анкетой и планом — один лоадер (страница /loading); finalizing overlay не показываем

  // Loader screen - показывается когда данные еще загружаются
  if (screen === 'LOADER') {
    devLog('⏳ [QuizRenderer] rendering LOADER screen');
    return <QuizInitialLoader />;
  }

  if (screen === 'RETAKE') {
    return (
      <ScreenErrorBoundary componentName="RetakeScreen">
        <Suspense fallback={<QuizInitialLoader />}>
          <ScreenErrorBoundary componentName="QuizRetakeScreen">
            <QuizRetakeScreen
              questionnaire={questionnaireFromQuery || questionnaireRef.current || questionnaire}
              hasFullRetakePayment={hasFullRetakePayment}
              setShowRetakeScreen={setShowRetakeScreen}
              setIsRetakingQuiz={setIsRetakingQuiz}
              setIsStartingOver={setIsStartingOver}
              isStartingOverRef={isStartingOverRef}
              setAnswers={setAnswers}
              setSavedProgress={setSavedProgress}
              setHasResumed={setHasResumed}
              hasResumedRef={hasResumedRef}
              setAutoSubmitTriggered={setAutoSubmitTriggered}
              autoSubmitTriggeredRef={autoSubmitTriggeredRef}
              setError={setError}
              setCurrentInfoScreenIndex={setCurrentInfoScreenIndex}
              setCurrentQuestionIndex={setCurrentQuestionIndex}
              setPendingInfoScreen={setPendingInfoScreen}
              setHasFullRetakePayment={setHasFullRetakePayment}
              onFullRetake={handleFullRetakeSelection}
            />
          </ScreenErrorBoundary>
        </Suspense>
      </ScreenErrorBoundary>
    );
  }

  // RESUME: рендерим только после монтирования, чтобы сервер и первый клиентский рендер совпадали (избегаем hydration mismatch из‑за savedProgress)
  if (screen === 'RESUME') {
    return (
      <ScreenErrorBoundary componentName="ResumeScreen">
        <ResumeScreenDeferred
          savedProgress={savedProgress}
          questionnaire={questionnaireFromQuery || questionnaireRef.current || questionnaire}
          answers={answers}
          answersRef={answersRef}          isRetakingQuiz={isRetakingQuiz}          showRetakeScreen={showRetakeScreen}
          onResume={handleResume}
          onStartOver={handleStartOver}
          isBusy={isStartingOver || isSubmitting}
        />
      </ScreenErrorBoundary>
    );
  }

  // Info screens
  if (screen === 'INFO') {
    devLog('📄 [QuizRenderer] rendering INFO screen', {
      pendingInfoScreen,
      currentInfoScreenIndex,
      questionnaireFromQuery: !!questionnaireFromQuery,
      isSubmitting
    });

    // ИСПРАВЛЕНО: Если pendingInfoScreen равен null, не рендерим QuizInfoScreen
    // Это предотвращает ошибку при возврате назад после резюм-экрана
    if (!pendingInfoScreen) {
      console.warn('⚠️ [QuizRenderer] INFO screen but pendingInfoScreen is null, showing loader');
      return <QuizInitialLoader />;
    }

    const initialInfoScreens = getInitialInfoScreens();
    const isPendingInitialScreen = pendingInfoScreen
      ? initialInfoScreens.some((screen) => screen.id === pendingInfoScreen.id)
      : false;

    return (
      <ScreenErrorBoundary componentName="InfoScreen">
        <Suspense fallback={<QuizInitialLoader />}>
          <ScreenErrorBoundary componentName="QuizInfoScreen">
            <QuizInfoScreen
            screen={pendingInfoScreen}
            currentInfoScreenIndex={currentInfoScreenIndex}
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

    devLog('📄 [QuizRenderer] rendering INITIAL_INFO screen', {
      currentInitialInfoScreen: currentInitialInfoScreen?.id,
      currentInfoScreenIndex: quizState.currentInfoScreenIndex,
      currentInfoScreenIndexRef: quizState.currentInfoScreenIndexRef.current,
      questionnaireFromQuery: !!questionnaireFromQuery,
      isSubmitting,
      screen
    });

    return (
      <ScreenErrorBoundary componentName="InitialInfoScreen">
        <Suspense fallback={<QuizInitialLoader />}>
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
  devLog('❓ [QuizRenderer] rendering QUESTION screen', {
    currentQuestion: !!currentQuestion,
    currentQuestionId: currentQuestion?.id,
    currentQuestionCode: currentQuestion?.code,
    currentQuestionIndex,
    allQuestionsLength,
    answersCount: Object.keys(answers).length,
    isRetakingQuiz,
    isSubmitting,
    backgroundColor,
    screen,
    currentInitialInfoScreen: currentInitialInfoScreen?.id
  });

  // ФИКС: Проверяем что currentQuestion существует перед рендерингом
  // ИСПРАВЛЕНО: Если currentQuestionIndex >= allQuestionsLength, значит все вопросы пройдены
  // В этом случае нужно запустить финализацию, а не показывать ошибку
  // ИСПРАВЛЕНО: Если screen === 'INFO' или есть pendingInfoScreen, не проверяем currentQuestion, так как мы на инфо-экране
  if (!currentQuestion && screen === 'QUESTION') {
    const isAllQuestionsCompleted = currentQuestionIndex >= allQuestionsLength && allQuestionsLength > 0;
    
    // ИСПРАВЛЕНО: Если currentQuestionIndex выходит за границы, но есть pendingInfoScreen,
    // это означает, что мы показываем инфо-экран после последнего вопроса
    // В этом случае не показываем ошибку, а позволяем показать инфо-экран
    // Это предотвращает показ ошибки на секунду перед переключением на INFO screen
    if (pendingInfoScreen) {
      devLog('ℹ️ [QuizRenderer] currentQuestion null, но есть pendingInfoScreen, пропускаем проверку', {
        currentQuestionIndex,
        allQuestionsLength,
        pendingInfoScreenId: pendingInfoScreen?.id,
        screen,
      });
      // Не показываем ошибку, позволяем показать инфо-экран
      // Компонент переключится на INFO screen в следующем рендере
      return null;
    }
    
    // ИСПРАВЛЕНО: Если currentQuestionIndex выходит за границы, но мы только что вернулись с инфо-экрана,
    // пытаемся найти вопрос 'budget' и установить валидный индекс
    if (currentQuestionIndex >= allQuestionsLength && allQuestionsLength > 0) {
      const budgetQuestion = allQuestions.find(q => q.code === 'budget');
      if (budgetQuestion) {
        const budgetIndex = allQuestions.findIndex(q => q.code === 'budget');
          if (budgetIndex >= 0 && budgetIndex < allQuestionsLength) {
            devLog('🔧 [QuizRenderer] Исправляем индекс после возврата с инфо-экрана', {
              currentQuestionIndex,
              budgetIndex,
              allQuestionsLength,
            });
          // Устанавливаем индекс на валидное значение
          setCurrentQuestionIndex(budgetIndex);
          if (quizState.currentQuestionIndexRef) {
            quizState.currentQuestionIndexRef.current = budgetIndex;
          }
          // Возвращаем null, чтобы компонент перерендерился с правильным индексом
          return null;
        }
      }
    }
    
    if (isAllQuestionsCompleted) {
      devLog('✅ [QuizRenderer] Все вопросы пройдены, запускаем финализацию', {
        currentQuestionIndex,
        allQuestionsLength,
      });
      if (onSubmit && !isSubmitting) {
        onSubmit();
      }
      // Один лоадер: тот же вид, что и страница /loading (без второго экрана)
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-50 to-white p-4">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
                  style={{ width: '10%' }}
                />
              </div>
              <p className="text-center mt-4 text-gray-600 text-lg font-medium">Сохраняем ответы...</p>
              <p className="text-center mt-2 text-gray-400 text-sm">Это может занять до 1 минуты</p>
            </div>
          </div>
        </div>
      );
    }
    
    console.warn('⚠️ [QuizRenderer] currentQuestion is null, showing error screen', {
      screen,
      currentQuestionIndex,
      allQuestionsLength,
      currentInitialInfoScreen: currentInitialInfoScreen?.id,
      isAllQuestionsCompleted,
      hasPendingInfoScreen: !!pendingInfoScreen,
    });
    return (
      <QuizErrorScreen
        title="Ошибка загрузки"
        message="Вопрос не найден. Попробуйте обновить страницу."
      />
    );
  }

  // ИСПРАВЛЕНО: TypeScript не понимает, что currentQuestion не null после проверки выше
  // Добавляем явную проверку для типизации
  if (!currentQuestion) {
    console.warn('⚠️ [QuizRenderer] currentQuestion is null after checks, showing error screen');
    return (
      <QuizErrorScreen
        title="Ошибка загрузки"
        message="Вопрос не найден. Попробуйте обновить страницу."
      />
    );
  }

  // ИСПРАВЛЕНО: TypeScript guard - после проверки выше currentQuestion гарантированно не null
  const safeCurrentQuestion: Question = currentQuestion;

  return (
    <QuestionErrorBoundary componentName="QuestionScreen">
      <div
        style={{
          minHeight: '100vh',
          backgroundColor,
          paddingTop: '36px',
          paddingBottom: '20px',
        }}
      >
        <Suspense fallback={<QuizInitialLoader />}>
          <QuestionErrorBoundary componentName="QuizQuestion">
            <QuizQuestion
              key={safeCurrentQuestion.id}
              question={safeCurrentQuestion}
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
          </QuestionErrorBoundary>
        </Suspense>
      </div>
    </QuestionErrorBoundary>
  );
});
