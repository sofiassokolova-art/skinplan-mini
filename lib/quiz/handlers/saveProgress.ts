// lib/quiz/handlers/saveProgress.ts
// Вынесена функция saveProgress из quiz/page.tsx для улучшения читаемости и поддержки

import { clientLogger } from '@/lib/client-logger';
import type { Questionnaire } from '@/lib/quiz/types';

export interface SaveProgressConfig {
  questionnaire: Questionnaire | null;
  currentQuestionIndexRef: React.MutableRefObject<number>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  saveQuizProgressMutation: {
    mutateAsync: (params: {
      questionnaireId: number;
      questionId: number;
      answerValue?: string;
      answerValues?: string[];
      questionIndex?: number;
      infoScreenIndex?: number;
    }) => Promise<any>;
  };
  pendingProgressRef: React.MutableRefObject<{ questionIndex?: number; infoScreenIndex?: number } | null>;
  saveProgressTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  isDev: boolean;
}

/**
 * Создает функцию saveProgress с привязкой к конфигурации
 * Сохраняет прогресс анкеты в localStorage и на сервер
 * Использует debouncing для оптимизации - сохраняет не сразу, а через задержку
 * Это уменьшает количество запросов к серверу при быстрых переходах между экранами
 * 
 * @param config Конфигурация для сохранения прогресса
 * @returns Функция saveProgress с сигнатурой (answers?, questionIndex?, infoScreenIndex?) => Promise<void>
 */
export function createSaveProgress(config: SaveProgressConfig) {
  const {
    questionnaire,
    currentQuestionIndexRef,
    currentInfoScreenIndexRef,
    saveQuizProgressMutation,
    pendingProgressRef,
    saveProgressTimeoutRef,
    isDev,
  } = config;

  return async (
    newAnswers?: Record<number, string | string[]>,
    newQuestionIndex?: number,
    newInfoScreenIndex?: number
  ): Promise<void> => {
    if (typeof window === 'undefined') return;
    
    // ИСПРАВЛЕНО: Сохраняем метаданные позиции (questionIndex, infoScreenIndex) в БД через API
    // Это критично для правильного восстановления прогресса после перезагрузки страницы
    if (questionnaire && (newQuestionIndex !== undefined || newInfoScreenIndex !== undefined)) {
      // ИСПРАВЛЕНО: Сохраняем метаданные в pendingProgressRef для batch-сохранения
      // Используем переданные значения или текущие из refs
      const questionIndex = newQuestionIndex !== undefined ? newQuestionIndex : currentQuestionIndexRef.current;
      const infoScreenIndex = newInfoScreenIndex !== undefined ? newInfoScreenIndex : currentInfoScreenIndexRef.current;
      
      // Обновляем pendingProgressRef с последними значениями
      pendingProgressRef.current = {
        questionIndex: pendingProgressRef.current?.questionIndex !== undefined 
          ? (newQuestionIndex !== undefined ? newQuestionIndex : pendingProgressRef.current.questionIndex)
          : questionIndex,
        infoScreenIndex: pendingProgressRef.current?.infoScreenIndex !== undefined
          ? (newInfoScreenIndex !== undefined ? newInfoScreenIndex : pendingProgressRef.current.infoScreenIndex)
          : infoScreenIndex,
      };
      
      // ИСПРАВЛЕНО: Очищаем предыдущий таймаут, если он есть
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
      }
      
      // ИСПРАВЛЕНО: Устанавливаем новый таймаут для debouncing (500ms)
      // Это позволяет собирать несколько изменений и отправлять их одним запросом
      saveProgressTimeoutRef.current = setTimeout(async () => {
        try {
          const finalQuestionIndex = pendingProgressRef.current?.questionIndex ?? questionIndex;
          const finalInfoScreenIndex = pendingProgressRef.current?.infoScreenIndex ?? infoScreenIndex;
          
          // Сохраняем только метаданные позиции (questionId = -1 означает только метаданные)
          // ФИКС: Используем React Query мутацию вместо прямого вызова API
          await saveQuizProgressMutation.mutateAsync({
            questionnaireId: questionnaire.id,
            questionId: -1, // questionId = -1 означает только метаданные позиции
            answerValue: undefined,
            answerValues: undefined,
            questionIndex: finalQuestionIndex,
            infoScreenIndex: finalInfoScreenIndex,
          });
          
          clientLogger.log('✅ Метаданные позиции сохранены (debounced)', {
            questionIndex: finalQuestionIndex,
            infoScreenIndex: finalInfoScreenIndex,
            questionnaireId: questionnaire.id,
          });
          
          // Очищаем pendingProgressRef после успешного сохранения
          pendingProgressRef.current = null;
        } catch (err: any) {
          // Не критично, если не удалось сохранить - прогресс все равно будет восстановлен из ответов
          // ФИКС: Не логируем 401 ошибки как предупреждения, если initData действительно недоступен
          // Это нормальная ситуация при разработке или если пользователь не в Telegram
          const is401Error = err?.message?.includes('401') || err?.message?.includes('Unauthorized');
          const hasInitData = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
          
          if (is401Error && !hasInitData) {
            // Это ожидаемо, если initData недоступен - не логируем как ошибку
            if (isDev) {
              clientLogger.log('ℹ️ Метаданные позиции не сохранены (initData недоступен, это нормально)');
            }
          } else {
            clientLogger.warn('⚠️ Не удалось сохранить метаданные позиции:', err?.message);
          }
        } finally {
          saveProgressTimeoutRef.current = null;
        }
      }, 500); // 500ms debounce - достаточно для batch-сохранения, но не слишком долго
    }
  };
}

