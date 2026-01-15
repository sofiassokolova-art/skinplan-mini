// lib/quiz/hooks/useQuizUI.ts
// Хук для управления UI состояниями анкеты
// Вынесен из useQuizStateExtended для разделения ответственности

import { useState, useRef, useEffect, useCallback } from 'react';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface UseQuizUIReturn {
  // UI состояния
  showResumeScreen: boolean;
  setShowResumeScreen: React.Dispatch<React.SetStateAction<boolean>>;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  isSubmittingRef: React.MutableRefObject<boolean>;
  finalizing: boolean;
  setFinalizing: React.Dispatch<React.SetStateAction<boolean>>;
  finalizingStep: 'answers' | 'plan' | 'done';
  setFinalizingStep: React.Dispatch<React.SetStateAction<'answers' | 'plan' | 'done'>>;
  finalizeError: string | null;
  setFinalizeError: React.Dispatch<React.SetStateAction<string | null>>;
  pendingInfoScreen: InfoScreen | null;
  pendingInfoScreenRef: React.MutableRefObject<InfoScreen | null>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<InfoScreen | null>>;
  
  // Debug состояния
  debugLogs: Array<{ time: string; message: string; data?: any }>;
  setDebugLogs: React.Dispatch<React.SetStateAction<Array<{ time: string; message: string; data?: any }>>>;
  showDebugPanel: boolean;
  setShowDebugPanel: React.Dispatch<React.SetStateAction<boolean>>;
  
  // Auto submit
  autoSubmitTriggered: boolean;
  setAutoSubmitTriggered: React.Dispatch<React.SetStateAction<boolean>>;
  autoSubmitTriggeredRef: React.MutableRefObject<boolean>;
}

/**
 * Хук для управления UI состояниями анкеты
 * Управляет видимостью экранов, состоянием отправки, финализации и отладки
 */
export function useQuizUI(): UseQuizUIReturn {
  // UI состояния
  const [showResumeScreen, setShowResumeScreen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizingStep, setFinalizingStep] = useState<'answers' | 'plan' | 'done'>('answers');
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [pendingInfoScreen, setPendingInfoScreen] = useState<InfoScreen | null>(null);
  const pendingInfoScreenRef = useRef<InfoScreen | null>(null);
  
  // Debug состояния
  const [debugLogs, setDebugLogs] = useState<Array<{ time: string; message: string; data?: any }>>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Auto submit
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
  const autoSubmitTriggeredRef = useRef(false);

  // ФИКС: Синхронизируем ref с state для получения актуального значения в замыканиях
  // ИСПРАВЛЕНО: Добавлено логирование для диагностики проблемы с синхронизацией
  useEffect(() => {
    const previousValue = pendingInfoScreenRef.current;
    pendingInfoScreenRef.current = pendingInfoScreen;
    
    // Логируем изменения для диагностики
    if (process.env.NODE_ENV === 'development' || true) {
      if (previousValue?.id !== pendingInfoScreen?.id) {
        console.log('🔄 pendingInfoScreenRef обновлен:', {
          previous: previousValue?.id || null,
          current: pendingInfoScreen?.id || null,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [pendingInfoScreen]);
  
  // ФИКС: Обертка для setPendingInfoScreen с логированием
  const setPendingInfoScreenWithLogging = useCallback((value: InfoScreen | null | ((prev: InfoScreen | null) => InfoScreen | null)) => {
    const newValue = typeof value === 'function' ? value(pendingInfoScreen) : value;
    if (process.env.NODE_ENV === 'development' || true) {
      console.log('🔄 setPendingInfoScreen вызван:', {
        previous: pendingInfoScreen?.id || null,
        new: newValue?.id || null,
        timestamp: new Date().toISOString(),
        stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n'),
      });
    }
    setPendingInfoScreen(value);
  }, [pendingInfoScreen]);

  // Синхронизация refs с state
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    autoSubmitTriggeredRef.current = autoSubmitTriggered;
  }, [autoSubmitTriggered]);

  return {
    // UI состояния
    showResumeScreen,
    setShowResumeScreen,
    isSubmitting,
    setIsSubmitting,
    isSubmittingRef,
    finalizing,
    setFinalizing,
    finalizingStep,
    setFinalizingStep,
    finalizeError,
    setFinalizeError,
    pendingInfoScreen,
    pendingInfoScreenRef,
    setPendingInfoScreen: setPendingInfoScreenWithLogging,
    
    // Debug состояния
    debugLogs,
    setDebugLogs,
    showDebugPanel,
    setShowDebugPanel,
    
    // Auto submit
    autoSubmitTriggered,
    setAutoSubmitTriggered,
    autoSubmitTriggeredRef,
  };
}
