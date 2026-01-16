// lib/quiz/handlers/handleNext.ts
// Вынесена функция handleNext из quiz/page.tsx для улучшения читаемости и поддержки

import { clientLogger } from '@/lib/client-logger';
import { INFO_SCREENS, getInitialInfoScreens, getInfoScreenAfterQuestion, getNextInfoScreenAfterScreen, type InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import { 
  saveIndexToSessionStorage, 
  saveProgressSafely, 
  updateInfoScreenIndex, 
  updateQuestionIndex,
  canNavigate 
} from './shared-utils';

// Используем any для типов, так как в page.tsx используются локальные интерфейсы
type Questionnaire = any;
type Question = any;

export interface HandleNextParams {
  // Refs
  handleNextInProgressRef: React.MutableRefObject<boolean>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  currentQuestionIndexRef?: React.MutableRefObject<number>;
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  initCompletedRef: React.MutableRefObject<boolean>;
  
  // State getters
  questionnaire: Questionnaire | null;
  loading: boolean;
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  allQuestions: Question[];
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  hasResumed: boolean;
  pendingInfoScreen: InfoScreen | null;
  pendingInfoScreenRef?: React.MutableRefObject<InfoScreen | null>;
  answers: Record<number, string | string[]>;
  
  // State setters
  setIsHandlingNext: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<InfoScreen | null>>;
  
  // Functions
  saveProgress: (answers: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => Promise<void>;
  isDev: boolean;
}

export async function handleNext(params: HandleNextParams): Promise<void> {
  const {
    handleNextInProgressRef,
    currentInfoScreenIndexRef,
    currentQuestionIndexRef,
    questionnaireRef,
    initCompletedRef,
    questionnaire,
    loading,
    currentInfoScreenIndex,
    currentQuestionIndex,
    allQuestions,
    isRetakingQuiz,
    showRetakeScreen,
    hasResumed,
    pendingInfoScreen,
    pendingInfoScreenRef,
    answers,
    setIsHandlingNext,
    setCurrentInfoScreenIndex,
    setCurrentQuestionIndex,
    setPendingInfoScreen,
    saveProgress,
    isDev,
  } = params;
  
  // ФИКС: Используем ref для получения актуального значения pendingInfoScreen
  // Это предотвращает проблему с устаревшим значением из замыкания
  // ИСПРАВЛЕНО: Сначала проверяем ref, потом state, чтобы получить самое актуальное значение
  const currentPendingInfoScreen = (pendingInfoScreenRef?.current !== undefined && pendingInfoScreenRef?.current !== null) 
    ? pendingInfoScreenRef.current 
    : pendingInfoScreen;

  // ФИКС: Защита от множественных кликов
  if (handleNextInProgressRef.current) {
    clientLogger.warn('⏸️ handleNext: уже выполняется, пропускаем повторный вызов');
    return;
  }
  
  // ФИКС: Логирование состояния pendingInfoScreen при входе в handleNext
  if (isDev || true) { // Всегда логируем для диагностики
    clientLogger.warn('🔍 handleNext: вход в функцию', {
      pendingInfoScreen: pendingInfoScreen ? pendingInfoScreen.id : null,
      pendingInfoScreenFromRef: currentPendingInfoScreen ? currentPendingInfoScreen.id : null,
      hasPendingInfoScreen: !!pendingInfoScreen,
      hasPendingInfoScreenFromRef: !!currentPendingInfoScreen,
      pendingInfoScreenRefExists: !!pendingInfoScreenRef,
      pendingInfoScreenRefCurrent: pendingInfoScreenRef?.current ? pendingInfoScreenRef.current.id : null,
      currentQuestionIndex,
      currentInfoScreenIndex,
      isRetakingQuiz,
    });
  }
  
  handleNextInProgressRef.current = true;
  setIsHandlingNext(true);
  
  try {
    // ИСПРАВЛЕНО: Используем единую функцию для получения начальных инфо-экранов
    const initialInfoScreens = getInitialInfoScreens();
    
    // ИСПРАВЛЕНО: Проверяем анкету только если мы НЕ на начальных инфо-экранах
    // Для начальных инфо-экранов анкета не нужна - они должны показываться независимо от загрузки анкеты
    const isOnInitialInfoScreens = currentInfoScreenIndex < initialInfoScreens.length;
    
    // ИСПРАВЛЕНО: Очищаем pendingInfoScreen только если мы НЕ на начальных инфо-экранах
    // На начальных инфо-экранах pendingInfoScreen не должен быть установлен, поэтому очистка не нужна
    // Если мы на вопросах и есть pendingInfoScreen, это означает, что пользователь закрывает инфо-экран между вопросами
    // КРИТИЧНО: После очистки pendingInfoScreen нужно перейти к следующему вопросу, а не обрабатывать текущий
    let shouldSkipToNextQuestion = false;
    if (currentPendingInfoScreen && !isOnInitialInfoScreens) {
      clientLogger.warn('🧹 ИНФО-СКРИН: Закрываем pendingInfoScreen при вызове handleNext (мы на вопросах)', {
        pendingInfoScreenId: currentPendingInfoScreen.id,
        pendingInfoScreenTitle: currentPendingInfoScreen.title,
        currentQuestionIndex,
        currentInfoScreenIndex,
        isOnInitialInfoScreens,
      });
      
      // Очищаем pendingInfoScreen и ref перед дальнейшей обработкой
      if (pendingInfoScreenRef) {
        pendingInfoScreenRef.current = null;
      }
      setPendingInfoScreen(null);
      
      // Сохраняем флаг в sessionStorage, что инфо-экран только что закрыт
      // Это поможет правильно обработать следующий шаг
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('quiz_justClosedInfoScreen', 'true');
        } catch (err) {
          // Игнорируем ошибки
        }
      }
      
      // КРИТИЧНО: После закрытия инфо-экрана нужно перейти к следующему вопросу
      // Пропускаем обработку текущего вопроса и сразу переходим к переходу к следующему
      // Это предотвращает проблему с currentQuestion = null
      shouldSkipToNextQuestion = true;
    }
    const hasQuestionnaire = questionnaire || questionnaireRef.current;
    
    // Если мы не на начальных инфо-экранах и анкета не загружена - блокируем
    if (!isOnInitialInfoScreens && !hasQuestionnaire) {
      clientLogger.warn('⏸️ handleNext: анкета еще не загружена, ждем...', {
        hasQuestionnaire: !!questionnaire,
        hasQuestionnaireRef: !!questionnaireRef.current,
        loading,
        initCompleted: initCompletedRef.current,
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
      });
      return;
    }
    
    // ФИКС: Всегда логируем handleNext (warn уровень для сохранения в БД)
    clientLogger.warn('🔄 handleNext: вызов', {
      currentInfoScreenIndex,
      initialInfoScreensLength: initialInfoScreens.length,
      currentQuestionIndex,
      allQuestionsLength: allQuestions.length,
      isRetakingQuiz,
      showRetakeScreen,
      hasResumed,
      pendingInfoScreen: !!pendingInfoScreen,
      hasQuestionnaire: !!questionnaire,
      hasQuestionnaireRef: !!questionnaireRef.current,
    });

    // ВАЖНО: При повторном прохождении (isRetakingQuiz && !showRetakeScreen) пропускаем все начальные info screens
    // showRetakeScreen = true означает, что показывается экран выбора тем, и мы еще не начали перепрохождение
    // ИСПРАВЛЕНО: Разрешаем пропуск начальных инфо-экранов даже без анкеты (она может загрузиться позже)
    if (isRetakingQuiz && !showRetakeScreen && currentInfoScreenIndex < initialInfoScreens.length) {
      // Не блокируем переход, даже если анкета еще не загружена
      // Анкета должна загрузиться в фоне
      if (!hasQuestionnaire) {
        clientLogger.warn('⚠️ Повторное прохождение: анкета еще не загружена, но разрешаем переход', {
          hasQuestionnaire: !!questionnaire,
          hasQuestionnaireRef: !!questionnaireRef.current,
          loading,
          initCompleted: initCompletedRef.current,
        });
      }
      const newInfoIndex = initialInfoScreens.length;
      setCurrentInfoScreenIndex(newInfoIndex);
      // Если currentQuestionIndex = 0, начинаем с первого вопроса
      if (currentQuestionIndex === 0) {
        setCurrentQuestionIndex(0);
      }
      await saveProgress(answers, currentQuestionIndex, newInfoIndex);
      return;
    }

    // Если мы на начальных информационных экранах, переходим к следующему или к вопросам
    // ИСПРАВЛЕНО: Не обрабатываем начальные инфо-экраны, если пользователь уже на вопросах
    // Это исправляет проблему, когда после возврата к первому вопросу по кнопке "Назад"
    // и нажатия "Продолжить" система пытается обработать начальные инфо-экраны
    // КРИТИЧНО: isAlreadyOnQuestions должен проверять, что пользователь уже прошел все начальные инфо-экраны
    // Просто проверка currentQuestionIndex >= 0 неправильна, так как для нового пользователя currentQuestionIndex = 0
    // но он еще на инфо-экранах, а не на вопросах
    const isAlreadyOnQuestions = currentInfoScreenIndex >= initialInfoScreens.length;
    
    if (isOnInitialInfoScreens && !isAlreadyOnQuestions && currentInfoScreenIndex < initialInfoScreens.length - 1) {
      const newIndex = currentInfoScreenIndex + 1;
      // ФИКС: Логируем переход на следующий экран
      clientLogger.warn('🔄 handleNext: переход на следующий инфо-экран', {
        currentInfoScreenIndex,
        newIndex,
        initialInfoScreensLength: initialInfoScreens.length,
      });
      // КРИТИЧНО: Обновляем ref СИНХРОННО перед установкой state
      updateInfoScreenIndex(newIndex, currentInfoScreenIndexRef, setCurrentInfoScreenIndex);
      // ФИКС: Сохраняем newIndex в sessionStorage для восстановления при перемонтировании
      // КРИТИЧНО: Сохраняем правильный ключ для currentInfoScreenIndex
      saveIndexToSessionStorage('quiz_currentInfoScreenIndex', newIndex, '💾 Сохранен currentInfoScreenIndex в sessionStorage');
      // ФИКС: Если после инкремента мы прошли все начальные экраны, очищаем pendingInfoScreen
      if (newIndex >= initialInfoScreens.length) {
        setPendingInfoScreen(null);
        // Если мы прошли все начальные экраны, переходим к первому вопросу
        if (currentQuestionIndex === 0 && allQuestions.length > 0) {
          setCurrentQuestionIndex(0);
        }
      }
      await saveProgressSafely(saveProgress, answers, currentQuestionIndex, newIndex);
      return;
    }

    if (currentInfoScreenIndex === initialInfoScreens.length - 1) {
      // КРИТИЧНО: Проверяем, что есть вопросы перед переходом к ним
      // Если анкета не загружена и вопросов нет, не переходим к вопросам
      if (allQuestions.length === 0 && !hasQuestionnaire) {
        clientLogger.warn('⚠️ Переход к вопросам заблокирован: анкета не загружена и вопросов нет', {
          hasQuestionnaire: !!questionnaire,
          hasQuestionnaireRef: !!questionnaireRef.current,
          allQuestionsLength: allQuestions.length,
          loading,
          initCompleted: initCompletedRef.current,
        });
        // Блокируем переход, если нет ни анкеты, ни вопросов
        return;
      }
      
      // ИСПРАВЛЕНО: Проверяем анкету только при переходе к вопросам
      // Если анкета не загружена, но есть вопросы (из кэша), разрешаем переход
      // Но логируем предупреждение для диагностики
      if (!hasQuestionnaire && allQuestions.length === 0) {
        clientLogger.warn('⚠️ Переход к вопросам без анкеты и без вопросов - блокируем', {
          hasQuestionnaire: !!questionnaire,
          hasQuestionnaireRef: !!questionnaireRef.current,
          allQuestionsLength: allQuestions.length,
          loading,
          initCompleted: initCompletedRef.current,
        });
        return;
      }
      
      if (!hasQuestionnaire && allQuestions.length > 0) {
        clientLogger.warn('⚠️ Переход к вопросам без анкеты, но есть вопросы из кэша - разрешаем', {
          hasQuestionnaire: !!questionnaire,
          hasQuestionnaireRef: !!questionnaireRef.current,
          allQuestionsLength: allQuestions.length,
          loading,
          initCompleted: initCompletedRef.current,
        });
      }
      
      const newInfoIndex = initialInfoScreens.length;
      // ФИКС: Логируем переход к вопросам после последнего инфо-экрана
      clientLogger.warn('🔄 handleNext: переход к вопросам после последнего инфо-экрана', {
        currentInfoScreenIndex,
        newInfoIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        allQuestionsLength: allQuestions.length,
      });
      // КРИТИЧНО: Обновляем ref СИНХРОННО перед установкой state, чтобы другие функции видели новое значение
      updateInfoScreenIndex(newInfoIndex, currentInfoScreenIndexRef, setCurrentInfoScreenIndex);
      // ФИКС: Сохраняем newInfoIndex в sessionStorage для восстановления при перемонтировании
      saveIndexToSessionStorage('quiz_currentInfoScreenIndex', newInfoIndex, '💾 Сохранен currentInfoScreenIndex в sessionStorage при переходе к вопросам');
      
      // ИСПРАВЛЕНО: Не сбрасываем currentQuestionIndex на 0, если у пользователя уже есть ответы
      // Это предотвращает возврат к первому вопросу для пользователей, которые уже отвечали
      // КРИТИЧНО: Проверяем, что allQuestions не пустой перед установкой индекса
      if (allQuestions.length === 0) {
        clientLogger.warn('⚠️ handleNext: allQuestions пустой, не устанавливаем currentQuestionIndex', {
          allQuestionsLength: allQuestions.length,
          hasQuestionnaire: !!questionnaire || !!questionnaireRef.current,
          loading,
        });
        // Не устанавливаем индекс, если вопросов нет - анкета еще загружается
        await saveProgress(answers, currentQuestionIndex, newInfoIndex);
        return;
      }
      
      // КРИТИЧНО: Всегда переходим к следующему вопросу по порядку, а не ищем неотвеченные
      // Это исправляет проблему, когда после возврата к вопросу по кнопке "Назад"
      // и нажатия "Продолжить" система переходит к последнему заполненному вопросу
      // Логика поиска неотвеченных вопросов используется только при первом переходе с инфо-экранов к вопросам
      // После того, как пользователь уже на вопросах, всегда переходим по порядку
      const answeredQuestionIds = Object.keys(answers).map(id => Number(id));
      let nextQuestionIndex = 0;
      
      // КРИТИЧНО: isAlreadyOnQuestions должен проверять, что пользователь уже прошел все начальные инфо-экраны
      // Просто проверка currentQuestionIndex >= 0 неправильна, так как для нового пользователя currentQuestionIndex = 0
      // но он еще на инфо-экранах, а не на вопросах
      const isAlreadyOnQuestions = currentInfoScreenIndex >= initialInfoScreens.length;
      
      if (isAlreadyOnQuestions) {
        // Пользователь уже на вопросах - переходим к следующему по порядку
        nextQuestionIndex = currentQuestionIndex + 1;
        if (nextQuestionIndex >= allQuestions.length) {
          nextQuestionIndex = allQuestions.length - 1;
        }
        clientLogger.log('🔄 Переход к вопросам: пользователь уже на вопросах, переходим к следующему по порядку', {
          currentQuestionIndex,
          nextQuestionIndex,
          allQuestionsLength: allQuestions.length,
        });
      } else {
        // Пользователь еще не на вопросах (переходит с последнего инфо-экрана)
        // Для нового пользователя без ответов начинаем с первого вопроса (индекс 0)
        // Для пользователя с ответами также начинаем с первого вопроса (индекс 0)
        // НЕ ищем неотвеченные вопросы - это может привести к прыжкам на последний отвеченный вопрос
        nextQuestionIndex = 0;
        clientLogger.log('🔄 Переход к вопросам: переход с инфо-экранов, начинаем с первого вопроса', {
          currentQuestionIndex,
          nextQuestionIndex,
          allQuestionsLength: allQuestions.length,
        });
      }
      
      // КРИТИЧНО: Финальная проверка перед установкой индекса
      if (nextQuestionIndex < 0 || nextQuestionIndex >= allQuestions.length) {
        clientLogger.warn('⚠️ handleNext: некорректный nextQuestionIndex, исправляем', {
          nextQuestionIndex,
          allQuestionsLength: allQuestions.length,
        });
        nextQuestionIndex = Math.max(0, Math.min(allQuestions.length - 1, 0));
      }
      
      updateQuestionIndex(nextQuestionIndex, currentQuestionIndexRef, setCurrentQuestionIndex);
      // ФИКС: Сохраняем индекс в sessionStorage для восстановления при перемонтировании
      saveIndexToSessionStorage('quiz_currentQuestionIndex', nextQuestionIndex, '💾 Сохранен currentQuestionIndex в sessionStorage при переходе к вопросам');
      // ФИКС: Принудительно очищаем pendingInfoScreen при переходе к вопросам
      // Это предотвращает застревание на info screens
      setPendingInfoScreen(null);
      // ФИКС: Детальное логирование установки вопросов для диагностики
      clientLogger.log('✅ Завершены все начальные инфо-экраны, переходим к вопросам', {
        newInfoIndex,
        allQuestionsLength: allQuestions.length,
        currentQuestionIndex: nextQuestionIndex,
        previousQuestionIndex: currentQuestionIndex,
        answeredQuestionsCount: answeredQuestionIds.length,
        isRetakingQuiz,
        showRetakeScreen,
        pendingInfoScreenCleared: true,
      });
      await saveProgressSafely(saveProgress, answers, nextQuestionIndex, newInfoIndex);
      return;
    }

    // ИСПРАВЛЕНО: Не блокируем обработку вопросов, если анкета еще не загружена
    // Анкета может загружаться в фоне, а вопросы уже могут быть доступны через questionnaireRef или allQuestions
    // Проверяем только если мы действительно на вопросах (не на инфо-экранах) И нет вопросов в allQuestions
    const isOnQuestions = currentInfoScreenIndex >= initialInfoScreens.length;
    if (isOnQuestions && !questionnaire && !questionnaireRef.current && allQuestions.length === 0) {
      clientLogger.warn('⏸️ handleNext: анкета не загружена и нет вопросов - ждем...', {
        hasQuestionnaire: !!questionnaire,
        hasQuestionnaireRef: !!questionnaireRef.current,
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        allQuestionsLength: allQuestions.length,
      });
      return;
    }
    
    // ДИАГНОСТИКА: Логируем состояние при обработке вопросов
    if (isOnQuestions) {
      clientLogger.log('🔍 handleNext: обработка вопросов', {
        hasQuestionnaire: !!questionnaire,
        hasQuestionnaireRef: !!questionnaireRef.current,
        allQuestionsLength: allQuestions.length,
        currentQuestionIndex,
        isLastQuestion: currentQuestionIndex === allQuestions.length - 1,
      });
    }

    // ИСПРАВЛЕНО: Проверяем, что currentQuestionIndex валиден для текущего allQuestions
    // При перепрохождении анкета может загружаться асинхронно, поэтому нужно корректно обрабатывать
    if (currentQuestionIndex >= allQuestions.length && allQuestions.length > 0) {
      clientLogger.warn('⚠️ currentQuestionIndex выходит за пределы allQuestions, корректируем', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        questionIds: allQuestions.map((q: Question) => q.id),
        isRetakingQuiz,
        showRetakeScreen,
      });
      // Корректируем индекс на последний валидный вопрос
      const correctedIndex = Math.max(0, allQuestions.length - 1);
      setCurrentQuestionIndex(correctedIndex);
      // ИСПРАВЛЕНО: Не сохраняем прогресс при перепрохождении, если анкета еще не полностью загружена
      if (!isRetakingQuiz && !showRetakeScreen) {
        await saveProgress(answers, correctedIndex, currentInfoScreenIndex);
      }
      return;
    }
        
    // Проверяем, что текущий вопрос существует в allQuestions
    const currentQuestionInAllQuestions = allQuestions[currentQuestionIndex];
    if (!currentQuestionInAllQuestions && allQuestions.length > 0) {
      clientLogger.warn('⚠️ Текущий вопрос не найден в allQuestions, ищем правильный индекс', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        allQuestionIds: allQuestions.map((q: Question) => q.id),
      });
      
      // ИСПРАВЛЕНО: Если вопрос не найден по индексу, корректируем на последний валидный индекс
      // Это может произойти после изменения фильтрации (например, после ответа на вопрос про бюджет)
      const correctedIndex = Math.max(0, allQuestions.length - 1);
      setCurrentQuestionIndex(correctedIndex);
      await saveProgress(answers, correctedIndex, currentInfoScreenIndex);
      return;
    }

    // Если показывается информационный экран между вопросами, проверяем, есть ли следующий инфо-экран в цепочке
    // При повторном прохождении пропускаем все info screens
    // ФИКС: Используем currentPendingInfoScreen из ref для получения актуального значения
    // ИСПРАВЛЕНО: Также проверяем pendingInfoScreenRef для получения актуального значения
    const currentPendingInfoScreenFromRef = pendingInfoScreenRef?.current;
    const effectivePendingInfoScreen = currentPendingInfoScreenFromRef || currentPendingInfoScreen;
    
    if (effectivePendingInfoScreen && !isRetakingQuiz) {
      // ИСПРАВЛЕНО: Используем getNextInfoScreenAfterScreen для цепочки экранов
      // Это правильно разделяет триггеры: showAfterQuestionCode для вопросов, showAfterInfoScreenId для экранов
      const nextInfoScreen = getNextInfoScreenAfterScreen(effectivePendingInfoScreen.id);
      
      // ФИКС: Логирование для диагностики проблемы с цепочкой инфо-экранов
      // ИСПРАВЛЕНО: Всегда логируем для диагностики проблем с цепочками
      clientLogger.warn('🔍 Проверка следующего инфо-экрана в цепочке:', {
        currentPendingInfoScreenId: effectivePendingInfoScreen.id,
        currentPendingInfoScreenFromState: currentPendingInfoScreen?.id || null,
        currentPendingInfoScreenFromRef: currentPendingInfoScreenFromRef?.id || null,
        nextInfoScreenFound: !!nextInfoScreen,
        nextInfoScreenId: nextInfoScreen?.id || null,
        currentQuestionIndex,
        isLastQuestion: currentQuestionIndex === allQuestions.length - 1,
        // ИСПРАВЛЕНО: Добавляем детальное логирование всех инфо-экранов с showAfterInfoScreenId
        allInfoScreensWithChains: INFO_SCREENS
          .filter(s => s.showAfterInfoScreenId)
          .map(s => ({ id: s.id, showAfterInfoScreenId: s.showAfterInfoScreenId })),
      });
      
      if (nextInfoScreen) {
        clientLogger.warn('✅ Найден следующий инфо-экран в цепочке, устанавливаем pendingInfoScreen', {
          from: effectivePendingInfoScreen.id,
          to: nextInfoScreen.id,
          currentQuestionIndex,
          currentInfoScreenIndex,
        });
        // ИСПРАВЛЕНО: Обновляем ref ПЕРЕД state, чтобы следующая проверка использовала актуальное значение
        if (pendingInfoScreenRef) {
          pendingInfoScreenRef.current = nextInfoScreen;
        }
        setPendingInfoScreen(nextInfoScreen);
        await saveProgressSafely(saveProgress, answers, currentQuestionIndex, currentInfoScreenIndex);
        clientLogger.log('✅ Переход к следующему инфо-экрану в цепочке:', {
          from: effectivePendingInfoScreen.id,
          to: nextInfoScreen.id,
        });
        return;
      } else {
        clientLogger.warn('⚠️ Следующий инфо-экран в цепочке НЕ найден, закрываем pendingInfoScreen', {
          currentPendingInfoScreenId: effectivePendingInfoScreen.id,
          currentQuestionIndex,
          currentInfoScreenIndex,
          // ИСПРАВЛЕНО: Добавляем детальное логирование для диагностики
          searchedForScreenId: effectivePendingInfoScreen.id,
          availableChains: INFO_SCREENS
            .filter(s => s.showAfterInfoScreenId === effectivePendingInfoScreen.id)
            .map(s => s.id),
        });
      }
      
      // ИСПРАВЛЕНО: Проверяем, не последний ли это вопрос ДО закрытия инфо-экрана
      const isLastQuestion = currentQuestionIndex === allQuestions.length - 1;
      const isWantImproveScreen = currentPendingInfoScreen?.id === 'want_improve';
      
      // ВАЖНО: Если это последний инфо-экран (want_improve), НЕ закрываем его автоматически
      // Пользователь должен нажать кнопку "Получить план ухода" для отправки ответов
      if (isWantImproveScreen && isLastQuestion) {
        clientLogger.log('ℹ️ Это последний инфо-экран want_improve - ждем нажатия кнопки "Получить план ухода"');
        // НЕ закрываем экран, НЕ меняем индекс - просто возвращаемся
        // Кнопка "Получить план ухода" должна вызвать handleGetPlan, который вызовет submitAnswers
        return;
      }
      
      // Если нет следующего info screen, закрываем pending и переходим к следующему вопросу
      clientLogger.warn('🧹 ИНФО-СКРИН: Закрываем pendingInfoScreen (нет следующего в цепочке)', {
        currentPendingInfoScreenId: effectivePendingInfoScreen.id,
        currentPendingInfoScreenTitle: effectivePendingInfoScreen.title,
        currentQuestionIndex,
        isLastQuestion,
      });
      setPendingInfoScreen(null);
      
      if (isLastQuestion) {
        // ИСПРАВЛЕНО: После закрытия последнего инфо-экрана (но не want_improve) увеличиваем индекс для запуска автоотправки
        // ВАЖНО: Сначала сохраняем прогресс, потом увеличиваем индекс, чтобы избежать проблем с редиректом
        await saveProgressSafely(saveProgress, answers, currentQuestionIndex, currentInfoScreenIndex);
        // ИСПРАВЛЕНО: Устанавливаем индекс синхронно, но с небольшой задержкой для безопасности
        // Это гарантирует, что автоотправка сработает после закрытия инфо-экрана
        setTimeout(() => {
          clientLogger.log('🔄 Закрыт последний инфо-экран, устанавливаем currentQuestionIndex для автоотправки', {
            currentIndex: currentQuestionIndex,
            targetIndex: allQuestions.length,
          });
          setCurrentQuestionIndex(allQuestions.length);
        }, 100); // Небольшая задержка, чтобы состояния успели обновиться
        return;
      }
      
      // Переходим к следующему вопросу
      const newIndex = currentQuestionIndex + 1;
      
      // КРИТИЧНО: Проверяем, что следующий вопрос существует перед переходом
      // Это предотвращает пустой экран и ошибку "Вопрос не найден"
      const nextQuestion = allQuestions[newIndex];
      if (!nextQuestion) {
        clientLogger.error('❌ handleNext: следующий вопрос не найден после закрытия инфо-экрана', {
          currentQuestionIndex,
          newIndex,
          allQuestionsLength: allQuestions.length,
          currentQuestionCode: allQuestions[currentQuestionIndex]?.code || null,
          allQuestionCodes: allQuestions.map((q: Question, idx: number) => ({
            index: idx,
            code: q?.code || null,
            id: q?.id || null,
          })),
        });
        // НЕ переходим к следующему вопросу, если его нет
        return;
      }
      
      updateQuestionIndex(newIndex, currentQuestionIndexRef, setCurrentQuestionIndex);
      // ФИКС: Сохраняем newIndex в sessionStorage для восстановления при перемонтировании
      saveIndexToSessionStorage('quiz_currentQuestionIndex', newIndex, '💾 Сохранен currentQuestionIndex в sessionStorage');
      
      // КРИТИЧНО: После закрытия инфо-экрана просто переходим к следующему вопросу
      // НЕ проверяем инфо-экран для следующего вопроса сразу - он будет проверен ПОСЛЕ того, как пользователь ответит
      // Это предотвращает застревание на инфо-экранах
      // ФИКС: Сохраняем информацию о том, что мы только что закрыли инфо-экран
      // Это предотвратит повторную проверку инфо-экрана для следующего вопроса сразу после перехода
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('quiz_justClosedInfoScreen', 'true');
          // Очищаем флаг через небольшую задержку, чтобы следующий вызов handleNext не видел его
          // ИСПРАВЛЕНО: Сохраняем timeout ID для возможной очистки при размонтировании
          const timeoutId = setTimeout(() => {
            try {
              sessionStorage.removeItem('quiz_justClosedInfoScreen');
            } catch (err) {
              // Игнорируем ошибки при очистке
            }
          }, 100);
          // Примечание: timeout очистится автоматически при завершении, но можно добавить cleanup в useEffect
        } catch (err) {
          // Игнорируем ошибки при сохранении
        }
      }
      await saveProgressSafely(saveProgress, answers, newIndex, currentInfoScreenIndex);
      clientLogger.log('✅ Закрыт инфо-экран, переходим к следующему вопросу', {
        newIndex,
        allQuestionsLength: allQuestions.length,
        pendingInfoScreenCleared: true,
        nextQuestionCode: nextQuestion?.code || null,
        nextQuestionId: nextQuestion?.id || null,
        hasAnsweredNextQuestion: nextQuestion && answers[nextQuestion.id] !== undefined,
      });
      // КРИТИЧНО: После закрытия инфо-экрана НЕ проверяем инфо-экран для следующего вопроса сразу
      // даже если пользователь уже ответил на него - это предотвращает застревание
      // Инфо-экран будет проверен при следующем вызове handleNext после ответа пользователя
      return;
    }
    
    // ИСПРАВЛЕНО: Проверяем инфо-экран для текущего вопроса ТОЛЬКО если:
    // 1. pendingInfoScreen НЕ установлен (не обрабатывается выше)
    // 2. Пользователь УЖЕ ответил на текущий вопрос (currentQuestionIndex в answers)
    // 3. Это НЕ повторное прохождение
    // КРИТИЧНО: НЕ проверяем инфо-экран сразу после перехода к вопросу - только после ответа
    // ФИКС: НЕ проверяем инфо-экран сразу после закрытия предыдущего инфо-экрана
    // Это предотвращает застревание на инфо-экранах, когда пользователь уже ответил на следующий вопрос
    const currentQuestion = allQuestions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === allQuestions.length - 1;
    const hasAnsweredCurrentQuestion = currentQuestion && answers[currentQuestion.id] !== undefined;
    
    // КРИТИЧНО: Проверяем инфо-экран только если:
    // 1. Пользователь УЖЕ ответил на текущий вопрос
    // 2. НЕТ pendingInfoScreen (не обрабатывается выше)
    // 3. Это НЕ повторное прохождение
    // 4. Вопрос существует и имеет код
    // ФИКС: Добавляем дополнительную проверку - не показываем инфо-экран, если мы только что закрыли инфо-экран
    // и перешли к следующему вопросу, даже если пользователь уже ответил на этот вопрос
    // Это предотвращает застревание на инфо-экранах
    // КРИТИЧНО: Проверяем инфо-экран ТОЛЬКО если пользователь ответил на вопрос ПОСЛЕ перехода к нему
    // Если пользователь уже ответил на вопрос ДО перехода к нему (например, из-за быстрых кликов),
    // то НЕ показываем инфо-экран сразу - он будет показан при следующем вызове handleNext после ответа
    // ФИКС: Проверяем, что мы НЕ только что закрыли инфо-экран и перешли к этому вопросу
    // Это предотвращает повторное показ инфо-экрана сразу после перехода к вопросу
    // Проверяем это через sessionStorage - если мы только что закрыли инфо-экран, не показываем его снова
    // ИСПРАВЛЕНО: Флаг блокирует показ инфо-экрана только если пользователь еще НЕ ответил на вопрос
    // Если пользователь уже ответил на вопрос и нажимает "Продолжить", инфо-экран должен показываться
    const justClosedInfoScreen = typeof window !== 'undefined' && 
      sessionStorage.getItem('quiz_justClosedInfoScreen') === 'true';
    
    // ИСПРАВЛЕНО: Флаг блокирует показ инфо-экрана только если пользователь еще НЕ ответил на вопрос
    // Если пользователь уже ответил на вопрос и нажимает "Продолжить", инфо-экран должен показываться
    // Это исправляет проблему, когда после ответа на второй вопрос инфо-экран не показывается
    // КРИТИЧНО ИСПРАВЛЕНО: Если пользователь уже ответил на вопрос, НЕ блокируем показ инфо-экрана
    // даже если флаг justClosedInfoScreen установлен - это исправляет проблему, когда инфо-экран
    // не показывается после ответа на вопрос gender
    const shouldBlockInfoScreen = justClosedInfoScreen && !hasAnsweredCurrentQuestion;
    
    // ФИКС: Логирование для диагностики проблемы с застреванием на втором вопросе
    // КРИТИЧНО: Логируем всегда (не только в dev), чтобы понять, почему инфо-экран не показывается при первом проходе
    if (currentQuestion && hasAnsweredCurrentQuestion) {
      clientLogger.warn('🔍 Проверка инфо-экрана для вопроса:', {
        questionIndex: currentQuestionIndex,
        questionCode: currentQuestion.code,
        questionId: currentQuestion.id,
        hasAnswered: hasAnsweredCurrentQuestion,
        justClosedInfoScreen,
        shouldBlockInfoScreen,
        pendingInfoScreen: !!pendingInfoScreen,
        currentPendingInfoScreen: !!currentPendingInfoScreen,
        isRetakingQuiz,
        willCheckInfoScreen: currentQuestion && !isRetakingQuiz && !currentPendingInfoScreen && hasAnsweredCurrentQuestion && !shouldBlockInfoScreen,
      });
    }
    
    // ФИКС: Логирование, если условие не выполняется
    if (isDev && currentQuestion && hasAnsweredCurrentQuestion && (!currentQuestion || isRetakingQuiz || currentPendingInfoScreen || !hasAnsweredCurrentQuestion || shouldBlockInfoScreen)) {
      clientLogger.warn('⚠️ Условие для проверки инфо-экрана не выполняется:', {
        questionIndex: currentQuestionIndex,
        questionCode: currentQuestion?.code,
        hasCurrentQuestion: !!currentQuestion,
        isRetakingQuiz,
        hasPendingInfoScreen: !!pendingInfoScreen,
        hasCurrentPendingInfoScreen: !!currentPendingInfoScreen,
        hasAnswered: hasAnsweredCurrentQuestion,
        shouldBlock: shouldBlockInfoScreen,
      });
    }
    
    // КРИТИЧНО: Проверяем инфо-экран для текущего вопроса ПЕРЕД переходом к следующему
    // Это исправляет проблему, когда инфо-экран не показывается при первом проходе
    // ИСПРАВЛЕНО: Если пользователь уже ответил на вопрос, проверяем инфо-экран независимо от флага justClosedInfoScreen
    // ИСПРАВЛЕНО: Используем currentPendingInfoScreen из ref для более точной проверки
    
    // ИСПРАВЛЕНО: Детальное логирование для диагностики проблемы с инфо-экранами
    // Логируем для ВСЕХ вопросов, которые должны показывать инфо-экраны
    const questionCode = currentQuestion?.code;
    const hasInfoScreenAfterQuestion = questionCode ? !!getInfoScreenAfterQuestion(questionCode) : false;
    
    // ИСПРАВЛЕНО: Логируем для всех вопросов с инфо-экранами, не только для gender
    if (hasInfoScreenAfterQuestion || questionCode === 'gender') {
      const infoScreenAfterQuestion = questionCode ? getInfoScreenAfterQuestion(questionCode) : null;
      clientLogger.warn('🔍 ДИАГНОСТИКА ИНФО-ЭКРАНА: Проверка условий для показа инфо-экрана', {
        hasCurrentQuestion: !!currentQuestion,
        questionCode: questionCode,
        questionId: currentQuestion?.id,
        questionIndex: currentQuestionIndex,
        isRetakingQuiz,
        hasCurrentPendingInfoScreen: !!currentPendingInfoScreen,
        currentPendingInfoScreenId: currentPendingInfoScreen?.id || null,
        hasAnsweredCurrentQuestion,
        shouldBlockInfoScreen,
        justClosedInfoScreen,
        willCheckInfoScreen: currentQuestion && !isRetakingQuiz && !currentPendingInfoScreen && hasAnsweredCurrentQuestion && !shouldBlockInfoScreen,
        hasInfoScreenAfterQuestion,
        infoScreenAfterQuestionId: infoScreenAfterQuestion?.id || null,
        infoScreenAfterQuestionTitle: infoScreenAfterQuestion?.title || null,
        allInfoScreensForThisQuestion: INFO_SCREENS.filter(s => s.showAfterQuestionCode === questionCode).map(s => ({
          id: s.id,
          title: s.title,
          showAfterQuestionCode: s.showAfterQuestionCode,
        })),
      });
    }
    
    if (!shouldSkipToNextQuestion && currentQuestion && !isRetakingQuiz && !currentPendingInfoScreen && hasAnsweredCurrentQuestion && !shouldBlockInfoScreen) {
      // ФИКС: Проверяем, что у вопроса есть код перед вызовом getInfoScreenAfterQuestion
      // Это предотвращает возврат info screen для вопросов без кода
      if (!currentQuestion.code) {
        clientLogger.warn('⚠️ Вопрос без кода, пропускаем проверку info screen', {
          questionId: currentQuestion.id,
          questionIndex: currentQuestionIndex,
          questionCode: currentQuestion.code,
        });
      } else {
        // ИСПРАВЛЕНО: Детальное логирование для всех вопросов с инфо-экранами
        const infoScreen = getInfoScreenAfterQuestion(currentQuestion.code);
        
        // ИСПРАВЛЕНО: Логируем для всех вопросов, которые должны показывать инфо-экраны
        if (infoScreen || currentQuestion.code === 'gender') {
          clientLogger.warn('🔍 ДИАГНОСТИКА ИНФО-ЭКРАНА: Вызываем getInfoScreenAfterQuestion', {
            questionCode: currentQuestion.code,
            questionIndex: currentQuestionIndex,
            allInfoScreensCount: INFO_SCREENS.length,
            infoScreensWithShowAfter: INFO_SCREENS.filter(s => s.showAfterQuestionCode).length,
            infoScreensForThisQuestion: INFO_SCREENS.filter(s => s.showAfterQuestionCode === currentQuestion.code).map(s => ({
              id: s.id,
              title: s.title,
            })),
          });
          
          clientLogger.warn('🔍 ДИАГНОСТИКА ИНФО-ЭКРАНА: Результат поиска инфо-экрана', {
            questionCode: currentQuestion.code,
            infoScreenFound: !!infoScreen,
            infoScreenId: infoScreen?.id || null,
            infoScreenTitle: infoScreen?.title || null,
            searchedCode: currentQuestion.code,
          });
        }
        
        if (infoScreen) {
          // КРИТИЧНО: Показываем инфо-экран для текущего вопроса ПЕРЕД переходом к следующему
          // Это исправляет проблему, когда инфо-экран не показывается при первом проходе
          // ИСПРАВЛЕНО: Обновляем ref ПЕРЕД state для консистентности
          // ИСПРАВЛЕНО: Сбрасываем флаг justClosedInfoScreen сразу после нахождения инфо-экрана
          // чтобы он не блокировал показ инфо-экрана для следующего вопроса
          if (typeof window !== 'undefined' && justClosedInfoScreen) {
            try {
              sessionStorage.removeItem('quiz_justClosedInfoScreen');
            } catch (err) {
              // Игнорируем ошибки при очистке
            }
          }
          
          // ИСПРАВЛЕНО: Логирование установки pendingInfoScreen для всех инфо-скринов
          clientLogger.warn('📋 ИНФО-СКРИН: Устанавливаем pendingInfoScreen', {
            questionCode: currentQuestion.code,
            questionIndex: currentQuestionIndex,
            questionId: currentQuestion.id,
            infoScreenId: infoScreen.id,
            infoScreenTitle: infoScreen.title,
            showAfterQuestionCode: infoScreen.showAfterQuestionCode,
            showAfterInfoScreenId: infoScreen.showAfterInfoScreenId,
            previousPendingInfoScreen: (pendingInfoScreen as InfoScreen | null)?.id || (currentPendingInfoScreen as InfoScreen | null)?.id || null,
            pendingInfoScreenRefExists: !!pendingInfoScreenRef,
          });
          
          if (pendingInfoScreenRef) {
            pendingInfoScreenRef.current = infoScreen;
            clientLogger.warn('📋 ИНФО-СКРИН: pendingInfoScreenRef.current установлен', {
              infoScreenId: infoScreen.id,
              infoScreenTitle: infoScreen.title,
            });
          }
          
          setPendingInfoScreen(infoScreen);
          clientLogger.warn('📋 ИНФО-СКРИН: setPendingInfoScreen вызван', {
            infoScreenId: infoScreen.id,
            infoScreenTitle: infoScreen.title,
          });
          
          await saveProgressSafely(saveProgress, answers, currentQuestionIndex, currentInfoScreenIndex);
          
          // ИСПРАВЛЕНО: Детальное логирование для всех инфо-экранов
          clientLogger.warn('✅ ДИАГНОСТИКА ИНФО-ЭКРАНА: Инфо-экран УСТАНОВЛЕН в pendingInfoScreen', {
            questionCode: currentQuestion.code,
            questionIndex: currentQuestionIndex,
            infoScreenId: infoScreen.id,
            infoScreenTitle: infoScreen.title,
            pendingInfoScreenRefSet: !!pendingInfoScreenRef,
            isLastQuestion,
            hasAnswered: true,
            justClosedInfoScreenWasSet: justClosedInfoScreen,
          });
          
          clientLogger.log('✅ Показан инфо-экран после вопроса:', {
            questionCode: currentQuestion.code,
            questionIndex: currentQuestionIndex,
            infoScreenId: infoScreen.id,
            isLastQuestion,
            hasAnswered: true,
            justClosedInfoScreenWasSet: justClosedInfoScreen,
          });
          // КРИТИЧНО: Возвращаемся, НЕ переходим к следующему вопросу
          // Инфо-экран будет показан, и после его закрытия пользователь перейдет к следующему вопросу
          clientLogger.warn('🛑 handleNext: ВЫХОД после установки pendingInfoScreen - НЕ переходим к следующему вопросу', {
            questionCode: currentQuestion.code,
            questionIndex: currentQuestionIndex,
            infoScreenId: infoScreen.id,
            pendingInfoScreenRefSet: !!pendingInfoScreenRef,
            pendingInfoScreenRefCurrent: pendingInfoScreenRef?.current?.id || null,
          });
          return;
        } else {
          // ФИКС: Логирование, если инфо-экран не найден для вопроса
          // КРИТИЧНО: Это может быть причиной проблемы, когда инфо-экран не показывается при первом проходе
          // ИСПРАВЛЕНО: Логирование для всех вопросов
          clientLogger.warn('⚠️ Инфо-экран не найден для вопроса:', {
            questionCode: currentQuestion.code,
            questionIndex: currentQuestionIndex,
            questionId: currentQuestion.id,
            allInfoScreens: INFO_SCREENS.map(s => ({ id: s.id, showAfterQuestionCode: s.showAfterQuestionCode })),
            // ИСПРАВЛЕНО: Добавляем детальное логирование для диагностики
            searchedForCode: currentQuestion.code,
            availableInfoScreens: INFO_SCREENS.filter(s => s.showAfterQuestionCode).map(s => ({
              id: s.id,
              showAfterQuestionCode: s.showAfterQuestionCode,
            })),
            // ИСПРАВЛЕНО: Специальная проверка для текущего вопроса
            infoScreensForThisQuestion: INFO_SCREENS.filter(s => s.showAfterQuestionCode === currentQuestion.code).map(s => ({
              id: s.id,
              title: s.title,
              showAfterQuestionCode: s.showAfterQuestionCode,
            })),
            getInfoScreenAfterQuestionResult: getInfoScreenAfterQuestion(currentQuestion.code) || null,
          });
        }
      }
    }

    // ИСПРАВЛЕНО: Проверяем последний вопрос отдельно, так как логика отличается
    if (isLastQuestion) {
      // Это последний вопрос - проверяем, есть ли инфо-экраны после него
      // При повторном прохождении пропускаем info screens
      if (!isRetakingQuiz && currentQuestion) {
        const infoScreen = getInfoScreenAfterQuestion(currentQuestion.code);
        if (infoScreen) {
          setPendingInfoScreen(infoScreen);
          // ИСПРАВЛЕНО: НЕ увеличиваем currentQuestionIndex, чтобы не запустить автоотправку
          // Автоотправка запустится только после закрытия инфо-экрана или при нажатии кнопки "Получить план"
          await saveProgressSafely(saveProgress, answers, currentQuestionIndex, currentInfoScreenIndex);
          clientLogger.log('✅ Показан инфо-экран после последнего вопроса:', {
            questionCode: currentQuestion.code,
            infoScreenId: infoScreen.id,
            currentQuestionIndex,
            allQuestionsLength: allQuestions.length,
          });
          return;
        }
      }
      // ВАЖНО: Если это последний вопрос и нет инфо-экрана, увеличиваем currentQuestionIndex
      // чтобы сработала автоматическая отправка ответов (проверка currentQuestionIndex >= allQuestions.length)
      await saveProgressSafely(saveProgress, answers, currentQuestionIndex, currentInfoScreenIndex);
      clientLogger.log('✅ Последний вопрос отвечен, нет инфо-экранов, увеличиваем индекс для автоотправки');
      // Увеличиваем индекс, чтобы выйти за пределы массива вопросов и запустить автоматическую отправку
      setCurrentQuestionIndex(allQuestions.length);
      return;
    }

    // Переходим к следующему вопросу
    // ИСПРАВЛЕНО: pendingInfoScreen теперь очищается в начале handleNext при закрытии инфо-экрана
    // Поэтому здесь мы всегда можем перейти к следующему вопросу, если он существует
    
    if (currentQuestionIndex < allQuestions.length - 1) {
      const newIndex = currentQuestionIndex + 1;
      
      // КРИТИЧНО: Проверяем, что следующий вопрос существует перед переходом
      // Это предотвращает пустой экран и ошибку "Вопрос не найден"
      const nextQuestion = allQuestions[newIndex];
      if (!nextQuestion) {
        clientLogger.error('❌ handleNext: следующий вопрос не найден', {
          currentQuestionIndex,
          newIndex,
          allQuestionsLength: allQuestions.length,
          currentQuestionCode: allQuestions[currentQuestionIndex]?.code || null,
          allQuestionCodes: allQuestions.map((q: Question, idx: number) => ({
            index: idx,
            code: q?.code || null,
            id: q?.id || null,
          })),
        });
        // НЕ переходим к следующему вопросу, если его нет
        return;
      }
      
      // КРИТИЧНО: Логируем переход к следующему вопросу для диагностики
      clientLogger.warn('🔄 handleNext: переход к следующему вопросу', {
        currentQuestionIndex,
        newIndex,
        allQuestionsLength: allQuestions.length,
        currentQuestionCode: allQuestions[currentQuestionIndex]?.code || null,
        nextQuestionCode: nextQuestion?.code || null,
        nextQuestionId: nextQuestion?.id || null,
        hasAnsweredCurrent: allQuestions[currentQuestionIndex] && answers[allQuestions[currentQuestionIndex].id] !== undefined,
        // ИСПРАВЛЕНО: Добавляем проверку pendingInfoScreen для диагностики пустого экрана
        pendingInfoScreen: !!pendingInfoScreen,
        pendingInfoScreenId: pendingInfoScreen?.id || null,
        currentPendingInfoScreen: !!currentPendingInfoScreen,
        currentPendingInfoScreenId: currentPendingInfoScreen?.id || null,
      });
      
      // ИСПРАВЛЕНО: Очищаем pendingInfoScreen перед переходом к следующему вопросу
      // Это предотвращает блокировку показа следующего вопроса, если pendingInfoScreen остался от предыдущего
      // КРИТИЧНО: Очищаем только если нет инфо-экрана для следующего вопроса
      // Если есть инфо-экран для следующего вопроса, он будет установлен после ответа на него
      if (pendingInfoScreen || currentPendingInfoScreen) {
        const nextQuestionInfoScreen = getInfoScreenAfterQuestion(nextQuestion.code);
        // Если для следующего вопроса нет инфо-экрана, очищаем pendingInfoScreen
        if (!nextQuestionInfoScreen) {
          clientLogger.warn('🧹 ИНФО-СКРИН: Очищаем pendingInfoScreen перед переходом к следующему вопросу (нет инфо-экрана для следующего вопроса)', {
            currentQuestionCode: allQuestions[currentQuestionIndex]?.code || null,
            currentQuestionIndex,
            nextQuestionCode: nextQuestion.code,
            nextQuestionIndex: newIndex,
            pendingInfoScreenId: (pendingInfoScreen as InfoScreen | null)?.id || (currentPendingInfoScreen as InfoScreen | null)?.id || null,
            nextQuestionInfoScreenFound: !!nextQuestionInfoScreen,
            nextQuestionInfoScreenId: (nextQuestionInfoScreen as InfoScreen | null | undefined)?.id || null,
          });
          if (pendingInfoScreenRef) {
            pendingInfoScreenRef.current = null;
            clientLogger.warn('🧹 ИНФО-СКРИН: pendingInfoScreenRef.current очищен', {
              previousPendingInfoScreenId: (pendingInfoScreen as InfoScreen | null)?.id || (currentPendingInfoScreen as InfoScreen | null)?.id || null,
            });
          }
          setPendingInfoScreen(null);
          clientLogger.warn('🧹 ИНФО-СКРИН: setPendingInfoScreen(null) вызван', {
            previousPendingInfoScreenId: pendingInfoScreen?.id || currentPendingInfoScreen?.id || null,
          });
        } else {
          clientLogger.warn('📋 ИНФО-СКРИН: НЕ очищаем pendingInfoScreen - для следующего вопроса есть инфо-экран', {
            currentQuestionCode: allQuestions[currentQuestionIndex]?.code || null,
            nextQuestionCode: nextQuestion.code,
            nextQuestionInfoScreenId: nextQuestionInfoScreen.id,
            currentPendingInfoScreenId: pendingInfoScreen?.id || currentPendingInfoScreen?.id || null,
          });
        }
      }
      
      updateQuestionIndex(newIndex, currentQuestionIndexRef, setCurrentQuestionIndex);
      // ФИКС: Сохраняем newIndex в sessionStorage для восстановления при перемонтировании
      saveIndexToSessionStorage('quiz_currentQuestionIndex', newIndex, '💾 Сохранен currentQuestionIndex в sessionStorage');
      await saveProgressSafely(saveProgress, answers, newIndex, currentInfoScreenIndex);
    } else {
      // КРИТИЧНО: Логируем, если не переходим к следующему вопросу
      clientLogger.warn('⚠️ handleNext: не переходим к следующему вопросу', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        isLastQuestion: currentQuestionIndex === allQuestions.length - 1,
        condition: currentQuestionIndex < allQuestions.length - 1,
      });
    }
  } finally {
    // ФИКС: Сбрасываем флаг после завершения handleNext
    handleNextInProgressRef.current = false;
    setIsHandlingNext(false);
  }
}

