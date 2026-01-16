// lib/quiz/handlers/handleBack.ts
// Вынесена функция handleBack из quiz/page.tsx для улучшения читаемости и поддержки

import { clientLogger } from '@/lib/client-logger';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire, Question } from '@/lib/quiz/types';
import { 
  saveIndexToSessionStorage, 
  saveProgressSafely, 
  updateInfoScreenIndex, 
  updateQuestionIndex,
  isOnQuestions,
  hasQuestionnaire 
} from './shared-utils';

export interface HandleBackParams {
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  questionnaire: Questionnaire | null;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  pendingInfoScreen: InfoScreen | null;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  allQuestions: Question[]; // ИСПРАВЛЕНО: Добавлен allQuestions для поиска вопроса по коду
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<InfoScreen | null>>;
  saveProgress: (answers: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => Promise<void>;
  answers: Record<number, string | string[]>;
}

export async function handleBack({
  currentInfoScreenIndex,
  currentQuestionIndex,
  questionnaire,
  questionnaireRef,
  pendingInfoScreen,
  currentInfoScreenIndexRef,
  allQuestions,
  setCurrentInfoScreenIndex,
  setCurrentQuestionIndex,
  setPendingInfoScreen,
  saveProgress,
  answers,
}: HandleBackParams): Promise<void> {
  clientLogger.log('🔙 handleBack вызван', {
    currentInfoScreenIndex,
    currentQuestionIndex,
    hasPendingInfoScreen: !!pendingInfoScreen,
    hasQuestionnaire: !!questionnaire || !!questionnaireRef.current,
    pendingInfoScreenId: pendingInfoScreen?.id,
    pendingInfoScreenShowAfter: pendingInfoScreen?.showAfterQuestionCode,
  });

  // ИСПРАВЛЕНО: Используем единую функцию для получения начальных инфо-экранов
  const initialInfoScreens = getInitialInfoScreens();
  
  // ИСПРАВЛЕНО: Используем утилиту для проверки, находимся ли мы на вопросах
  const isOnQuestionsValue = isOnQuestions(currentInfoScreenIndex, currentInfoScreenIndexRef);
  
  // ИСПРАВЛЕНО: Для начальных инфо-экранов анкета не нужна
  // Проверяем анкету только если мы на вопросах
  if (isOnQuestionsValue && !hasQuestionnaire(questionnaire, questionnaireRef)) {
    clientLogger.warn('⏸️ handleBack: анкета не загружена, но мы на вопросах - блокируем');
    return;
  }

  // Если показывается инфо-экран между вопросами, закрываем его и возвращаемся к предыдущему вопросу
  if (pendingInfoScreen) {
    clientLogger.log('🔙 handleBack: закрываем pendingInfoScreen и возвращаемся к предыдущему вопросу', {
      currentQuestionIndex,
      pendingInfoScreenId: pendingInfoScreen.id,
      showAfterQuestionCode: pendingInfoScreen.showAfterQuestionCode,
    });
    setPendingInfoScreen(null);
    
    // ИСПРАВЛЕНО: Находим вопрос, после которого был показан pendingInfoScreen
    // Используем showAfterQuestionCode для точного определения вопроса
    let targetQuestionIndex = -1;
    
    if (pendingInfoScreen.showAfterQuestionCode && allQuestions.length > 0) {
      // Ищем вопрос с указанным кодом
      targetQuestionIndex = allQuestions.findIndex(q => q.code === pendingInfoScreen.showAfterQuestionCode);
      clientLogger.log('🔙 handleBack: ищем вопрос по showAfterQuestionCode', {
        showAfterQuestionCode: pendingInfoScreen.showAfterQuestionCode,
        foundIndex: targetQuestionIndex,
        allQuestionsLength: allQuestions.length,
      });
    }
    
    // Если не нашли по коду или код не указан, используем текущий индекс - 1
    if (targetQuestionIndex === -1) {
      if (currentQuestionIndex > 0) {
        targetQuestionIndex = currentQuestionIndex - 1;
        clientLogger.log('🔙 handleBack: используем currentQuestionIndex - 1', {
          currentQuestionIndex,
          targetQuestionIndex,
        });
      } else {
        clientLogger.warn('🔙 handleBack: не можем определить предыдущий вопрос', {
          currentQuestionIndex,
          showAfterQuestionCode: pendingInfoScreen.showAfterQuestionCode,
        });
        return;
      }
    }
    
    if (targetQuestionIndex >= 0 && targetQuestionIndex < allQuestions.length) {
      clientLogger.log('🔙 handleBack: возвращаемся к вопросу после закрытия pendingInfoScreen', {
        oldIndex: currentQuestionIndex,
        newIndex: targetQuestionIndex,
        questionCode: allQuestions[targetQuestionIndex]?.code,
      });
      updateQuestionIndex(targetQuestionIndex, undefined, setCurrentQuestionIndex);
      
      // Сохраняем прогресс
      await saveProgressSafely(saveProgress, answers, targetQuestionIndex, currentInfoScreenIndex);
      
      // Сохраняем в sessionStorage
      saveIndexToSessionStorage('quiz_currentQuestionIndex', targetQuestionIndex);
    }
    return;
  }

  // Если мы на вопросах, переходим к предыдущему вопросу
  if (isOnQuestionsValue && currentQuestionIndex > 0) {
    const newQuestionIndex = currentQuestionIndex - 1;
    clientLogger.log('🔙 handleBack: переходим к предыдущему вопросу', {
      oldIndex: currentQuestionIndex,
      newIndex: newQuestionIndex,
    });
    updateQuestionIndex(newQuestionIndex, undefined, setCurrentQuestionIndex);
    
    // Сохраняем прогресс
    await saveProgressSafely(saveProgress, answers, newQuestionIndex, currentInfoScreenIndex);
    
    // Сохраняем в sessionStorage
    saveIndexToSessionStorage('quiz_currentQuestionIndex', newQuestionIndex);
    return;
  }

  // Если мы на первом вопросе (currentQuestionIndex === 0) и на вопросах, 
  // возвращаемся к последнему инфо-экрану
  // ИСПРАВЛЕНО: Это позволяет пользователю вернуться к инфо-экранам после прохождения вопросов
  if (isOnQuestionsValue && currentQuestionIndex === 0) {
    const newInfoScreenIndex = initialInfoScreens.length - 1;
    clientLogger.log('🔙 handleBack: возвращаемся к последнему инфо-экрану с первого вопроса', {
      oldInfoScreenIndex: currentInfoScreenIndex,
      oldInfoScreenIndexRef: currentInfoScreenIndexRef.current,
      newInfoScreenIndex,
      currentQuestionIndex,
      isOnQuestionsValue,
    });
    // КРИТИЧНО: Обновляем и state, и ref синхронно
    updateInfoScreenIndex(newInfoScreenIndex, currentInfoScreenIndexRef, setCurrentInfoScreenIndex);
    
    // Сохраняем прогресс
    await saveProgressSafely(saveProgress, answers, currentQuestionIndex, newInfoScreenIndex);
    
    // Сохраняем в sessionStorage
    saveIndexToSessionStorage('quiz_currentInfoScreenIndex', newInfoScreenIndex);
    return;
  }

  // Если мы на начальных инфо-экранах, переходим к предыдущему
  // ИСПРАВЛЕНО: Проверяем и state, и ref для надежности
  const isOnInfoScreens = (currentInfoScreenIndex >= 0 && currentInfoScreenIndex < initialInfoScreens.length) ||
                          (currentInfoScreenIndexRef.current >= 0 && currentInfoScreenIndexRef.current < initialInfoScreens.length);
  
  if (isOnInfoScreens && currentInfoScreenIndex > 0) {
    const newInfoScreenIndex = currentInfoScreenIndex - 1;
    clientLogger.log('🔙 handleBack: переходим к предыдущему инфо-экрану', {
      oldIndex: currentInfoScreenIndex,
      oldIndexRef: currentInfoScreenIndexRef.current,
      newIndex: newInfoScreenIndex,
      initialInfoScreensLength: initialInfoScreens.length,
    });
    // КРИТИЧНО: Обновляем и state, и ref синхронно
    updateInfoScreenIndex(newInfoScreenIndex, currentInfoScreenIndexRef, setCurrentInfoScreenIndex);
    
    // Сохраняем прогресс
    await saveProgressSafely(saveProgress, answers, currentQuestionIndex, newInfoScreenIndex);
    
    // Сохраняем в sessionStorage
    saveIndexToSessionStorage('quiz_currentInfoScreenIndex', newInfoScreenIndex);
    return;
  }

  // Если мы на самом начале (индекс 0), не делаем ничего
  clientLogger.log('🔙 handleBack: мы на самом начале, ничего не делаем', {
    currentInfoScreenIndex,
    currentQuestionIndex,
  });
}

