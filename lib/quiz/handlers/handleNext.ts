// lib/quiz/handlers/handleNext.ts
// Вынесена функция handleNext из quiz/page.tsx для улучшения читаемости и поддержки

import { clientLogger } from '@/lib/client-logger';
import { INFO_SCREENS, getInfoScreenAfterQuestion, getNextInfoScreenAfterScreen, type InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

// Используем any для типов, так как в page.tsx используются локальные интерфейсы
type Questionnaire = any;
type Question = any;

export interface HandleNextParams {
  // Refs
  handleNextInProgressRef: React.MutableRefObject<boolean>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
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
    answers,
    setIsHandlingNext,
    setCurrentInfoScreenIndex,
    setCurrentQuestionIndex,
    setPendingInfoScreen,
    saveProgress,
    isDev,
  } = params;

  // ФИКС: Защита от множественных кликов
  if (handleNextInProgressRef.current) {
    clientLogger.warn('⏸️ handleNext: уже выполняется, пропускаем повторный вызов');
    return;
  }
  
  // ФИКС: Проверяем, что анкета загружена перед выполнением handleNext
  // ИСПРАВЛЕНО: Проверяем questionnaireRef.current в первую очередь, так как он устанавливается раньше
  const hasQuestionnaire = questionnaire || questionnaireRef.current;
  if (!hasQuestionnaire) {
    clientLogger.warn('⏸️ handleNext: анкета еще не загружена, ждем...', {
      hasQuestionnaire: !!questionnaire,
      hasQuestionnaireRef: !!questionnaireRef.current,
      loading,
      initCompleted: initCompletedRef.current,
    });
    return;
  }
  
  handleNextInProgressRef.current = true;
  setIsHandlingNext(true);
  
  try {
    // ФИКС: Начальные экраны - это только те, которые не имеют showAfterQuestionCode И не имеют showAfterInfoScreenId
    // Экраны с showAfterInfoScreenId показываются после других экранов или вопросов, а не в начале
    const initialInfoScreens = INFO_SCREENS.filter(screen => !screen.showAfterQuestionCode && !screen.showAfterInfoScreenId);
    
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
    if (isRetakingQuiz && !showRetakeScreen && currentInfoScreenIndex < initialInfoScreens.length) {
      if (!questionnaire) return;
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
    if (currentInfoScreenIndex < initialInfoScreens.length - 1) {
      const newIndex = currentInfoScreenIndex + 1;
      // ФИКС: Логируем переход на следующий экран
      clientLogger.warn('🔄 handleNext: переход на следующий инфо-экран', {
        currentInfoScreenIndex,
        newIndex,
        initialInfoScreensLength: initialInfoScreens.length,
      });
      // КРИТИЧНО: Обновляем ref СИНХРОННО перед установкой state
      currentInfoScreenIndexRef.current = newIndex;
      setCurrentInfoScreenIndex(newIndex);
      // ФИКС: Если после инкремента мы прошли все начальные экраны, очищаем pendingInfoScreen
      if (newIndex >= initialInfoScreens.length) {
        setPendingInfoScreen(null);
        // Если мы прошли все начальные экраны, переходим к первому вопросу
        if (currentQuestionIndex === 0 && allQuestions.length > 0) {
          setCurrentQuestionIndex(0);
        }
      }
      await saveProgress(answers, currentQuestionIndex, newIndex);
      return;
    }

    if (currentInfoScreenIndex === initialInfoScreens.length - 1) {
      if (!questionnaire) return;
      const newInfoIndex = initialInfoScreens.length;
      // ФИКС: Логируем переход к вопросам после последнего инфо-экрана
      clientLogger.warn('🔄 handleNext: переход к вопросам после последнего инфо-экрана', {
        currentInfoScreenIndex,
        newInfoIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        allQuestionsLength: allQuestions.length,
      });
      // КРИТИЧНО: Обновляем ref СИНХРОННО перед установкой state, чтобы другие функции видели новое значение
      currentInfoScreenIndexRef.current = newInfoIndex;
      setCurrentInfoScreenIndex(newInfoIndex);
      // КРИТИЧНО: Для нового пользователя всегда начинаем с первого вопроса (индекс 0)
      // Это гарантирует, что после прохождения всех инфо-экранов вопросы начнут отображаться
      setCurrentQuestionIndex(0);
      // ФИКС: Принудительно очищаем pendingInfoScreen при переходе к вопросам
      // Это предотвращает застревание на info screens
      setPendingInfoScreen(null);
      // ФИКС: Детальное логирование установки вопросов для диагностики
      clientLogger.warn('🔧 УСТАНОВКА ВОПРОСОВ: setCurrentQuestionIndex(0) в handleNext после инфо-скринов', {
        newInfoIndex,
        allQuestionsLength: allQuestions.length,
        currentQuestionIndex: 0,
        isRetakingQuiz,
        showRetakeScreen,
      });
      clientLogger.log('✅ Завершены все начальные инфо-экраны, переходим к вопросам', {
        newInfoIndex,
        allQuestionsLength: allQuestions.length,
        currentQuestionIndex: 0,
        isRetakingQuiz,
        showRetakeScreen,
        pendingInfoScreenCleared: true,
      });
      await saveProgress(answers, 0, newInfoIndex);
      return;
    }

    if (!questionnaire) return;

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
    if (pendingInfoScreen && !isRetakingQuiz) {
      // ИСПРАВЛЕНО: Используем getNextInfoScreenAfterScreen для цепочки экранов
      // Это правильно разделяет триггеры: showAfterQuestionCode для вопросов, showAfterInfoScreenId для экранов
      const nextInfoScreen = getNextInfoScreenAfterScreen(pendingInfoScreen.id);
      if (nextInfoScreen) {
        setPendingInfoScreen(nextInfoScreen);
        await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
        return;
      }
      
      // ИСПРАВЛЕНО: Проверяем, не последний ли это вопрос ДО закрытия инфо-экрана
      const isLastQuestion = currentQuestionIndex === allQuestions.length - 1;
      const isWantImproveScreen = pendingInfoScreen?.id === 'want_improve';
      
      // ВАЖНО: Если это последний инфо-экран (want_improve), НЕ закрываем его автоматически
      // Пользователь должен нажать кнопку "Получить план ухода" для отправки ответов
      if (isWantImproveScreen && isLastQuestion) {
        clientLogger.log('ℹ️ Это последний инфо-экран want_improve - ждем нажатия кнопки "Получить план ухода"');
        // НЕ закрываем экран, НЕ меняем индекс - просто возвращаемся
        // Кнопка "Получить план ухода" должна вызвать handleGetPlan, который вызовет submitAnswers
        return;
      }
      
      // Если нет следующего info screen, закрываем pending и переходим к следующему вопросу
      setPendingInfoScreen(null);
      
      if (isLastQuestion) {
        // ИСПРАВЛЕНО: После закрытия последнего инфо-экрана (но не want_improve) увеличиваем индекс для запуска автоотправки
        // ВАЖНО: Сначала сохраняем прогресс, потом увеличиваем индекс, чтобы избежать проблем с редиректом
        await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
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
      setCurrentQuestionIndex(newIndex);
      await saveProgress(answers, newIndex, currentInfoScreenIndex);
      return;
    }

    // Проверяем, нужно ли показать информационный экран после текущего вопроса
    // При повторном прохождении пропускаем все info screens
    const currentQuestion = allQuestions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === allQuestions.length - 1;
    
    if (currentQuestion && !isRetakingQuiz) {
      // ФИКС: Проверяем, что у вопроса есть код перед вызовом getInfoScreenAfterQuestion
      // Это предотвращает возврат info screen для вопросов без кода
      if (!currentQuestion.code) {
        if (isDev) {
          clientLogger.warn('⚠️ Вопрос без кода, пропускаем проверку info screen', {
            questionId: currentQuestion.id,
            questionIndex: currentQuestionIndex,
          });
        }
      } else {
        const infoScreen = getInfoScreenAfterQuestion(currentQuestion.code);
        if (infoScreen) {
          setPendingInfoScreen(infoScreen);
          await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
          clientLogger.log('✅ Показан инфо-экран после вопроса:', {
            questionCode: currentQuestion.code,
            questionIndex: currentQuestionIndex,
            infoScreenId: infoScreen.id,
            isLastQuestion,
          });
          return;
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
          await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
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
      await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
      clientLogger.log('✅ Последний вопрос отвечен, нет инфо-экранов, увеличиваем индекс для автоотправки');
      // Увеличиваем индекс, чтобы выйти за пределы массива вопросов и запустить автоматическую отправку
      setCurrentQuestionIndex(allQuestions.length);
      return;
    }

    // Переходим к следующему вопросу
    if (currentQuestionIndex < allQuestions.length - 1) {
      const newIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(newIndex);
      await saveProgress(answers, newIndex, currentInfoScreenIndex);
    }
  } finally {
    // ФИКС: Сбрасываем флаг после завершения handleNext
    handleNextInProgressRef.current = false;
    setIsHandlingNext(false);
  }
}

