// lib/quiz/hooks/useQuizRestorePipeline.ts
// ФИКС C: Хук для управления restore pipeline с четким порядком выполнения
// Предотвращает гонки между восстановлением answers, коррекцией индексов и авто-сабмитом

import { useEffect, useLayoutEffect, useRef } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import { api } from '@/lib/api';
import type { Questionnaire, Question } from '@/lib/quiz/types';

export interface UseQuizRestorePipelineParams {
  // Scope (фиксированный)
  scope: string;
  scopedStorageKeys: {
    CURRENT_INFO_SCREEN: string;
    CURRENT_QUESTION: string;
    CURRENT_QUESTION_CODE: string;
    INIT_CALLED: string;
    JUST_SUBMITTED: string;
  };
  
  // Questionnaire (source of truth)
  questionnaire: Questionnaire | null;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  questionnaireFromQuery: Questionnaire | null;
  
  // Progress
  quizProgressFromQuery: {
    progress?: {
      answers: Record<number, string | string[]>;
      questionIndex: number;
      infoScreenIndex: number;
    } | null;
    isCompleted?: boolean;
  } | null;
  isLoadingProgress: boolean;
  
  // Questions (computed)
  allQuestions: Question[];
  allQuestionsPrevRef: React.MutableRefObject<Question[]>;
  
  // State
  answers: Record<number, string | string[]>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  setSavedProgress: React.Dispatch<React.SetStateAction<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>>;
  currentInfoScreenIndex: number;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  
  // Refs
  answersRef: React.MutableRefObject<Record<number, string | string[]>>;
  answersCountRef: React.MutableRefObject<number>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  currentQuestionIndexRef: React.MutableRefObject<number>;
  lastRestoredAnswersIdRef: React.MutableRefObject<string | null>;
  
  // Flags
  isStartingOver: boolean;
  isStartingOverRef: React.MutableRefObject<boolean>;
  hasResumed: boolean;
  hasResumedRef: React.MutableRefObject<boolean>;
  
  // Other
  isDev: boolean;
}

/**
 * Хук для управления restore pipeline с четким порядком выполнения
 * 
 * Порядок восстановления:
 * 1. Определить scope (уже фиксирован через scopeRef)
 * 2. Загрузить questionnaire (через loadQuestionnaire)
 * 3. Загрузить progress (через React Query или API)
 * 4. Вычислить allQuestions (через useQuizComputed)
 * 5. Выставить индексы (из sessionStorage или progress)
 * 6. Только потом разрешать авто-сабмит и "question not found"
 * 
 * Это предотвращает гонки между восстановлением answers, коррекцией индексов и авто-сабмитом
 */
