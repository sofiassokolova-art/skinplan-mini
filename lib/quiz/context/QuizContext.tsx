// lib/quiz/context/QuizContext.tsx
// Context для централизованного управления состоянием анкеты
// Упрощает передачу props и делает код более читаемым

'use client';

import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import type { Question } from '@/lib/quiz/types';

export interface Questionnaire {
  id: number;
  name: string;
  version: number;
  groups: Array<{
    id: number;
    title: string;
    questions: Question[];
  }>;
  questions: Question[];
}

export interface QuizContextValue {
  // State
  questionnaire: Questionnaire | null;
  loading: boolean;
  error: string | null;
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  answers: Record<number, string | string[]>;
  showResumeScreen: boolean;
  isSubmitting: boolean;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  hasResumed: boolean;
  pendingInfoScreen: any | null;
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  
  // Refs (для синхронного доступа)
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  isSubmittingRef: React.MutableRefObject<boolean>;
  
  // Setters
  setQuestionnaire: React.Dispatch<React.SetStateAction<Questionnaire | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
  setShowResumeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setIsRetakingQuiz: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRetakeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  setHasResumed: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<any | null>>;
  setSavedProgress: React.Dispatch<React.SetStateAction<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>>;
  
  // Functions
  handleNext: () => void;
  handleBack: () => void;
  handleAnswer: (questionId: number, answer: string | string[]) => Promise<void>;
  submitAnswers: () => Promise<void>;
  loadQuestionnaire: (params: any) => Promise<void>;
  
  // Computed values
  allQuestions: Question[];
  allQuestionsRaw: Question[];
  currentQuestion: Question | null;
  isShowingInitialInfoScreen: boolean;
  
  // Utils
  isDev: boolean;
}

const QuizContext = createContext<QuizContextValue | undefined>(undefined);

export interface QuizProviderProps {
  children: ReactNode;
  value: QuizContextValue;
}

export function QuizProvider({ children, value }: QuizProviderProps) {
  return (
    <QuizContext.Provider value={value}>
      {children}
    </QuizContext.Provider>
  );
}

export function useQuizContext(): QuizContextValue {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error('useQuizContext must be used within a QuizProvider');
  }
  return context;
}

// Вспомогательные хуки для удобства
export function useQuizState() {
  const context = useQuizContext();
  return {
    questionnaire: context.questionnaire,
    loading: context.loading,
    error: context.error,
    currentInfoScreenIndex: context.currentInfoScreenIndex,
    currentQuestionIndex: context.currentQuestionIndex,
    answers: context.answers,
    showResumeScreen: context.showResumeScreen,
    isSubmitting: context.isSubmitting,
    isRetakingQuiz: context.isRetakingQuiz,
    showRetakeScreen: context.showRetakeScreen,
    hasResumed: context.hasResumed,
    pendingInfoScreen: context.pendingInfoScreen,
    savedProgress: context.savedProgress,
  };
}

export function useQuizActions() {
  const context = useQuizContext();
  return {
    handleNext: context.handleNext,
    handleBack: context.handleBack,
    handleAnswer: context.handleAnswer,
    submitAnswers: context.submitAnswers,
    loadQuestionnaire: context.loadQuestionnaire,
    setQuestionnaire: context.setQuestionnaire,
    setLoading: context.setLoading,
    setError: context.setError,
    setCurrentInfoScreenIndex: context.setCurrentInfoScreenIndex,
    setCurrentQuestionIndex: context.setCurrentQuestionIndex,
    setAnswers: context.setAnswers,
    setShowResumeScreen: context.setShowResumeScreen,
    setIsSubmitting: context.setIsSubmitting,
    setIsRetakingQuiz: context.setIsRetakingQuiz,
    setShowRetakeScreen: context.setShowRetakeScreen,
    setHasResumed: context.setHasResumed,
    setPendingInfoScreen: context.setPendingInfoScreen,
    setSavedProgress: context.setSavedProgress,
  };
}

export function useQuizComputed() {
  const context = useQuizContext();
  return {
    allQuestions: context.allQuestions,
    allQuestionsRaw: context.allQuestionsRaw,
    currentQuestion: context.currentQuestion,
    isShowingInitialInfoScreen: context.isShowingInitialInfoScreen,
    questionnaireRef: context.questionnaireRef,
    currentInfoScreenIndexRef: context.currentInfoScreenIndexRef,
    isSubmittingRef: context.isSubmittingRef,
  };
}

