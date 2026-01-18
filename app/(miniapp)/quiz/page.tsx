// app/(miniapp)/quiz/page.tsx
// Страница анкеты - рефакторинг с разделением на компоненты

'use client';

import { useState, useRef, useCallback } from 'react';
import { QuizProvider } from './components/QuizProvider';
import { QuizRenderer } from './components/QuizRenderer';
import { useQuizContext } from './components/QuizProvider';
import { useQuizComputed, ViewMode } from '@/lib/quiz/hooks/useQuizComputed';
import { QuizErrorBoundary } from '@/components/QuizErrorBoundary';
import type { Question } from '@/lib/quiz/types';

function QuizPageContent() {
  // Debug state - currently unused but kept for future debugging
  const [debugLogs] = useState<Array<{ time: string; message: string; data?: any }>>([]);
  const [showDebugPanel] = useState(false);

  // Refs for computed hook - используем правильные refs вместо пустых объектов
  const allQuestionsRawPrevRef = useRef<Question[]>([]);
  const allQuestionsPrevRef = useRef<Question[]>([]);

  const {
    quizState,
    quizStateMachine,
    questionnaireQuery,
    progressQuery,
    isDev
  } = useQuizContext();

  // ФИКС: Проверяем состояние загрузки данных
  const isQuestionnaireLoading = questionnaireQuery.isLoading;
  const questionnaireError = questionnaireQuery.error;
  const progressError = progressQuery.error;

  // Показываем лоадер пока загружается questionnaire
  if (isQuestionnaireLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        padding: '20px',
      }}>
        <div style={{
          fontSize: '18px',
          color: '#666',
          textAlign: 'center'
        }}>
          Загрузка анкеты...
        </div>
      </div>
    );
  }

  if (questionnaireError || progressError) {
    console.error('❌ [QuizPage] Data loading error:', {
      questionnaireError: questionnaireError?.message,
      progressError: progressError?.message
    });
    // Возвращаем компонент ошибки вместо рендеринга основного контента
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        padding: '20px',
      }}>
        <div style={{
          fontSize: '18px',
          color: '#666',
          textAlign: 'center'
        }}>
          Ошибка загрузки данных анкеты
        </div>
      </div>
    );
  }

  const {
    questionnaire,
    answers,
    savedProgress,
    currentInfoScreenIndex,
    currentQuestionIndex,
    isRetakingQuiz,
    showRetakeScreen,
    showResumeScreen,
    hasResumed,
    isStartingOver,
    pendingInfoScreen,
    questionnaireRef,
    currentInfoScreenIndexRef,
    pendingInfoScreenRef,
  } = quizState;

  // Current question from computed hook with proper parameters
  // ФИКС: Добавляем версии для более точного отслеживания изменений
  const answersVersion = Object.keys(answers).length + JSON.stringify(Object.values(answers)).length;
  const savedProgressVersion = savedProgress ? JSON.stringify(savedProgress).length : undefined;

  const quizComputedResult = useQuizComputed({
    questionnaire,
    answers,
    answersVersion,
    savedProgress,
    savedProgressVersion,
    currentInfoScreenIndex,
    currentQuestionIndex,
    isRetakingQuiz,
    showRetakeScreen,
    showResumeScreen,
    hasResumed,
    isStartingOver,
    pendingInfoScreen,
    isLoadingProgress: progressQuery.isLoading,
    questionnaireRef,
    currentInfoScreenIndexRef,
    allQuestionsRawPrevRef,
    allQuestionsPrevRef,
    pendingInfoScreenRef,
    quizStateMachine,
    isDev,
  });

  const { currentQuestion, currentInitialInfoScreen, viewMode } = quizComputedResult;

  // ФИКС: Используем viewMode из useQuizComputed для консистентности
  // Преобразуем viewMode в screen формат
  const getScreenFromViewMode = useCallback((mode: ViewMode): 'LOADER' | 'ERROR' | 'RETAKE' | 'RESUME' | 'INFO' | 'INITIAL_INFO' | 'QUESTION' => {
    switch (mode) {
      case 'LOADING_PROGRESS':
        return 'LOADER';
      case 'ERROR':
        return 'ERROR';
      case 'RESUME':
        return 'RESUME';
      case 'RETAKE_SELECT':
        return 'RETAKE';
      case 'INITIAL_INFO':
        return 'INITIAL_INFO';
      case 'PENDING_INFO':
        return 'INFO';
      case 'QUESTION':
        return 'QUESTION';
      default:
        return 'LOADER';
    }
  }, []);

  const screen = getScreenFromViewMode(viewMode);

  return (
    <QuizRenderer
      screen={screen}
      currentQuestion={currentQuestion}
      currentInitialInfoScreen={currentInitialInfoScreen}
      debugLogs={debugLogs}
      showDebugPanel={showDebugPanel}
    />
  );
}

export default function QuizPage() {
  return (
    <QuizErrorBoundary componentName="QuizProvider">
      <QuizProvider>
        <QuizPageContent />
      </QuizProvider>
    </QuizErrorBoundary>
  );
}