export function useQuizRestorePipeline(params: UseQuizRestorePipelineParams) {
  const {
    scope,
    scopedStorageKeys,
    questionnaire,
    questionnaireRef,
    questionnaireFromQuery,
    quizProgressFromQuery,
    isLoadingProgress,
    allQuestions,
    allQuestionsPrevRef,
    answers,
    setAnswers,
    savedProgress,
    setSavedProgress,
    currentInfoScreenIndex,
    setCurrentInfoScreenIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answersRef,
    answersCountRef,
    currentInfoScreenIndexRef,
    currentQuestionIndexRef,
    lastRestoredAnswersIdRef,
    isStartingOver,
    isStartingOverRef,
    hasResumed,
    hasResumedRef,
    isDev,
  } = params;
  
  // Флаг для отслеживания, что restore pipeline уже выполнен
  const restoreCompletedRef = useRef(false);
  
  // Шаг 1: Восстановление answers из sessionStorage (быстро и синхронно)
  // Выполняется в useLayoutEffect для синхронного выполнения ДО рендера
  useLayoutEffect(() => {
    // Пропускаем если:
    // - Пользователь начал заново
    // - Прогресс загружается
    // - Есть сохраненный прогресс с >= 2 ответами (ждем загрузки из React Query)
    const hasSavedProgress = savedProgress && savedProgress.answers && 
      Object.keys(savedProgress.answers).length >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
    
    if (typeof window === 'undefined' || 
        answersCountRef.current > 0 || 
        isStartingOver || 
        isStartingOverRef.current ||
        isLoadingProgress ||
        hasSavedProgress) {
      return;
    }
    
    try {
      const answersBackupKey = QUIZ_CONFIG.getScopedKey('quiz_answers_backup', scope);
      const savedAnswersStr = sessionStorage.getItem(answersBackupKey);
      if (savedAnswersStr) {
        const savedAnswers = JSON.parse(savedAnswersStr);
        if (savedAnswers && Object.keys(savedAnswers).length > 0) {
          const savedAnswersCount = Object.keys(savedAnswers).length;
          if (answersCountRef.current === 0 || savedAnswersCount > answersCountRef.current) {
            if (isDev) {
              clientLogger.log('🔄 [Restore Pipeline Step 1] Восстанавливаем answers из sessionStorage', {
                answersCount: savedAnswersCount,
              });
            }
            setAnswers(savedAnswers);
            answersRef.current = savedAnswers;
            answersCountRef.current = savedAnswersCount;
          }
        }
      }
    } catch (err) {
      clientLogger.warn('⚠️ Ошибка при восстановлении answers из sessionStorage', err);
    }
  }, [
    scope,
    answersCountRef.current,
    isStartingOver,
    isLoadingProgress,
    savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0,
  ]);
  
  // Шаг 2: Восстановление answers из React Query кэша
  // Выполняется после загрузки progress из React Query
  useLayoutEffect(() => {
    // Пропускаем если:
    // - Прогресс загружается
    // - Пользователь начал заново
    if (isLoadingProgress || isStartingOver || isStartingOverRef.current) {
      return;
    }
    
    const progressAnswers = quizProgressFromQuery?.progress?.answers;
    if (progressAnswers && Object.keys(progressAnswers).length > 0) {
      const answersId = JSON.stringify(progressAnswers);
      const progressAnswersCount = Object.keys(progressAnswers).length;
      
      // Восстанавливаем если answers пустые или количество увеличилось
      if (answersId !== lastRestoredAnswersIdRef.current || 
          progressAnswersCount > answersCountRef.current || 
          answersCountRef.current === 0) {
        const currentAnswersId = JSON.stringify(answersRef.current);
        if (answersId !== currentAnswersId) {
          if (isDev) {
            clientLogger.log('🔄 [Restore Pipeline Step 2] Восстанавливаем answers из React Query кэша', {
              answersCount: progressAnswersCount,
            });
          }
          setAnswers((prevAnswers) => {
            if (Object.keys(prevAnswers).length === 0) {
              return progressAnswers;
            }
            return { ...prevAnswers, ...progressAnswers };
          });
          answersRef.current = progressAnswers;
          answersCountRef.current = progressAnswersCount;
          setSavedProgress({
            answers: progressAnswers,
            questionIndex: quizProgressFromQuery.progress?.questionIndex || 0,
            infoScreenIndex: quizProgressFromQuery.progress?.infoScreenIndex || 0,
          });
          lastRestoredAnswersIdRef.current = answersId;
        }
      }
    }
  }, [
    isLoadingProgress,
    isStartingOver,
    quizProgressFromQuery?.progress?.answers ? Object.keys(quizProgressFromQuery.progress.answers).length : 0,
  ]);
  
  // Шаг 3: Восстановление индексов из sessionStorage или progress
  // Выполняется после восстановления answers и вычисления allQuestions
  useEffect(() => {
    // Пропускаем если:
    // - Пользователь начал заново
    // - Прогресс загружается
    // - Есть сохраненный прогресс с >= 2 ответами (ждем резюм-экрана)
    const hasSavedProgress = savedProgress && savedProgress.answers && 
      Object.keys(savedProgress.answers).length >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN;
    
    if (isStartingOver || 
        isStartingOverRef.current ||
        isLoadingProgress ||
        hasSavedProgress) {
      return;
    }
    
    // Используем allQuestions для восстановления индексов
    const currentAllQuestions = allQuestions.length > 0 ? allQuestions : 
      (allQuestionsPrevRef.current.length > 0 ? allQuestionsPrevRef.current : []);
    
    if (currentAllQuestions.length === 0) {
      return; // Ждем загрузки вопросов
    }
    
    // Шаг 3.1: Восстановление currentQuestionIndex по коду вопроса
    const savedQuestionCode = sessionStorage.getItem(scopedStorageKeys.CURRENT_QUESTION_CODE);
    if (savedQuestionCode) {
      const questionIndex = currentAllQuestions.findIndex(q => q.code === savedQuestionCode);
      if (questionIndex >= 0 && questionIndex !== currentQuestionIndex) {
        if (isDev) {
          clientLogger.log('🔄 [Restore Pipeline Step 3.1] Восстанавливаем currentQuestionIndex по коду', {
            questionCode: savedQuestionCode,
            questionIndex,
          });
        }
        setCurrentQuestionIndex(questionIndex);
        currentQuestionIndexRef.current = questionIndex;
      }
    }
    
    // Шаг 3.2: Восстановление currentInfoScreenIndex
    const savedInfoScreenIndex = sessionStorage.getItem(scopedStorageKeys.CURRENT_INFO_SCREEN);
    if (savedInfoScreenIndex !== null) {
      const infoScreenIndex = parseInt(savedInfoScreenIndex, 10);
      if (!isNaN(infoScreenIndex) && infoScreenIndex >= 0) {
        const initialInfoScreens = getInitialInfoScreens();
        const isActivelyOnInfoScreens = currentInfoScreenIndex > 0 && currentInfoScreenIndex < initialInfoScreens.length;
        const isOnQuestions = currentInfoScreenIndex >= initialInfoScreens.length;
        
        const shouldRestore = currentInfoScreenIndex === 0 || 
                             infoScreenIndex > currentInfoScreenIndex || 
                             (!isActivelyOnInfoScreens && !isOnQuestions);
        
        if (shouldRestore && infoScreenIndex !== currentInfoScreenIndex) {
          if (isDev) {
            clientLogger.log('🔄 [Restore Pipeline Step 3.2] Восстанавливаем currentInfoScreenIndex', {
              savedIndex: infoScreenIndex,
              currentIndex: currentInfoScreenIndex,
            });
          }
          setCurrentInfoScreenIndex(infoScreenIndex);
          currentInfoScreenIndexRef.current = infoScreenIndex;
        }
      }
    }
    
    // Шаг 3.3: Восстановление индексов из savedProgress (если есть)
    if (savedProgress && !hasSavedProgress) {
      // Используем индексы из savedProgress только если они валидны
      if (savedProgress.questionIndex >= 0 && 
          savedProgress.questionIndex < currentAllQuestions.length &&
          savedProgress.questionIndex !== currentQuestionIndex) {
        if (isDev) {
          clientLogger.log('🔄 [Restore Pipeline Step 3.3] Восстанавливаем currentQuestionIndex из savedProgress', {
            questionIndex: savedProgress.questionIndex,
          });
        }
        setCurrentQuestionIndex(savedProgress.questionIndex);
        currentQuestionIndexRef.current = savedProgress.questionIndex;
      }
      
      if (savedProgress.infoScreenIndex >= 0 && 
          savedProgress.infoScreenIndex !== currentInfoScreenIndex) {
        if (isDev) {
          clientLogger.log('🔄 [Restore Pipeline Step 3.3] Восстанавливаем currentInfoScreenIndex из savedProgress', {
            infoScreenIndex: savedProgress.infoScreenIndex,
          });
        }
        setCurrentInfoScreenIndex(savedProgress.infoScreenIndex);
        currentInfoScreenIndexRef.current = savedProgress.infoScreenIndex;
      }
    }
    
    // Помечаем, что restore pipeline выполнен
    restoreCompletedRef.current = true;
  }, [
    scope,
    scopedStorageKeys.CURRENT_QUESTION_CODE,
    scopedStorageKeys.CURRENT_INFO_SCREEN,
    allQuestions.length,
    isStartingOver,
    isLoadingProgress,
    savedProgress?.questionIndex,
    savedProgress?.infoScreenIndex,
    savedProgress?.answers ? Object.keys(savedProgress.answers).length : 0,
  ]);
  
  return {
    restoreCompleted: restoreCompletedRef.current,
  };
}
