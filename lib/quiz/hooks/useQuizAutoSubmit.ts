// lib/quiz/hooks/useQuizAutoSubmit.ts
// ИСПРАВЛЕНО: Хук для управления автоматической отправкой ответов
// Вынесен из quiz/page.tsx для разделения логики

import { useState, useEffect, useRef, useMemo } from 'react';
import { clientLogger } from '@/lib/client-logger';
import type { Questionnaire } from '../types';

interface UseQuizAutoSubmitOptions {
  questionnaire: Questionnaire;
  allQuestions: any[];
  currentQuestionIndex: number;
  answersCount: number;
  isSubmitting: boolean;
  showResumeScreen: boolean;
  error: string | null;
  pendingInfoScreen: any;
  submitAnswersRef: React.MutableRefObject<(() => Promise<void>) | null>;
  isMountedRef: React.MutableRefObject<boolean>;
}

export function useQuizAutoSubmit(options: UseQuizAutoSubmitOptions) {
  const {
    questionnaire,
    allQuestions,
    currentQuestionIndex,
    answersCount,
    isSubmitting,
    showResumeScreen,
    error,
    pendingInfoScreen,
    submitAnswersRef,
    isMountedRef,
  } = options;

  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
  const autoSubmitTriggeredRef = useRef(false);

  useEffect(() => {
    autoSubmitTriggeredRef.current = autoSubmitTriggered;
  }, [autoSubmitTriggered]);

  // Оптимизация: Вычисляем условия автосабмита через useMemo
  const allAnswered = useMemo(() => {
    return questionnaire &&
        allQuestions.length > 0 &&
        currentQuestionIndex >= allQuestions.length &&
        answersCount >= allQuestions.length &&
        !isSubmitting &&
        !showResumeScreen &&
        !error &&
        !pendingInfoScreen &&
        !autoSubmitTriggeredRef.current;
  }, [
    questionnaire,
    allQuestions.length,
    currentQuestionIndex,
    answersCount,
    isSubmitting,
    showResumeScreen,
    error,
    pendingInfoScreen,
    autoSubmitTriggeredRef.current,
  ]);

  // ИСПРАВЛЕНО: Event-driven auto-submit вместо setTimeout
  useEffect(() => {
    
    if (allAnswered && submitAnswersRef.current) {
      clientLogger.log('✅ Все вопросы отвечены, автоматически отправляем ответы (event-driven)', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        answersCount,
      });
      
      autoSubmitTriggeredRef.current = true;
      setAutoSubmitTriggered(true);
      
      submitAnswersRef.current().catch((err) => {
        console.error('❌ Ошибка при автоматической отправке ответов:', err);
        if (isMountedRef.current) {
          try {
            autoSubmitTriggeredRef.current = false;
            setAutoSubmitTriggered(false);
          } catch (stateError) {
            clientLogger.warn('⚠️ Не удалось обновить состояние:', stateError);
          }
        }
      });
    }
  }, [
    currentQuestionIndex,
    allQuestions.length,
    answersCount,
    questionnaire,
    isSubmitting,
    showResumeScreen,
    autoSubmitTriggered,
    error,
    pendingInfoScreen,
    submitAnswersRef,
    isMountedRef,
  ]);

  return {
    autoSubmitTriggered,
    setAutoSubmitTriggered,
    autoSubmitTriggeredRef,
  };
}

