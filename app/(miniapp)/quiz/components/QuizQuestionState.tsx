// app/(miniapp)/quiz/components/QuizQuestionState.tsx
// Компонент для отображения состояний вопроса (ошибка, загрузка)

'use client';

import { clientLogger } from '@/lib/client-logger';
import type { Questionnaire } from '@/lib/quiz/types';

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
  
  const shouldShowError = !currentQuestion && 
    !isPastInitialScreens && 
    !isPastInitialScreensRef && 
    hasQuestions && 
    hasQuestionnaireData;
  
  const shouldShowLoading = !currentQuestion && 
    !isShowingInitialInfoScreen &&
    currentInfoScreenIndex >= initialInfoScreensLength &&
    (
      (isPastInitialScreens || isPastInitialScreensRef) || 
      !hasQuestions || 
      !hasQuestionnaireData ||
      loading
    );

  // Логируем состояние для диагностики
  if (!currentQuestion) {
    clientLogger.warn('⚠️ Рендер: currentQuestion null, проверяем условия', {
      hasCurrentQuestion: !!currentQuestion,
      currentQuestionIndex,
      currentInfoScreenIndex,
      currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
      isPastInitialScreens,
      isPastInitialScreensRef,
      shouldShowError,
      shouldShowLoading,
      initialInfoScreensLength,
      allQuestionsLength,
      hasQuestions,
      hasQuestionnaireData,
      hasQuestionnaireState: !!questionnaire,
      hasQuestionnaireRef: !!questionnaireRef.current,
      hasQuestionnaireStateMachine: !!quizStateMachineQuestionnaire,
      effectiveQuestionnaire: !!(questionnaireRef.current || questionnaire || quizStateMachineQuestionnaire),
      isShowingInitialInfoScreen,
    });
  }

  if (shouldShowError) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        {isDev && (
          <div style={{ marginBottom: '20px', padding: '10px', background: '#fff3cd', borderRadius: '8px', fontSize: '12px', textAlign: 'left' }}>
            <strong>🔍 Диагностика:</strong>
            <pre style={{ marginTop: '8px', fontSize: '11px', overflow: 'auto' }}>
              {JSON.stringify({
                currentQuestion: currentQuestion ? 'exists' : 'null',
                currentQuestionIndex,
                allQuestionsLength,
                isShowingInitialInfoScreen,
                isPastInitialScreens,
                pendingInfoScreen: pendingInfoScreen ? pendingInfoScreen.id : null,
                showResumeScreen,
                hasResumed,
                currentInfoScreenIndex,
                initialInfoScreensLength,
              }, null, 2)}
            </pre>
          </div>
        )}
        <div style={{ color: '#0A5F59', fontSize: '18px', marginBottom: '12px' }}>
          Вопрос не найден
        </div>
        <div style={{ color: '#6B7280', fontSize: '14px' }}>
          Попробуйте обновить страницу
        </div>
      </div>
    );
  }

  if (shouldShowLoading) {
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
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(10, 95, 89, 0.2)',
          borderTop: '4px solid #0A5F59',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '24px',
        }}></div>
        <div style={{ color: '#0A5F59', fontSize: '18px', fontWeight: 600, marginBottom: '32px' }}>
          Загрузка вопросов...
        </div>
        {/* Skeleton loader для предпросмотра вопроса */}
        <div style={{ width: '100%', maxWidth: '600px' }}>
          <div style={{
            backgroundColor: '#E5E7EB',
            height: '24px',
            width: '60%',
            borderRadius: '4px',
            marginBottom: '16px',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}></div>
          <div style={{
            backgroundColor: '#E5E7EB',
            height: '16px',
            width: '100%',
            borderRadius: '4px',
            marginBottom: '8px',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}></div>
          <div style={{
            backgroundColor: '#E5E7EB',
            height: '16px',
            width: '80%',
            borderRadius: '4px',
            marginBottom: '32px',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}></div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                backgroundColor: '#E5E7EB',
                height: '48px',
                width: '100%',
                borderRadius: '8px',
                marginBottom: '12px',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}</style>
      </div>
    );
  }

  return null;
}
