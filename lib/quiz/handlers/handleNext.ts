// lib/quiz/handlers/handleNext.ts
// Вынесена функция handleNext из quiz/page.tsx для улучшения читаемости и поддержки

import type React from 'react';
import { clientLogger } from '@/lib/client-logger';
import { safeSessionStorageGet } from '@/lib/storage-utils';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { INFO_SCREENS, getInitialInfoScreens, getNextInfoScreenAfterScreen, getInfoScreenAfterQuestion } from '@/app/(miniapp)/quiz/info-screens';
import { getQuizSteps, getNextStep } from '@/lib/quiz/quizSteps';
import type { InfoScreen } from '@/app/(miniapp)/quiz/info-screens';
import type { Questionnaire, Question } from '@/lib/quiz/types';

// Импортируем модули навигации
import { validateAndGetPendingInfoScreen } from './navigation/validation';
import { handleQuestionNavigation } from './navigation/question-navigation';
import { handleInfoScreenNavigation } from './navigation/info-screen-navigation';
import { handleRetakeNavigation } from './navigation/retake-navigation';
import {
  saveIndexToSessionStorage,
  saveProgressSafely,
  updateInfoScreenIndex,
  updateQuestionIndex,
  canNavigate
} from './shared-utils';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';

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

// Вспомогательная функция для подсчета общего количества вопросов в анкете
// Теперь вопросы всегда нормализованы в questionnaire.questions
const getTotalQuestionsCount = (questionnaire: Questionnaire | null): number => {
  // ИСПРАВЛЕНО: Используем extractQuestionsFromQuestionnaire для получения вопросов из groups
  if (!questionnaire) return 0;
  const questions = extractQuestionsFromQuestionnaire(questionnaire);
  return questions.length;
};

