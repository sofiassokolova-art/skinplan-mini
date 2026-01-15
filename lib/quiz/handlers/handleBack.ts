// lib/quiz/handlers/handleBack.ts
// Вынесена функция handleBack из quiz/page.tsx для улучшения читаемости и поддержки

import { clientLogger } from '@/lib/client-logger';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire } from '@/lib/quiz/types';

export interface HandleBackParams {
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  questionnaire: Questionnaire | null;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  pendingInfoScreen: InfoScreen | null;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<InfoScreen | null>>;
  saveProgress: (answers: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => Promise<void>;
  answers: Record<number, string | string[]>;
}

export function handleBack({
  currentInfoScreenIndex,
  currentQuestionIndex,
  questionnaire,
  questionnaireRef,
  pendingInfoScreen,
  setCurrentInfoScreenIndex,
  setCurrentQuestionIndex,
  setPendingInfoScreen,
  saveProgress,
  answers,
}: HandleBackParams): void {
  clientLogger.log('🔙 handleBack вызван', {
    currentInfoScreenIndex,
    currentQuestionIndex,
    hasPendingInfoScreen: !!pendingInfoScreen,
    hasQuestionnaire: !!questionnaire || !!questionnaireRef.current,
  });

  // ИСПРАВЛЕНО: Используем единую функцию для получения начальных инфо-экранов
  const initialInfoScreens = getInitialInfoScreens();
  
  // ИСПРАВЛЕНО: Для начальных инфо-экранов анкета не нужна
  // Проверяем анкету только если мы на вопросах
  const isOnQuestions = currentInfoScreenIndex >= initialInfoScreens.length;
  if (isOnQuestions && !questionnaire && !questionnaireRef.current) {
    clientLogger.warn('⏸️ handleBack: анкета не загружена, но мы на вопросах - блокируем');
    return;
  }

  // Если показывается инфо-экран между вопросами, просто закрываем его
  if (pendingInfoScreen) {
    clientLogger.log('🔙 handleBack: закрываем pendingInfoScreen');
    setPendingInfoScreen(null);
    return;
  }

  // Если мы на вопросах, переходим к предыдущему вопросу
  if (isOnQuestions && currentQuestionIndex > 0) {
    const newQuestionIndex = currentQuestionIndex - 1;
    clientLogger.log('🔙 handleBack: переходим к предыдущему вопросу', {
      oldIndex: currentQuestionIndex,
      newIndex: newQuestionIndex,
    });
    setCurrentQuestionIndex(newQuestionIndex);
    
    // Сохраняем прогресс
    saveProgress(answers, newQuestionIndex, currentInfoScreenIndex).catch((err) => {
      clientLogger.warn('⚠️ Ошибка при сохранении прогресса в handleBack:', err);
    });
    
    // Сохраняем в sessionStorage
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('quiz_currentQuestionIndex', String(newQuestionIndex));
      } catch (err) {
        clientLogger.warn('⚠️ Не удалось сохранить currentQuestionIndex в sessionStorage', err);
      }
    }
    return;
  }

  // Если мы на начальных инфо-экранах, переходим к предыдущему
  if (currentInfoScreenIndex > 0) {
    const newInfoScreenIndex = currentInfoScreenIndex - 1;
    clientLogger.log('🔙 handleBack: переходим к предыдущему инфо-экрану', {
      oldIndex: currentInfoScreenIndex,
      newIndex: newInfoScreenIndex,
      initialInfoScreensLength: initialInfoScreens.length,
    });
    setCurrentInfoScreenIndex(newInfoScreenIndex);
    
    // Сохраняем прогресс
    saveProgress(answers, currentQuestionIndex, newInfoScreenIndex).catch((err) => {
      clientLogger.warn('⚠️ Ошибка при сохранении прогресса в handleBack:', err);
    });
    
    // Сохраняем в sessionStorage
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('quiz_currentInfoScreenIndex', String(newInfoScreenIndex));
      } catch (err) {
        clientLogger.warn('⚠️ Не удалось сохранить currentInfoScreenIndex в sessionStorage', err);
      }
    }
    return;
  }

  // Если мы на самом начале (индекс 0), не делаем ничего
  clientLogger.log('🔙 handleBack: мы на самом начале, ничего не делаем', {
    currentInfoScreenIndex,
    currentQuestionIndex,
  });
}

