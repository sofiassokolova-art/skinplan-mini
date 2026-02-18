// app/(miniapp)/quiz/components/QuizErrorChecker.tsx
// Компонент для проверки и отображения ошибок анкеты

'use client';

import React from 'react';
import { clientLogger } from '@/lib/client-logger';
import { QuizErrorScreen } from './QuizErrorScreen';
import type { Questionnaire, Question } from '@/lib/quiz/types';

interface QuizErrorCheckerProps {
  questionnaire: Questionnaire | null;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  allQuestionsRaw: Question[];
  allQuestions: Question[];
  answers: Record<string, any>;
  loading: boolean;
  error: string | null;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  currentQuestion: Question | null;
  showResumeScreen: boolean;
  isShowingInitialInfoScreen: boolean;
  pendingInfoScreen: any;
  hasResumed: boolean;
}

/**
 * Утилита для проверки различных ошибок анкеты и возврата соответствующего экрана ошибки
 * Возвращает JSX элемент или null
 */
export function checkQuizErrors({
  questionnaire,
  questionnaireRef,
  allQuestionsRaw,
  allQuestions,
  answers,
  loading,
  error,
  isRetakingQuiz,
  showRetakeScreen,
  currentQuestion,
  showResumeScreen,
  isShowingInitialInfoScreen,
  pendingInfoScreen,
  hasResumed,
}: QuizErrorCheckerProps): React.ReactElement | null {
  // Случай 1: Анкета не загрузилась (questionnaire === null)
  if ((!currentQuestion || allQuestions.length === 0) && !loading && !showResumeScreen && !showRetakeScreen && !isShowingInitialInfoScreen && !pendingInfoScreen && !hasResumed && questionnaireRef.current) {
    if (!questionnaire) {
      clientLogger.error('❌ Questionnaire not loaded - showing error to user', {
        loading,
        error,
        hasQuestionnaire: !!questionnaire,
        hasQuestionnaireRef: !!questionnaireRef.current,
        questionnaireRefId: questionnaireRef.current?.id,
      });
      return (
        <QuizErrorScreen
          title="Не удалось загрузить анкету"
          message={typeof error === 'string' ? error : ((error as any)?.message || 'Пожалуйста, откройте приложение через Telegram или обновите страницу.')}
        />
      );
    }
    
    // Случай 2: Анкета загрузилась, но все вопросы отфильтрованы
    if (questionnaire && allQuestionsRaw.length > 0 && allQuestions.length === 0) {
      clientLogger.error('❌ All questions filtered out - showing error to user', {
        allQuestionsRawLength: allQuestionsRaw.length,
        allQuestionsLength: allQuestions.length,
        answersCount: Object.keys(answers).length,
        isRetakingQuiz,
        showRetakeScreen,
      });
      return (
        <QuizErrorScreen
          title="Все вопросы отфильтрованы"
          message="Похоже, что все вопросы анкеты были отфильтрованы. Пожалуйста, обновите страницу или обратитесь в поддержку."
        />
      );
    }
    
    // Случай 3: Анкета загрузилась, но allQuestionsRaw пустой (анкета без вопросов)
    const shouldShowEmptyQuestionnaireError = questionnaire && 
                                             allQuestionsRaw.length === 0 && 
                                             !loading && 
                                             questionnaireRef.current;
    const hasQuestionsInQuestionnaire = shouldShowEmptyQuestionnaireError && questionnaire && 
                                      (questionnaire.groups?.some((g: any) => g?.questions?.length > 0) || 
                                         (questionnaire.questions && questionnaire.questions.length > 0));
      
    if (shouldShowEmptyQuestionnaireError && !hasQuestionsInQuestionnaire) {
      clientLogger.error('❌ Questionnaire loaded but has no questions - showing error to user', {
        questionnaireId: questionnaire.id,
        hasGroups: !!questionnaire.groups,
        groupsCount: questionnaire.groups?.length || 0,
        hasQuestions: !!questionnaire.questions,
        questionsCount: questionnaire.questions?.length || 0,
      });
      return (
        <QuizErrorScreen
          title="Анкета пуста"
          message="Анкета загружена, но в ней нет вопросов. Пожалуйста, обновите страницу или обратитесь в поддержку."
        />
      );
    }
  }
  
  return null;
}
