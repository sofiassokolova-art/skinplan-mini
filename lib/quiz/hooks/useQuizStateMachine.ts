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
  
  // Создаем State Machine один раз при монтировании
  const stateMachineRef = useRef<QuizStateMachine | null>(null);
  if (stateMachineRef.current === null) {
    stateMachineRef.current = new QuizStateMachine(initialState);
  }
  
  // State для React (синхронизируется с State Machine)
  const [state, setState] = useState<QuizState>(() => 
    stateMachineRef.current?.getState() || initialState
  );
  
  // Подписываемся на изменения состояния
  useEffect(() => {
    const stateMachine = stateMachineRef.current;
    if (!stateMachine) return;
    
    const listener = (newState: QuizState) => {
      const previousState = state;
      setState(newState);
      
      if (onStateChange) {
        onStateChange(newState, previousState);
      }
    };
    
    stateMachine.subscribe(listener);
    
    // Инициализируем state, если он еще не установлен
    const currentState = stateMachine.getState();
    if (currentState !== state) {
      setState(currentState);
    }
    
    return () => {
      stateMachine.unsubscribe(listener);
    };
  }, [state, onStateChange]);
  
  // Функция для отправки событий
  const dispatch = useCallback((event: QuizEvent) => {
    const stateMachine = stateMachineRef.current;
    if (!stateMachine) {
      console.error('State Machine not initialized');
      return false;
    }
    
    const previousState = stateMachine.getState();
    const success = stateMachine.dispatch(event);
    
    if (!success && onTransitionError) {
      onTransitionError(event, previousState);
    }
    
    return success;
  }, [onTransitionError]);
  
  // Функция для получения текущего состояния
  const getState = useCallback(() => {
    return stateMachineRef.current?.getState() || initialState;
  }, [initialState]);
  
  // Функция для сброса State Machine
  const reset = useCallback((newInitialState?: QuizState) => {
    const stateMachine = stateMachineRef.current;
    if (!stateMachine) return;
    
    const resetState = newInitialState || initialState;
    stateMachine.reset(resetState);
    setState(resetState);
  }, [initialState]);
  
  // Вспомогательные функции для проверки состояния
  const isState = useCallback((targetState: QuizState) => {
    return state === targetState;
  }, [state]);
  
  const isAnyState = useCallback((targetStates: QuizState[]) => {
    return targetStates.includes(state);
  }, [state]);
  
  return {
    state,
    dispatch,
    getState,
    reset,
    isState,
    isAnyState,
    stateMachine: stateMachineRef.current,
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

