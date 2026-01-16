// lib/quiz/hooks/useQuizStateMachine.ts
// Хук для использования QuizStateMachine в React компонентах

import { useEffect, useState, useRef, useCallback } from 'react';
import { QuizStateMachine, type QuizState, type QuizEvent } from '../quiz-state-machine';

export interface UseQuizStateMachineOptions {
  initialState?: QuizState;
  onStateChange?: (state: QuizState, previousState: QuizState) => void;
  onTransitionError?: (event: QuizEvent, from: QuizState) => void;
}

export function useQuizStateMachine(options: UseQuizStateMachineOptions = {}) {
  const { initialState = 'LOADING', onStateChange, onTransitionError } = options;
  
  // КРИТИЧНО ИСПРАВЛЕНО: Создаем State Machine один раз при монтировании
  // Используем useRef с ленивой инициализацией через функцию, чтобы избежать проблем с порядком хуков
  const stateMachineRef = useRef<QuizStateMachine | null>(null);
  if (stateMachineRef.current === null) {
    stateMachineRef.current = new QuizStateMachine(initialState);
  }
  
  // КРИТИЧНО ИСПРАВЛЕНО: Используем функцию-инициализатор для useState, чтобы значение вычислялось только один раз
  // Это предотвращает проблемы с порядком хуков и React Error #300
  const [state, setState] = useState<QuizState>(() => {
    return stateMachineRef.current?.getState() || initialState;
  });
  
  // КРИТИЧНО ИСПРАВЛЕНО: Инициализируем ref начальным состоянием из state machine
  // Используем ref для хранения предыдущего состояния в listener, чтобы избежать бесконечных циклов
  // КРИТИЧНО: useRef не принимает функцию, поэтому вычисляем значение заранее
  const initialPreviousState = stateMachineRef.current?.getState() || initialState;
  const previousStateRef = useRef<QuizState>(initialPreviousState);
  
  // Подписываемся на изменения состояния
  // ИСПРАВЛЕНО: Убрали state из зависимостей, чтобы избежать бесконечных циклов
  
  // КРИТИЧНО: Используем ref для onStateChange, чтобы избежать пересоздания подписки
  const onStateChangeRef = useRef(onStateChange);
  const onTransitionErrorRef = useRef(onTransitionError);
  
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
    onTransitionErrorRef.current = onTransitionError;
  }, [onStateChange, onTransitionError]);
  
  useEffect(() => {
    const stateMachine = stateMachineRef.current;
    if (!stateMachine) return;
    
    const listener = (newState: QuizState) => {
      const previousState = previousStateRef.current;
      previousStateRef.current = newState;
      setState(newState);
      
      if (onStateChangeRef.current) {
        onStateChangeRef.current(newState, previousState);
      }
    };
    
    // subscribe возвращает функцию для отписки
    const unsubscribe = stateMachine.subscribe(listener);
    
    // Инициализируем state только один раз при монтировании
    // ИСПРАВЛЕНО: Убрали проверку currentState !== state, чтобы избежать циклов
    const currentState = stateMachine.getState();
    if (previousStateRef.current !== currentState) {
      previousStateRef.current = currentState;
      setState(currentState);
    }
    
    return unsubscribe;
  }, []); // ПУСТЫЕ ЗАВИСИМОСТИ - используем refs для колбэков
  
  // Функция для отправки событий
  const dispatch = useCallback((event: QuizEvent) => {
    const stateMachine = stateMachineRef.current;
    if (!stateMachine) {
      console.error('State Machine not initialized');
      return false;
    }
    
    const previousState = stateMachine.getState();
    const success = stateMachine.dispatch(event);
    
    if (!success && onTransitionErrorRef.current) {
      onTransitionErrorRef.current(event, previousState);
    }
    
    return success;
  }, []); // ПУСТЫЕ ЗАВИСИМОСТИ - используем ref для onTransitionError
  
  // Функция для получения текущего состояния
  const getState = useCallback(() => {
    return stateMachineRef.current?.getState() || initialState;
  }, [initialState]);
  
  // Функция для сброса State Machine
  // ИСПРАВЛЕНО: QuizStateMachine не имеет метода reset, создаем новый экземпляр
  const reset = useCallback((newInitialState?: QuizState) => {
    const resetState = newInitialState || initialState;
    // Создаем новый экземпляр State Machine с новым начальным состоянием
    stateMachineRef.current = new QuizStateMachine(resetState);
    setState(resetState);
    // ИСПРАВЛЕНО: При сбросе State Machine также сбрасываем questionnaire
    stateMachineRef.current.resetQuestionnaire();
    setQuestionnaireState(null);
  }, [initialState]);
  
  // Вспомогательные функции для проверки состояния
  const isState = useCallback((targetState: QuizState) => {
    return state === targetState;
  }, [state]);
  
  const isAnyState = useCallback((targetStates: QuizState[]) => {
    return targetStates.includes(state);
  }, [state]);
  
  // КРИТИЧНО ИСПРАВЛЕНО: Добавляем управление questionnaire через State Machine
  // Используем функцию-инициализатор для стабильности
  const [questionnaire, setQuestionnaireState] = useState<any | null>(() => {
    // КРИТИЧНО: Вычисляем значение только один раз при первом рендере
    // Это предотвращает React Error #300 из-за нестабильных значений
    return stateMachineRef.current?.getQuestionnaire() || null;
  });

  // Подписываемся на изменения questionnaire
  useEffect(() => {
    const stateMachine = stateMachineRef.current;
    if (!stateMachine) return;

    const unsubscribe = stateMachine.subscribeToQuestionnaire((newQuestionnaire) => {
      setQuestionnaireState(newQuestionnaire);
    });

    return unsubscribe;
  }, []);

  // Функция для установки questionnaire через State Machine
  const setQuestionnaire = useCallback((newQuestionnaire: any | null) => {
    const stateMachine = stateMachineRef.current;
    if (!stateMachine) {
      console.error('State Machine not initialized');
      return;
    }
    stateMachine.setQuestionnaire(newQuestionnaire);
  }, []);

  // Функция для получения questionnaire
  const getQuestionnaire = useCallback(() => {
    return stateMachineRef.current?.getQuestionnaire() || null;
  }, []);

  return {
    state,
    dispatch,
    getState,
    reset,
    isState,
    isAnyState,
    stateMachine: stateMachineRef.current,
    // ИСПРАВЛЕНО: Добавляем questionnaire в возвращаемый объект
    questionnaire,
    setQuestionnaire,
    getQuestionnaire,
  };
}

// Вспомогательные хуки для конкретных состояний
export function useQuizStateIsLoading(state: QuizState) {
  return state === 'LOADING';
}

export function useQuizStateIsIntro(state: QuizState) {
  return state === 'INTRO';
}

export function useQuizStateIsResume(state: QuizState) {
  return state === 'RESUME';
}

export function useQuizStateIsQuestions(state: QuizState) {
  return state === 'QUESTIONS';
}

export function useQuizStateIsSubmitting(state: QuizState) {
  return state === 'SUBMITTING';
}

export function useQuizStateIsDone(state: QuizState) {
  return state === 'DONE';
}

