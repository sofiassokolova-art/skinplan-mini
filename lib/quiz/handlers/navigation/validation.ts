// lib/quiz/handlers/navigation/validation.ts
// Валидация и защита от множественных вызовов в handleNext

import type React from 'react';
import { clientLogger } from '@/lib/client-logger';
import type { Questionnaire, Question } from '@/lib/quiz/types';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';

export interface ValidationParams {
  handleNextInProgressRef: React.MutableRefObject<boolean>;
  questionnaire: Questionnaire | null;
  loading: boolean;
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  allQuestions: Question[];
  pendingInfoScreen: InfoScreen | null;
  pendingInfoScreenRef?: React.MutableRefObject<InfoScreen | null>;
  isDev: boolean;
}

export function validateAndGetPendingInfoScreen(params: ValidationParams): InfoScreen | null {
  const {
    handleNextInProgressRef,
    questionnaire,
    loading,
    currentInfoScreenIndex,
    currentQuestionIndex,
    allQuestions,
    pendingInfoScreen,
    pendingInfoScreenRef,
    isDev,
  } = params;

  const initialInfoScreens = getInitialInfoScreens();
  const isOnInitialInfoScreens = currentInfoScreenIndex < initialInfoScreens.length;

  // ФИКС: Используем ref для получения актуального значения pendingInfoScreen
  const currentPendingInfoScreen = (pendingInfoScreenRef?.current !== undefined && pendingInfoScreenRef?.current !== null)
    ? pendingInfoScreenRef.current
    : pendingInfoScreen;

  // ФИКС: Защита от множественных кликов
  if (handleNextInProgressRef.current) {
    clientLogger.warn('⏸️ handleNext: уже выполняется, пропускаем повторный вызов');
    return null;
  }

  // ФИКС: Логирование состояния pendingInfoScreen при входе в handleNext
  if (isDev || true) { // Всегда логируем для диагностики
    clientLogger.warn('🔍 handleNext: вход в функцию', {
      pendingInfoScreen: pendingInfoScreen ? pendingInfoScreen.id : null,
      pendingInfoScreenFromRef: currentPendingInfoScreen ? currentPendingInfoScreen.id : null,
      currentInfoScreenIndex,
      currentQuestionIndex,
      loading,
      hasQuestionnaire: !!questionnaire,
      totalQuestions: allQuestions.length,
    });
  }

  // Базовая валидация
  if (loading && !isOnInitialInfoScreens) {
    clientLogger.warn('⏸️ handleNext: загрузка в процессе, пропускаем');
    return null;
  }

  if (!questionnaire && !isOnInitialInfoScreens) {
    clientLogger.warn('⏸️ handleNext: нет questionnaire, пропускаем');
    return null;
  }

  return currentPendingInfoScreen;
}
