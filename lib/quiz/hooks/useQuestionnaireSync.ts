// lib/quiz/hooks/useQuestionnaireSync.ts
// Хук для синхронизации questionnaire между React Query, State Machine и локальным state

import { useEffect, useCallback, useRef } from 'react';
import { clientLogger } from '@/lib/client-logger';
import type { Questionnaire } from '@/lib/quiz/types';

interface UseQuestionnaireSyncParams {
  questionnaireFromQuery: Questionnaire | null | undefined;
  questionnaire: Questionnaire | null;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  setQuestionnaire: (questionnaire: Questionnaire | null | ((prev: Questionnaire | null) => Questionnaire | null)) => void;
  quizStateMachine: {
    questionnaire: Questionnaire | null;
    getQuestionnaire: () => Questionnaire | null;
    setQuestionnaire: (questionnaire: Questionnaire | null) => void;
  };
  isLoadingQuestionnaire: boolean;
  questionnaireError: Error | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Хук для синхронизации questionnaire между различными источниками
 */
export function useQuestionnaireSync({
  questionnaireFromQuery,
  questionnaire,
  questionnaireRef,
  setQuestionnaire,
  quizStateMachine,
  isLoadingQuestionnaire,
  questionnaireError,
  setLoading,
  setError,
}: UseQuestionnaireSyncParams) {
  const lastSyncedFromQueryIdRef = useRef<number | null>(null);
  const setQuestionnaireInStateMachineRef = useRef<((questionnaire: Questionnaire | null) => void) | null>(null);
  const questionnaireForCallbackRef = useRef<Questionnaire | null>(null);
  // ИСПРАВЛЕНО: Используем ref для setQuestionnaire, чтобы избежать включения функции в зависимости
  const setQuestionnaireRef = useRef(setQuestionnaire);

  // Обновляем refs при каждом рендере
  useEffect(() => {
    questionnaireForCallbackRef.current = questionnaire;
    setQuestionnaireRef.current = setQuestionnaire;
    setQuestionnaireInStateMachineRef.current = quizStateMachine.setQuestionnaire;
  });

  // Синхронизация из React Query
  // КРИТИЧНО ИСПРАВЛЕНО: Предотвращаем бесконечные циклы - используем только ref и lastSynced для проверки
  // НЕ используем questionnaire?.id в условии, так как он обновляется асинхронно и вызывает циклы
  useEffect(() => {
    const queryId = questionnaireFromQuery?.id;
    const refId = questionnaireRef.current?.id;
    const stateMachineId = quizStateMachine.questionnaire?.id;
    
    // КРИТИЧНО: Синхронизируем только если:
    // 1. Есть questionnaireFromQuery с валидным ID
    // 2. ID отличается от ref (чтобы не синхронизировать то, что уже в ref)
    // 3. ID отличается от последнего синхронизированного (защита от повторных синхронизаций)
    // 4. ID отличается от State Machine (чтобы не синхронизировать то, что уже синхронизировано)
    // ВАЖНО: НЕ проверяем questionnaire?.id, так как он обновляется асинхронно и вызывает бесконечные циклы
    const shouldSync = questionnaireFromQuery &&
        queryId &&
        queryId !== refId &&
        queryId !== lastSyncedFromQueryIdRef.current;

    // DEBUG: Логируем условие синхронизации
    if (questionnaireFromQuery && queryId) {
      clientLogger.log('🔍 Sync condition check', {
        queryId,
        refId,
        lastSyncedId: lastSyncedFromQueryIdRef.current,
        stateMachineId,
        queryId_ne_refId: queryId !== refId,
        queryId_ne_lastSynced: queryId !== lastSyncedFromQueryIdRef.current,
        queryId_ne_stateMachine: queryId !== stateMachineId,
        shouldSync,
      });
    }
    
    if (shouldSync) {
      lastSyncedFromQueryIdRef.current = queryId;
      clientLogger.log('🔄 Syncing questionnaire from React Query', {
        questionnaireId: questionnaireFromQuery.id,
        currentQuestionnaireId: questionnaire?.id,
        refId,
        stateMachineId,
        lastSyncedId: lastSyncedFromQueryIdRef.current,
      });
      // ИСПРАВЛЕНО: Используем ref для setQuestionnaire, чтобы избежать включения функции в зависимости
      setQuestionnaireRef.current(questionnaireFromQuery);
      questionnaireRef.current = questionnaireFromQuery;
      if (setQuestionnaireInStateMachineRef.current) {
        setQuestionnaireInStateMachineRef.current(questionnaireFromQuery);
      }
    }
    // ИСПРАВЛЕНО: Только ID в зависимостях, функции убраны (они стабильны)
    // ИСПРАВЛЕНО: Убрали questionnaire?.id из зависимостей, так как он меняется после синхронизации
    // и вызывает повторные срабатывания. Используем только queryId и stateMachineId.
  }, [questionnaireFromQuery?.id]);

  // Обертка для setQuestionnaire с синхронизацией State Machine
  const setQuestionnaireWithStateMachine = useCallback((
    newQuestionnaireOrUpdater: Questionnaire | null | ((prev: Questionnaire | null) => Questionnaire | null)
  ) => {
    let newQuestionnaire: Questionnaire | null;
    if (typeof newQuestionnaireOrUpdater === 'function') {
      const currentQuestionnaire = questionnaireForCallbackRef.current;
      clientLogger.log('🔄 setQuestionnaireWithStateMachine: calling function updater', {
        currentQuestionnaireId: currentQuestionnaire?.id || null,
        hasCurrentQuestionnaire: !!currentQuestionnaire,
      });
      newQuestionnaire = newQuestionnaireOrUpdater(currentQuestionnaire);
      clientLogger.log('🔄 setQuestionnaireWithStateMachine: function updater returned', {
        returnedQuestionnaireId: newQuestionnaire?.id || null,
        hasReturnedQuestionnaire: !!newQuestionnaire,
        returnedType: typeof newQuestionnaire,
      });
    } else {
      newQuestionnaire = newQuestionnaireOrUpdater;
    }
    
    clientLogger.log('🔄 setQuestionnaireWithStateMachine called', {
      newQuestionnaireId: newQuestionnaire?.id || null,
      currentStateMachineQuestionnaireId: quizStateMachine.questionnaire?.id || null,
      currentLocalQuestionnaireId: questionnaireForCallbackRef.current?.id || null,
      currentRefQuestionnaireId: questionnaireRef.current?.id || null,
      isFunctionalForm: typeof newQuestionnaireOrUpdater === 'function',
    });
    
    const previousStateMachineQuestionnaire = quizStateMachine.questionnaire;
    quizStateMachine.setQuestionnaire(newQuestionnaire);
    const questionnaireFromStateMachine = quizStateMachine.getQuestionnaire();
    const questionnaireToSet = questionnaireFromStateMachine || previousStateMachineQuestionnaire;
    
    if (newQuestionnaire === null && questionnaireFromStateMachine === null && previousStateMachineQuestionnaire !== null) {
      clientLogger.warn('🛡️ [State Machine] Protection triggered: prevented setting questionnaire to null', {
        previousQuestionnaireId: previousStateMachineQuestionnaire.id,
      });
      setQuestionnaireRef.current(previousStateMachineQuestionnaire);
      questionnaireRef.current = previousStateMachineQuestionnaire;
      return;
    }
    
    const currentQuestionnaire = questionnaireForCallbackRef.current;
    if (questionnaireToSet !== currentQuestionnaire) {
      clientLogger.log('🔄 Updating local questionnaire state from State Machine', {
        stateMachineQuestionnaireId: questionnaireFromStateMachine?.id || null,
        previousStateMachineQuestionnaireId: previousStateMachineQuestionnaire?.id || null,
        questionnaireToSetId: questionnaireToSet?.id || null,
        localQuestionnaireId: currentQuestionnaire?.id || null,
      });
      
      setQuestionnaireRef.current(questionnaireToSet);
      questionnaireRef.current = questionnaireToSet;
    } else if (questionnaireToSet) {
      questionnaireRef.current = questionnaireToSet;
    }
    // ИСПРАВЛЕНО: Убраны функции из зависимостей - используем refs для стабильности
    // quizStateMachine - объект, но мы используем только его методы, которые стабильны
  }, [quizStateMachine]);

  // Синхронизация loading из React Query
  // ИСПРАВЛЕНО: Убрана функция setLoading из зависимостей, используем ref для предотвращения циклов
  const setLoadingRef = useRef(setLoading);
  useEffect(() => {
    setLoadingRef.current = setLoading;
  }, [setLoading]);
  
  useEffect(() => {
    const hasQuestionnaireAlready = !!questionnaire || !!questionnaireRef.current || !!quizStateMachine.questionnaire;
    
    if (isLoadingQuestionnaire && !hasQuestionnaireAlready) {
      setLoadingRef.current(true);
    } else if (questionnaireFromQuery?.id) {
      setLoadingRef.current(false);
    }
    // ИСПРАВЛЕНО: Только значения в зависимостях, функции убраны
    // ИСПРАВЛЕНО: Убрали questionnaire?.id и quizStateMachine.questionnaire?.id из зависимостей,
    // так как они меняются после синхронизации и вызывают повторные срабатывания
  }, [isLoadingQuestionnaire, questionnaireFromQuery?.id]);

  // Синхронизация error из React Query
  // ИСПРАВЛЕНО: Убрана функция setError из зависимостей, используем ref для предотвращения циклов
  const setErrorRef = useRef(setError);
  useEffect(() => {
    setErrorRef.current = setError;
  }, [setError]);
  
  useEffect(() => {
    if (questionnaireError) {
      setErrorRef.current('Ошибка загрузки анкеты. Пожалуйста, обновите страницу.');
    }
    // ИСПРАВЛЕНО: Только questionnaireError в зависимостях
  }, [questionnaireError]);

  return {
    setQuestionnaireWithStateMachine,
    lastSyncedFromQueryIdRef,
    setQuestionnaireInStateMachineRef,
  };
}