// Вспомогательная функция для обеспечения готовности вопросов
// Использует questionnaireRef как источник истины, а не allQuestions
const ensureQuestionsReady = async (
  questionnaireRef: React.MutableRefObject<Questionnaire | null>,
  initInProgressRef: React.MutableRefObject<boolean>,
  loadQuestionnaire: () => Promise<Questionnaire | null>,
  setLoading?: React.Dispatch<React.SetStateAction<boolean>>
): Promise<boolean> => {
  // 1) Если уже есть вопросы — ок
  const qLen = getTotalQuestionsCount(questionnaireRef.current);
  if (qLen > 0) return true;

  if (questionnaireRef.current) {
    const normalizedQuestions = extractQuestionsFromQuestionnaire(questionnaireRef.current);
    if (normalizedQuestions.length > 0) {
      questionnaireRef.current = {
        ...questionnaireRef.current,
        questions: normalizedQuestions,
      };
      return true;
    }
  }

  if (initInProgressRef.current) {
    const waitEnd = Date.now() + 3000;
    while (Date.now() < waitEnd) {
      if (getTotalQuestionsCount(questionnaireRef.current) > 0) return true;
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }

  // 3) Иначе — принудительно грузим
  if (setLoading) {
    setLoading(true);
  }
  try {
    const loaded = await loadQuestionnaire();
    if (!loaded) return false;

    const loadedQuestionsCount = getTotalQuestionsCount(loaded);
    if (loadedQuestionsCount > 0) return true;

    const normalizedQuestions = extractQuestionsFromQuestionnaire(loaded);
    if (normalizedQuestions.length > 0) {
      questionnaireRef.current = {
        ...loaded,
        questions: normalizedQuestions,
      };
      return true;
    }

    return false;
  } finally {
    if (setLoading) {
      setLoading(false);
    }
  }
};

type BudgetInfoScreenResult = {
  handled: boolean;
  promise?: Promise<void>;
};

function tryShowBudgetInfoScreen(
  allQuestions: Question[],
  effectiveAnswers: Record<number, string | string[]>,
  pendingInfoScreenRef: React.MutableRefObject<InfoScreen | null> | undefined,
  setPendingInfoScreen: React.Dispatch<React.SetStateAction<InfoScreen | null>>,
  currentQuestionIndexRef: React.MutableRefObject<number> | undefined,
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>,
  saveProgress: (answers: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => Promise<void>,
  answers: Record<number, string | string[]>,
  currentInfoScreenIndex: number
): BudgetInfoScreenResult {
  const budgetQuestionIndex = allQuestions.findIndex(q => q.code === 'budget');
  if (budgetQuestionIndex === -1) {
    return { handled: false };
  }

  const budgetQuestion = allQuestions[budgetQuestionIndex];
  const hasAnsweredBudget = effectiveAnswers[budgetQuestion.id] !== undefined;
  if (!hasAnsweredBudget) {
    return { handled: false };
  }

  const infoScreen = getInfoScreenAfterQuestion('budget');
  if (!infoScreen) {
    return { handled: false };
  }

  if (pendingInfoScreenRef) {
    pendingInfoScreenRef.current = infoScreen;
  }
  setPendingInfoScreen(infoScreen);

  if (currentQuestionIndexRef) {
    updateQuestionIndex(budgetQuestionIndex, currentQuestionIndexRef, setCurrentQuestionIndex);
  } else {
    setCurrentQuestionIndex(budgetQuestionIndex);
  }

  const promise = saveProgressSafely(
    saveProgress,
    answers,
    budgetQuestionIndex,
    currentInfoScreenIndex
  );

  return { handled: true, promise };
}

// Экспортируем функцию для использования в других местах
export { getTotalQuestionsCount };

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
    setError,
    saveProgress,
    loadQuestionnaire,
    initInProgressRef,
    setLoading,
    isDev,
  } = params;

  // Валидация и получение актуального pendingInfoScreen
  const currentPendingInfoScreen = validateAndGetPendingInfoScreen({
    handleNextInProgressRef,
    questionnaire,
    loading,
    currentInfoScreenIndex,
    currentQuestionIndex,
    allQuestions,
    pendingInfoScreen,
    pendingInfoScreenRef,
    isDev,
  });

  // ИСПРАВЛЕНО: Проверяем валидацию более точно
  // Если handleNextInProgressRef.current === true, значит предыдущий вызов еще не завершился
  // В этом случае validateAndGetPendingInfoScreen вернет null, и мы должны вернуться
  if (handleNextInProgressRef.current) {
    return; // Уже выполняется
  }

  // ИСПРАВЛЕНО: Для начальных экранов pendingInfoScreen может быть null - это нормально
  // Для вопросов pendingInfoScreen также может быть null - это нормально
  // Проверяем только если мы НЕ на начальных экранах И НЕ на вопросах
  const initialInfoScreens = getInitialInfoScreens();
  const isOnInitialInfoScreens = currentInfoScreenIndex < initialInfoScreens.length;
  // ИСПРАВЛЕНО: Для вопросов проверяем, что мы прошли все начальные экраны
  // currentQuestionIndex >= 0 означает, что мы на вопросах (даже на первом вопросе)
  const isOnQuestions = currentInfoScreenIndex >= initialInfoScreens.length;
  
  // Если валидация не прошла по другим причинам (не из-за handleNextInProgressRef)
  // И мы не на начальных экранах (где pendingInfoScreen может быть null)
  // И мы не на вопросах (где pendingInfoScreen также может быть null)
  // ВАЖНО: Для вопросов pendingInfoScreen === null это нормально, не блокируем
  if (currentPendingInfoScreen === null && !handleNextInProgressRef.current && !isOnInitialInfoScreens && !isOnQuestions) {
    return; // Валидация не прошла
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
    
    
    // Флаг для особых случаев, когда нужно сразу перейти к следующему вопросу
    // (например, только что закрыли инфо-экран). Сейчас не используется для инфо-экранов —
    // переход по ним идёт через канонический список шагов.
    let shouldSkipToNextQuestion = false;
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

    // ИСПРАВЛЕНО: Добавлено логирование для диагностики перехода от последнего начального экрана
    
    if (currentInfoScreenIndex === initialInfoScreens.length - 1) {
      // ИСПРАВЛЕНО: Используем extractQuestionsFromQuestionnaire для логирования правильного количества вопросов
      const questionsForLog = extractQuestionsFromQuestionnaire(questionnaireRef.current);
      clientLogger.warn('🔄 handleNext: последний начальный экран, переходим к вопросам', {
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        hasQuestionnaire: !!questionnaire,
        hasQuestionnaireRef: !!questionnaireRef.current,
        questionnaireQuestionsLength: questionsForLog.length,
        loading,
        initCompleted: initCompletedRef.current,
      });

      // КРИТИЧНО: Используем ensureQuestionsReady вместо проверки allQuestions
      // Это гарантирует, что вопросы будут готовы перед переходом к ним
      const ok = await ensureQuestionsReady(
        questionnaireRef,
        initInProgressRef,
        loadQuestionnaire,
        setLoading
      );

      if (!ok) {
        // ИСПРАВЛЕНО: Используем extractQuestionsFromQuestionnaire для логирования
        const questionsForLog = extractQuestionsFromQuestionnaire(questionnaireRef.current);
        clientLogger.warn('❌ Не удалось загрузить вопросы для перехода к вопросам', {
          hasQuestionnaire: !!questionnaire,
          hasQuestionnaireRef: !!questionnaireRef.current,
          loading,
          initCompleted: initCompletedRef.current,
          questionnaireQuestionsLength: questionsForLog.length,
        });
        // Показываем ошибку пользователю
        setError('Не удалось загрузить анкету. Пожалуйста, обновите страницу.');
        return;
      }

      // ИСПРАВЛЕНО: Используем extractQuestionsFromQuestionnaire для логирования
      const questionsForLogReady = extractQuestionsFromQuestionnaire(questionnaireRef.current);
      clientLogger.warn('✅ handleNext: вопросы готовы, устанавливаем currentInfoScreenIndex', {
        questionnaireQuestionsLength: questionsForLogReady.length,
        newInfoIndex: initialInfoScreens.length,
      });

      const newInfoIndex = initialInfoScreens.length;
      // ИСПРАВЛЕНО: Используем extractQuestionsFromQuestionnaire для получения вопросов из groups
      // Вопросы могут быть в questionnaire.groups[].questions, а не в questionnaire.questions
      const questions = extractQuestionsFromQuestionnaire(questionnaireRef.current);
      const totalQuestionsCount = questions.length;

      // ФИКС: Логируем переход к вопросам после последнего инфо-экрана
      clientLogger.warn('🔄 handleNext: переход к вопросам после последнего инфо-экрана', {
        currentInfoScreenIndex,
        newInfoIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        questionsLength: questions.length,
        totalQuestionsCount,
      });

      if (questions.length === 0) {
        clientLogger.warn('⚠️ handleNext: вопросы не найдены в questionnaireRef, не устанавливаем currentQuestionIndex', {
          hasQuestionnaire: !!questionnaireRef.current,
          questionsLength: questions.length,
          totalQuestionsCount,
        });
        // Не устанавливаем индекс, если вопросов нет
        return;
      }

      // КРИТИЧНО: Обновляем ref СИНХРОННО перед установкой state, чтобы другие функции видели новое значение
      updateInfoScreenIndex(newInfoIndex, currentInfoScreenIndexRef, setCurrentInfoScreenIndex);
      // ИСПРАВЛЕНО: БАГ #3 - используем QUIZ_CONFIG.STORAGE_KEYS со скоупированием
      // ФИКС: Сохраняем newInfoIndex в sessionStorage для восстановления при перемонтировании
      const scopedInfoScreenKey = QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_INFO_SCREEN, qid);
      saveIndexToSessionStorage(scopedInfoScreenKey, newInfoIndex, '💾 Сохранен currentInfoScreenIndex в sessionStorage при переходе к вопросам');
      
      // Прямое прохождение: после экрана «Расскажите о вашей цели» всегда показываем первый вопрос (индекс 0),
      // даже если есть сохранённые ответы или код вопроса в sessionStorage. Восстановление прогресса делается
      // при загрузке страницы (resume), а не при нажатии «Продолжить» на последнем интро-экране.
      let nextQuestionIndex = 0;
      clientLogger.log('🔄 Переход к вопросам: после последнего начального экрана — всегда первый вопрос (прямое прохождение)', {
        currentQuestionIndex,
        nextQuestionIndex,
        questionsLength: questions.length,
        firstQuestionCode: questions[0]?.code,
      });

      // КРИТИЧНО: Финальная проверка перед установкой индекса
      // ИСПРАВЛЕНО: Исправлена логика - если индекс некорректный, устанавливаем 0 или последний валидный индекс
      if (nextQuestionIndex < 0 || nextQuestionIndex >= questions.length) {
        clientLogger.warn('⚠️ handleNext: некорректный nextQuestionIndex, исправляем', {
          nextQuestionIndex,
          questionsLength: questions.length,
        });
        nextQuestionIndex = questions.length > 0 ? Math.max(0, Math.min(questions.length - 1, nextQuestionIndex)) : 0;
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
      const answeredQuestionIds = Object.keys(answers).map(id => Number(id));
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
    // ИСПРАВЛЕНО: Используем extractQuestionsFromQuestionnaire для проверки вопросов из groups
    const isOnQuestions = currentInfoScreenIndex >= initialInfoScreens.length;
    const questionsFromRef = extractQuestionsFromQuestionnaire(questionnaireRef.current);
    if (isOnQuestions && (!questionnaireRef.current || questionsFromRef.length === 0)) {
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
          questionsLength: questionsFromRef.length,
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
    
    if (effectivePendingInfoScreen && allQuestions.length > 0) {
      const isWantImproveScreen = effectivePendingInfoScreen.id === 'want_improve';
      const isLastQuestion = currentQuestionIndex === allQuestions.length - 1;
      if (isWantImproveScreen && isLastQuestion) {
        clientLogger.log('ℹ️ Это последний инфо-экран want_improve - ждем нажатия кнопки "Получить план ухода"');
        return;
      }

      const steps = getQuizSteps(allQuestions);
      const nextStep = getNextStep(steps, currentQuestionIndex, effectivePendingInfoScreen);

      if (nextStep?.type === 'info') {
        if (pendingInfoScreenRef) pendingInfoScreenRef.current = nextStep.infoScreen;
        setPendingInfoScreen(nextStep.infoScreen);
        await saveProgressSafely(saveProgress, answers, currentQuestionIndex, currentInfoScreenIndex);
        return;
      }
      if (nextStep?.type === 'question') {
        const newIndex = nextStep.questionIndex;
        setPendingInfoScreen(null);
        if (pendingInfoScreenRef) pendingInfoScreenRef.current = null;
        if (justClosedInfoScreenRef) justClosedInfoScreenRef.current = true;
        queueMicrotask(() => { if (justClosedInfoScreenRef) justClosedInfoScreenRef.current = false; });
        updateQuestionIndex(newIndex, currentQuestionIndexRef, setCurrentQuestionIndex);
        const questionCode = allQuestions[newIndex]?.code;
        if (questionCode) {
          const scopedQuestionCodeKey = QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE, qid);
          saveIndexToSessionStorage(scopedQuestionCodeKey, questionCode, '💾 Сохранен код вопроса в sessionStorage');
        }
        await saveProgressSafely(saveProgress, answers, newIndex, currentInfoScreenIndex);
        return;
      }
      setPendingInfoScreen(null);
      if (pendingInfoScreenRef) pendingInfoScreenRef.current = null;
      await saveProgressSafely(saveProgress, answers, currentQuestionIndex, currentInfoScreenIndex);
      setCurrentQuestionIndex(allQuestions.length);
      return;
    }

    // ИСПРАВЛЕНО: Проверяем инфо-экран для текущего вопроса ТОЛЬКО если:
    // 1. pendingInfoScreen НЕ установлен (не обрабатывается выше)
    // 2. Пользователь УЖЕ ответил на текущий вопрос (currentQuestionIndex в answers)
    // 3. Это НЕ повторное прохождение
    // КРИТИЧНО: НЕ проверяем инфо-экран сразу после перехода к вопросу - только после ответа
    // ФИКС: НЕ проверяем инфо-экран сразу после закрытия предыдущего инфо-экрана
    // Это предотвращает застревание на инфо-экранах, когда пользователь уже ответил на следующий вопрос
    // ИСПРАВЛЕНО: Используем валидный индекс для получения currentQuestion (не выходим за границы)
    const validQuestionIndex = Math.min(currentQuestionIndex, allQuestions.length - 1);
    let currentQuestion = allQuestions[validQuestionIndex];
    // ИСПРАВЛЕНО: Проверяем, является ли вопрос последним, учитывая возможное изменение индекса нормализацией
    const isLastQuestion = validQuestionIndex === allQuestions.length - 1 || currentQuestionIndex >= allQuestions.length;

    // ИСПРАВЛЕНО: Используем ref для проверки актуального ответа, так как для single_choice handleNext вызывается через setTimeout
    // и answers из замыкания может быть устаревшим
    const effectiveAnswers = (answersRef?.current !== undefined && Object.keys(answersRef.current).length > 0)
      ? answersRef.current
      : answers;

    // ИСПРАВЛЕНО: Используем порядок вопросов, чтобы корректно найти последний отвеченный вопрос.
    // Object.keys для числовых id сортируется по возрастанию, что приводит к неверному "последнему" ответу.
    const questionByIndexCode = currentQuestion?.code;
    const lastAnsweredQuestion = allQuestions
      .slice()
      .reverse()
      .find(q => effectiveAnswers[q.id] !== undefined);

    if (!currentQuestion && lastAnsweredQuestion) {
      currentQuestion = lastAnsweredQuestion;
      clientLogger.log('🔧 [handleNext] Используем последний отвеченный вопрос (fallback вместо null)', {
        questionIndex: currentQuestionIndex,
        lastAnsweredQuestionId: lastAnsweredQuestion.id,
        lastAnsweredQuestionCode: lastAnsweredQuestion.code,
        allQuestionsLength: allQuestions.length,
      });
    } else if (
      currentQuestion &&
      effectiveAnswers[currentQuestion.id] === undefined &&
      lastAnsweredQuestion &&
      lastAnsweredQuestion.id !== currentQuestion.id
    ) {
      currentQuestion = lastAnsweredQuestion;
      clientLogger.log('🔧 [handleNext] Используем последний отвеченный вопрос вместо неотвеченного по индексу', {
        questionIndex: currentQuestionIndex,
        questionByIndex: questionByIndexCode || null,
        lastAnsweredQuestionId: lastAnsweredQuestion.id,
        lastAnsweredQuestionCode: lastAnsweredQuestion.code,
        allQuestionsLength: allQuestions.length,
      });
    }

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

    // Единая навигация: после вопроса следующий шаг берём из канонического списка (вопрос или инфо-цепочка)
    // ВАЖНО: для вопросов, после которых есть инфо-экраны, всегда используем канонический порядок,
    // даже если ответ ещё не успел сохраниться в answers/effectiveAnswers.
    const hasInfoScreenForCurrent =
      currentQuestion &&
      INFO_SCREENS.some(
        (s) =>
          (s.showAfterQuestionCode || '').toLowerCase() ===
          (currentQuestion!.code || '').toLowerCase()
      );

    // Специальный защитный кейс: после avoid_ingredients мы обязаны показать цепочку ai_showcase → habits_matter.
    // Если по какой-то причине канонический список шагов не сработает, явно ставим первый инфо-экран.
    if (
      !shouldSkipToNextQuestion &&
      currentQuestion &&
      currentQuestion.code === 'avoid_ingredients' &&
      !currentPendingInfoScreen &&
      (hasAnsweredCurrentQuestion || hasInfoScreenForCurrent)
    ) {
      const infoScreen = getInfoScreenAfterQuestion('avoid_ingredients');
      if (infoScreen) {
        if (pendingInfoScreenRef) {
          pendingInfoScreenRef.current = infoScreen;
        }
        setPendingInfoScreen(infoScreen);
        await saveProgressSafely(saveProgress, answers, currentQuestionIndex, currentInfoScreenIndex);
        return;
      }
    }

    if (
      !shouldSkipToNextQuestion &&
      currentQuestion &&
      !currentPendingInfoScreen &&
      (hasAnsweredCurrentQuestion || hasInfoScreenForCurrent) &&
      allQuestions.length > 0
    ) {
      const steps = getQuizSteps(allQuestions);
      const currentIndexForSteps = allQuestions.findIndex(
        (q) => q.id === currentQuestion.id
      );
      const nextStep =
        currentIndexForSteps >= 0
          ? getNextStep(steps, currentIndexForSteps, null)
          : null;
      if (nextStep?.type === 'info') {
        if (pendingInfoScreenRef) pendingInfoScreenRef.current = nextStep.infoScreen;
        setPendingInfoScreen(nextStep.infoScreen);
        await saveProgressSafely(saveProgress, answers, currentQuestionIndex, currentInfoScreenIndex);
        return;
      }
      if (nextStep?.type === 'question') {
        const newIndex = nextStep.questionIndex;
        setPendingInfoScreen(null);
        if (pendingInfoScreenRef) pendingInfoScreenRef.current = null;
        if (justClosedInfoScreenRef) justClosedInfoScreenRef.current = true;
        queueMicrotask(() => { if (justClosedInfoScreenRef) justClosedInfoScreenRef.current = false; });
        updateQuestionIndex(newIndex, currentQuestionIndexRef, setCurrentQuestionIndex);
        const questionCode = allQuestions[newIndex]?.code;
        if (questionCode) {
          const scopedQuestionCodeKey = QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE, qid);
          saveIndexToSessionStorage(scopedQuestionCodeKey, questionCode, '💾 Сохранен код вопроса в sessionStorage');
        }
        await saveProgressSafely(saveProgress, answers, newIndex, currentInfoScreenIndex);
        return;
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

    // Фикс: блокируем показ инфо-экрана после того, как он был только что закрыт
    // Это предотвращает повторное появление инфо-экрана в обычном потоке викторины
    // НО: не блокируем, если пользователь уже ответил на текущий вопрос (иначе инфо-экраны пропускаются)
    const shouldBlockInfoScreen = justClosedInfoScreen && !hasAnsweredCurrentQuestion;

    if (justClosedInfoScreen && hasAnsweredCurrentQuestion && justClosedInfoScreenRef) {
      justClosedInfoScreenRef.current = false;
      clientLogger.warn('🧹 ИНФО-СКРИН: Сбрасываем justClosedInfoScreenRef, чтобы показать инфо-экран после ответа', {
        questionIndex: currentQuestionIndex,
        questionCode: currentQuestion?.code,
      });
    }
    
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
    
    // ИСПРАВЛЕНО: Проверяем последний вопрос ПЕРЕД проверкой инфо-экрана для текущего вопроса
    // Это важно, потому что если currentQuestion null (из-за выхода индекса за границы),
    // мы все равно должны проверить инфо-экран для последнего вопроса
    // ИСПРАВЛЕНО: Определяем последний вопрос по коду 'budget', а не по индексу
    // Это важно, потому что allQuestions может быть неотфильтрованным, а useQuizComputed использует отфильтрованный
    const budgetQuestion = allQuestions.find(q => q.code === 'budget');
    const lastQuestionIndex = allQuestions.length - 1;
    const lastQuestionByIndex = lastQuestionIndex >= 0 ? allQuestions[lastQuestionIndex] : null;
    
    // ИСПРАВЛЕНО: Используем вопрос 'budget' как последний вопрос, если он найден
    // Иначе используем последний вопрос по индексу
    const actualLastQuestion = budgetQuestion || lastQuestionByIndex;
    const actualLastQuestionIndex = budgetQuestion 
      ? allQuestions.findIndex(q => q.code === 'budget')
      : lastQuestionIndex;
    
    // ИСПРАВЛЕНО: Проверяем, является ли текущий вопрос последним (по коду 'budget' или по индексу)
    const isActuallyLastQuestion = (currentQuestion && currentQuestion.code === 'budget') ||
                                   (validQuestionIndex === actualLastQuestionIndex) ||
                                   (currentQuestionIndex >= allQuestions.length && actualLastQuestionIndex >= 0);
    const questionToCheck = currentQuestion || actualLastQuestion;
    
    // ИСПРАВЛЕНО: Проверяем, был ли ответ на последний вопрос, даже если currentQuestion null
    // Используем effectiveAnswers для проверки ответа на последний вопрос
    const hasAnsweredLastQuestion = actualLastQuestion && effectiveAnswers[actualLastQuestion.id] !== undefined;
    const hasAnsweredQuestionToCheck = questionToCheck && effectiveAnswers[questionToCheck.id] !== undefined;
    
    // ИСПРАВЛЕНО: Проверяем инфо-экран после последнего вопроса, если:
    // 1. Это действительно последний вопрос (по коду 'budget' или по индексу)
    // 2. Пользователь ответил на последний вопрос (проверяем через effectiveAnswers)
    // 3. Это не повторное прохождение
    if (isActuallyLastQuestion && questionToCheck && (hasAnsweredCurrentQuestion || hasAnsweredLastQuestion || hasAnsweredQuestionToCheck)) {
      // Это последний вопрос - проверяем, есть ли инфо-экраны после него
      const infoScreen = getInfoScreenAfterQuestion(questionToCheck.code);
      if (infoScreen) {
        // ИСПРАВЛЕНО: БАГ #5 - обеспечиваем консистентность ref/state для pendingInfoScreen
        if (pendingInfoScreenRef) {
          pendingInfoScreenRef.current = infoScreen;
        }
        setPendingInfoScreen(infoScreen);
        // ИСПРАВЛЕНО: Используем валидный индекс для сохранения прогресса
        await saveProgressSafely(saveProgress, answers, actualLastQuestionIndex >= 0 ? actualLastQuestionIndex : lastQuestionIndex, currentInfoScreenIndex);
        clientLogger.log('✅ Показан инфо-экран после последнего вопроса (ранняя проверка):', {
          questionCode: questionToCheck.code,
          infoScreenId: infoScreen.id,
          currentQuestionIndex,
          validQuestionIndex,
          actualLastQuestionIndex,
          lastQuestionIndex,
          allQuestionsLength: allQuestions.length,
          currentQuestionWasNull: !currentQuestion,
          hasAnsweredCurrentQuestion,
          hasAnsweredLastQuestion,
          hasAnsweredQuestionToCheck,
          foundBudgetQuestion: !!budgetQuestion,
        });
        return;
      }
    }
    
    // ИСПРАВЛЕНО: Проверяем инфо-экран для текущего вопроса, используя валидный индекс
    if (!shouldSkipToNextQuestion && currentQuestion && !currentPendingInfoScreen && hasAnsweredCurrentQuestion) {
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

    // ИСПРАВЛЕНО: Логику «последнего вопроса» теперь определяет канонический список шагов (quizSteps),
    // поэтому специальная fallback-проверка последнего вопроса здесь больше не нужна.

    // Переходим к следующему вопросу
    // ИСПРАВЛЕНО: pendingInfoScreen теперь очищается в начале handleNext при закрытии инфо-экрана
    // Поэтому здесь мы всегда можем перейти к следующему вопросу, если он существует
    // КРИТИЧНО: Если мы только что закрыли инфо-экран (shouldSkipToNextQuestion = true),
    // нужно перейти к следующему вопросу, даже если мы не проверяли инфо-экран для текущего вопроса
    
    // ИСПРАВЛЕНО: Упростили логику shouldSkipToNextQuestion
    // Если мы закрыли инфо-экран или не на последнем вопросе - переходим к следующему
    if (shouldSkipToNextQuestion || currentQuestionIndex < allQuestions.length - 1) {
      // ИСПРАВЛЕНО: Проверяем, является ли текущий вопрос последним (по коду 'budget')
      // Если да, не переходим к следующему вопросу, а проверяем инфо-экраны
      const isCurrentQuestionBudget = currentQuestion && currentQuestion.code === 'budget';
      const budgetQuestion = allQuestions.find(q => q.code === 'budget');
      const hasAnsweredBudget = budgetQuestion && effectiveAnswers[budgetQuestion.id] !== undefined;
      
      // Упрощенная логика: всегда переходим к следующему вопросу (индекс + 1)
      const newIndex = currentQuestionIndex + 1;
      
      // ИСПРАВЛЕНО: Проверяем, является ли следующий вопрос 'budget'
      // Если да, и на него уже есть ответ, показываем инфо-экран вместо перехода
      // ИСПРАВЛЕНО: Используем let вместо const, чтобы можно было переопределить позже
      let nextQuestion = newIndex < allQuestions.length ? allQuestions[newIndex] : null;
      const isNextQuestionBudget = nextQuestion && nextQuestion.code === 'budget';
      
      if (isNextQuestionBudget && hasAnsweredBudget) {
        const r = tryShowBudgetInfoScreen(allQuestions, effectiveAnswers, pendingInfoScreenRef, setPendingInfoScreen, currentQuestionIndexRef, setCurrentQuestionIndex, saveProgress, answers, currentInfoScreenIndex);
        if (r.handled) { if (r.promise) await r.promise; return; }
      }
      
      // ИСПРАВЛЕНО: Если текущий вопрос - 'budget' и пользователь ответил на него,
      // проверяем инфо-экраны после него вместо перехода к следующему вопросу
      if (isCurrentQuestionBudget && hasAnsweredCurrentQuestion) {
        const r = tryShowBudgetInfoScreen(allQuestions, effectiveAnswers, pendingInfoScreenRef, setPendingInfoScreen, currentQuestionIndexRef, setCurrentQuestionIndex, saveProgress, answers, currentInfoScreenIndex);
        if (r.handled) { if (r.promise) await r.promise; return; }
      }
      
      if (newIndex >= allQuestions.length) {
        if (isCurrentQuestionBudget || (budgetQuestion && effectiveAnswers[budgetQuestion.id] !== undefined)) {
          const r = tryShowBudgetInfoScreen(allQuestions, effectiveAnswers, pendingInfoScreenRef, setPendingInfoScreen, currentQuestionIndexRef, setCurrentQuestionIndex, saveProgress, answers, currentInfoScreenIndex);
          if (r.handled) { if (r.promise) await r.promise; return; }
        }
        return;
      }
      
      // КРИТИЧНО: Проверяем, что следующий вопрос существует перед переходом
      // Это предотвращает пустой экран и ошибку "Вопрос не найден"
      // ИСПРАВЛЕНО: Если nextQuestion был null (из-за проверки границ), переопределяем его
      if (!nextQuestion) {
        nextQuestion = allQuestions[newIndex];
      }
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
        if (budgetQuestion && effectiveAnswers[budgetQuestion.id] !== undefined) {
          const r = tryShowBudgetInfoScreen(allQuestions, effectiveAnswers, pendingInfoScreenRef, setPendingInfoScreen, currentQuestionIndexRef, setCurrentQuestionIndex, saveProgress, answers, currentInfoScreenIndex);
          if (r.handled) { if (r.promise) await r.promise; return; }
        }
        return;
      }

      // ИСПРАВЛЕНО: Определяем nextQuestion для использования в логах и проверках
      // Используем уже определенную переменную nextQuestion из блока выше, или получаем из массива
      const nextQuestionForLog = nextQuestion || (newIndex < allQuestions.length ? allQuestions[newIndex] : null);

      // Страховка: вопрос «Какой тип ухода вам ближе?» (care_type) должен идти только после инфо-экрана «Расскажите о ваших предпочтениях».
      // Если переходим с lifestyle_habits на care_type — сначала показываем ai_comparison → preferences_intro.
      const currentQuestionCodeByIndex = (allQuestions[currentQuestionIndex]?.code || currentQuestion?.code || '').toLowerCase();
      const isCurrentLifestyleHabits = currentQuestionCodeByIndex === 'lifestyle_habits';
      const nextCode = (nextQuestionForLog?.code || '').toLowerCase();
      const isNextCareType = nextCode === 'care_type';
      if (isCurrentLifestyleHabits && isNextCareType) {
        const infoScreenAfterLifestyle = getInfoScreenAfterQuestion('lifestyle_habits');
        if (infoScreenAfterLifestyle) {
          clientLogger.log('🔧 [handleNext] Страховка: lifestyle_habits → care_type, показываем ai_comparison → preferences_intro', {
            infoScreenId: infoScreenAfterLifestyle.id,
          });
          if (pendingInfoScreenRef) pendingInfoScreenRef.current = infoScreenAfterLifestyle;
          setPendingInfoScreen(infoScreenAfterLifestyle);
          await saveProgressSafely(saveProgress, answers, currentQuestionIndex, currentInfoScreenIndex);
          return;
        }
      }
      
      // КРИТИЧНО: Логируем переход к следующему вопросу для диагностики
      clientLogger.warn('🔄 handleNext: переход к следующему вопросу', {
        currentQuestionIndex,
        newIndex,
        allQuestionsLength: allQuestions.length,
        currentQuestionCode: allQuestions[currentQuestionIndex]?.code || null,
        nextQuestionCode: nextQuestionForLog?.code || null,
        nextQuestionId: nextQuestionForLog?.id || null,
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
        // ИСПРАВЛЕНО: Используем nextQuestionForLog, который определен выше
        const nextQuestionInfoScreen = nextQuestionForLog ? getInfoScreenAfterQuestion(nextQuestionForLog.code) : null;
        clientLogger.warn('🧹 ИНФО-СКРИН: Очищаем pendingInfoScreen перед переходом к следующему вопросу', {
          currentQuestionCode: allQuestions[currentQuestionIndex]?.code || null,
          currentQuestionIndex,
          nextQuestionCode: nextQuestionForLog?.code || null,
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
