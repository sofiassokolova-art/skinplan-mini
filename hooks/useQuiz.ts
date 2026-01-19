// hooks/useQuiz.ts
// React Query хуки для работы с анкетой (quiz)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';

const QUIZ_QUERY_KEY = 'quiz';
const QUIZ_PROGRESS_QUERY_KEY = 'quiz-progress';

/**
 * Хук для получения активной анкеты (с кэшированием)
 * Анкета редко меняется, поэтому используем длительное кэширование
 */
export function useQuestionnaire() {
  return useQuery({
    queryKey: [QUIZ_QUERY_KEY, 'active'],
    queryFn: () => api.getActiveQuestionnaire() as Promise<any>,
    staleTime: QUIZ_CONFIG.REACT_QUERY.QUESTIONNAIRE_STALE_TIME,
    gcTime: QUIZ_CONFIG.REACT_QUERY.QUESTIONNAIRE_GC_TIME,
    retry: (failureCount, error: any) => {
      // Не повторяем при 403 (Forbidden) - это не временная ошибка
      if (error?.status === 403) {
        return false;
      }
      return failureCount < QUIZ_CONFIG.RETRY.QUESTIONNAIRE_MAX_ATTEMPTS;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Хук для получения прогресса анкеты (с кэшированием)
 * Прогресс может меняться чаще, поэтому используем более короткое кэширование
 * ИСПРАВЛЕНО: Обрабатываем 401 ошибки gracefully - если initData недоступен, возвращаем null
 */
export function useQuizProgress() {
  return useQuery({
    queryKey: [QUIZ_PROGRESS_QUERY_KEY],
    queryFn: async () => {
      try {
        return await api.getQuizProgress() as Promise<any>;
      } catch (error: any) {
        // Если initData недоступен (401), возвращаем null вместо ошибки
        // Это нормально для новых пользователей или при тестировании вне Telegram
        if (error?.status === 401 || error?.message?.includes('Unauthorized')) {
          return { progress: null, isCompleted: false };
        }
        throw error;
      }
    },
    staleTime: QUIZ_CONFIG.REACT_QUERY.PROGRESS_STALE_TIME,
    gcTime: QUIZ_CONFIG.REACT_QUERY.PROGRESS_GC_TIME,
    retry: (failureCount, error: any) => {
      // Не повторяем запрос при 401 (unauthorized) - это нормально, если initData недоступен
      if (error?.status === 401 || error?.message?.includes('Unauthorized')) {
        return false;
      }
      return failureCount < QUIZ_CONFIG.RETRY.PROGRESS_MAX_ATTEMPTS;
    },
    retryDelay: 1000,
  });
}

/**
 * Хук для сохранения прогресса анкеты (мутация)
 */
export function useSaveQuizProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      questionnaireId: number;
      questionId: number;
      answerValue?: string;
      answerValues?: string[];
      questionIndex?: number;
      infoScreenIndex?: number;
    }) => 
      api.saveQuizProgress(
        params.questionnaireId,
        params.questionId,
        params.answerValue,
        params.answerValues,
        params.questionIndex,
        params.infoScreenIndex
      ) as Promise<any>,
    onSuccess: () => {
      // Инвалидируем кэш прогресса после сохранения
      queryClient.invalidateQueries({ queryKey: [QUIZ_PROGRESS_QUERY_KEY] });
    },
    retry: QUIZ_CONFIG.RETRY.SAVE_PROGRESS_MAX_ATTEMPTS,
    retryDelay: 1000,
  });
}

/**
 * Хук для очистки прогресса анкеты (мутация)
 */
export function useClearQuizProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params?: { profileVersion?: number; cleanupId?: string }) =>
      api.clearQuizProgress(params?.profileVersion, params?.cleanupId) as Promise<any>,
    onSuccess: () => {
      // Инвалидируем кэш прогресса после очистки
      queryClient.invalidateQueries({ queryKey: [QUIZ_PROGRESS_QUERY_KEY] });
      // Также инвалидируем кэш анкеты, так как очистка может повлиять на состояние
      queryClient.invalidateQueries({ queryKey: [QUIZ_QUERY_KEY] });
    },
    retry: 1,
    retryDelay: 1000,
  });
}

