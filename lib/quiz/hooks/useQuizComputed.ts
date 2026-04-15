// lib/quiz/hooks/useQuizComputed.ts
// РЕФАКТОРИНГ: Хук для группировки всех вычисляемых значений из quiz/page.tsx
// Вынесен для улучшения читаемости и поддержки
// ВАЖНО: единая точка выбора экрана (старый useQuizScreen удален во избежание расхождений)

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
  answersRevision?: number; // Ревизия ответов вместо версии
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  savedProgressRevision?: number; // Ревизия savedProgress вместо версии
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  showResumeScreen: boolean;
  hasResumed: boolean;
  isStartingOver: boolean;
  pendingInfoScreen: any | null;
  isLoadingProgress: boolean;
  isLoadingQuestionnaire?: boolean; // Новое поле для загрузки анкеты
  isQuestionnaireLoading?: boolean; // Новое поле для состояния loading из quizState
  questionnaireError?: Error | null; // Ошибка загрузки анкеты
  isQuestionnaireQueryError?: boolean; // true когда запрос анкеты в состоянии error (сохраняется при refetch)
  progressError?: Error | null; // Ошибка загрузки прогресса
  hasTelegramInitData?: boolean; // передаётся снаружи через useState+useEffect, не читается из window в useMemo

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
    answersRevision = 0, // Ревизия ответов
    savedProgress,
    savedProgressRevision = 0, // Ревизия savedProgress
    currentInfoScreenIndex,
    currentQuestionIndex,
    isRetakingQuiz,
    showRetakeScreen,
    showResumeScreen,
    hasResumed,
    isStartingOver,
    pendingInfoScreen,
    isLoadingProgress,
    isLoadingQuestionnaire = false, // Новое поле
    isQuestionnaireLoading = false, // Новое поле
    questionnaireError,
    isQuestionnaireQueryError = false,
    progressError,
    hasTelegramInitData = false,
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
    // ФИКС: Зависеть от ревизии ответов, чтобы пересчитывать при изменении значений
    answersRevision,
    savedProgressRevision,
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
    questionnaire?.questions?.length,
    questionnaire?.groups?.length,
    quizStateMachine.questionnaire?.id,
    quizStateMachine.questionnaire?.questions?.length,
    quizStateMachine.questionnaire?.groups?.length,
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
    questionnaire?.questions?.length,
    questionnaire?.groups?.length,
    quizStateMachine.questionnaire?.questions?.length,
    quizStateMachine.questionnaire?.groups?.length,
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
        const hash = `${rawIds}|${answersKeys}`;
        // Отладка: console.log('🔍 [useQuizComputed] allQuestionsHash computed', { hash, allQuestionsRawLength: allQuestionsRaw.length, answersRevision });
        return hash;
      }, [allQuestionsRawHash, answersRevision]);
  
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
        logger: {
          log: (message: string, data?: any) => console.log(`🔍 [filterQuestions] ${message}`, data),
          warn: (message: string, data?: any) => console.warn(`⚠️ [filterQuestions] ${message}`, data),
          error: (message: string, data?: any) => console.error(`❌ [filterQuestions] ${message}`, data),
        },
      });
      
      // Сохраняем результат в ref
      if (filtered.length > 0) {
        allQuestionsPrevRef.current = filtered;
      } else if (allQuestionsPrevRef.current.length > 0) {
        // НЕ перезаписываем ref, оставляем предыдущее значение
      }

      // Отладка: console.log('🔍 [useQuizComputed] filterQuestions result', { allQuestionsRawLength: allQuestionsRaw.length, filteredLength: filtered.length });

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
    answersRevision,
    savedProgressRevision,
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
    const hasQuestionnaire = !!questionnaireRef.current ||
      !!questionnaire ||
      !!quizStateMachine.questionnaire;
    const isLoadingAnyQuestionnaire = isLoadingQuestionnaire || isQuestionnaireLoading;

    // ИСПРАВЛЕНО: Используем уже вычисленный savedProgressAnswersCount вместо пересчета
    // const savedProgressAnswersCount уже вычислен выше как useMemo
    const currentAnswersCount = Object.keys(answers || {}).length;

    console.log('🔍 [useQuizComputed] viewMode: computing', {
      isLoadingProgress,
      isLoadingQuestionnaire,
      isQuestionnaireLoading,
      questionnaireError: !!questionnaireError,
      progressError: !!progressError,
      hasQuestionnaire,
      savedProgressAnswersCount,
      savedProgress: savedProgress ? {
        answersCount: savedProgressAnswersCount,
        questionIndex: savedProgress.questionIndex,
        infoScreenIndex: savedProgress.infoScreenIndex,
      } : null,
      currentAnswersCount,
      isStartingOver,
      hasResumed,
      isRetakingQuiz,
      showRetakeScreen,
      currentInfoScreenIndex,
      initialInfoScreensLength: initialInfoScreens.length,
      pendingInfoScreen,
      allQuestionsLength: allQuestions.length,
      allQuestionsHash
    });

    const isTelegramInitDataMissing = !hasTelegramInitData;

    // ИСПРАВЛЕНО: Проверяем резюм-экран ДО проверки ошибок, чтобы он показывался сразу
    // Это предотвращает показ первого экрана на секунду перед резюм-экраном
    // ИСПРАВЛЕНО: Используем уже вычисленный savedProgressAnswersCount
    const savedCount = savedProgressAnswersCount;
    
    // ИСПРАВЛЕНО: Добавлено подробное логирование для диагностики
    console.log('🔍 [useQuizComputed] проверка резюм-экрана (самый высокий приоритет)', {
      showResumeScreen,
      savedCount,
      currentAnswersCount,
      hasResumed,
      isStartingOver,
      minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
      hasSavedProgress: !!savedProgress,
      savedProgressAnswers: savedProgress?.answers ? Object.keys(savedProgress.answers) : [],
      answersKeys: Object.keys(answers || {}),
      shouldShowResume: !isStartingOver && 
                        !hasResumed && 
                        savedCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN &&
                        currentAnswersCount === 0,
    });
    
    const shouldShowResumeImmediately = !isStartingOver && 
                                       !hasResumed && 
                                       savedCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN &&
                                       currentAnswersCount === 0;

    // При isRetakingQuiz не показываем RESUME — приоритет у RETAKE_SELECT (без чтения window → без hydration mismatch)
    const shouldSuppressResumeForRetake = isRetakingQuiz;

    if (isRetakingQuiz && showRetakeScreen) {
      console.log('📺 [useQuizComputed] viewMode: RETAKE_SELECT (retake from home — higher priority than RESUME)', {
        isRetakingQuiz,
        showRetakeScreen,
      });
      return 'RETAKE_SELECT';
    }
    
    if ((showResumeScreen || shouldShowResumeImmediately) && !shouldSuppressResumeForRetake) {
      console.log('📺 [useQuizComputed] viewMode: RESUME (highest priority - before errors)', {
        showResumeScreen,
        savedCount,
        currentAnswersCount,
        hasResumed,
        isStartingOver,
        shouldShowResumeImmediately
      });
      return 'RESUME';
    }

    // Приоритет 0: Ошибки загрузки (высший приоритет, но после резюм-экрана)
    // Используем isQuestionnaireQueryError чтобы показывать ERROR даже при refetch (когда error временно сброшен)
    const hasQuestionnaireError = !!(questionnaireError || isQuestionnaireQueryError);
    if (hasQuestionnaireError || progressError) {
      console.log('📺 [useQuizComputed] viewMode: ERROR (data loading error)', {
        questionnaireError: questionnaireError?.message,
        questionnaireErrorStatus: (questionnaireError as any)?.status,
        isQuestionnaireQueryError,
        progressError: progressError?.message,
        progressErrorStatus: (progressError as any)?.status,
        isTelegramUser: !!(typeof window !== 'undefined' && window.Telegram?.WebApp?.initData),
      });

      if ((questionnaireError as any)?.status === 403 || (progressError as any)?.status === 403) {
        console.log('🚫 [useQuizComputed] viewMode: FORBIDDEN_ERROR (403)', {
          message: 'Пользователь должен открыть приложение через Telegram Mini App'
        });
        return 'ERROR';
      }
      return 'ERROR';
    }

    // Приоритет 1: Резюм-экран (уже проверен выше, но оставляем для логирования)
    console.log('🔍 [useQuizComputed] проверка резюм-экрана (после проверки ошибок)', {
      showResumeScreen,
      savedCount,
      minRequired: QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN,
      hasResumed,
      isStartingOver,
      shouldShowResumeImmediately,
      currentAnswersCount,
      hasSavedProgress: !!savedProgress,
      savedProgressAnswers: savedProgress?.answers ? Object.keys(savedProgress.answers) : [],
    });

    // Приоритет 3: Экран выбора тем при перепрохождении
    if (isRetakingQuiz && showRetakeScreen) {
      console.log('📺 [useQuizComputed] viewMode: RETAKE_SELECT (retake screen)');
      return 'RETAKE_SELECT';
    }

    // Приоритет 3: Начальные инфо-экраны (показываем независимо от загрузки анкеты)
    // ИСПРАВЛЕНО: НЕ показываем начальные экраны, если должен показываться резюм-экран
    // Это гарантирует, что резюм-экран показывается ВМЕСТО первого экрана анкеты
    const initialLen = initialInfoScreens.length;
    const onInitial = currentInfoScreenIndex < initialLen;
    const shouldShowResumeInstead = !isStartingOver && 
                                     !hasResumed && 
                                     savedCount >= QUIZ_CONFIG.VALIDATION.MIN_ANSWERS_FOR_PROGRESS_SCREEN &&
                                     currentAnswersCount === 0; // НЕ активно отвечает
    
    if (onInitial && !shouldShowResumeInstead) {
      console.log('📺 [useQuizComputed] viewMode: INITIAL_INFO (showing initial screens)', {
        currentInfoScreenIndex,
        currentInfoScreenIndexRef: currentInfoScreenIndexRef.current,
        initialLen,
        shouldShowResumeInstead
      });
      return 'INITIAL_INFO';
    }

    // Приоритет 4: Загрузка анкеты (если данные еще не получены)
    // Не показываем лоадер, если запрос уже завершился ошибкой (иначе бесконечный лоадер при refetch)
    if (isLoadingAnyQuestionnaire && !hasQuestionnaire && !hasQuestionnaireError) {
      console.log('📺 [useQuizComputed] viewMode: LOADING_QUESTIONNAIRE (waiting for questionnaire data)', {
        isLoadingQuestionnaire,
        isQuestionnaireLoading,
        hasQuestionnaire
      });
      return 'LOADING_PROGRESS';
    }

    // Приоритет 5: Загрузка прогресса (если анкета уже есть, но прогресс еще грузится)
    if (isLoadingProgress && hasQuestionnaire) {
      console.log('📺 [useQuizComputed] viewMode: LOADING_PROGRESS (questionnaire ready, waiting for progress)', {
        isLoadingProgress,
        hasQuestionnaire
      });
      return 'LOADING_PROGRESS';
    }

    // Приоритет 6: Загрузка внутреннего состояния (loading из quizState)
    // ИСПРАВЛЕНО: Не показываем LOADER, если анкета уже загружена в ref или запрос завершился ошибкой
    if (isQuestionnaireLoading && !hasQuestionnaire && !hasQuestionnaireError) {
      console.log('📺 [useQuizComputed] viewMode: LOADING_PROGRESS (waiting for internal state)', {
        isQuestionnaireLoading,
        hasQuestionnaire
      });
      return 'LOADING_PROGRESS';
    }

    // Приоритет 7: Нет анкеты - это критическая ошибка после загрузки
    // Не показываем лоадер "waiting for Telegram", если запрос анкеты уже завершился ошибкой (500 и т.д.)
    if (!hasQuestionnaire && !isLoadingAnyQuestionnaire) {
      console.log('📺 [useQuizComputed] viewMode: ERROR (no questionnaire after loading)', {
        hasQuestionnaire,
        isLoadingQuestionnaire,
        isQuestionnaireLoading,
        hasQuestionnaireError,
      });
      if (isTelegramInitDataMissing && !hasQuestionnaireError) {
        console.log('📺 [useQuizComputed] viewMode: LOADING_PROGRESS (waiting for Telegram initData)', {
          isTelegramInitDataMissing,
        });
        return 'LOADING_PROGRESS';
      }
      return 'ERROR';
    }

    // Приоритет 8: Анкета есть, но все вопросы отфильтрованы - ошибка
    if (hasQuestionnaire && allQuestions.length === 0 && !isLoadingProgress && !isLoadingAnyQuestionnaire) {
      console.log('📺 [useQuizComputed] viewMode: ERROR (questionnaire exists but no questions after filtering)', {
        hasQuestionnaire,
        allQuestionsLength: allQuestions.length,
        allQuestionsRawLength: allQuestionsRaw.length,
        isLoadingProgress,
        isLoadingQuestionnaire,
        isQuestionnaireLoading
      });
      return 'ERROR';
    }

    // Приоритет 9: Pending инфо-экран между вопросами
    // ИСПРАВЛЕНО: Проверяем pendingInfoScreen ПЕРЕД вопросами, чтобы не показывать ERROR
    // когда currentQuestion становится null перед показом инфо-экрана
    // ИСПРАВЛЕНО: Проверяем, что pendingInfoScreen не null, чтобы не показывать INFO экран без данных
    const effectivePending = pendingInfoScreenRef?.current ?? pendingInfoScreen;
    if (effectivePending && effectivePending !== null) {
      console.log('📺 [useQuizComputed] viewMode: PENDING_INFO (pending info screen)', {
        effectivePending,
        pendingInfoScreenRef: pendingInfoScreenRef?.current,
        pendingInfoScreen,
        isRetakingQuiz
      });
      return 'PENDING_INFO';
    }

    // Приоритет 10: Вопросы
    // ИСПРАВЛЕНО: Не показываем ERROR если есть pendingInfoScreen, даже если currentQuestion null
    if (allQuestions.length > 0 && !effectivePending) {
      console.log('📺 [useQuizComputed] viewMode: QUESTION (questions available)', {
        allQuestionsLength: allQuestions.length,
        firstQuestionId: allQuestions[0]?.id,
        firstQuestionCode: allQuestions[0]?.code,
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        isOnInitial: currentInfoScreenIndex < initialInfoScreens.length
      });
      return 'QUESTION';
    }

    // Приоритет 11: Ошибка (нет вопросов)
    // ИСПРАВЛЕНО: Не показываем ERROR если есть pendingInfoScreen - это нормальное состояние при переходе к инфо-экрану
    // ИСПРАВЛЕНО: Проверяем, что effectivePending не null
    if (effectivePending && effectivePending !== null) {
      console.log('📺 [useQuizComputed] viewMode: PENDING_INFO (fallback check)', {
        effectivePending,
        allQuestionsLength: allQuestions.length,
      });
      return 'PENDING_INFO';
    }
    
    console.log('❌ [useQuizComputed] viewMode: ERROR (no questions, no screens, no progress)', {
      allQuestionsLength: allQuestions.length,
      allQuestionsRawLength: allQuestionsRaw.length,
      questionnaireExists: !!questionnaire,
      currentInfoScreenIndex,
      initialInfoScreensLength: initialInfoScreens.length,
      isOnInitial: currentInfoScreenIndex < initialInfoScreens.length,
      isLoadingProgress,
      isLoadingQuestionnaire,
      isQuestionnaireLoading,
      hasPendingInfoScreen: !!effectivePending
    });
    return 'ERROR';
  }, [
    isLoadingProgress,
    isLoadingQuestionnaire, // Новое поле
    isQuestionnaireLoading, // Новое поле
    questionnaireError,
    isQuestionnaireQueryError,
    progressError,
    savedProgressAnswersCount,
    showResumeScreen, // ИСПРАВЛЕНО: Добавлено, используется в строке 415
    isStartingOver,
    hasResumed,
    isRetakingQuiz,
    showRetakeScreen,
    currentInfoScreenIndex,
    initialInfoScreens.length,
    pendingInfoScreen,
    allQuestionsHash, // ФИКС: Используем хеш вместо length
    allQuestions.length, // Добавлено для логирования
    answersRevision, // ИСПРАВЛЕНО: Добавлено для отслеживания изменений answers (используется в строке 358)
    savedProgressRevision, // ИСПРАВЛЕНО: Добавлено для отслеживания изменений savedProgress (используется в строке 357)
    hasTelegramInitData,
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
    if (initialInfoScreens.length === 0) {
      return null;
    }

    if (currentInfoScreenIndex >= 0 && currentInfoScreenIndex < initialInfoScreens.length) {
      return initialInfoScreens[currentInfoScreenIndex];
    }

    if (viewMode === 'INITIAL_INFO') {
      console.warn('⚠️ [useQuizComputed] currentInitialInfoScreen: invalid index, falling back to first screen', {
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
      });
      return initialInfoScreens[0] ?? null;
    }

    return null;
  }, [currentInfoScreenIndex, initialInfoScreens, viewMode]); // ФИКС: Убрали isDev из зависимостей

  // ============================================
  // ГРУППА 9: Вычисление currentQuestion
  // ============================================
  
  // ФИКС: currentQuestion вычисляется ТОЛЬКО если viewMode === 'QUESTION'
  // Это убирает ситуацию "currentQuestion null → page думает, что вопрос не найден"
  const currentQuestion = useMemo(() => {
    console.log('🔍 [useQuizComputed] currentQuestion: computing', {
      viewMode,
      currentQuestionIndex,
      allQuestionsLength: allQuestions.length,
      allQuestionsPrevRefLength: allQuestionsPrevRef.current.length,
      questionnaireExists: !!(questionnaire || questionnaireRef.current),
      isDev
    });

    // КРИТИЧНО: Вычисляем вопрос только если viewMode === 'QUESTION'
    if (viewMode !== 'QUESTION') {
      console.log('⚠️ [useQuizComputed] currentQuestion: viewMode is not QUESTION, returning null', { viewMode });
      return null;
    }

    // ФИКС: Защита от некорректного индекса или undefined
    // Используем allQuestionsPrevRef как fallback, если allQuestions пустой после перемонтирования
    const questionsToUse = allQuestions.length > 0
      ? allQuestions
      : (allQuestionsPrevRef.current.length > 0 ? allQuestionsPrevRef.current : []);

    // ИСПРАВЛЕНО: Проверяем, что индекс валиден и не выходит за границы
    // Если индекс >= length, значит все вопросы пройдены - нужно перейти к финализации
    const isValidIndex = currentQuestionIndex >= 0 && currentQuestionIndex < questionsToUse.length;
    const isOutOfBounds = currentQuestionIndex >= questionsToUse.length;

    console.log('🔍 [useQuizComputed] currentQuestion: validation', {
      currentQuestionIndex,
      questionsToUseLength: questionsToUse.length,
      isValidIndex,
      isOutOfBounds,
      questionsToUseIds: questionsToUse.slice(0, 5).map(q => q?.id)
    });

    // ИСПРАВЛЕНО: Если индекс выходит за границы, проверяем, не вернулись ли мы с инфо-экрана после вопроса 'budget'
    // В этом случае возвращаем вопрос 'budget' вместо null
    if (!isValidIndex) {
      if (isOutOfBounds) {
        // ИСПРАВЛЕНО: Если индекс выходит за границы, но есть ответ на вопрос 'budget',
        // это означает, что мы вернулись с инфо-экрана после вопроса 'budget'
        // В этом случае возвращаем вопрос 'budget' вместо null
        const budgetQuestion = questionsToUse.find(q => q.code === 'budget');
        const hasAnsweredBudget = budgetQuestion && effectiveAnswers[budgetQuestion.id] !== undefined;
        
        if (hasAnsweredBudget && budgetQuestion) {
          console.log('🔧 [useQuizComputed] currentQuestion: индекс выходит за границы, но есть ответ на budget, возвращаем budget', {
            currentQuestionIndex,
            questionsToUseLength: questionsToUse.length,
            budgetQuestionId: budgetQuestion.id,
          });
          return budgetQuestion;
        }
        
        console.log('✅ [useQuizComputed] currentQuestion: все вопросы пройдены, возвращаем null для финализации', {
          currentQuestionIndex,
          questionsToUseLength: questionsToUse.length
        });
      } else {
        console.log('❌ [useQuizComputed] currentQuestion: invalid index, попытаемся использовать ближайший валидный вопрос', {
          currentQuestionIndex,
          questionsToUseLength: questionsToUse.length
        });
      }

      // ФИКС: Если есть хотя бы один вопрос, вместо null возвращаем ближайший валидный вопрос,
      // чтобы не падать на экране "Вопрос не найден"
      if (questionsToUse.length > 0) {
        const clampedIndex = Math.max(0, Math.min(currentQuestionIndex, questionsToUse.length - 1));
        const fallbackQuestion = questionsToUse[clampedIndex];
        console.log('🔧 [useQuizComputed] currentQuestion: используем fallback-вопрос по скорректированному индексу', {
          clampedIndex,
          fallbackQuestionId: fallbackQuestion?.id,
          fallbackQuestionCode: fallbackQuestion?.code,
        });
        return fallbackQuestion;
      }

      // Если вопросов нет вообще — возвращаем null (это уже отдельная ошибка конфигурации анкеты)
      return null;
    }

    const question = questionsToUse[currentQuestionIndex];

    console.log('🔍 [useQuizComputed] currentQuestion: got question', {
      questionId: question?.id,
      questionCode: question?.code,
      questionText: question?.text?.substring(0, 50)
    });

    // ФИКС: Проверка на undefined и валидность вопроса
    if (!question || !question.id) {
      console.log('❌ [useQuizComputed] currentQuestion: question is invalid, returning null', {
        question,
        hasQuestion: !!question,
        hasId: question ? !!question.id : false
      });
      return null;
    }

    console.log('✅ [useQuizComputed] currentQuestion: returning valid question', {
      questionId: question.id,
      questionCode: question.code
    });

    return question;
  }, [
    viewMode, // ФИКС: Зависеть от viewMode вместо множественных проверок
    currentQuestionIndex,
    allQuestionsHash, // ФИКС: Используем хеш вместо length
    answersRevision,
    savedProgressRevision,
    questionnaire,
    questionnaireRef,
    isDev
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
