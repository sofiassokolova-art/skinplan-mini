// lib/quiz/handlers/handleNext.ts
// Вынесена функция handleNext из quiz/page.tsx для улучшения читаемости и поддержки

import { clientLogger } from '@/lib/client-logger';
import { INFO_SCREENS, getInitialInfoScreens, getInfoScreenAfterQuestion, getNextInfoScreenAfterScreen, type InfoScreen } from '@/app/(miniapp)/quiz/info-screens';

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
  const currentPendingInfoScreen = pendingInfoScreenRef?.current ?? pendingInfoScreen;

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
      // ФИКС: Сохраняем newIndex в sessionStorage для восстановления при перемонтировании
      // Это предотвращает сброс currentInfoScreenIndex в 0 при ошибке React #310
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('quiz_currentInfoScreenIndex', String(newIndex));
          clientLogger.log('💾 Сохранен currentInfoScreenIndex в sessionStorage', { newIndex });
        } catch (err) {
          clientLogger.warn('⚠️ Не удалось сохранить currentInfoScreenIndex в sessionStorage', err);
        }
      }
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
      // ИСПРАВЛЕНО: Проверяем анкету только при переходе к вопросам
      // Если анкета не загружена, все равно переходим к вопросам (они могут загрузиться позже)
      // Но логируем предупреждение для диагностики
      if (!hasQuestionnaire) {
        clientLogger.warn('⚠️ Переход к вопросам без анкеты - анкета может загрузиться позже', {
          hasQuestionnaire: !!questionnaire,
          hasQuestionnaireRef: !!questionnaireRef.current,
          loading,
          initCompleted: initCompletedRef.current,
        });
        // НЕ блокируем переход - разрешаем переход к вопросам, даже если анкета еще не загружена
        // Это позволит пользователю видеть инфо-экраны, даже если API вернул пустую анкету
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
      currentInfoScreenIndexRef.current = newInfoIndex;
      setCurrentInfoScreenIndex(newInfoIndex);
      // ФИКС: Сохраняем newInfoIndex в sessionStorage для восстановления при перемонтировании
      // Это предотвращает сброс currentInfoScreenIndex в 0 при ошибке React #310
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('quiz_currentInfoScreenIndex', String(newInfoIndex));
          clientLogger.log('💾 Сохранен currentInfoScreenIndex в sessionStorage', { newInfoIndex });
        } catch (err) {
          clientLogger.warn('⚠️ Не удалось сохранить currentInfoScreenIndex в sessionStorage', err);
        }
      }
      // КРИТИЧНО: Для нового пользователя всегда начинаем с первого вопроса (индекс 0)
      // Это гарантирует, что после прохождения всех инфо-экранов вопросы начнут отображаться
      setCurrentQuestionIndex(0);
      // ФИКС: Сохраняем 0 в sessionStorage для восстановления при перемонтировании
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('quiz_currentQuestionIndex', '0');
          clientLogger.log('💾 Сохранен currentQuestionIndex=0 в sessionStorage при переходе к вопросам');
        } catch (err) {
          clientLogger.warn('⚠️ Не удалось сохранить currentQuestionIndex в sessionStorage', err);
        }
      }
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
    if (currentPendingInfoScreen && !isRetakingQuiz) {
      // ИСПРАВЛЕНО: Используем getNextInfoScreenAfterScreen для цепочки экранов
      // Это правильно разделяет триггеры: showAfterQuestionCode для вопросов, showAfterInfoScreenId для экранов
      const nextInfoScreen = getNextInfoScreenAfterScreen(currentPendingInfoScreen.id);
      
      // ФИКС: Логирование для диагностики проблемы с цепочкой инфо-экранов
      if (isDev || true) { // Всегда логируем для диагностики
        clientLogger.warn('🔍 Проверка следующего инфо-экрана в цепочке:', {
          currentPendingInfoScreenId: currentPendingInfoScreen.id,
          nextInfoScreenFound: !!nextInfoScreen,
          nextInfoScreenId: nextInfoScreen?.id || null,
          currentQuestionIndex,
          isLastQuestion: currentQuestionIndex === allQuestions.length - 1,
        });
      }
      
      if (nextInfoScreen) {
        setPendingInfoScreen(nextInfoScreen);
        await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
        clientLogger.log('✅ Переход к следующему инфо-экрану в цепочке:', {
          from: currentPendingInfoScreen.id,
          to: nextInfoScreen.id,
        });
        return;
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
      // ФИКС: Сохраняем newIndex в sessionStorage для восстановления при перемонтировании
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('quiz_currentQuestionIndex', String(newIndex));
          clientLogger.log('💾 Сохранен currentQuestionIndex в sessionStorage', { newIndex });
        } catch (err) {
          clientLogger.warn('⚠️ Не удалось сохранить currentQuestionIndex в sessionStorage', err);
        }
      }
      
      // КРИТИЧНО: После закрытия инфо-экрана просто переходим к следующему вопросу
      // НЕ проверяем инфо-экран для следующего вопроса сразу - он будет проверен ПОСЛЕ того, как пользователь ответит
      // Это предотвращает застревание на инфо-экранах
      // ФИКС: Сохраняем информацию о том, что мы только что закрыли инфо-экран
      // Это предотвратит повторную проверку инфо-экрана для следующего вопроса сразу после перехода
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('quiz_justClosedInfoScreen', 'true');
          // Очищаем флаг через небольшую задержку, чтобы следующий вызов handleNext не видел его
          setTimeout(() => {
            try {
              sessionStorage.removeItem('quiz_justClosedInfoScreen');
            } catch (err) {
              // Игнорируем ошибки при очистке
            }
          }, 100);
        } catch (err) {
          // Игнорируем ошибки при сохранении
        }
      }
      await saveProgress(answers, newIndex, currentInfoScreenIndex);
      clientLogger.log('✅ Закрыт инфо-экран, переходим к следующему вопросу', {
        newIndex,
        allQuestionsLength: allQuestions.length,
        pendingInfoScreenCleared: true,
        nextQuestionCode: allQuestions[newIndex]?.code || null,
        hasAnsweredNextQuestion: allQuestions[newIndex] && answers[allQuestions[newIndex].id] !== undefined,
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
    // Если пользователь уже ответил на вопрос и нажимает "Далее", инфо-экран должен показываться
    const justClosedInfoScreen = typeof window !== 'undefined' && 
      sessionStorage.getItem('quiz_justClosedInfoScreen') === 'true';
    
    // ИСПРАВЛЕНО: Флаг блокирует показ инфо-экрана только если пользователь еще НЕ ответил на вопрос
    // Если пользователь уже ответил на вопрос и нажимает "Далее", инфо-экран должен показываться
    // Это исправляет проблему, когда после ответа на второй вопрос инфо-экран не показывается
    const shouldBlockInfoScreen = justClosedInfoScreen && !hasAnsweredCurrentQuestion;
    
    // ФИКС: Логирование для диагностики проблемы с застреванием на втором вопросе
    if (isDev && currentQuestion && hasAnsweredCurrentQuestion) {
      clientLogger.warn('🔍 Проверка инфо-экрана для вопроса:', {
        questionIndex: currentQuestionIndex,
        questionCode: currentQuestion.code,
        questionId: currentQuestion.id,
        hasAnswered: hasAnsweredCurrentQuestion,
        justClosedInfoScreen,
        shouldBlockInfoScreen,
        pendingInfoScreen: !!pendingInfoScreen,
        isRetakingQuiz,
      });
    }
    
    // ФИКС: Логирование, если условие не выполняется
    if (isDev && currentQuestion && hasAnsweredCurrentQuestion && (!currentQuestion || isRetakingQuiz || pendingInfoScreen || !hasAnsweredCurrentQuestion || shouldBlockInfoScreen)) {
      clientLogger.warn('⚠️ Условие для проверки инфо-экрана не выполняется:', {
        questionIndex: currentQuestionIndex,
        questionCode: currentQuestion?.code,
        hasCurrentQuestion: !!currentQuestion,
        isRetakingQuiz,
        hasPendingInfoScreen: !!pendingInfoScreen,
        hasAnswered: hasAnsweredCurrentQuestion,
        shouldBlock: shouldBlockInfoScreen,
      });
    }
    
    if (currentQuestion && !isRetakingQuiz && !pendingInfoScreen && hasAnsweredCurrentQuestion && !shouldBlockInfoScreen) {
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
          // ФИКС: Проверяем, не был ли этот инфо-экран уже показан для этого вопроса
          // Это предотвращает повторное показ инфо-экрана после закрытия предыдущего
          // Если мы только что закрыли инфо-экран и перешли к следующему вопросу,
          // не показываем инфо-экран сразу - он будет показан после того, как пользователь ответит
          // Но если пользователь уже ответил на этот вопрос ДО перехода к нему (например, из-за быстрых кликов),
          // то все равно показываем инфо-экран
          setPendingInfoScreen(infoScreen);
          await saveProgress(answers, currentQuestionIndex, currentInfoScreenIndex);
          clientLogger.log('✅ Показан инфо-экран после вопроса:', {
            questionCode: currentQuestion.code,
            questionIndex: currentQuestionIndex,
            infoScreenId: infoScreen.id,
            isLastQuestion,
            hasAnswered: true,
          });
          return;
        } else {
          // ФИКС: Логирование, если инфо-экран не найден для вопроса
          if (isDev) {
            clientLogger.warn('⚠️ Инфо-экран не найден для вопроса:', {
              questionCode: currentQuestion.code,
              questionIndex: currentQuestionIndex,
              questionId: currentQuestion.id,
            });
          }
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
      // ФИКС: Сохраняем newIndex в sessionStorage для восстановления при перемонтировании
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('quiz_currentQuestionIndex', String(newIndex));
          clientLogger.log('💾 Сохранен currentQuestionIndex в sessionStorage', { newIndex });
        } catch (err) {
          clientLogger.warn('⚠️ Не удалось сохранить currentQuestionIndex в sessionStorage', err);
        }
      }
      await saveProgress(answers, newIndex, currentInfoScreenIndex);
    }
  } finally {
    // ФИКС: Сбрасываем флаг после завершения handleNext
    handleNextInProgressRef.current = false;
    setIsHandlingNext(false);
  }
}

