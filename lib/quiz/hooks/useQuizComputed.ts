// lib/quiz/hooks/useQuizComputed.ts
// РЕФАКТОРИНГ: Хук для группировки всех вычисляемых значений из quiz/page.tsx
// Вынесен для улучшения читаемости и поддержки

import { useMemo, useRef, useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { getInitialInfoScreens, getInfoScreenAfterQuestion } from '@/app/(miniapp)/quiz/info-screens';
import { filterQuestions, getEffectiveAnswers } from '@/lib/quiz/filterQuestions';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import type { Questionnaire, Question } from '@/lib/quiz/types';

// ФИКС: Единый тип режима экрана для ясности логики
export type ViewMode =
  | 'LOADING_PROGRESS'
  | 'RESUME'
  | 'RETAKE_SELECT'
  | 'INITIAL_INFO'
  | 'PENDING_INFO'
  | 'QUESTION'
  | 'DONE'
  | 'ERROR';

export interface UseQuizComputedParams {
  // State
  questionnaire: Questionnaire | null;
  answers: Record<number, string | string[]>;
  answersVersion?: number; // ФИКС: Версия ответов для отслеживания изменений значений
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  savedProgressVersion?: number; // ФИКС: Версия savedProgress для отслеживания изменений
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  showResumeScreen: boolean;
  hasResumed: boolean;
  isStartingOver: boolean;
  pendingInfoScreen: any | null;
  isLoadingProgress: boolean;
  
  // Refs
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  allQuestionsRawPrevRef: React.MutableRefObject<Question[]>;
  allQuestionsPrevRef: React.MutableRefObject<Question[]>;
  pendingInfoScreenRef?: React.MutableRefObject<any | null>; // ИСПРАВЛЕНО: Добавлен для проверки актуального состояния
  
  // State Machine
  quizStateMachine: any;
  
  // Other
  isDev: boolean;
}

/**
 * Хук для группировки всех вычисляемых значений из основного компонента Quiz
 * Организует вычисляемые значения для лучшей читаемости и производительности
 */
export function useQuizComputed(params: UseQuizComputedParams) {
  const {
    questionnaire,
    answers,
    answersVersion = 0, // ФИКС: Версия ответов
    savedProgress,
    savedProgressVersion = 0, // ФИКС: Версия savedProgress
    currentInfoScreenIndex,
    currentQuestionIndex,
    isRetakingQuiz,
    showRetakeScreen,
    showResumeScreen,
    hasResumed,
    isStartingOver,
    pendingInfoScreen,
    isLoadingProgress,
    questionnaireRef,
    currentInfoScreenIndexRef,
    allQuestionsRawPrevRef,
    allQuestionsPrevRef,
    pendingInfoScreenRef,
    quizStateMachine,
    isDev,
  } = params;

  // КРИТИЧНО: Ref для отслеживания последнего обработанного questionnaire в этом хуке
  const lastProcessedQuestionnaireRef = useRef<Questionnaire | null>(null);

  // ============================================
  // ГРУППА 1: Вычисление effectiveAnswers
  // ============================================
  
  // ФИКС: Используем версию ответов для отслеживания изменений значений, а не только количества ключей
  const answersKeysCount = Object.keys(answers || {}).length;
  const savedProgressAnswersKeysCount = Object.keys(savedProgress?.answers || {}).length;
  
  const effectiveAnswers = useMemo(() => {
    const result = getEffectiveAnswers(answers, savedProgress?.answers);
    return result;
  }, [
    // ФИКС: Зависеть от версии ответов, чтобы пересчитывать при изменении значений
    answersVersion,
    savedProgressVersion,
    answersKeysCount, // Также от количества для новых/удаленных ответов
    savedProgressAnswersKeysCount,
  ]);

  // ============================================
  // ГРУППА 2: Вычисление answersCount
  // ============================================
  
  // ИСПРАВЛЕНО: Используем стабильную зависимость для answersCount
  // effectiveAnswers может меняться между рендерами, даже если количество ключей не изменилось
  const effectiveAnswersKeysCount = Object.keys(effectiveAnswers).length;
  const answersCount = useMemo(() => {
    return Object.keys(effectiveAnswers).length;
  }, [effectiveAnswersKeysCount]); // ФИКС: Убрали isDev из зависимостей

  // ============================================
  // ГРУППА 3: Стабильный идентификатор questionnaire для зависимостей
  // ============================================

  // КРИТИЧНО ИСПРАВЛЕНИЕ: Создаем стабильный ID для предотвращения бесконечных циклов
  // Объединяем все источники questionnaire в один стабильный идентификатор
  const stableQuestionnaireId = useMemo(() => {
    const refId = questionnaireRef.current?.id;
    const stateId = questionnaire?.id;
    const stateMachineId = quizStateMachine.questionnaire?.id;

    // Используем первый доступный ID как стабильный идентификатор
    const stableId = refId || stateId || stateMachineId;

    // УБРАНО: Логирование вызывает бесконечные циклы в продакшене
    // if (isDev && stableId) {
    //   clientLogger.log('🔒 stableQuestionnaireId computed', {...});
    // }

    return stableId || null;
  }, [
    // КРИТИЧНО ИСПРАВЛЕНО: Убрали questionnaireRef.current?.id из зависимостей
    // ref.current не должен быть в зависимостях, так как изменения ref не триггерят ререндер
    // и это вызывает React Error #300
    questionnaire?.id,
    quizStateMachine.questionnaire?.id,
    isDev
  ]);

  // ============================================
  // ГРУППА 3: Вычисление allQuestionsRaw
  // ============================================

  // ФИКС: Используем stableQuestionnaireId для зависимостей
  const allQuestionsRaw = useMemo(() => {
    // КРИТИЧНО: Проверяем, изменился ли questionnaire
    const effectiveQuestionnaire = questionnaireRef.current || questionnaire || quizStateMachine.questionnaire;

    if (!effectiveQuestionnaire) {
      return allQuestionsRawPrevRef.current.length > 0 ? allQuestionsRawPrevRef.current : [];
    }

    // Проверяем, изменился ли questionnaire по сравнению с предыдущим
    const questionnaireChanged = !lastProcessedQuestionnaireRef.current ||
                               effectiveQuestionnaire.id !== lastProcessedQuestionnaireRef.current.id ||
                               effectiveQuestionnaire !== lastProcessedQuestionnaireRef.current;

    if (!questionnaireChanged && allQuestionsRawPrevRef.current.length > 0) {
      return allQuestionsRawPrevRef.current;
    }

    lastProcessedQuestionnaireRef.current = effectiveQuestionnaire;

    // Теперь выполняем вычисление только если questionnaire изменился
    try {
      // РЕФАКТОРИНГ: Используем единую функцию для извлечения вопросов
      const result = extractQuestionsFromQuestionnaire(effectiveQuestionnaire);
      
      // КРИТИЧНО: Сохраняем результат в ref для использования при следующем пересчете
      if (result.length > 0) {
        allQuestionsRawPrevRef.current = result;
      }
      
      if (result.length === 0) {
        // ИСПРАВЛЕНО: Если результат пустой, но есть предыдущее значение - используем его
        if (allQuestionsRawPrevRef.current.length > 0) {
          return allQuestionsRawPrevRef.current;
        }
      }

      return result;
    } catch (err) {
      // ИСПРАВЛЕНО: При ошибке используем предыдущее значение, если оно есть
      if (allQuestionsRawPrevRef.current.length > 0) {
        return allQuestionsRawPrevRef.current;
      }
      return allQuestionsRawPrevRef.current.length > 0 ? allQuestionsRawPrevRef.current : [];
    }
  }, [
    // ФИКС: Используем stableQuestionnaireId вместо отдельных источников
    stableQuestionnaireId,
  ]);

  // ============================================
  // ГРУППА 4: Вычисление allQuestions (с фильтрацией)
  // ============================================
  
  // ФИКС: Вычисляем стабильный хеш вопросов для отслеживания изменений содержимого
  // Не зависеть от .length, а от реального состава
  const allQuestionsRawIds = useMemo(() => {
    return allQuestionsRaw.map(q => q.id).sort((a, b) => a - b).join(',');
  }, [stableQuestionnaireId, allQuestionsRaw.length]); // ФИКС: Зависеть от stableQuestionnaireId и length для триггера
  
  const allQuestionsRawHash = useMemo(() => {
    if (allQuestionsRaw.length === 0) return '';
    return allQuestionsRawIds;
  }, [allQuestionsRawIds, allQuestionsRaw.length]);
  
  // ФИКС: Вычисляем хеш отфильтрованных вопросов для отслеживания изменений состава
  const allQuestionsHash = useMemo(() => {
    // Вычисляем хеш на основе allQuestionsRaw и ответов для определения изменений
    const rawIds = allQuestionsRaw.map(q => q.id).sort((a, b) => a - b).join(',');
    const answersKeys = Object.keys(answers).sort((a, b) => Number(a) - Number(b)).join(',');
    return `${rawIds}|${answersKeys}`;
  }, [allQuestionsRawHash, answersVersion]);
  
  const allQuestions = useMemo<Question[]>(() => {
    try {
      const effectiveQuestionnaire = questionnaireRef.current || questionnaire || quizStateMachine.questionnaire;
      
      const hasQuestionnaire = !!effectiveQuestionnaire;
      const hasAllQuestionsRaw = allQuestionsRaw.length > 0;
      const hasPrevRef = allQuestionsPrevRef.current.length > 0;
      
      // КРИТИЧНО: Используем предыдущее значение, если:
      // 1. allQuestionsRaw пустой И есть предыдущее значение
      // 2. questionnaire временно null И есть предыдущее значение
      const shouldUsePrevRef = (!hasAllQuestionsRaw || !hasQuestionnaire) && hasPrevRef;
      
      if (shouldUsePrevRef) {
        return allQuestionsPrevRef.current;
      }
      
      if ((!hasQuestionnaire || !hasAllQuestionsRaw) && !hasPrevRef) {
        return [];
      }
      
      // ФИКС: Убрали логирование из useMemo - это side effect
      // Используем единую функцию filterQuestions
      const filtered = filterQuestions({
        questions: allQuestionsRaw,
        answers,
        savedProgressAnswers: savedProgress?.answers,
        isRetakingQuiz,
        showRetakeScreen,
        logger: undefined, // ФИКС: Не передаем logger в useMemo
      });
      
      // Сохраняем результат в ref
      if (filtered.length > 0) {
        allQuestionsPrevRef.current = filtered;
      } else if (allQuestionsPrevRef.current.length > 0) {
        // НЕ перезаписываем ref, оставляем предыдущее значение
      }
      return filtered;
    } catch (err) {
      console.error('❌ Error computing allQuestions:', err);
      const fallback = allQuestionsRaw || [];
      if (fallback.length > 0) {
        allQuestionsPrevRef.current = fallback;
      }
      return fallback;
    }
  }, [
    // ФИКС: Зависеть от хеша, а не от length
    allQuestionsHash,
    stableQuestionnaireId,
    answersVersion,
    savedProgressVersion,
    isRetakingQuiz,
    showRetakeScreen,
  ]);
  
  // ФИКС: Логирование вынесено в отдельный useEffect
  useEffect(() => {
    if (isDev && allQuestions.length > 0) {
      clientLogger.log('✅ allQuestions: computed', {
        count: allQuestions.length,
        questionIds: allQuestions.map((q: Question) => q?.id).slice(0, 10),
      });
    }
  }, [allQuestionsHash]); // ФИКС: Убрали isDev из зависимостей

  // ============================================
  // ГРУППА 5: Вычисление savedProgressAnswersCount
  // ============================================
  
  // ИСПРАВЛЕНО: Используем стабильную зависимость для savedProgressAnswersCount
  const savedProgressAnswersCount = useMemo(() => Object.keys(savedProgress?.answers || {}).length, [savedProgressAnswersKeysCount]);

  // ============================================
  // ГРУППА 6: Вычисление initialInfoScreens
  // ============================================
  
  const initialInfoScreens = useMemo(() => {
    return getInitialInfoScreens();
  }, []); // ФИКС: Стабильная зависимость - initialInfoScreens не меняется
  
  // ФИКС: Логирование вынесено в useEffect
  useEffect(() => {
    if (isDev) {
      clientLogger.log('📊 initialInfoScreens: computed', {
        count: initialInfoScreens.length,
        screenIds: initialInfoScreens.map((s: any) => s?.id).filter(Boolean).slice(0, 10),
      });
    }
  }, [initialInfoScreens.length]); // ФИКС: Убрали isDev из зависимостей

  // ============================================
  // ГРУППА 7: Вычисление viewMode (единый режим экрана)
  // ============================================
  
  // ФИКС: Единый computed "режим экрана" вместо множественных проверок и возврата null
  const viewMode = useMemo<ViewMode>(() => {
    // Приоритет 1: Загрузка прогресса
    if (isLoadingProgress) {
      return 'LOADING_PROGRESS';
    }
    
    // Приоритет 2: Резюм-экран
    const savedCount = Object.keys(savedProgress?.answers ?? {}).length;
    if (!isStartingOver && savedCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN && !hasResumed) {
      return 'RESUME';
    }
    
    // Приоритет 3: Экран выбора тем при перепрохождении
    if (isRetakingQuiz && showRetakeScreen) {
      return 'RETAKE_SELECT';
    }
    
    // Приоритет 4: Начальные инфо-экраны
    const initialLen = initialInfoScreens.length;
    const onInitial = currentInfoScreenIndex < initialLen && currentInfoScreenIndexRef.current < initialLen;
    if (onInitial) {
      return 'INITIAL_INFO';
    }
    
    // Приоритет 5: Pending инфо-экран между вопросами
    const effectivePending = pendingInfoScreenRef?.current ?? pendingInfoScreen;
    if (effectivePending && !isRetakingQuiz) {
      return 'PENDING_INFO';
    }
    
    // Приоритет 6: Вопросы
    if (allQuestions.length > 0) {
      return 'QUESTION';
    }
    
    // Приоритет 7: Ошибка (нет вопросов)
    return 'ERROR';
  }, [
    isLoadingProgress,
    savedProgressAnswersCount,
    isStartingOver,
    hasResumed,
    isRetakingQuiz,
    showRetakeScreen,
    currentInfoScreenIndex,
    initialInfoScreens.length,
    pendingInfoScreen,
    allQuestionsHash, // ФИКС: Используем хеш вместо length
  ]);
  
  // ФИКС: isShowingInitialInfoScreen теперь просто проверяет viewMode
  const isShowingInitialInfoScreen = viewMode === 'INITIAL_INFO';
  
  // ФИКС: Логирование viewMode вынесено в useEffect
  useEffect(() => {
    if (isDev) {
      clientLogger.log('📺 viewMode: computed', {
        viewMode,
        isShowingInitialInfoScreen,
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        showResumeScreen,
        hasResumed,
        savedProgressAnswersCount,
      });
    }
  }, [viewMode, isShowingInitialInfoScreen, currentInfoScreenIndex, initialInfoScreens.length, showResumeScreen, hasResumed, savedProgressAnswersCount]); // ФИКС: Убрали isDev из зависимостей

  // ============================================
  // ГРУППА 8: Вычисление currentInitialInfoScreen
  // ============================================
  
  const currentInitialInfoScreen = useMemo(() => {
    // ИСПРАВЛЕНИЕ: currentInitialInfoScreen должен быть независимым от isShowingInitialInfoScreen
    // Он просто возвращает экран по индексу, если индекс валиден
    return currentInfoScreenIndex >= 0 &&
           currentInfoScreenIndex < initialInfoScreens.length
            ? initialInfoScreens[currentInfoScreenIndex]
            : null;
  }, [currentInfoScreenIndex, initialInfoScreens.length]); // ФИКС: Убрали isDev из зависимостей

  // ============================================
  // ГРУППА 9: Вычисление currentQuestion
  // ============================================
  
  // ФИКС: currentQuestion вычисляется ТОЛЬКО если viewMode === 'QUESTION'
  // Это убирает ситуацию "currentQuestion null → page думает, что вопрос не найден"
  const currentQuestion = useMemo(() => {
    // КРИТИЧНО: Вычисляем вопрос только если viewMode === 'QUESTION'
    if (viewMode !== 'QUESTION') {
      return null;
    }
    
    // ФИКС: Защита от некорректного индекса или undefined
    // Используем allQuestionsPrevRef как fallback, если allQuestions пустой после перемонтирования
    const questionsToUse = allQuestions.length > 0 
      ? allQuestions 
      : (allQuestionsPrevRef.current.length > 0 ? allQuestionsPrevRef.current : []);
    
    const isValidIndex = currentQuestionIndex >= 0 && currentQuestionIndex < questionsToUse.length;
    
    if (!isValidIndex) {
      return null;
    }
    
    const question = questionsToUse[currentQuestionIndex];
    
    // ФИКС: Проверка на undefined и валидность вопроса
    if (!question || !question.id) {
      return null;
    }
    
    return question;
  }, [
    viewMode, // ФИКС: Зависеть от viewMode вместо множественных проверок
    currentQuestionIndex,
    allQuestionsHash, // ФИКС: Используем хеш вместо length
  ]);
  
  // ФИКС: Логирование вынесено в useEffect
  useEffect(() => {
    if (isDev && currentQuestion) {
      clientLogger.log('✅ currentQuestion: computed', {
        questionId: currentQuestion.id,
        questionCode: currentQuestion.code,
        questionIndex: currentQuestionIndex,
        viewMode,
      });
    }
    if (isDev && !currentQuestion && viewMode === 'QUESTION') {
      clientLogger.warn('⏸️ currentQuestion: null but viewMode is QUESTION', {
        currentQuestionIndex,
        allQuestionsHash,
        viewMode,
      });
    }
  }, [currentQuestion?.id, currentQuestionIndex, allQuestionsHash, viewMode]); // ФИКС: Убрали isDev из зависимостей

  return {
    effectiveAnswers,
    answersCount,
    allQuestionsRaw,
    allQuestions,
    savedProgressAnswersCount,
    initialInfoScreens,
    isShowingInitialInfoScreen,
    currentInitialInfoScreen,
    currentQuestion,
    viewMode, // ФИКС: Возвращаем viewMode для использования в page.tsx
  };
}

