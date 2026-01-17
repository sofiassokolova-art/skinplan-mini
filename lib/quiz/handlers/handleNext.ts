// lib/quiz/handlers/handleNext.ts
// Вынесена функция handleNext из quiz/page.tsx для улучшения читаемости и поддержки

import type React from 'react';
import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
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
  answersRef?: React.MutableRefObject<Record<number, string | string[]>>; // ИСПРАВЛЕНО: Добавлен ref для проверки актуального ответа
  
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
  justClosedInfoScreenRef?: React.MutableRefObject<boolean>; // ИСПРАВЛЕНО: Заменяем sessionStorage на ref
  answers: Record<number, string | string[]>;
  
  // State setters
  setIsHandlingNext: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentInfoScreenIndex: React.Dispatch<React.SetStateAction<number>>;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<InfoScreen | null>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  
  // Functions
  saveProgress: (answers: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => Promise<void>;
  loadQuestionnaire: () => Promise<Questionnaire | null>;
  initInProgressRef: React.MutableRefObject<boolean>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isDev: boolean;
}

// Вспомогательная функция для обеспечения готовности вопросов
// Использует questionnaireRef как источник истины, а не allQuestions
const ensureQuestionsReady = async (
  questionnaireRef: React.MutableRefObject<Questionnaire | null>,
  initInProgressRef: React.MutableRefObject<boolean>,
  loadQuestionnaire: () => Promise<Questionnaire | null>,
  setLoading?: React.Dispatch<React.SetStateAction<boolean>>
): Promise<boolean> => {
  // 1) Если уже есть вопросы — ок
  const qLen = questionnaireRef.current?.questions?.length ?? 0;
  if (qLen > 0) return true;

  // 2) Если загрузка уже идёт — просто ждём немного
  if (initInProgressRef.current) {
    let attempts = 0;
    while (attempts < 30) { // ~3s
      const len = questionnaireRef.current?.questions?.length ?? 0;
      if (len > 0) return true;
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    return false;
  }

  // 3) Иначе — принудительно грузим
  if (setLoading) {
    setLoading(true);
  }
  try {
    const loaded = await loadQuestionnaire();
    return (loaded?.questions?.length ?? 0) > 0;
  } finally {
    if (setLoading) {
      setLoading(false);
    }
  }
};

export async function handleNext(params: HandleNextParams): Promise<void> {
  const {
    handleNextInProgressRef,
    currentInfoScreenIndexRef,
    currentQuestionIndexRef,
    questionnaireRef,
    initCompletedRef,
    answersRef,
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
    justClosedInfoScreenRef,
    answers,
    setIsHandlingNext,
    setCurrentInfoScreenIndex,
    setCurrentQuestionIndex,
    setPendingInfoScreen,
    saveProgress,
    loadQuestionnaire,
    initInProgressRef,
    setLoading,
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
    // ФИКС: Получаем questionnaireId для скоупирования ключей sessionStorage с fallback
    // Это предотвращает нестабильные ключи, когда анкета еще не загружена
    const questionnaireId = questionnaire?.id?.toString() || questionnaireRef.current?.id?.toString();
    const qid = questionnaireId ?? 'pending';
    
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
      
      // ИСПРАВЛЕНО: Очищаем pendingInfoScreen и ref СРАЗУ и синхронно для предотвращения currentQuestion = null
      // КРИТИЧНО: Очистка должна происходить ДО любого использования currentQuestion
      if (pendingInfoScreenRef) {
        pendingInfoScreenRef.current = null;
        clientLogger.warn('🧹 ИНФО-СКРИН: pendingInfoScreenRef.current очищен синхронно', {
          pendingInfoScreenId: currentPendingInfoScreen.id,
        });
      }
      // ИСПРАВЛЕНО: Устанавливаем null в state, но не ждем его обновления - ref уже очищен
      setPendingInfoScreen(null);
      
      // ФИКС: Используем queueMicrotask для сброса флага после одного tick
      // Это предотвращает "залипание" флага и позволяет ему работать на следующем клике
      if (justClosedInfoScreenRef) {
        justClosedInfoScreenRef.current = true;
        clientLogger.warn('🧹 ИНФО-СКРИН: justClosedInfoScreenRef.current установлен', {
          pendingInfoScreenId: currentPendingInfoScreen.id,
        });
        // Сбрасываем флаг через queueMicrotask, чтобы он пережил один tick
        queueMicrotask(() => {
          if (justClosedInfoScreenRef) {
            justClosedInfoScreenRef.current = false;
          }
        });
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
      // ИСПРАВЛЕНО: БАГ #3 - используем QUIZ_CONFIG.STORAGE_KEYS со скоупированием
      // ФИКС: Сохраняем newIndex в sessionStorage для восстановления при перемонтировании
      const scopedInfoScreenKey = QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN, qid);
      saveIndexToSessionStorage(scopedInfoScreenKey, newIndex, '💾 Сохранен currentInfoScreenIndex в sessionStorage');
      // ИСПРАВЛЕНО: БАГ #5 - обеспечиваем консистентность ref/state для pendingInfoScreen
      // ФИКС: Если после инкремента мы прошли все начальные экраны, очищаем pendingInfoScreen
      if (newIndex >= initialInfoScreens.length) {
        if (pendingInfoScreenRef) {
          pendingInfoScreenRef.current = null;
        }
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
      // КРИТИЧНО: Используем ensureQuestionsReady вместо проверки allQuestions
      // Это гарантирует, что вопросы будут готовы перед переходом к ним
      const ok = await ensureQuestionsReady(
        questionnaireRef,
        initInProgressRef,
        loadQuestionnaire,
        setLoading
      );

      if (!ok) {
        clientLogger.warn('❌ Не удалось загрузить вопросы для перехода к вопросам', {
          hasQuestionnaire: !!questionnaire,
          hasQuestionnaireRef: !!questionnaireRef.current,
          loading,
          initCompleted: initCompletedRef.current,
        });
        // Показываем ошибку пользователю
        setError('Не удалось загрузить анкету. Пожалуйста, обновите страницу.');
        return;
      }

      const newInfoIndex = initialInfoScreens.length;
      // ФИКС: Логируем переход к вопросам после последнего инфо-экрана
      clientLogger.warn('🔄 handleNext: переход к вопросам после последнего инфо-экрана', {
        currentInfoScreenIndex,
        newInfoIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        questionsLength: questionnaireRef.current?.questions?.length ?? 0,
      });
      // КРИТИЧНО: Обновляем ref СИНХРОННО перед установкой state, чтобы другие функции видели новое значение
      updateInfoScreenIndex(newInfoIndex, currentInfoScreenIndexRef, setCurrentInfoScreenIndex);
      // ИСПРАВЛЕНО: БАГ #3 - используем QUIZ_CONFIG.STORAGE_KEYS со скоупированием
      // ФИКС: Сохраняем newInfoIndex в sessionStorage для восстановления при перемонтировании
      const scopedInfoScreenKey = QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN, qid);
      saveIndexToSessionStorage(scopedInfoScreenKey, newInfoIndex, '💾 Сохранен currentInfoScreenIndex в sessionStorage при переходе к вопросам');

      // Получаем вопросы из questionnaireRef - это теперь источник истины
      const questions = questionnaireRef.current?.questions ?? [];
      if (questions.length === 0) {
        clientLogger.warn('⚠️ handleNext: вопросы не найдены в questionnaireRef, не устанавливаем currentQuestionIndex', {
          hasQuestionnaire: !!questionnaireRef.current,
          questionsLength: questions.length,
        });
        // Не устанавливаем индекс, если вопросов нет
        return;
      }
      
      // ИСПРАВЛЕНО: Теперь используем questions из questionnaireRef как источник истины
      // Восстанавливаем questionCode из sessionStorage для пользователей с прогрессом
      const scopedQuestionCodeKey = QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE, qid);
      const savedQuestionCode = typeof window !== 'undefined' ? sessionStorage.getItem(scopedQuestionCodeKey) : null;
      const answeredQuestionIds = Object.keys(answers).map(id => Number(id));
      let nextQuestionIndex = 0;

      // Проверяем, есть ли сохраненный вопрос или ответы (пользователь возвращается)
      const hasSavedProgress = savedQuestionCode || answeredQuestionIds.length > 0 || currentQuestionIndex > 0;

      if (hasSavedProgress && savedQuestionCode) {
        // Восстанавливаем индекс по сохраненному коду вопроса
        const savedIndex = questions.findIndex((q: Question) => q.code === savedQuestionCode);
        if (savedIndex >= 0 && savedIndex < questions.length) {
          nextQuestionIndex = savedIndex;
          clientLogger.log('🔄 Переход к вопросам: восстановлен индекс по сохраненному коду', {
            savedQuestionCode,
            savedIndex,
            nextQuestionIndex,
            currentQuestionIndex,
            questionsLength: questions.length,
          });
        } else {
          // Если вопрос не найден, начинаем с 0
          nextQuestionIndex = 0;
          clientLogger.warn('⚠️ Переход к вопросам: сохраненный вопрос не найден, начинаем с 0', {
            savedQuestionCode,
            questionsLength: questions.length,
          });
        }
      } else if (hasSavedProgress && currentQuestionIndex > 0) {
        // Используем сохраненный индекс, если код не найден
        nextQuestionIndex = Math.min(currentQuestionIndex, questions.length - 1);
        clientLogger.log('🔄 Переход к вопросам: восстановлен индекс из currentQuestionIndex', {
          currentQuestionIndex,
          nextQuestionIndex,
          questionsLength: questions.length,
        });
      } else {
        // Первый заход после интро - начинаем с первого вопроса
        nextQuestionIndex = 0;
        clientLogger.log('🔄 Переход к вопросам: первый заход, начинаем с первого вопроса', {
          currentQuestionIndex,
          nextQuestionIndex,
          questionsLength: questions.length,
        });
      }

      // КРИТИЧНО: Финальная проверка перед установкой индекса
      if (nextQuestionIndex < 0 || nextQuestionIndex >= questions.length) {
        clientLogger.warn('⚠️ handleNext: некорректный nextQuestionIndex, исправляем', {
          nextQuestionIndex,
          questionsLength: questions.length,
        });
        nextQuestionIndex = Math.max(0, Math.min(questions.length - 1, 0));
      }

      updateQuestionIndex(nextQuestionIndex, currentQuestionIndexRef, setCurrentQuestionIndex);
      // ИСПРАВЛЕНО: Сохраняем код вопроса вместо индекса для стабильного восстановления
      const questionCode = questions[nextQuestionIndex]?.code;
      if (questionCode && questions.length > 0) {
        const scopedQuestionCodeKey = QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE, qid);
        saveIndexToSessionStorage(scopedQuestionCodeKey, questionCode, '💾 Сохранен код вопроса в sessionStorage при переходе к вопросам');
      }
      // ИСПРАВЛЕНО: Принудительно очищаем pendingInfoScreen при переходе к вопросам
      if (pendingInfoScreenRef) {
        pendingInfoScreenRef.current = null;
      }
      setPendingInfoScreen(null);
      // ФИКС: Детальное логирование установки вопросов для диагностики
      clientLogger.log('✅ Завершены все начальные инфо-экраны, переходим к вопросам', {
        newInfoIndex,
        questionsLength: questions.length,
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

    // ИСПРАВЛЕНО: Проверяем готовность вопросов с помощью questionnaireRef
    // Если мы на вопросах и вопросов нет в questionnaireRef, ждем их загрузки
    const isOnQuestions = currentInfoScreenIndex >= initialInfoScreens.length;
    if (isOnQuestions && (!questionnaireRef.current || (questionnaireRef.current.questions?.length ?? 0) === 0)) {
      // Используем ensureQuestionsReady для ожидания загрузки вопросов
      const ok = await ensureQuestionsReady(
        questionnaireRef,
        initInProgressRef,
        loadQuestionnaire,
        setLoading
      );

      if (!ok) {
        clientLogger.warn('⏸️ handleNext: вопросы не загружены и не удалось их загрузить - ждем...', {
          hasQuestionnaire: !!questionnaire,
          hasQuestionnaireRef: !!questionnaireRef.current,
          questionsLength: questionnaireRef.current?.questions?.length ?? 0,
          currentInfoScreenIndex,
          initialInfoScreensLength: initialInfoScreens.length,
        });
        return;
      }
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
      clientLogger.warn('⚠️ currentQuestionIndex выходит за пределы allQuestions, корректируем на 0', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        questionIds: allQuestions.map((q: Question) => q.id),
        isRetakingQuiz,
        showRetakeScreen,
      });
      // ФИКС: Корректируем индекс на 0 (начало), а не на последний вопрос
      // Это предотвращает телепортацию пользователя в конец квиза
      const correctedIndex = 0;
      setCurrentQuestionIndex(correctedIndex);
      // ФИКС: Не сохраняем прогресс, если allQuestions пустой
      if (allQuestions.length > 0 && !isRetakingQuiz && !showRetakeScreen) {
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
      
      // ФИКС: Если вопрос не найден по индексу, корректируем на 0 (начало)
      // Это предотвращает телепортацию пользователя на последний вопрос, что выглядит как баг
      const correctedIndex = 0;
      clientLogger.warn('⚠️ Текущий вопрос не найден в allQuestions, корректируем на 0', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        correctedIndex,
      });
      setCurrentQuestionIndex(correctedIndex);
      // ФИКС: Не сохраняем прогресс, если allQuestions пустой
      if (allQuestions.length > 0) {
        await saveProgress(answers, correctedIndex, currentInfoScreenIndex);
      }
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
      // ИСПРАВЛЕНО: БАГ #3 - используем QUIZ_CONFIG.STORAGE_KEYS со скоупированием
      // Сохраняем код вопроса вместо индекса для стабильного восстановления
      const questionCode = allQuestions[newIndex]?.code;
      if (questionCode) {
        const scopedQuestionCodeKey = QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE, qid);
        saveIndexToSessionStorage(scopedQuestionCodeKey, questionCode, '💾 Сохранен код вопроса в sessionStorage');
      }

      // ФИКС: Используем queueMicrotask для сброса флага после одного tick
      if (justClosedInfoScreenRef) {
        justClosedInfoScreenRef.current = true;
        clientLogger.warn('🧹 ИНФО-СКРИН: justClosedInfoScreenRef.current установлен после перехода', {
          newIndex,
        });
        // Сбрасываем флаг через queueMicrotask, чтобы он пережил один tick
        queueMicrotask(() => {
          if (justClosedInfoScreenRef) {
            justClosedInfoScreenRef.current = false;
          }
        });
      }

      // ИСПРАВЛЕНО: Используем ref для проверки актуального ответа, так как для single_choice handleNext вызывается через setTimeout
      // и answers из замыкания может быть устаревшим
      const effectiveAnswers = (answersRef?.current !== undefined && Object.keys(answersRef.current).length > 0)
        ? answersRef.current
        : answers;

      await saveProgressSafely(saveProgress, answers, newIndex, currentInfoScreenIndex);
      clientLogger.log('✅ Закрыт инфо-экран, переходим к следующему вопросу', {
        newIndex,
        allQuestionsLength: allQuestions.length,
        pendingInfoScreenCleared: true,
        nextQuestionCode: nextQuestion?.code || null,
        nextQuestionId: nextQuestion?.id || null,
        hasAnsweredNextQuestion: nextQuestion && effectiveAnswers[nextQuestion.id] !== undefined, // ФИКС: Используем effectiveAnswers
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

    // ИСПРАВЛЕНО: Используем ref для проверки актуального ответа, так как для single_choice handleNext вызывается через setTimeout
    // и answers из замыкания может быть устаревшим
    const effectiveAnswers = (answersRef?.current !== undefined && Object.keys(answersRef.current).length > 0)
      ? answersRef.current
      : answers;

    // ФИКС B: Хард-fallback - если currentQuestion валиден, но hasAnsweredCurrentQuestion false,
    // но ответ есть в answersRef/effectiveAnswers - это mismatch id/code, логируем и нормализуем
    let hasAnsweredCurrentQuestion = currentQuestion && effectiveAnswers[currentQuestion.id] !== undefined;

    if (currentQuestion && !hasAnsweredCurrentQuestion) {
      // Проверяем, есть ли ответ в answersRef, но для другого questionId (возможен mismatch)
      const hasAnswerInRef = answersRef?.current && Object.values(answersRef.current).length > 0;
      const hasAnswerInAnswers = answers && Object.values(answers).length > 0;
      
      if (hasAnswerInRef || hasAnswerInAnswers) {
        // Пытаемся найти ответ для текущего вопроса по коду
        const questionCode = currentQuestion.code;
        const allQuestionsWithCode = allQuestions.filter(q => q.code === questionCode);
        
        if (allQuestionsWithCode.length > 0) {
          // Проверяем, есть ли ответ для любого вопроса с таким кодом
          const foundQuestionWithAnswer = allQuestionsWithCode.find(q =>
            effectiveAnswers[q.id] !== undefined ||
            (answersRef?.current && answersRef.current[q.id] !== undefined) ||
            (answers && answers[q.id] !== undefined)
          );
          
          if (foundQuestionWithAnswer && foundQuestionWithAnswer.id !== currentQuestion.id) {
            // Mismatch - ответ есть для вопроса с таким же кодом, но другим ID
            clientLogger.warn('⚠️ [Нормализация] Обнаружен mismatch questionId при проверке ответа', {
              currentQuestionId: currentQuestion.id,
              currentQuestionCode: questionCode,
              foundQuestionId: foundQuestionWithAnswer.id,
              hasAnswerForCurrent: false,
              hasAnswerForFound: true,
              currentQuestionIndex,
              foundQuestionIndex: allQuestions.findIndex(q => q.id === foundQuestionWithAnswer.id),
              effectiveAnswersKeys: Object.keys(effectiveAnswers),
              answersRefKeys: answersRef?.current ? Object.keys(answersRef.current) : [],
              answersKeys: answers ? Object.keys(answers) : [],
            });
            
            // Не делаем ранний return - продолжаем с попыткой нормализации через переход к следующему вопросу
            // или обновление индекса
          }
        }
      }
    }
    
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
    // ИСПРАВЛЕНО: БАГ #4 - используем ref вместо sessionStorage для justClosedInfoScreen
    // Проверяем флаг через ref - он очищается в finally блоке после перехода к следующему вопросу
    const justClosedInfoScreen = justClosedInfoScreenRef?.current || false;
    
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
          // ИСПРАВЛЕНО: БАГ #4 - используем ref вместо sessionStorage для justClosedInfoScreen
          // Сбрасываем флаг сразу после нахождения инфо-экрана, чтобы он не блокировал показ
          if (justClosedInfoScreenRef && justClosedInfoScreen) {
            justClosedInfoScreenRef.current = false;
            clientLogger.warn('🧹 ИНФО-СКРИН: justClosedInfoScreenRef.current очищен после нахождения инфо-экрана');
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
          // ИСПРАВЛЕНО: БАГ #5 - обеспечиваем консистентность ref/state для pendingInfoScreen
          if (pendingInfoScreenRef) {
            pendingInfoScreenRef.current = infoScreen;
          }
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
    // КРИТИЧНО: Если мы только что закрыли инфо-экран (shouldSkipToNextQuestion = true),
    // нужно перейти к следующему вопросу, даже если мы не проверяли инфо-экран для текущего вопроса
    
    // ИСПРАВЛЕНО: Упростили логику shouldSkipToNextQuestion
    // Если мы закрыли инфо-экран или не на последнем вопросе - переходим к следующему
    if (shouldSkipToNextQuestion || currentQuestionIndex < allQuestions.length - 1) {
      // Упрощенная логика: всегда переходим к следующему вопросу (индекс + 1)
      const newIndex = currentQuestionIndex + 1;
      
      // Если мы уже на последнем вопросе и закрыли инфо-экран, не переходим дальше
      if (newIndex >= allQuestions.length) {
        clientLogger.warn('⚠️ handleNext: не переходим к следующему вопросу - уже на последнем', {
          currentQuestionIndex,
          newIndex,
          allQuestionsLength: allQuestions.length,
          shouldSkipToNextQuestion,
        });
        return;
      }
      
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
          shouldSkipToNextQuestion,
        });
        // НЕ переходим к следующему вопросу, если его нет
        return;
      }
      
      // ИСПРАВЛЕНО: Удалена дублирующая очистка - она уже выполнена выше
      
      // КРИТИЧНО: Логируем переход к следующему вопросу для диагностики
      clientLogger.warn('🔄 handleNext: переход к следующему вопросу', {
        currentQuestionIndex,
        newIndex,
        allQuestionsLength: allQuestions.length,
        currentQuestionCode: allQuestions[currentQuestionIndex]?.code || null,
        nextQuestionCode: nextQuestion?.code || null,
        nextQuestionId: nextQuestion?.id || null,
        hasAnsweredCurrent: allQuestions[currentQuestionIndex] && effectiveAnswers[allQuestions[currentQuestionIndex].id] !== undefined, // ФИКС: Используем effectiveAnswers
        // ИСПРАВЛЕНО: Добавляем проверку pendingInfoScreen для диагностики пустого экрана
        pendingInfoScreen: !!pendingInfoScreen,
        pendingInfoScreenId: pendingInfoScreen?.id || null,
        currentPendingInfoScreen: !!currentPendingInfoScreen,
        currentPendingInfoScreenId: currentPendingInfoScreen?.id || null,
      });
      
      // КРИТИЧНО: ВСЕГДА очищаем pendingInfoScreen перед переходом к следующему вопросу
      // Это предотвращает блокировку показа следующего вопроса
      // Инфо-экран для следующего вопроса будет установлен ПОСЛЕ того, как пользователь ответит на него (строки 751-824)
      // НЕ устанавливаем pendingInfoScreen для следующего вопроса до того, как на него ответили
      if (pendingInfoScreen || currentPendingInfoScreen) {
        const nextQuestionInfoScreen = getInfoScreenAfterQuestion(nextQuestion.code);
        clientLogger.warn('🧹 ИНФО-СКРИН: Очищаем pendingInfoScreen перед переходом к следующему вопросу', {
          currentQuestionCode: allQuestions[currentQuestionIndex]?.code || null,
          currentQuestionIndex,
          nextQuestionCode: nextQuestion.code,
          nextQuestionIndex: newIndex,
          pendingInfoScreenId: (pendingInfoScreen as InfoScreen | null)?.id || (currentPendingInfoScreen as InfoScreen | null)?.id || null,
          nextQuestionHasInfoScreen: !!nextQuestionInfoScreen,
          nextQuestionInfoScreenId: (nextQuestionInfoScreen as InfoScreen | null | undefined)?.id || null,
          note: 'Инфо-экран для следующего вопроса будет установлен после ответа на него',
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
      }
      
      // ИСПРАВЛЕНО: БАГ #4 - используем ref вместо sessionStorage для justClosedInfoScreen
      // Очищаем флаг после перехода к следующему вопросу - это позволяет инфо-экранам показываться для следующего вопроса
      if (shouldSkipToNextQuestion && justClosedInfoScreenRef) {
        justClosedInfoScreenRef.current = false;
        clientLogger.warn('🧹 ИНФО-СКРИН: justClosedInfoScreenRef.current очищен после перехода к следующему вопросу', {
          previousIndex: currentQuestionIndex,
          newIndex,
        });
      }

      updateQuestionIndex(newIndex, currentQuestionIndexRef, setCurrentQuestionIndex);
      // ИСПРАВЛЕНО: БАГ #3 - используем QUIZ_CONFIG.STORAGE_KEYS со скоупированием
      // Сохраняем код вопроса вместо индекса для стабильного восстановления
      // ФИКС: Не сохраняем, если allQuestions пустой
      const questionCode = allQuestions[newIndex]?.code;
      if (questionCode && allQuestions.length > 0) {
        const scopedQuestionCodeKey = QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE, qid);
        saveIndexToSessionStorage(scopedQuestionCodeKey, questionCode, '💾 Сохранен код вопроса в sessionStorage');
      }
      // ФИКС: Не сохраняем прогресс, если allQuestions пустой
      if (allQuestions.length > 0) {
        await saveProgressSafely(saveProgress, answers, newIndex, currentInfoScreenIndex);
      }

      // КРИТИЧНО: Логируем успешный переход к следующему вопросу
      clientLogger.warn('✅ handleNext: успешно перешли к следующему вопросу', {
        previousIndex: currentQuestionIndex,
        newIndex,
        allQuestionsLength: allQuestions.length,
        nextQuestionExists: !!allQuestions[newIndex],
        nextQuestionCode: allQuestions[newIndex]?.code || null,
        shouldSkipToNextQuestion,
      });
    } else if (!shouldSkipToNextQuestion) {
      // КРИТИЧНО: Логируем, если не переходим к следующему вопросу (только если не из-за shouldSkipToNextQuestion)
      clientLogger.warn('⚠️ handleNext: не переходим к следующему вопросу', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        isLastQuestion: currentQuestionIndex === allQuestions.length - 1,
        condition: currentQuestionIndex < allQuestions.length - 1,
        shouldSkipToNextQuestion,
      });
    }
  } finally {
    // ФИКС: Сбрасываем флаг после завершения handleNext
    handleNextInProgressRef.current = false;
    setIsHandlingNext(false);
    // ФИКС: Убрали безусловный сброс justClosedInfoScreenRef из finally
    // Теперь флаг сбрасывается через queueMicrotask в местах установки
    // Это позволяет флагу работать на следующем клике/вызове
  }
}

