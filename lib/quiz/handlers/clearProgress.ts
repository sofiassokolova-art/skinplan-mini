// lib/quiz/handlers/clearProgress.ts
// Вынесена функция clearProgress из quiz/page.tsx для улучшения читаемости и поддержки

import { api } from '@/lib/api';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';

export interface ClearProgressConfig {
  setSavedProgress: React.Dispatch<React.SetStateAction<{
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null>>;
  setShowResumeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  hasResumedRef: React.MutableRefObject<boolean>;
  setHasResumed: React.Dispatch<React.SetStateAction<boolean>>;
  lastSavedAnswerRef: React.MutableRefObject<{ questionId: number; answer: string | string[] } | null>;
}

/**
 * Создает функцию clearProgress с привязкой к конфигурации
 * Очищает сохранённый прогресс анкеты
 * Удаляет прогресс из localStorage, сбрасывает флаги восстановления и очищает прогресс на сервере
 * 
 * @param config Конфигурация для очистки прогресса
 * @returns Функция clearProgress с сигнатурой () => Promise<void>
 */
export function createClearProgress(config: ClearProgressConfig) {
  const {
    setSavedProgress,
    setShowResumeScreen,
    hasResumedRef,
    setHasResumed,
    lastSavedAnswerRef,
  } = config;

  return async (): Promise<void> => {
    if (typeof window === 'undefined') return;
    
    // ИСПРАВЛЕНО: Прогресс хранится в БД, очистка через API не требуется (прогресс удаляется при удалении ответов)
    setSavedProgress(null);
    setShowResumeScreen(false);
    // Сбрасываем флаги восстановления прогресса (и state, и ref)
    hasResumedRef.current = false;
    setHasResumed(false);
    // Сбрасываем кэш последнего сохраненного ответа
    lastSavedAnswerRef.current = null;
    
    // ФИКС: Очищаем флаг quiz_initCalled из sessionStorage при очистке прогресса
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem(QUIZ_CONFIG.STORAGE_KEYS.INIT_CALLED);
      } catch (err) {
        // Игнорируем ошибки sessionStorage
      }
    }
    
    // Также очищаем прогресс на сервере
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      try {
        await api.clearQuizProgress();
        clientLogger.log('✅ Прогресс очищен на сервере');
      } catch (err: any) {
        // Не критично, если не удалось очистить - прогресс просто не будет показываться
        clientLogger.warn('⚠️ Не удалось очистить прогресс на сервере:', err);
      }
    }
  };
}

