// app/(miniapp)/quiz/hooks/useQuizEngine.ts
// View‑модель анкеты для QuizPage: объединяет контекст, стейт‑машину и вычисляемые значения

'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { Question } from '@/lib/quiz/types';
import { useQuizContext } from '../components/QuizProvider';
import { useQuizComputed, type ViewMode } from '@/lib/quiz/hooks/useQuizComputed';

export type QuizScreen = 'LOADER' | 'ERROR' | 'RETAKE' | 'RESUME' | 'INFO' | 'INITIAL_INFO' | 'QUESTION';

export interface UseQuizEngineResult {
  screen: QuizScreen;
  currentQuestion: Question | null;
  currentInitialInfoScreen: any | null;
  dataError: Error | null;
}

function mapViewModeToScreen(mode: ViewMode): QuizScreen {
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
}

export function useQuizEngine(): UseQuizEngineResult {
  const [hasTelegramInitData, setHasTelegramInitData] = useState(false);

  // ИСПРАВЛЕНО: проверяем initData только на клиенте и только в эффекте
  useEffect(() => {
    const check = () => {
      const has =
        !!(window.Telegram?.WebApp?.initData) ||
        !!(() => {
          try {
            return sessionStorage.getItem('tg_init_data');
          } catch {
            return null;
          }
        })();
      setHasTelegramInitData(Boolean(has));
    };

    check();
    window.addEventListener('telegram-webapp-ready', check);
    const t = setTimeout(check, 2000);

    return () => {
      window.removeEventListener('telegram-webapp-ready', check);
      clearTimeout(t);
    };
  }, []);

  const allQuestionsRawPrevRef = useRef<Question[]>([]);
  const allQuestionsPrevRef = useRef<Question[]>([]);

  const { quizState, quizStateMachine, questionnaireQuery, progressQuery, isDev } = useQuizContext();

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
    loading,
  } = quizState;

  const { answersRevision, savedProgressRevision } = useQuizContext();

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
    isLoadingQuestionnaire: isQuestionnaireLoadingStable,
    isQuestionnaireLoading: isQuestionnaireLoadingStable,
    questionnaireError: questionnaireQuery.error,
    isQuestionnaireQueryError: questionnaireQuery.isError,
    progressError: progressQuery.error,
    hasTelegramInitData,
    questionnaireRef,
    currentInfoScreenIndexRef,
    allQuestionsRawPrevRef,
    allQuestionsPrevRef,
    pendingInfoScreenRef: quizState.pendingInfoScreenRef,
    quizStateMachine,
    isDev,
  });

  const { currentQuestion, currentInitialInfoScreen, viewMode } = quizComputedResult;

  const screen = useMemo(() => mapViewModeToScreen(viewMode), [viewMode]);

  const dataError = useMemo<Error | null>(() => {
    return (questionnaireQuery.error as Error | null) || (progressQuery.error as Error | null) || null;
  }, [questionnaireQuery.error, progressQuery.error]);

  return {
    screen,
    currentQuestion,
    currentInitialInfoScreen,
    dataError,
  };
}

