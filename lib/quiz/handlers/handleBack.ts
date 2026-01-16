// lib/quiz/handlers/handleBack.ts
// Вынесена функция handleBack из quiz/page.tsx для улучшения читаемости и поддержки

import { clientLogger } from '@/lib/client-logger';
import { getInitialInfoScreens, getInfoScreenAfterQuestion, getNextInfoScreenAfterScreen, INFO_SCREENS } from '@/app/(miniapp)/quiz/info-screens';
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
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
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
  setAnswers,
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
  
  // КРИТИЧНО: Если мы на первом вопросе (currentQuestionIndex === 0), 
  // разрешаем возврат к начальным инфо-экранам даже без анкеты
  // Это позволяет пользователю вернуться к начальным экранам с первого вопроса
  const isOnFirstQuestion = currentQuestionIndex === 0 && allQuestions.length > 0;
  
  // ИСПРАВЛЕНО: Для начальных инфо-экранов анкета не нужна
  // Проверяем анкету только если мы на вопросах (но не на первом вопросе, где можно вернуться к инфо-экранам)
  if (isOnQuestionsValue && !isOnFirstQuestion && !hasQuestionnaire(questionnaire, questionnaireRef)) {
    clientLogger.warn('⏸️ handleBack: анкета не загружена, но мы на вопросах - блокируем');
    return;
  }

  // Если показывается инфо-экран между вопросами, проверяем, есть ли предыдущий инфо-экран в цепочке
  if (pendingInfoScreen) {
    clientLogger.log('🔙 handleBack: обрабатываем pendingInfoScreen', {
      currentQuestionIndex,
      pendingInfoScreenId: pendingInfoScreen.id,
      showAfterQuestionCode: pendingInfoScreen.showAfterQuestionCode,
      showAfterInfoScreenId: pendingInfoScreen.showAfterInfoScreenId,
    });
    
    // ИСПРАВЛЕНО: Если текущий инфо-экран является частью цепочки (showAfterInfoScreenId),
    // находим предыдущий инфо-экран в цепочке
    // Логика: если текущий экран имеет showAfterInfoScreenId = 'X', значит он показывается после экрана 'X'
    // Значит, при навигации назад нужно показать экран 'X'
    if (pendingInfoScreen.showAfterInfoScreenId) {
      // Находим предыдущий инфо-экран в цепочке (тот, после которого показывается текущий)
      const previousInfoScreen = INFO_SCREENS.find(screen => 
        screen.id === pendingInfoScreen.showAfterInfoScreenId
      );
      
      if (previousInfoScreen) {
        clientLogger.log('🔙 handleBack: находим предыдущий инфо-экран в цепочке', {
          currentInfoScreenId: pendingInfoScreen.id,
          previousInfoScreenId: previousInfoScreen.id,
          showAfterInfoScreenId: pendingInfoScreen.showAfterInfoScreenId,
        });
        
        // Показываем предыдущий инфо-экран в цепочке
        setPendingInfoScreen(previousInfoScreen);
        
        // Сохраняем прогресс (индексы не меняются, так как мы остаемся на инфо-экранах)
        await saveProgressSafely(saveProgress, answers, currentQuestionIndex, currentInfoScreenIndex);
        return;
      } else {
        // ИСПРАВЛЕНО: Если предыдущий экран не найден, логируем предупреждение
        clientLogger.warn('⚠️ handleBack: предыдущий инфо-экран в цепочке не найден', {
          currentInfoScreenId: pendingInfoScreen.id,
          showAfterInfoScreenId: pendingInfoScreen.showAfterInfoScreenId,
          allInfoScreenIds: INFO_SCREENS.map(s => s.id),
        });
      }
    }
    
    // Если нет предыдущего инфо-экрана в цепочке, возвращаемся к вопросу
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
      // ИСПРАВЛЕНО: Сбрасываем ответ на текущий вопрос при переходе назад
      const currentQuestion = allQuestions[currentQuestionIndex];
      if (currentQuestion && answers[currentQuestion.id] !== undefined) {
        clientLogger.log('🔙 handleBack: сбрасываем ответ на текущий вопрос', {
          questionId: currentQuestion.id,
          questionCode: currentQuestion.code,
          oldAnswer: answers[currentQuestion.id],
        });
        setAnswers(prev => {
          const newAnswers = { ...prev };
          delete newAnswers[currentQuestion.id];
          return newAnswers;
        });
      }
      
      clientLogger.log('🔙 handleBack: возвращаемся к вопросу после закрытия pendingInfoScreen', {
        oldIndex: currentQuestionIndex,
        newIndex: targetQuestionIndex,
        questionCode: allQuestions[targetQuestionIndex]?.code,
      });
      updateQuestionIndex(targetQuestionIndex, undefined, setCurrentQuestionIndex);
      
      // Сохраняем прогресс (с обновленными answers без ответа на текущий вопрос)
      const updatedAnswers = { ...answers };
      if (currentQuestion) {
        delete updatedAnswers[currentQuestion.id];
      }
      await saveProgressSafely(saveProgress, updatedAnswers, targetQuestionIndex, currentInfoScreenIndex);
      
      // Сохраняем в sessionStorage
      saveIndexToSessionStorage('quiz_currentQuestionIndex', targetQuestionIndex);
    }
    return;
  }

  // ИСПРАВЛЕНО: Если мы на первом вопросе (currentQuestionIndex === 0), 
  // возвращаемся к последнему начальному инфо-экрану
  // Это позволяет пользователю вернуться к инфо-экранам с первого вопроса
  if (currentQuestionIndex === 0 && allQuestions.length > 0) {
    const newInfoScreenIndex = initialInfoScreens.length - 1;
    clientLogger.log('🔙 handleBack: возвращаемся к последнему инфо-экрану с первого вопроса', {
      oldInfoScreenIndex: currentInfoScreenIndex,
      oldInfoScreenIndexRef: currentInfoScreenIndexRef.current,
      newInfoScreenIndex,
      currentQuestionIndex,
      isOnQuestionsValue,
      initialInfoScreensLength: initialInfoScreens.length,
    });
    // КРИТИЧНО: Обновляем и state, и ref синхронно
    updateInfoScreenIndex(newInfoScreenIndex, currentInfoScreenIndexRef, setCurrentInfoScreenIndex);
    
    // Очищаем pendingInfoScreen, если он был установлен
    setPendingInfoScreen(null);
    
    // Сохраняем прогресс
    await saveProgressSafely(saveProgress, answers, currentQuestionIndex, newInfoScreenIndex);
    
    // Сохраняем в sessionStorage
    saveIndexToSessionStorage('quiz_currentInfoScreenIndex', newInfoScreenIndex);
    return;
  }

  // Если мы на вопросах, переходим к предыдущему вопросу
  if (isOnQuestionsValue && currentQuestionIndex > 0) {
    const currentQuestion = allQuestions[currentQuestionIndex];
    const newQuestionIndex = currentQuestionIndex - 1;
    const previousQuestion = allQuestions[newQuestionIndex];
    
    // ИСПРАВЛЕНО: Сбрасываем ответ на текущий вопрос при переходе назад
    if (currentQuestion && answers[currentQuestion.id] !== undefined) {
      clientLogger.log('🔙 handleBack: сбрасываем ответ на текущий вопрос', {
        questionId: currentQuestion.id,
        questionCode: currentQuestion.code,
        oldAnswer: answers[currentQuestion.id],
      });
      setAnswers(prev => {
        const newAnswers = { ...prev };
        delete newAnswers[currentQuestion.id];
        return newAnswers;
      });
    }
    
    // ИСПРАВЛЕНО: Если текущий вопрос - это age или gender, нужно найти инфо-экран general_info_intro,
    // который показывается перед этими вопросами (после testimonials)
    // Это должно работать ПЕРЕД проверкой инфо-экрана после предыдущего вопроса
    if (currentQuestion && (currentQuestion.code === 'age' || currentQuestion.code === 'gender')) {
      // Находим инфо-экран general_info_intro, который показывается перед age/gender
      const generalInfoScreen = INFO_SCREENS.find(screen => screen.id === 'general_info_intro');
      
      if (generalInfoScreen) {
        clientLogger.log('🔙 handleBack: находим general_info_intro перед вопросом age/gender', {
          currentQuestionCode: currentQuestion.code,
          currentQuestionIndex,
          previousQuestionCode: previousQuestion?.code,
          previousQuestionIndex: newQuestionIndex,
          generalInfoScreenId: generalInfoScreen.id,
        });
        
        // Устанавливаем pendingInfoScreen для показа general_info_intro
        setPendingInfoScreen(generalInfoScreen);
        
        // Обновляем индекс вопроса на предыдущий (skin_goals)
        updateQuestionIndex(newQuestionIndex, undefined, setCurrentQuestionIndex);
        
        // Сохраняем прогресс (с обновленными answers без ответа на текущий вопрос)
        const updatedAnswers = { ...answers };
        if (currentQuestion) {
          delete updatedAnswers[currentQuestion.id];
        }
        await saveProgressSafely(saveProgress, updatedAnswers, newQuestionIndex, currentInfoScreenIndex);
        
        // Сохраняем в sessionStorage
        saveIndexToSessionStorage('quiz_currentQuestionIndex', newQuestionIndex);
        return;
      }
    }
    
    // ИСПРАВЛЕНО: Проверяем, есть ли инфо-экраны после предыдущего вопроса
    // Если есть, показываем их вместо прямого перехода к вопросу
    if (previousQuestion) {
      const infoScreenAfterPrevious = getInfoScreenAfterQuestion(previousQuestion.code);
      
      if (infoScreenAfterPrevious) {
        clientLogger.log('🔙 handleBack: находим инфо-экран после предыдущего вопроса, показываем его', {
          previousQuestionCode: previousQuestion.code,
          previousQuestionIndex: newQuestionIndex,
          currentQuestionCode: currentQuestion?.code,
          currentQuestionIndex,
          infoScreenId: infoScreenAfterPrevious.id,
        });
        
        // ИСПРАВЛЕНО: Находим последний инфо-экран в цепочке после предыдущего вопроса
        // Цепочка: infoScreenAfterPrevious -> nextInfoScreen -> nextNextInfoScreen -> ...
        // Последний экран в цепочке - это тот, который показывается перед текущим вопросом
        let lastInfoScreenInChain = infoScreenAfterPrevious;
        let nextScreen = getNextInfoScreenAfterScreen(lastInfoScreenInChain.id);
        
        // Проходим по всей цепочке, чтобы найти последний экран
        // Останавливаемся, если следующий экран не найден (конец цепочки)
        while (nextScreen) {
          lastInfoScreenInChain = nextScreen;
          nextScreen = getNextInfoScreenAfterScreen(lastInfoScreenInChain.id);
        }
        
        clientLogger.log('🔙 handleBack: показываем последний инфо-экран в цепочке', {
          firstInfoScreenId: infoScreenAfterPrevious.id,
          lastInfoScreenId: lastInfoScreenInChain.id,
          currentQuestionCode: currentQuestion?.code,
        });
        
        // Устанавливаем pendingInfoScreen для показа последнего инфо-экрана в цепочке
        setPendingInfoScreen(lastInfoScreenInChain);
        
        // Обновляем индекс вопроса на предыдущий
        updateQuestionIndex(newQuestionIndex, undefined, setCurrentQuestionIndex);
        
        // Сохраняем прогресс (с обновленными answers без ответа на текущий вопрос)
        const updatedAnswers = { ...answers };
        if (currentQuestion) {
          delete updatedAnswers[currentQuestion.id];
        }
        await saveProgressSafely(saveProgress, updatedAnswers, newQuestionIndex, currentInfoScreenIndex);
        
        // Сохраняем в sessionStorage
        saveIndexToSessionStorage('quiz_currentQuestionIndex', newQuestionIndex);
        return;
      }
    }
    
    clientLogger.log('🔙 handleBack: переходим к предыдущему вопросу', {
      oldIndex: currentQuestionIndex,
      newIndex: newQuestionIndex,
    });
    updateQuestionIndex(newQuestionIndex, undefined, setCurrentQuestionIndex);
    
    // Сохраняем прогресс (с обновленными answers без ответа на текущий вопрос)
    const updatedAnswers = { ...answers };
    if (currentQuestion) {
      delete updatedAnswers[currentQuestion.id];
    }
    await saveProgressSafely(saveProgress, updatedAnswers, newQuestionIndex, currentInfoScreenIndex);
    
    // Сохраняем в sessionStorage
    saveIndexToSessionStorage('quiz_currentQuestionIndex', newQuestionIndex);
    return;
  }

  // Если мы на начальных инфо-экранах, переходим к предыдущему
  // ИСПРАВЛЕНО: Проверяем и state, и ref для надежности
  const isOnInfoScreens = (currentInfoScreenIndex >= 0 && currentInfoScreenIndex < initialInfoScreens.length) ||
                          (currentInfoScreenIndexRef.current >= 0 && currentInfoScreenIndexRef.current < initialInfoScreens.length);
  
  // ИСПРАВЛЕНО: Используем ref для проверки, так как state может быть устаревшим
  const effectiveInfoScreenIndex = currentInfoScreenIndexRef.current >= 0 ? currentInfoScreenIndexRef.current : currentInfoScreenIndex;
  
  if (isOnInfoScreens && effectiveInfoScreenIndex > 0) {
    const newInfoScreenIndex = effectiveInfoScreenIndex - 1;
    clientLogger.log('🔙 handleBack: переходим к предыдущему инфо-экрану', {
      oldIndex: currentInfoScreenIndex,
      oldIndexRef: currentInfoScreenIndexRef.current,
      effectiveIndex: effectiveInfoScreenIndex,
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

