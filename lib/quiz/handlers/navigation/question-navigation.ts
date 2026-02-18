// lib/quiz/handlers/navigation/question-navigation.ts
// Логика навигации по вопросам

import type React from 'react';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { getInfoScreenAfterQuestion } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire, Question } from '@/lib/quiz/types';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface QuestionNavigationParams {
  questionnaire: Questionnaire;
  allQuestions: Question[];
  currentQuestion: Question | null;
  currentQuestionIndex: number;
  currentQuestionIndexRef?: React.MutableRefObject<number>;
  answers: Record<number, string | string[]>;
  isRetakingQuiz: boolean;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<InfoScreen | null>>;
  saveProgress: (answers: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => Promise<void>;
  currentInfoScreenIndex: number;
  isDev: boolean;
}

export async function handleQuestionNavigation(params: QuestionNavigationParams): Promise<boolean> {
  const {
    questionnaire,
    allQuestions,
    currentQuestion,
    currentQuestionIndex,
    currentQuestionIndexRef,
    answers,
    isRetakingQuiz,
    setCurrentQuestionIndex,
    setPendingInfoScreen,
    saveProgress,
    currentInfoScreenIndex,
    isDev,
  } = params;

  const totalQuestions = allQuestions.length;
  const nextQuestionIndex = currentQuestionIndex + 1;

  // Проверяем, есть ли следующий вопрос
  if (nextQuestionIndex >= totalQuestions) {
    clientLogger.log('✅ handleNext: достигнут конец вопросов', {
      currentQuestionIndex,
      totalQuestions,
      isRetakingQuiz,
    });
    return true; // Все вопросы пройдены
  }

  // Проверяем, нужно ли показать инфо-экран после текущего вопроса
  const questionCode = currentQuestion?.code;
  const infoScreenAfterQuestion = questionCode ? getInfoScreenAfterQuestion(questionCode) : undefined;

  if (infoScreenAfterQuestion) {
    clientLogger.log('ℹ️ handleNext: найден инфо-экран после вопроса', {
      questionIndex: currentQuestionIndex,
      infoScreenId: infoScreenAfterQuestion.id,
      infoScreenTitle: infoScreenAfterQuestion.title,
    });

    // Сохраняем прогресс перед показом инфо-экрана
    try {
      await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
    } catch (error) {
      clientLogger.error('❌ handleNext: ошибка сохранения прогресса перед инфо-экраном', error);
    }

    setPendingInfoScreen(infoScreenAfterQuestion);
    return false; // Переходим к инфо-экрану
  }

  // Переходим к следующему вопросу
  clientLogger.log('➡️ handleNext: переходим к следующему вопросу', {
    from: currentQuestionIndex,
    to: nextQuestionIndex,
    totalQuestions,
  });

  // Сохраняем прогресс
  try {
    await saveProgress(answers, nextQuestionIndex, currentInfoScreenIndex);
  } catch (error) {
    clientLogger.error('❌ handleNext: ошибка сохранения прогресса при переходе к вопросу', error);
  }

  // Обновляем индекс вопроса
  setCurrentQuestionIndex(nextQuestionIndex);
  if (currentQuestionIndexRef) {
    currentQuestionIndexRef.current = nextQuestionIndex;
  }

  return false; // Продолжаем с вопросами
}