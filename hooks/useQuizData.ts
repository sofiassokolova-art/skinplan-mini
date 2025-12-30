// hooks/useQuizData.ts
// Хук для управления данными анкеты (questionnaire, questions, answers)
// Вынесено из quiz/page.tsx для улучшения читаемости

import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuestionnaire, useQuizProgress, useSaveQuizProgress } from '@/hooks/useQuiz';
import { useQuizStateMachine } from '@/lib/quiz/hooks/useQuizStateMachine';
import { useQuizSync } from '@/lib/quiz/utils/quizSync';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import { filterQuestions, getEffectiveAnswers } from '@/lib/quiz/filterQuestions';
import { clientLogger } from '@/lib/client-logger';
import type { Question, Questionnaire, SavedProgress } from '@/lib/quiz/types';

export interface UseQuizDataReturn {
  // Data
  questionnaire: Questionnaire | null;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  allQuestionsRaw: Question[];
  allQuestions: Question[];
  effectiveAnswers: Record<number, string | string[]>;
  answersCount: number;
  savedProgress: SavedProgress | null;
  
  // State Machine
  quizStateMachine: ReturnType<typeof useQuizStateMachine>;
  
  // React Query
  questionnaireFromQuery: Questionnaire | undefined;
  isLoadingQuestionnaire: boolean;
  questionnaireError: Error | null;
  quizProgressFromQuery: any;
  isLoadingProgress: boolean;
  saveQuizProgressMutation: ReturnType<typeof useSaveQuizProgress>;
  
  // Setters
  setQuestionnaire: React.Dispatch<React.SetStateAction<Questionnaire | null>>;
  setSavedProgress: React.Dispatch<React.SetStateAction<SavedProgress | null>>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
}

export function useQuizData() {
  const isDev = process.env.NODE_ENV === 'development';
  
  // State Machine
  const quizStateMachine = useQuizStateMachine({
    initialState: 'LOADING',
    onStateChange: (newState, previousState) => {
      clientLogger.log('🔄 State Machine transition', { 
        from: previousState, 
        to: newState 
      });
    },
    onTransitionError: (event, from) => {
      clientLogger.warn('⚠️ Invalid State Machine transition', { 
        event, 
        from 
      });
    },
  });
  
  const questionnaireFromStateMachine = quizStateMachine.questionnaire;
  const setQuestionnaireInStateMachine = quizStateMachine.setQuestionnaire;
  
  // React Query
  const { 
    data: questionnaireFromQuery, 
    isLoading: isLoadingQuestionnaire, 
    error: questionnaireError 
  } = useQuestionnaire();
  
  const { 
    data: quizProgressFromQuery, 
    isLoading: isLoadingProgress,
    error: progressError 
  } = useQuizProgress();
  
  const saveQuizProgressMutation = useSaveQuizProgress();
  
  // Local state
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const questionnaireRef = useRef<Questionnaire | null>(null);
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  
  // Sync questionnaire from React Query
  useEffect(() => {
    if (questionnaireFromQuery && questionnaireFromQuery !== questionnaire) {
      clientLogger.log('🔄 Syncing questionnaire from React Query', {
        questionnaireId: questionnaireFromQuery.id,
        currentQuestionnaireId: questionnaire?.id,
      });
      setQuestionnaire(questionnaireFromQuery);
      setQuestionnaireInStateMachine(questionnaireFromQuery);
    }
  }, [questionnaireFromQuery, questionnaire, setQuestionnaireInStateMachine]);
  
  // Sync questionnaire ref
  useEffect(() => {
    questionnaireRef.current = questionnaire;
  }, [questionnaire]);
  
  // Use QuizSync for State Machine synchronization
  const isSyncingRef = useRef(false);
  useQuizSync({
    stateMachineQuestionnaire: questionnaireFromStateMachine,
    setQuestionnaire,
    questionnaireRef,
    isSyncingRef,
  });
  
  // Extract questions from questionnaire
  const allQuestionsRaw = useMemo(() => {
    try {
      const effectiveQuestionnaire = questionnaireRef.current || 
                                      questionnaire || 
                                      questionnaireFromStateMachine;
      
      if (!effectiveQuestionnaire) {
        return [];
      }
      
      return extractQuestionsFromQuestionnaire(effectiveQuestionnaire);
    } catch (err) {
      clientLogger.error('❌ Error computing allQuestionsRaw:', { err });
      return [];
    }
  }, [questionnaire, questionnaireFromStateMachine]);
  
  // Filter questions based on answers
  const allQuestions = useMemo(() => {
    if (allQuestionsRaw.length === 0) {
      return [];
    }
    
    return filterQuestions(allQuestionsRaw, answers, questionnaire);
  }, [allQuestionsRaw, answers, questionnaire]);
  
  // Effective answers (current + saved)
  const effectiveAnswers = useMemo(() => 
    getEffectiveAnswers(answers, savedProgress?.answers), 
    [answers, savedProgress?.answers]
  );
  
  const answersCount = useMemo(() => Object.keys(effectiveAnswers).length, [effectiveAnswers]);
  
  return {
    // Data
    questionnaire,
    questionnaireRef,
    allQuestionsRaw,
    allQuestions,
    effectiveAnswers,
    answersCount,
    savedProgress,
    
    // State Machine
    quizStateMachine,
    
    // React Query
    questionnaireFromQuery,
    isLoadingQuestionnaire,
    questionnaireError: questionnaireError as Error | null,
    quizProgressFromQuery,
    isLoadingProgress,
    saveQuizProgressMutation,
    
    // Setters
    setQuestionnaire,
    setSavedProgress,
    setAnswers,
  };
}

