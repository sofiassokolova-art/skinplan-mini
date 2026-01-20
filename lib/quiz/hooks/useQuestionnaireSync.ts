// lib/quiz/hooks/useQuestionnaireSync.ts
// Хук для синхронизации questionnaire между React Query, State Machine и локальным state

import { useEffect, useCallback, useRef } from 'react';
import { clientLogger } from '@/lib/client-logger';
import type { Questionnaire } from '@/lib/quiz/types';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';

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
  const setQuestionnaireInStateMachineRef = useRef<((questionnaire: Questionnaire | null) => void) | null>(null);
  const questionnaireForCallbackRef = useRef<Questionnaire | null>(null);
  // ИСПРАВЛЕНО: Используем ref для setQuestionnaire, чтобы избежать включения функции в зависимости
  const setQuestionnaireRef = useRef(setQuestionnaire);


  // КРИТИЧНО ИСПРАВЛЕНО: Обновляем refs только при изменении значений
  // useEffect без зависимостей выполняется при каждом рендере, что может вызывать проблемы
  useEffect(() => {
    questionnaireForCallbackRef.current = questionnaire;
  }, [questionnaire]);
  
  useEffect(() => {
    setQuestionnaireRef.current = setQuestionnaire;
  }, [setQuestionnaire]);
  
  useEffect(() => {
    setQuestionnaireInStateMachineRef.current = quizStateMachine.setQuestionnaire;
  }, [quizStateMachine.setQuestionnaire]);

  // Синхронизация из React Query при появлении данных или смене анкеты
  const lastSyncedQuestionnaireIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (!questionnaireFromQuery?.id) {
      return;
    }

    if (lastSyncedQuestionnaireIdRef.current === questionnaireFromQuery.id) {
      return;
    }

    lastSyncedQuestionnaireIdRef.current = questionnaireFromQuery.id;

    // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
    // clientLogger.log('🔄 Syncing questionnaire from React Query', {...});

    // ИСПРАВЛЕНО: Используем ref для setQuestionnaire, чтобы избежать включения функции в зависимости
    const normalizedQuestionnaire = {
      ...questionnaireFromQuery,
      questions: extractQuestionsFromQuestionnaire(questionnaireFromQuery),
    };

    setQuestionnaireRef.current(normalizedQuestionnaire);
    questionnaireRef.current = normalizedQuestionnaire;
    if (setQuestionnaireInStateMachineRef.current) {
      setQuestionnaireInStateMachineRef.current(normalizedQuestionnaire);
    }
  }, [questionnaireFromQuery]);

  // Обертка для setQuestionnaire с синхронизацией State Machine
  // КРИТИЧНО: Используем ref для quizStateMachine, чтобы избежать пересоздания useCallback
  const quizStateMachineRef = useRef(quizStateMachine);
  useEffect(() => {
    quizStateMachineRef.current = quizStateMachine;
  }, [quizStateMachine]);
  
  const setQuestionnaireWithStateMachine = useCallback((
    newQuestionnaireOrUpdater: Questionnaire | null | ((prev: Questionnaire | null) => Questionnaire | null)
  ) => {
    let newQuestionnaire: Questionnaire | null;
    if (typeof newQuestionnaireOrUpdater === 'function') {
      const currentQuestionnaire = questionnaireForCallbackRef.current;
      // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
      // clientLogger.log('🔄 setQuestionnaireWithStateMachine: calling function updater', {...});
      newQuestionnaire = newQuestionnaireOrUpdater(currentQuestionnaire);
      // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
      // clientLogger.log('🔄 setQuestionnaireWithStateMachine: function updater returned', {...});
    } else {
      newQuestionnaire = newQuestionnaireOrUpdater;
    }
    
    // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
    // clientLogger.log('🔄 setQuestionnaireWithStateMachine called', {...});
    
    const stateMachine = quizStateMachineRef.current;
    const previousStateMachineQuestionnaire = stateMachine.questionnaire;
    stateMachine.setQuestionnaire(newQuestionnaire);
    const questionnaireFromStateMachine = stateMachine.getQuestionnaire();
    const questionnaireToSet = questionnaireFromStateMachine || previousStateMachineQuestionnaire;
    
    if (newQuestionnaire === null && questionnaireFromStateMachine === null && previousStateMachineQuestionnaire !== null) {
      // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
      // clientLogger.warn('🛡️ [State Machine] Protection triggered: prevented setting questionnaire to null', {...});
      setQuestionnaireRef.current(previousStateMachineQuestionnaire);
      questionnaireRef.current = previousStateMachineQuestionnaire;
      return;
    }
    
    const currentQuestionnaire = questionnaireForCallbackRef.current;
    if (questionnaireToSet !== currentQuestionnaire) {
      // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
      // clientLogger.log('🔄 Updating local questionnaire state from State Machine', {...});
      
      setQuestionnaireRef.current(questionnaireToSet);
      questionnaireRef.current = questionnaireToSet;
    } else if (questionnaireToSet) {
      questionnaireRef.current = questionnaireToSet;
    }
    // ИСПРАВЛЕНО: Убраны все зависимости - используем refs для стабильности
    // Это предотвращает пересоздание функции на каждом рендере
  }, []); // ПУСТЫЕ ЗАВИСИМОСТИ - используем refs для всех значений

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
    setQuestionnaireInStateMachineRef,
  };
}
