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

  // ВСЕ ХУКИ ДОЛЖНЫ ВЫЗЫВАТЬСЯ ДО ЛЮБЫХ УСЛОВНЫХ RETURNS
  // React Rule: Hooks must be called in the same order every time

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
    loading,
  } = quizState;

  // Current question from computed hook with proper parameters
  // ФИКС: Используем ревизии вместо stringify для оптимизации
  const { answersRevision, savedProgressRevision } = useQuizContext();

  // ИСПРАВЛЕНО: Стабилизируем isQuestionnaireLoading - используем только questionnaireQuery.isLoading
  // loading из quizState может меняться часто и вызывать лишние ре-рендеры
  // Объединяем оба источника загрузки в один стабильный флаг
  const isQuestionnaireLoadingStable = questionnaireQuery.isLoading || loading;

  const quizComputedResult = useQuizComputed({
    questionnaire,
    answers,
    answersRevision,
    savedProgress,
    savedProgressRevision,
    currentInfoScreenIndex,
    currentQuestionIndex,
    isRetakingQuiz,
    showRetakeScreen,
    showResumeScreen,
    hasResumed,
    isStartingOver,
    pendingInfoScreen,
    isLoadingProgress: progressQuery.isLoading,
    isLoadingQuestionnaire: isQuestionnaireLoadingStable, // ИСПРАВЛЕНО: Используем стабильное значение
    isQuestionnaireLoading: isQuestionnaireLoadingStable, // ИСПРАВЛЕНО: Используем стабильное значение
    questionnaireError: questionnaireQuery.error,
    isQuestionnaireQueryError: questionnaireQuery.isError, // сохраняем при refetch, чтобы не переключаться в лоадер
    progressError: progressQuery.error,
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

  // ФИКС: Убираем ранние return'ы - теперь viewMode является единственным источником правды
  // Передаем информацию о загрузке и ошибках в useQuizComputed

  return (
    <QuizRenderer
      screen={screen}
      currentQuestion={currentQuestion}
      currentInitialInfoScreen={currentInitialInfoScreen}
      debugLogs={debugLogs}
      showDebugPanel={showDebugPanel}
      dataError={questionnaireQuery.error || progressQuery.error}
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
