// lib/quiz/hooks/useQuizComputed.ts
// РЕФАКТОРИНГ: Хук для группировки всех вычисляемых значений из quiz/page.tsx
// Вынесен для улучшения читаемости и поддержки

import { useMemo } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { getInitialInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import { filterQuestions, getEffectiveAnswers } from '@/lib/quiz/filterQuestions';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import type { Questionnaire, Question } from '@/lib/quiz/types';

export interface UseQuizComputedParams {
  // State
  questionnaire: Questionnaire | null;
  answers: Record<number, string | string[]>;
  savedProgress: {
    answers: Record<number, string | string[]>;
    questionIndex: number;
    infoScreenIndex: number;
  } | null;
  currentInfoScreenIndex: number;
  currentQuestionIndex: number;
  isRetakingQuiz: boolean;
  showRetakeScreen: boolean;
  showResumeScreen: boolean;
  hasResumed: boolean;
  pendingInfoScreen: any | null;
  
  // Refs
  questionnaireRef: React.MutableRefObject<Questionnaire | null>;
  currentInfoScreenIndexRef: React.MutableRefObject<number>;
  allQuestionsRawPrevRef: React.MutableRefObject<Question[]>;
  allQuestionsPrevRef: React.MutableRefObject<Question[]>;
  
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
    savedProgress,
    currentInfoScreenIndex,
    currentQuestionIndex,
    isRetakingQuiz,
    showRetakeScreen,
    showResumeScreen,
    hasResumed,
    pendingInfoScreen,
    questionnaireRef,
    currentInfoScreenIndexRef,
    allQuestionsRawPrevRef,
    allQuestionsPrevRef,
    quizStateMachine,
    isDev,
  } = params;

  // ============================================
  // ГРУППА 1: Вычисление effectiveAnswers
  // ============================================
  
  // ИСПРАВЛЕНО: Используем стабильные значения для отслеживания изменений answers
  const answersKeysCount = Object.keys(answers || {}).length;
  const savedProgressAnswersKeysCount = Object.keys(savedProgress?.answers || {}).length;
  
  const effectiveAnswers = useMemo(() => {
    const result = getEffectiveAnswers(answers, savedProgress?.answers);
    if (isDev) {
      clientLogger.log('📊 effectiveAnswers: computed', {
        answersCount: Object.keys(answers || {}).length,
        savedProgressAnswersCount: Object.keys(savedProgress?.answers || {}).length,
        effectiveAnswersCount: Object.keys(result).length,
        answerKeys: Object.keys(result).slice(0, 10),
      });
    }
    return result;
  }, [
    // ИСПРАВЛЕНО: Используем стабильные зависимости для предотвращения React error #300
    answersKeysCount, // Используем количество ключей вместо объекта
    savedProgressAnswersKeysCount, // Используем количество ключей вместо объекта
    isDev
  ]);

  // ============================================
  // ГРУППА 2: Вычисление answersCount
  // ============================================
  
  // ИСПРАВЛЕНО: Используем стабильную зависимость для answersCount
  // effectiveAnswers может меняться между рендерами, даже если количество ключей не изменилось
  const effectiveAnswersKeysCount = Object.keys(effectiveAnswers).length;
  const answersCount = useMemo(() => {
    const count = Object.keys(effectiveAnswers).length;
    if (isDev) {
      clientLogger.log('📊 answersCount: computed', {
        count,
        effectiveAnswersKeys: Object.keys(effectiveAnswers).slice(0, 10),
      });
    }
    return count;
  }, [effectiveAnswersKeysCount, isDev]);

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

    if (isDev && stableId) {
      clientLogger.log('🔒 stableQuestionnaireId computed', {
        stableId,
        refId,
        stateId,
        stateMachineId,
        source: refId ? 'ref' : stateId ? 'state' : stateMachineId ? 'stateMachine' : 'none'
      });
    }

    return stableId || null;
  }, [
    // ИСПРАВЛЕНО: Используем только стабильные значения, которые не меняются после загрузки
    questionnaireRef.current?.id,
    questionnaire?.id,
    quizStateMachine.questionnaire?.id,
    isDev
  ]);

  // ============================================
  // ГРУППА 3: Вычисление allQuestionsRaw
  // ============================================

  const allQuestionsRaw = useMemo(() => {
    try {
      // КРИТИЧНО: Используем questionnaireRef.current как ОСНОВНОЙ источник, а не fallback
      // Это гарантирует, что вопросы всегда извлекаются, даже если state временно null
      // ИСПРАВЛЕНО: Приоритет ref над state, так как ref обновляется синхронно
      // ИСПРАВЛЕНО: Также проверяем State Machine как дополнительный источник
      const effectiveQuestionnaire = questionnaireRef.current || 
                                      questionnaire || 
                                      quizStateMachine.questionnaire;
      
      if (!effectiveQuestionnaire) {
        // ИСПРАВЛЕНО: Если все источники null, используем предыдущее значение из ref
        if (allQuestionsRawPrevRef.current.length > 0) {
          clientLogger.log('⚠️ allQuestionsRaw: questionnaire is null (all sources), using previous value from ref', {
            previousLength: allQuestionsRawPrevRef.current.length,
            hasQuestionnaireRef: !!questionnaireRef.current,
            hasQuestionnaireState: !!questionnaire,
            hasQuestionnaireStateMachine: !!quizStateMachine.questionnaire,
          });
          return allQuestionsRawPrevRef.current;
        }
        if (isDev) {
          clientLogger.log('⚠️ allQuestionsRaw: questionnaire is null (all sources), returning empty', {
            hasQuestionnaireRef: !!questionnaireRef.current,
            hasQuestionnaireState: !!questionnaire,
            hasQuestionnaireStateMachine: !!quizStateMachine.questionnaire,
          });
        }
        return allQuestionsRawPrevRef.current.length > 0 ? allQuestionsRawPrevRef.current : [];
      }
      
      // ИСПРАВЛЕНО: Логируем источник questionnaire для диагностики
      const source = effectiveQuestionnaire === questionnaireRef.current ? 'ref' :
                     effectiveQuestionnaire === questionnaire ? 'state' :
                     effectiveQuestionnaire === quizStateMachine.questionnaire ? 'stateMachine' : 'unknown';
      
      if (isDev && source !== 'ref') {
        clientLogger.log('📊 allQuestionsRaw: using questionnaire from ' + source, {
          questionnaireId: effectiveQuestionnaire.id,
          hasQuestionnaireRef: !!questionnaireRef.current,
          hasQuestionnaireState: !!questionnaire,
          hasQuestionnaireStateMachine: !!quizStateMachine.questionnaire,
        });
      }
      
      // РЕФАКТОРИНГ: Используем единую функцию для извлечения вопросов
      const result = extractQuestionsFromQuestionnaire(effectiveQuestionnaire);
      
      // КРИТИЧНО: Сохраняем результат в ref для использования при следующем пересчете
      if (result.length > 0) {
        allQuestionsRawPrevRef.current = result;
      }
      
      // Логируем только в development, чтобы не создавать спам
      if (isDev) {
        const groups = effectiveQuestionnaire.groups || [];
        const questions = effectiveQuestionnaire.questions || [];
        clientLogger.log('📊 allQuestionsRaw: extracting questions', {
          questionnaireId: effectiveQuestionnaire.id,
          groupsCount: groups.length,
          questionsCount: questions.length,
          extractedCount: result.length,
          fromState: !!questionnaire,
          fromRef: !!questionnaireRef.current,
          usingRef: effectiveQuestionnaire === questionnaireRef.current,
        });
      }
      
      if (result.length === 0) {
        const groups = effectiveQuestionnaire.groups || [];
        const questions = effectiveQuestionnaire.questions || [];
        clientLogger.warn('⚠️ allQuestionsRaw: No questions extracted', {
          questionnaireId: effectiveQuestionnaire.id,
          groupsCount: groups.length,
          questionsCount: questions.length,
          fromState: !!questionnaire,
          fromRef: !!questionnaireRef.current,
          previousLength: allQuestionsRawPrevRef.current.length,
        });
        // ИСПРАВЛЕНО: Если результат пустой, но есть предыдущее значение - используем его
        if (allQuestionsRawPrevRef.current.length > 0) {
          clientLogger.log('✅ allQuestionsRaw: using previous value from ref', {
            previousLength: allQuestionsRawPrevRef.current.length,
          });
          return allQuestionsRawPrevRef.current;
        }
      } else if (isDev) {
        const groups = effectiveQuestionnaire.groups || [];
        const questions = effectiveQuestionnaire.questions || [];
        clientLogger.log('✅ allQuestionsRaw: extracted successfully', {
          total: result.length,
          fromGroups: groups.flatMap((g: any) => g.questions || []).length,
          fromQuestions: questions.length,
          fromState: !!questionnaire,
          fromRef: !!questionnaireRef.current,
          usingRef: effectiveQuestionnaire === questionnaireRef.current,
        });
      }
      
      return result;
    } catch (err) {
      clientLogger.error('❌ Error computing allQuestionsRaw:', {
        err,
        hasQuestionnaire: !!questionnaire,
        hasQuestionnaireRef: !!questionnaireRef.current,
        hasQuestionnaireStateMachine: !!quizStateMachine.questionnaire,
        questionnaireId: questionnaire?.id || questionnaireRef.current?.id || quizStateMachine.questionnaire?.id,
        previousLength: allQuestionsRawPrevRef.current.length,
      });
      // ИСПРАВЛЕНО: При ошибке используем предыдущее значение, если оно есть
      if (allQuestionsRawPrevRef.current.length > 0) {
        clientLogger.log('✅ allQuestionsRaw: using previous value from ref after error', {
          previousLength: allQuestionsRawPrevRef.current.length,
        });
        return allQuestionsRawPrevRef.current;
      }
      return allQuestionsRawPrevRef.current.length > 0 ? allQuestionsRawPrevRef.current : [];
    }
  }, [
    // КРИТИЧНО ИСПРАВЛЕНИЕ: Используем только стабильный ID вместо отдельных ID источников
    // Это предотвращает бесконечные циклы, когда разные источники обновляются в разное время
    stableQuestionnaireId,
    isDev
  ]);

  // ============================================
  // ГРУППА 4: Вычисление allQuestions (с фильтрацией)
  // ============================================
  
  const allQuestions = useMemo<Question[]>(() => {
    try {
      // ИСПРАВЛЕНО: Используем questionnaireRef.current и quizStateMachine.questionnaire как fallback
      // Это предотвращает потерю вопросов, когда questionnaire временно становится null в state
      // КРИТИЧНО: Приоритет ref и State Machine над state, так как они обновляются синхронно
      const effectiveQuestionnaire = questionnaireRef.current || 
                                      questionnaire || 
                                      quizStateMachine.questionnaire;
      
      // ИСПРАВЛЕНО: Если answers пустые после ремоунта, но есть предыдущее значение в ref, используем его
      // Это предотвращает потерю вопросов, когда ответы еще не загружены из API
      const hasAnswers = answers && Object.keys(answers).length > 0;
      const hasSavedProgressAnswers = savedProgress?.answers && Object.keys(savedProgress.answers).length > 0;
      const hasAnyAnswers = hasAnswers || hasSavedProgressAnswers;
      
      // ИСПРАВЛЕНО: Если allQuestionsRaw пустой, но есть предыдущее значение в ref, используем его
      // Это предотвращает потерю вопросов, когда questionnaire временно становится null
      // КРИТИЧНО: Также проверяем, что questionnaire загружен, чтобы не использовать устаревшие данные
      // ИСПРАВЛЕНО: Используем предыдущее значение, если allQuestionsRaw пустой ИЛИ если questionnaire временно null
      // Это критично для восстановления после перемонтирования
      const hasQuestionnaire = !!effectiveQuestionnaire;
      const hasAllQuestionsRaw = allQuestionsRaw.length > 0;
      const hasPrevRef = allQuestionsPrevRef.current.length > 0;
      
      // КРИТИЧНО: Используем предыдущее значение, если:
      // 1. allQuestionsRaw пустой И есть предыдущее значение
      // 2. questionnaire временно null И есть предыдущее значение
      // Это предотвращает потерю данных после перемонтирования
      const shouldUsePrevRef = (!hasAllQuestionsRaw || !hasQuestionnaire) && hasPrevRef;
      
      if (shouldUsePrevRef) {
        clientLogger.log('✅ Using previous allQuestions from ref (questionnaire temporarily null or allQuestionsRaw empty)', {
          previousLength: allQuestionsPrevRef.current.length,
          hasQuestionnaire,
          hasAllQuestionsRaw,
          allQuestionsRawLength: allQuestionsRaw.length,
          effectiveQuestionnaireId: effectiveQuestionnaire?.id,
        });
        return allQuestionsPrevRef.current;
      }
      
      // Логируем только если действительно нет fallback
      if ((!hasQuestionnaire || !hasAllQuestionsRaw) && !hasPrevRef) {
        if (isDev) {
          clientLogger.warn('⚠️ allQuestionsRaw is empty and questionnaire is null (no fallback available)', {
            hasQuestionnaire,
            hasAllQuestionsRaw,
            allQuestionsRawLength: allQuestionsRaw.length,
            allQuestionsPrevRefLength: allQuestionsPrevRef.current.length,
          });
        }
        return [];
      }
      
      // ИСПРАВЛЕНО: Безопасное логирование с проверками
      try {
        clientLogger.log('🔍 allQuestions: Starting filter', {
          allQuestionsRawLength: allQuestionsRaw.length,
          answersCount: Object.keys(answers || {}).length,
          savedProgressAnswersCount: Object.keys(savedProgress?.answers || {}).length,
          isRetakingQuiz,
          showRetakeScreen,
          answerKeys: Object.keys(answers || {}),
        });
      } catch (logErr) {
        // Игнорируем ошибки логирования
        console.warn('Failed to log allQuestions filter start:', logErr);
      }
      
      // ИСПРАВЛЕНО: Используем единую функцию filterQuestions вместо дублирующей логики
      const filtered = filterQuestions({
        questions: allQuestionsRaw,
        answers,
        savedProgressAnswers: savedProgress?.answers,
        isRetakingQuiz,
        showRetakeScreen,
        logger: clientLogger, // Передаем clientLogger для логирования
      });
      
      // ИСПРАВЛЕНО: Безопасное логирование с проверками
      try {
        clientLogger.log('✅ allQuestions: Filter completed', {
          originalCount: allQuestionsRaw.length,
          filteredCount: filtered.length,
          filteredQuestionIds: filtered.length > 0 ? filtered.map((q: Question) => q?.id).filter(Boolean).slice(0, 10) : [],
          removedCount: allQuestionsRaw.length - filtered.length,
          answersCount: Object.keys(answers || {}).length,
          savedProgressAnswersCount: Object.keys(savedProgress?.answers || {}).length,
          isRetakingQuiz,
          showRetakeScreen,
          hasQuestionnaire: !!questionnaire,
          hasQuestionnaireRef: !!questionnaireRef.current,
        });
      
        // ДИАГНОСТИКА: Если filtered пустой, логируем детальную информацию
        if (filtered.length === 0 && allQuestionsRaw.length > 0) {
          clientLogger.error('❌ CRITICAL: filtered is empty but allQuestionsRaw has questions', {
            allQuestionsRawCount: allQuestionsRaw.length,
            filteredCount: filtered.length,
            allQuestionsRawIds: allQuestionsRaw.map((q: Question) => q.id).slice(0, 10),
            allQuestionsRawCodes: allQuestionsRaw.map((q: Question) => q.code).slice(0, 10),
            answersCount: Object.keys(answers || {}).length,
            savedProgressAnswersCount: Object.keys(savedProgress?.answers || {}).length,
            effectiveAnswers: effectiveAnswers,
            isRetakingQuiz,
            showRetakeScreen,
            hasQuestionnaire: !!questionnaire,
            hasQuestionnaireRef: !!questionnaireRef.current,
          });
        }
        
        // ДИАГНОСТИКА: Если и allQuestionsRaw, и filtered пустые, но questionnaire есть
        if (filtered.length === 0 && allQuestionsRaw.length === 0 && (questionnaire || questionnaireRef.current)) {
          clientLogger.error('❌ CRITICAL: allQuestionsRaw and filtered are empty but questionnaire exists', {
            hasQuestionnaire: !!questionnaire,
            hasQuestionnaireRef: !!questionnaireRef.current,
            questionnaireId: questionnaire?.id || questionnaireRef.current?.id,
            hasGroups: !!(questionnaire?.groups || questionnaireRef.current?.groups),
            groupsCount: (questionnaire?.groups?.length || questionnaireRef.current?.groups?.length || 0),
            hasQuestions: !!(questionnaire?.questions || questionnaireRef.current?.questions),
            questionsCount: (questionnaire?.questions?.length || questionnaireRef.current?.questions?.length || 0),
          });
        }
      } catch (logErr) {
        // Игнорируем ошибки логирования
        console.warn('Failed to log allQuestions filter result:', logErr);
      }
      
      // ВАЖНО: Возвращаем результат фильтрации БЕЗ fallback - основная логика должна работать правильно
      // КРИТИЧНО: Сохраняем результат в ref для использования при временном пустом allQuestionsRaw
      // ВАЖНО: Сохраняем ТОЛЬКО если filtered не пустой, чтобы не перезаписывать валидные данные пустым массивом
      // КРИТИЧНО: Сохраняем СРАЗУ после вычисления, чтобы fallback сработал при следующем пересчете
      // ИСПРАВЛЕНО: Сохраняем даже если filtered пустой, но только если предыдущее значение было не пустым
      // Это предотвращает потерю данных при перемонтировании
      if (filtered.length > 0) {
        allQuestionsPrevRef.current = filtered;
        clientLogger.log('💾 allQuestionsPrevRef updated', {
          length: filtered.length,
          questionIds: filtered.map((q: Question) => q?.id).slice(0, 10),
        });
      } else if (allQuestionsPrevRef.current.length > 0) {
        // ИСПРАВЛЕНО: Если filtered пустой, но есть предыдущее значение, сохраняем его
        // Это предотвращает потерю данных при перемонтировании
        clientLogger.warn('⚠️ filtered is empty, but keeping previous allQuestionsPrevRef value', {
          previousLength: allQuestionsPrevRef.current.length,
          filteredLength: filtered.length,
        });
        // НЕ перезаписываем ref, оставляем предыдущее значение
      }
      return filtered;
    } catch (err) {
      console.error('❌ Error computing allQuestions:', err, {
        allQuestionsRawLength: allQuestionsRaw?.length,
        answersKeys: Object.keys(answers || {}),
      });
      // В случае ошибки возвращаем все вопросы из allQuestionsRaw (уже отсортированные)
      const fallback = allQuestionsRaw || [];
      // ВАЖНО: Сохраняем в ref ТОЛЬКО если fallback не пустой
      if (fallback.length > 0) {
        allQuestionsPrevRef.current = fallback;
      }
      return fallback;
    }
  }, [
    allQuestionsRaw.length, // ИСПРАВЛЕНО: Используем длину вместо массива для стабильности (предотвращает React error #300)
    answersKeysCount, // ИСПРАВЛЕНО: Используем стабильное значение вместо объекта
    savedProgressAnswersKeysCount, // ИСПРАВЛЕНО: Используем стабильное значение вместо объекта
    isRetakingQuiz,
    showRetakeScreen,
    stableQuestionnaireId, // ИСПРАВЛЕНИЕ: Используем стабильный ID вместо отдельных questionnaire ID
    // ИСПРАВЛЕНО: Убрали questionnaireRef из зависимостей - ref не должен быть в зависимостях (вызывает React error #300)
    // ИСПРАВЛЕНО: Убрали allQuestionsPrevRef из зависимостей - ref не должен быть в зависимостях (вызывает React error #300) 
    // ИСПРАВЛЕНО: Убрали effectiveAnswers из зависимостей - это вычисляемое значение, используем answersKeysCount
    isDev
  ]);

  // ============================================
  // ГРУППА 5: Вычисление savedProgressAnswersCount
  // ============================================
  
  // ИСПРАВЛЕНО: Используем стабильную зависимость для savedProgressAnswersCount
  const savedProgressAnswersCount = useMemo(() => Object.keys(savedProgress?.answers || {}).length, [savedProgressAnswersKeysCount]);

  // ============================================
  // ГРУППА 6: Вычисление initialInfoScreens
  // ============================================
  
  const initialInfoScreens = useMemo(() => {
    const screens = getInitialInfoScreens();
    if (isDev) {
      clientLogger.log('📊 initialInfoScreens: computed', {
        count: screens.length,
        screenIds: screens.map((s: any) => s?.id).filter(Boolean).slice(0, 10),
      });
    }
    return screens;
  }, [isDev]);

  // ============================================
  // ГРУППА 7: Вычисление isShowingInitialInfoScreen
  // ============================================
  
  const isShowingInitialInfoScreen = useMemo(() => {
    // Логирование для диагностики (всегда, чтобы понять, почему возвращается true/false)
    if (isDev) {
      clientLogger.log('🔍 isShowingInitialInfoScreen: вычисление', {
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        showResumeScreen,
        showRetakeScreen,
        hasSavedProgress: !!savedProgress,
        hasResumed,
        isRetakingQuiz,
        currentQuestionIndex,
        answersCount: Object.keys(answers).length,
      });
    }
    
    // КРИТИЧНО: Если показывается экран продолжения - не показываем начальные экраны
    // Это должно быть ПЕРВОЙ проверкой, чтобы резюм-экран имел приоритет
    if (showResumeScreen) {
      if (isDev) clientLogger.log('🔍 isShowingInitialInfoScreen: false (showResumeScreen)');
      return false;
    }
    
    // Если показывается экран выбора тем при перепрохождении - не показываем начальные экраны
    if (showRetakeScreen && isRetakingQuiz) {
      if (isDev) clientLogger.log('🔍 isShowingInitialInfoScreen: false (showRetakeScreen && isRetakingQuiz)');
      return false;
    }
    // КРИТИЧНО: Проверяем savedProgress ПЕРЕД проверкой isOnInfoScreens
    // Если есть сохраненный прогресс с >= 2 ответами, НЕ показываем инфо-экраны (должен показаться резюм-экран)
    // Это предотвращает показ инфо-экранов при повторном заходе в приложение
    if (savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length >= 2) {
      if (isDev) clientLogger.log('🔍 isShowingInitialInfoScreen: false (savedProgress with >= 2 answers)');
      return false;
    }
    // Если пользователь восстановил прогресс - не показываем начальные экраны
    if (hasResumed) {
      if (isDev) clientLogger.log('🔍 isShowingInitialInfoScreen: false (hasResumed)');
      return false;
    }
    // ИСПРАВЛЕНО: Если пользователь вернулся к инфо-экранам через навигацию назад (оба индекса < length),
    // показываем их, даже если есть сохраненный прогресс с 1 ответом (имя)
    const isOnInfoScreens = currentInfoScreenIndex < initialInfoScreens.length && 
                            currentInfoScreenIndexRef.current < initialInfoScreens.length;
    // Если есть сохраненный прогресс с 1 ответом (только имя) И пользователь НЕ на инфо-экранах - не показываем
    // Это предотвращает показ инфо-экранов при первом заходе, если есть только имя
    if (!isOnInfoScreens && savedProgress && savedProgress.answers && Object.keys(savedProgress.answers).length === 1) {
      if (isDev) clientLogger.log('🔍 isShowingInitialInfoScreen: false (savedProgress with 1 answer, not on info screens)');
      return false;
    }
    // ВАЖНО: Если повторное прохождение БЕЗ экрана выбора тем - не показываем начальные экраны
    // Это означает, что пользователь уже выбрал "Пройти всю анкету заново" и оплатил
    if (isRetakingQuiz && !showRetakeScreen) {
      if (isDev) clientLogger.log('🔍 isShowingInitialInfoScreen: false (isRetakingQuiz && !showRetakeScreen)');
      return false;
    }
    // ИСПРАВЛЕНО: КРИТИЧЕСКАЯ ЗАЩИТА - проверяем ref, чтобы не показывать инфо-экраны, если пользователь уже перешел к вопросам
    // Это предотвращает показ инфо-экранов, если currentInfoScreenIndex временно сбросился, но ref все еще указывает на вопросы
    if (currentInfoScreenIndexRef.current >= initialInfoScreens.length) {
      if (isDev) clientLogger.log('🔍 isShowingInitialInfoScreen: false (ref index >= length)');
      return false;
    }
    // Если currentInfoScreenIndex уже прошел все начальные экраны - не показываем их
    if (currentInfoScreenIndex >= initialInfoScreens.length) {
      if (isDev) clientLogger.log('🔍 isShowingInitialInfoScreen: false (index >= length)');
      return false;
    }
    // ИСПРАВЛЕНО: НЕ блокируем показ инфо-экранов, если пользователь вернулся к ним через навигацию назад
    // Проверяем только, если пользователь активно на вопросах (currentQuestionIndex > 0 И currentInfoScreenIndex >= length)
    // Если currentInfoScreenIndex < initialInfoScreens.length, значит пользователь на инфо-экранах, показываем их
    const isActivelyOnQuestions = currentQuestionIndex > 0 && currentInfoScreenIndex >= initialInfoScreens.length;
    if (isActivelyOnQuestions) {
      if (isDev) clientLogger.log('🔍 isShowingInitialInfoScreen: false (user actively on questions)');
      return false;
    }
    // Иначе показываем, если currentInfoScreenIndex < initialInfoScreens.length
    // ИСПРАВЛЕНО: Дополнительная проверка ref для надежности
    const shouldShow = currentInfoScreenIndex < initialInfoScreens.length && 
                       currentInfoScreenIndexRef.current < initialInfoScreens.length;
    
    // ФИКС: Всегда логируем результат (warn уровень для диагностики в БД)
    // Это поможет понять, почему isShowingInitialInfoScreen остается true
    clientLogger.warn(`📺 isShowingInitialInfoScreen: ${shouldShow}`, {
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
      isLastInfoScreen: currentInfoScreenIndex === initialInfoScreens.length - 1,
        showResumeScreen,
        showRetakeScreen,
        hasSavedProgress: !!savedProgress,
        hasResumed,
        isRetakingQuiz,
        currentQuestionIndex,
        answersCount: Object.keys(answers).length,
      allQuestionsLength: allQuestions.length,
    });
    
    return shouldShow;
  }, [
    showResumeScreen, 
    showRetakeScreen, 
    // ИСПРАВЛЕНО: Убрали savedProgress из зависимостей - используем только savedProgressAnswersKeysCount
    hasResumed, 
    isRetakingQuiz, 
    currentQuestionIndex, 
    answersKeysCount, // ИСПРАВЛЕНО: Используем стабильное значение вместо объекта
    currentInfoScreenIndex, 
    initialInfoScreens.length, 
    allQuestions.length, // ИСПРАВЛЕНО: Используем длину вместо массива для стабильности
    isDev
  ]);

  // ============================================
  // ГРУППА 8: Вычисление currentInitialInfoScreen
  // ============================================
  
  const currentInitialInfoScreen = useMemo(() => {
    const screen = isShowingInitialInfoScreen && 
                   currentInfoScreenIndex >= 0 && 
                   currentInfoScreenIndex < initialInfoScreens.length
                    ? initialInfoScreens[currentInfoScreenIndex] 
                    : null;
    if (isDev) {
      clientLogger.log('📊 currentInitialInfoScreen: computed', {
        hasScreen: !!screen,
        screenId: screen?.id || null,
        isShowingInitialInfoScreen,
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
      });
    }
    return screen;
  }, [isShowingInitialInfoScreen, currentInfoScreenIndex, initialInfoScreens, isDev]);

  // ============================================
  // ГРУППА 9: Вычисление currentQuestion
  // ============================================
  
  const currentQuestion = useMemo(() => {
    // ВАЖНО: При перепрохождении (retake) мы пропускаем info screens,
    // поэтому pendingInfoScreen не должен блокировать отображение вопросов при retake
    // ВАЖНО: Если показывается экран продолжения (showResumeScreen), не блокируем вопросы
    // ВАЖНО: Блокируем только если действительно есть начальный экран для показа
    // ФИКС: Если currentInfoScreenIndex >= initialInfoScreens.length, значит все начальные экраны пройдены
    // и мы не должны блокировать показ вопросов, даже если isShowingInitialInfoScreen = true
    // КРИТИЧНО: Также проверяем, что questionnaire загружен, чтобы не блокировать вопросы при загрузке
    // ИСПРАВЛЕНО: Используем только state для проверки, чтобы избежать проблем с зависимостями
    // КРИТИЧНО: Не используем ref в зависимостях useMemo, так как это может вызвать React error #300
    const isPastInitialScreens = currentInfoScreenIndex >= initialInfoScreens.length;
    // ИСПРАВЛЕНО: Используем ref только внутри useMemo, но не в зависимостях
    const isPastInitialScreensRef = currentInfoScreenIndexRef.current >= initialInfoScreens.length;
    // Не блокируем, если хотя бы один из индексов показывает, что пользователь прошел начальные экраны
    const isPastInitialScreensAny = isPastInitialScreens || isPastInitialScreensRef;
    // ИСПРАВЛЕНО: Также проверяем ref в условии currentInfoScreenIndex < initialInfoScreens.length
    // Если ref показывает, что пользователь уже прошел начальные экраны, не блокируем
    const isStillOnInitialScreens = currentInfoScreenIndex < initialInfoScreens.length && currentInfoScreenIndexRef.current < initialInfoScreens.length;
    // ИСПРАВЛЕНО: pendingInfoScreen должен блокировать вопросы ТОЛЬКО если мы уже на вопросах (прошли начальные экраны)
    // pendingInfoScreen - это инфо-экраны МЕЖДУ вопросами, они не должны блокировать вопросы на начальных экранах
    // КРИТИЧНО: pendingInfoScreen блокирует вопросы только если мы УЖЕ на вопросах (isOnQuestions = true)
    const isOnQuestions = currentInfoScreenIndex >= initialInfoScreens.length || currentInfoScreenIndexRef.current >= initialInfoScreens.length;
    // ИСПРАВЛЕНО: pendingInfoScreen блокирует вопросы только если мы УЖЕ на вопросах (не на начальных экранах)
    const shouldBlockPendingInfoScreen = pendingInfoScreen && !isRetakingQuiz && isOnQuestions;
    const shouldBlock = (!isPastInitialScreensAny && isShowingInitialInfoScreen && currentInitialInfoScreen && isStillOnInitialScreens) || shouldBlockPendingInfoScreen;
    if (shouldBlock && !showResumeScreen) {
      // ФИКС: Всегда логируем блокировку вопросов (warn уровень сохраняется в БД)
      clientLogger.warn('⏸️ currentQuestion: null (blocked by info screen)', {
          isShowingInitialInfoScreen,
          hasCurrentInitialInfoScreen: !!currentInitialInfoScreen,
        currentInitialInfoScreenId: currentInitialInfoScreen?.id || null,
          pendingInfoScreen: !!pendingInfoScreen,
        pendingInfoScreenId: pendingInfoScreen?.id || null,
          isRetakingQuiz,
        showResumeScreen,
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
          currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        hasResumed,
        savedProgressExists: !!savedProgress,
        answersCount: Object.keys(answers).length,
        isOnQuestions: currentInfoScreenIndex >= initialInfoScreens.length || currentInfoScreenIndexRef.current >= initialInfoScreens.length,
        isStillOnInitialScreens,
        isPastInitialScreensAny,
      });
      return null;
    }
    
    // ФИКС: Защита от некорректного индекса или undefined
    // ИСПРАВЛЕНО: Используем allQuestionsPrevRef как fallback, если allQuestions пустой после перемонтирования
    const questionsToUse = allQuestions.length > 0 
      ? allQuestions 
      : (allQuestionsPrevRef.current.length > 0 ? allQuestionsPrevRef.current : []);
    const hasQuestionnaire = !!questionnaire || !!questionnaireRef.current || !!quizStateMachine.questionnaire;
    const isValidIndex = currentQuestionIndex >= 0 && currentQuestionIndex < questionsToUse.length;
    
    if (!isValidIndex) {
      // ФИКС: Всегда логируем проблемы с индексом (warn уровень сохраняется в БД)
      clientLogger.warn('⏸️ currentQuestion: null (индекс вне границ)', {
        currentQuestionIndex,
        allQuestionsLength: allQuestions.length,
        allQuestionsPrevRefLength: allQuestionsPrevRef.current.length,
        questionsToUseLength: questionsToUse.length,
        isShowingInitialInfoScreen,
        currentInfoScreenIndex,
        initialInfoScreensLength: initialInfoScreens.length,
        hasQuestionnaire,
        hasResumed,
        savedProgressExists: !!savedProgress,
        usingPrevRef: allQuestions.length === 0 && allQuestionsPrevRef.current.length > 0,
        isValidIndex,
        indexRange: questionsToUse.length > 0 ? `0-${questionsToUse.length - 1}` : 'empty',
      });
      // ИСПРАВЛЕНО: Если индекс вне границ и есть вопросы, логируем для диагностики
      // Но не пытаемся исправить индекс здесь - это должно делать в handleNext или при восстановлении прогресса
      return null;
    }
    
    const question = questionsToUse[currentQuestionIndex];
    
    // ФИКС: Проверка на undefined и валидность вопроса
    if (!question || !question.id) {
      if (isDev) {
        clientLogger.warn('⏸️ currentQuestion: null (вопрос не найден или невалидный)', {
          currentQuestionIndex,
            allQuestionsLength: allQuestions.length,
          questionExists: !!question,
          questionId: question?.id,
        });
      }
      return null;
    }
    
    // ФИКС: Логируем успешное отображение вопроса (info уровень для диагностики)
    clientLogger.log('✅ currentQuestion: показываем вопрос', {
          currentQuestionIndex,
          allQuestionsLength: allQuestions.length,
      questionId: question.id,
      isShowingInitialInfoScreen,
      currentInfoScreenIndex,
      initialInfoScreensLength: initialInfoScreens.length,
        });
      return question;
  }, [
    isShowingInitialInfoScreen, 
    currentInitialInfoScreen, 
    pendingInfoScreen, 
    isRetakingQuiz, 
    showResumeScreen, 
    currentQuestionIndex, 
    allQuestions.length, // ИСПРАВЛЕНО: Используем длину вместо массива для стабильности
    initialInfoScreens.length, 
    currentInfoScreenIndex, 
    // ИСПРАВЛЕНО: Убрали currentInfoScreenIndexRef из зависимостей - ref не должен быть в зависимостях
    // ИСПРАВЛЕНО: Убрали answers из зависимостей - используем только внутри useMemo
    // ИСПРАВЛЕНО: Убрали savedProgress из зависимостей - используем только внутри useMemo
    // ИСПРАВЛЕНО: Убрали allQuestionsPrevRef из зависимостей - ref не должен быть в зависимостях
    isDev
  ]);

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
  };
}

