// lib/quiz/handlers/navigation/info-screen-navigation.ts
// Логика навигации по инфо-экранам

import type React from 'react';
import { clientLogger } from '@/lib/client-logger';
import { INFO_SCREENS, getInitialInfoScreens, getNextInfoScreenAfterScreen } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire, Question } from '@/lib/quiz/types';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

export interface InfoScreenNavigationParams {
  pendingInfoScreen: InfoScreen | null;
  currentInfoScreenIndex: number;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  questionnaire: Questionnaire;
  allQuestions: Question[];
  answers: Record<number, string | string[]>;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  hasResumed: boolean;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<InfoScreen | null>>;
  saveProgress: (answers: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => Promise<void>;
  currentQuestionIndex: number;
  justClosedInfoScreenRef?: React.MutableRefObject<boolean>;
  isDev: boolean;
}

export async function handleInfoScreenNavigation(params: InfoScreenNavigationParams): Promise<boolean> {
  const {
    pendingInfoScreen,
    currentInfoScreenIndex,
    currentInfoScreenIndexRef,
    questionnaire,
    allQuestions,
    answers,
    isRetakingQuiz,
    showRetakeScreen,
    hasResumed,
    setCurrentInfoScreenIndex,
    setPendingInfoScreen,
    saveProgress,
    currentQuestionIndex,
    justClosedInfoScreenRef,
    isDev,
  } = params;

  if (!pendingInfoScreen) {
    return false; // Нет инфо-экрана для обработки
  }

  const nextInfoScreenIndex = currentInfoScreenIndex + 1;
  const initialInfoScreens = getInitialInfoScreens();
  const totalInitialScreens = initialInfoScreens.length;

  // Определяем, является ли текущий экран начальным
  const isInitialInfoScreen = currentInfoScreenIndex < totalInitialScreens;

  clientLogger.log('ℹ️ handleNext: обрабатываем инфо-экран', {
    pendingInfoScreenId: pendingInfoScreen.id,
    currentInfoScreenIndex,
    nextInfoScreenIndex,
    isInitialInfoScreen,
    totalInitialScreens,
  });

  // Проверяем, есть ли следующий инфо-экран
  if (nextInfoScreenIndex < totalInitialScreens) {
    // Есть следующий начальный инфо-экран
    const nextScreen = initialInfoScreens[nextInfoScreenIndex];

    clientLogger.log('➡️ handleNext: переходим к следующему начальному инфо-экрану', {
      from: pendingInfoScreen.id,
      to: nextScreen.id,
      nextInfoScreenIndex,
    });

    // Сохраняем прогресс перед переходом
    try {
      await saveProgress(answers, currentQuestionIndex, nextInfoScreenIndex);
    } catch (error) {
      clientLogger.error('❌ handleNext: ошибка сохранения прогресса перед следующим инфо-экраном', error);
    }

    setCurrentInfoScreenIndex(nextInfoScreenIndex);
    currentInfoScreenIndexRef.current = nextInfoScreenIndex;
    setPendingInfoScreen(nextScreen);

    if (justClosedInfoScreenRef) {
      justClosedInfoScreenRef.current = false;
    }

    return false; // Продолжаем с инфо-экранами
  }

  // Начальные инфо-экраны закончились, проверяем специальные условия
  if (isRetakingQuiz && showRetakeScreen) {
    clientLogger.log('🔄 handleNext: переходим к экрану перепрохождения');
    setPendingInfoScreen(null);
    setCurrentInfoScreenIndex(totalInitialScreens);
    currentInfoScreenIndexRef.current = totalInitialScreens;
    return false;
  }

  if (hasResumed) {
    clientLogger.log('▶️ handleNext: возобновляем с сохраненной позиции');
    setPendingInfoScreen(null);
    setCurrentInfoScreenIndex(totalInitialScreens);
    currentInfoScreenIndexRef.current = totalInitialScreens;
    return false;
  }

  // Переходим к вопросам
  clientLogger.log('❓ handleNext: переходим к вопросам после инфо-экранов');

  // Сохраняем прогресс перед переходом к вопросам
  try {
    await saveProgress(answers, 0, nextInfoScreenIndex);
  } catch (error) {
    clientLogger.error('❌ handleNext: ошибка сохранения прогресса перед вопросами', error);
  }

  setCurrentInfoScreenIndex(nextInfoScreenIndex);
  currentInfoScreenIndexRef.current = nextInfoScreenIndex;
  setPendingInfoScreen(null);

  if (justClosedInfoScreenRef) {
    justClosedInfoScreenRef.current = true;
  }

  return false; // Переходим к вопросам
}
