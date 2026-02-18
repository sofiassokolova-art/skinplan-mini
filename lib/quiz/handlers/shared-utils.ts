// lib/quiz/handlers/shared-utils.ts
// Общие утилиты для quiz handlers (handleNext, handleBack, handleAnswer)
// Вынесены для устранения дублирования кода

import { clientLogger } from '@/lib/client-logger';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire } from '@/lib/quiz/types';
import { safeSessionStorageSet } from '@/lib/storage-utils';

/**
 * Сохраняет индекс или код вопроса в sessionStorage с обработкой ошибок
 * ИСПРАВЛЕНО: БАГ #3 - принимает string для поддержки скоупленных ключей
 */
export function saveIndexToSessionStorage(
  key: string,
  value: number | string,
  logMessage?: string
): void {
  const saved = safeSessionStorageSet(key, String(value));
  if (saved && logMessage) {
    clientLogger.log(logMessage, { value, key });
  } else if (!saved) {
    clientLogger.warn(`⚠️ Не удалось сохранить ${key} в sessionStorage`);
  }
}

/**
 * Сохраняет прогресс с обработкой ошибок
 */
export async function saveProgressSafely(
  saveProgress: (answers: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => Promise<void>,
  answers: Record<number, string | string[]>,
  questionIndex: number,
  infoScreenIndex: number
): Promise<void> {
  try {
    await saveProgress(answers, questionIndex, infoScreenIndex);
  } catch (err) {
    clientLogger.warn('⚠️ Ошибка при сохранении прогресса', err);
  }
}

/**
 * Обновляет ref и state синхронно для индекса инфо-экрана
 */
export function updateInfoScreenIndex(
  newIndex: number,
  currentInfoScreenIndexRef: React.MutableRefObject<number>,
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>
): void {
  currentInfoScreenIndexRef.current = newIndex;
  setCurrentInfoScreenIndex(newIndex);
}

/**
 * Обновляет ref и state синхронно для индекса вопроса
 */
export function updateQuestionIndex(
  newIndex: number,
  currentQuestionIndexRef: React.MutableRefObject<number> | undefined,
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>
): void {
  if (currentQuestionIndexRef) {
    currentQuestionIndexRef.current = newIndex;
  }
  setCurrentQuestionIndex(newIndex);
}

/**
 * Проверяет, находится ли пользователь на вопросах (не на начальных инфо-экранах)
 */
export function isOnQuestions(
  currentInfoScreenIndex: number,
  currentInfoScreenIndexRef: React.MutableRefObject<number>
): boolean {
  const initialInfoScreens = getInitialInfoScreens();
  const isOnQuestionsByState = currentInfoScreenIndex >= initialInfoScreens.length;
  const isOnQuestionsByRef = currentInfoScreenIndexRef.current >= initialInfoScreens.length;
  return isOnQuestionsByState || isOnQuestionsByRef;
}

/**
 * Проверяет, загружена ли анкета
 */
export function hasQuestionnaire(
  questionnaire: Questionnaire | null,
  questionnaireRef: React.MutableRefObject<Questionnaire | null>
): boolean {
  return !!(questionnaire || questionnaireRef.current);
}

/**
 * Проверяет, можно ли продолжить навигацию (анкета загружена или мы на начальных экранах)
 */
export function canNavigate(
  currentInfoScreenIndex: number,
  questionnaire: Questionnaire | null,
  questionnaireRef: React.MutableRefObject<Questionnaire | null>
): boolean {
  const initialInfoScreens = getInitialInfoScreens();
  const isOnInitialScreens = currentInfoScreenIndex < initialInfoScreens.length;
  const hasQuestionnaireData = hasQuestionnaire(questionnaire, questionnaireRef);
  
  // На начальных экранах анкета не нужна
  if (isOnInitialScreens) {
    return true;
  }
  
  // На вопросах анкета обязательна
  return hasQuestionnaireData;
}
