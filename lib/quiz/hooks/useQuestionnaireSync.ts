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

  // Обновляем ref для questionnaire
  useEffect(() => {
    questionnaireForCallbackRef.current = questionnaire;
  }, [questionnaire]);

  // Обновляем ref для setQuestionnaireInStateMachine
  useEffect(() => {
    setQuestionnaireInStateMachineRef.current = quizStateMachine.setQuestionnaire;
  }, [quizStateMachine.setQuestionnaire]);

  // Синхронизация из React Query
  useEffect(() => {
    const queryId = questionnaireFromQuery?.id;
    const currentId = questionnaire?.id;
    
    if (questionnaireFromQuery && queryId && queryId !== currentId && queryId !== lastSyncedFromQueryIdRef.current) {
      lastSyncedFromQueryIdRef.current = queryId;
      clientLogger.log('🔄 Syncing questionnaire from React Query', {
        questionnaireId: questionnaireFromQuery.id,
        currentQuestionnaireId: questionnaire?.id,
      });
      setQuestionnaire(questionnaireFromQuery);
      questionnaireRef.current = questionnaireFromQuery;
      if (setQuestionnaireInStateMachineRef.current) {
        setQuestionnaireInStateMachineRef.current(questionnaireFromQuery);
      }
    }
  }, [questionnaireFromQuery?.id, questionnaire?.id, setQuestionnaire, questionnaireRef]);

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
      setQuestionnaire(previousStateMachineQuestionnaire);
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
      
      setQuestionnaire(questionnaireToSet);
      questionnaireRef.current = questionnaireToSet;
    } else if (questionnaireToSet) {
      questionnaireRef.current = questionnaireToSet;
    }
  }, [quizStateMachine, setQuestionnaire, questionnaireRef]);

  // Синхронизация loading из React Query
  useEffect(() => {
    const hasQuestionnaireAlready = !!questionnaire || !!questionnaireRef.current || !!quizStateMachine.questionnaire;
    
    if (isLoadingQuestionnaire && !hasQuestionnaireAlready) {
      setLoading(true);
    } else if (questionnaireFromQuery?.id) {
      setLoading(false);
    }
  }, [isLoadingQuestionnaire, questionnaireFromQuery?.id, questionnaire?.id, quizStateMachine.questionnaire?.id, setLoading]);

  // Синхронизация error из React Query
  useEffect(() => {
    if (questionnaireError) {
      setError('Ошибка загрузки анкеты. Пожалуйста, обновите страницу.');
    }
  }, [questionnaireError, setError]);

  return {
    setQuestionnaireWithStateMachine,
    lastSyncedFromQueryIdRef,
    setQuestionnaireInStateMachineRef,
  };
}
