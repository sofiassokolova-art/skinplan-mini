// lib/quiz/hooks/useRetakeAnswersLoader.ts
// Хук для загрузки предыдущих ответов при перепрохождении анкеты

import { useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';
import type { Questionnaire } from '../types';

interface UseRetakeAnswersLoaderParams {
  isRetakingQuiz: boolean;
  questionnaire: Questionnaire;
  setAnswers: (answers: Record<number, string | string[]>) => void;
  setCurrentQuestionIndex: (index: number) => void;
}

/**
 * Хук для загрузки предыдущих ответов при перепрохождении анкеты
 */
export function useRetakeAnswersLoader({
  isRetakingQuiz,
  questionnaire,
  setAnswers,
  setCurrentQuestionIndex,
}: UseRetakeAnswersLoaderParams) {
  useEffect(() => {
    if (
      !isRetakingQuiz ||
      !questionnaire ||
      typeof window === 'undefined' ||
      !window.Telegram?.WebApp?.initData
    ) {
      return;
    }

    clientLogger.log('🔄 Загружаем предыдущие ответы для повторного прохождения...');
    
    (async () => {
      const quiz = questionnaire;
      if (!quiz) {
        clientLogger.warn('⚠️ Cannot load previous answers: questionnaire not loaded');
        return;
      }
      
      try {
        const response = await fetch(`/api/questionnaire/progress?retaking=true`, {
          headers: {
            'X-Telegram-Init-Data': typeof window !== 'undefined' && window.Telegram?.WebApp?.initData
              ? window.Telegram.WebApp.initData
              : '',
          },
        });

        if (response.ok) {
          const data = await response.json() as {
            progress?: {
              answers: Record<number, string | string[]>;
              questionIndex: number;
              infoScreenIndex: number;
            } | null;
          };
          
          if (data?.progress?.answers && Object.keys(data.progress.answers).length > 0) {
            clientLogger.log('✅ Загружены предыдущие ответы для повторного прохождения:', Object.keys(data.progress.answers).length, 'ответов');
            setAnswers(data.progress.answers);
            if (data.progress.questionIndex !== undefined && data.progress.questionIndex >= 0) {
              setCurrentQuestionIndex(data.progress.questionIndex);
            }
          }
        }
      } catch (err: any) {
        clientLogger.warn('⚠️ Ошибка загрузки предыдущих ответов:', err);
      }
    })();
  }, [isRetakingQuiz, questionnaire, setAnswers, setCurrentQuestionIndex]);
}
