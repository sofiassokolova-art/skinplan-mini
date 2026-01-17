// app/(miniapp)/quiz/components/QuizQuestionState.tsx
// Компонент для отображения состояний вопроса (ошибка, загрузка)

'use client';

import { clientLogger } from '@/lib/client-logger';
import type { Questionnaire } from '@/lib/quiz/types';
import { QuestionSkeleton } from '@/components/ui/SkeletonLoader';

interface QuizQuestionStateProps {
  currentQuestion: any;
  currentQuestionIndex: number;
  currentInfoScreenIndex: number;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  isPastInitialScreens: boolean;
  allQuestionsLength: number;
  initialInfoScreensLength: number;
  isShowingInitialInfoScreen: boolean;
  loading: boolean;
  questionnaire: Questionnaire | null;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  quizStateMachineQuestionnaire: Questionnaire | null;
  pendingInfoScreen: any;
  showResumeScreen: boolean;
  hasResumed: boolean;
  isDev: boolean;
}

export function QuizQuestionState({
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
  isDev,
}: QuizQuestionStateProps) {
  const isPastInitialScreensRef = currentInfoScreenIndexRef.current >= initialInfoScreensLength;
  const hasQuestions = allQuestionsLength > 0;
  const effectiveQuestionnaire = questionnaireRef.current || questionnaire || quizStateMachineQuestionnaire;
  const hasQuestionnaireData = !!effectiveQuestionnaire;
  
  // УДАЛЕНО: shouldShowError больше не используется
  
  const shouldShowLoading = !currentQuestion && 
    !isShowingInitialInfoScreen &&
    currentInfoScreenIndex >= initialInfoScreensLength &&
    (
      (isPastInitialScreens || isPastInitialScreensRef) || 
      !hasQuestions || 
      !hasQuestionnaireData ||
      loading
    );

  // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
  // if (isDev && !currentQuestion) {
  //   clientLogger.warn('⚠️ Рендер: currentQuestion null, проверяем условия', {
  //     hasCurrentQuestion: !!currentQuestion,
  //     currentQuestionIndex,
  //     currentInfoScreenIndex,
  //     currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
  //     isPastInitialScreens,
  //     isPastInitialScreensRef,
  //     shouldShowError,
  //     shouldShowLoading,
  //     initialInfoScreensLength,
  //     allQuestionsLength,
  //     hasQuestions,
  //     hasQuestionnaireData,
  //     hasQuestionnaireState: !!questionnaire,
  //     hasQuestionnaireRef: !!questionnaireRef.current,
  //     hasQuestionnaireStateMachine: !!quizStateMachineQuestionnaire,
  //     effectiveQuestionnaire: !!(questionnaireRef.current || questionnaire || quizStateMachineQuestionnaire),
  //     isShowingInitialInfoScreen,
  //   });
  // }

  // УДАЛЕНО: Экран "Вопрос не найден" больше не показывается как UI
  // Это внутренняя ошибка состояния, которая должна решаться автоматически

  if (shouldShowLoading) {
    // Используем только скелетную загрузку, без спиннера и текста
    return (
      <div style={{ 
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        padding: '40px 20px',
      }}>
        <QuestionSkeleton />
      </div>
    );
  }

  return null;
}
