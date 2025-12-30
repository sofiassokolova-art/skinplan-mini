// lib/quiz/utils/quizSync.ts
// Утилиты для синхронизации состояния анкеты
// Однонаправленная синхронизация: State Machine -> Ref -> State

import { useEffect, useRef } from 'react';
import { clientLogger } from '@/lib/client-logger';

export interface UseQuizSyncParams {
  stateMachineQuestionnaire: any | null;
  setQuestionnaire: (q: any | null) => void;
  questionnaireRef: React.MutableRefObject<any | null>;
  isSyncingRef: React.MutableRefObject<boolean>;
}

/**
 * Хук для однонаправленной синхронизации состояния анкеты
 * State Machine -> Ref -> State (только при необходимости)
 * 
 * Это предотвращает бесконечные циклы React error #310
 * и упрощает управление состоянием
 */
export function useQuizSync({
  stateMachineQuestionnaire,
  setQuestionnaire,
  questionnaireRef,
  isSyncingRef,
}: UseQuizSyncParams) {
  const lastSyncedIdRef = useRef<number | null>(null);
  const stateQuestionnaireRef = useRef<any | null>(null);

  useEffect(() => {
    // Защита от рекурсивных вызовов
    if (isSyncingRef.current) {
      return;
    }

    const stateMachineId = stateMachineQuestionnaire?.id;
    const currentStateId = stateQuestionnaireRef.current?.id;

    // Если State Machine изменился, синхронизируем
    if (stateMachineId && stateMachineId !== lastSyncedIdRef.current) {
      // Проверяем, действительно ли объект изменился
      if (stateMachineQuestionnaire !== stateQuestionnaireRef.current) {
        isSyncingRef.current = true;
        try {
          clientLogger.log('🔄 useQuizSync: синхронизация из State Machine', {
            stateMachineId,
            currentStateId,
            lastSyncedId: lastSyncedIdRef.current,
          });

          // Обновляем ref
          questionnaireRef.current = stateMachineQuestionnaire;
          stateQuestionnaireRef.current = stateMachineQuestionnaire;

          // Обновляем state только если он действительно отличается
          // Используем setTimeout для отложенного обновления, чтобы избежать бесконечных циклов
          setTimeout(() => {
            if (stateQuestionnaireRef.current?.id === stateMachineId) {
              setQuestionnaire(stateMachineQuestionnaire);
            }
            isSyncingRef.current = false;
          }, 0);
        } catch (error) {
          isSyncingRef.current = false;
          clientLogger.error('❌ useQuizSync: ошибка синхронизации', error);
        }

        lastSyncedIdRef.current = stateMachineId;
      }
    }
  }, [stateMachineQuestionnaire?.id]); // Зависим только от ID, а не от всего объекта
}

/**
 * Утилита для проверки, нужно ли синхронизировать состояние
 */
export function shouldSyncQuestionnaire(
  source: any | null,
  target: any | null
): boolean {
  if (!source && !target) return false;
  if (!source || !target) return true;
  return source.id !== target.id || source !== target;
}

/**
 * Утилита для безопасного обновления ref без триггера рендера
 */
export function updateQuestionnaireRef(
  ref: React.MutableRefObject<any | null>,
  newQuestionnaire: any | null
): void {
  if (ref.current !== newQuestionnaire) {
    ref.current = newQuestionnaire;
  }
}

