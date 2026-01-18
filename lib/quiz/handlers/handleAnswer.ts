// lib/quiz/handlers/handleAnswer.ts
// Вынесена функция handleAnswer из quiz/page.tsx для улучшения читаемости и поддержки

import { clientLogger } from '@/lib/client-logger';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import type { Question, Questionnaire } from '@/lib/quiz/types';

export interface HandleAnswerParams {
  questionId: number;
  value: string | string[];
  currentQuestion: Question | null;
  answers: Record<number, string | string[]>;
  allQuestions: Question[];
  questionnaire: Questionnaire | null;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
  saveProgress: (answers: Record<number, string | string[]>, questionIndex: number, infoScreenIndex: number) => Promise<void>;
  currentQuestionIndex: number;
  currentInfoScreenIndex: number;
  saveQuizProgressMutation: {
    mutateAsync: (params: {
      questionnaireId: number;
      questionId: number;
      answerValue?: string;
      answerValues?: string[];
      questionIndex: number;
      infoScreenIndex: number;
    }) => Promise<any>;
  };
  lastSavedAnswerRef: React.MutableRefObject<{ questionId: number; answer: string | string[] } | null>;
  answersRef?: React.MutableRefObject<Record<number, string | string[]>>; // ИСПРАВЛЕНО: Добавлен ref для синхронного обновления
  addDebugLog?: (message: string, context?: any) => void;
  // ФИКС: Параметры для нормализации индекса после изменения фильтрующих вопросов
  setCurrentQuestionIndex?: (index: number | ((prev: number) => number)) => void;
  currentQuestionIndexRef?: React.MutableRefObject<number>;
  scopedStorageKeys?: { CURRENT_QUESTION_CODE: string };
  scope?: string;
}

export async function handleAnswer({
  questionId,
  value,
  currentQuestion,
  answers,
  allQuestions,
  questionnaire,
  setAnswers,
  saveProgress,
  currentQuestionIndex,
  currentInfoScreenIndex,
  saveQuizProgressMutation,
  lastSavedAnswerRef,
  answersRef,
  addDebugLog,
  setCurrentQuestionIndex,
  currentQuestionIndexRef,
  scopedStorageKeys,
  scope,
}: HandleAnswerParams): Promise<void> {
  console.log('💾 [handleAnswer] called', {
    questionId,
    questionIdType: typeof questionId,
    value,
    valueType: Array.isArray(value) ? 'array' : 'string',
    currentQuestionId: currentQuestion?.id,
    currentQuestionCode: currentQuestion?.code,
    questionnaireId: questionnaire?.id,
    allQuestionsLength: allQuestions.length,
    currentQuestionIndex,
    answersCount: Object.keys(answers).length
  });

  if (addDebugLog) {
    addDebugLog('💾 handleAnswer called', {
      questionId,
      questionIdType: typeof questionId,
      value,
      currentQuestion: currentQuestion?.id,
      currentQuestionCode: currentQuestion?.code,
      questionnaireId: questionnaire?.id,
      allQuestionsLength: allQuestions.length,
      currentQuestionIndex,
    });
  }

  // Валидация: проверяем, что questionId соответствует текущему вопросу
  let actualQuestionId = questionId;
  if (currentQuestion && currentQuestion.id !== questionId) {
    console.error('⚠️ Question ID mismatch:', {
      currentQuestionId: currentQuestion.id,
      providedQuestionId: questionId,
      currentQuestionCode: currentQuestion.code,
    });
    // Используем ID текущего вопроса вместо переданного
    actualQuestionId = currentQuestion.id;
  }

  // ИСПРАВЛЕНО: Проверяем, что вопрос существует в анкете (не только в allQuestions)
  const questionExistsInAllQuestions = allQuestions.some((q: Question) => q.id === actualQuestionId);
  const questionExistsInQuestionnaire = questionnaire?.questions?.some((q: Question) => q.id === actualQuestionId) ||
                                       questionnaire?.groups?.some((g: any) => 
                                         g?.questions?.some((q: Question) => q.id === actualQuestionId)
                                       );
  
  // ВАЖНО: Если вопрос не найден в анкете, все равно сохраняем ответ в state
  if (!questionExistsInAllQuestions && !questionExistsInQuestionnaire && allQuestions.length > 0) {
    console.warn('⚠️ Question ID not found in questionnaire, but saving to state anyway:', {
      questionId: actualQuestionId,
      allQuestionIds: allQuestions.map((q: Question) => q.id),
      currentQuestionId: currentQuestion?.id,
      questionnaireId: questionnaire?.id,
    });
  }
  
  // ВАЖНО: Если вопрос существует в анкете, но отфильтрован из allQuestions - все равно сохраняем
  if (!questionExistsInAllQuestions && questionExistsInQuestionnaire) {
    clientLogger.log('⚠️ Question exists in questionnaire but filtered from allQuestions, saving anyway', {
      questionId: actualQuestionId,
      currentQuestionCode: currentQuestion?.code,
    });
  }

  // ОПТИМИЗАЦИЯ: Дедупликация - проверяем, не сохраняли ли мы уже этот ответ на сервер
  const lastSaved = lastSavedAnswerRef.current;
  let isDuplicateServerSave: boolean = false;
  try {
    if (lastSaved && lastSaved.questionId === actualQuestionId) {
      isDuplicateServerSave = JSON.stringify(lastSaved.answer) === JSON.stringify(value);
    }
  } catch (compareError) {
    console.warn('Error checking duplicate save, assuming not duplicate:', compareError);
    isDuplicateServerSave = false;
  }
  
  // Всегда обновляем состояние (даже если не изменилось, для консистентности)
  const newAnswers = { ...answers, [actualQuestionId]: value };
  setAnswers(newAnswers);
  
  // ИСПРАВЛЕНО: Обновляем ref синхронно для немедленного использования в handleNext (особенно важно для single_choice)
  if (answersRef) {
    answersRef.current = newAnswers;
  }
  
  // КРИТИЧНО: Сохраняем answers в sessionStorage для восстановления после перемонтирования
  // Это необходимо, так как без initData ответы не сохраняются в БД и не попадают в React Query кэш
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('quiz_answers_backup', JSON.stringify(newAnswers));
      clientLogger.log('💾 Сохранены answers в sessionStorage для восстановления', {
        questionId: actualQuestionId,
        answersCount: Object.keys(newAnswers).length,
      });
    } catch (err) {
      clientLogger.warn('⚠️ Не удалось сохранить answers в sessionStorage', err);
    }
  }
  
  // ИСПРАВЛЕНО: Ответы сохраняются только на сервер через API, не в localStorage
  await saveProgress(newAnswers, currentQuestionIndex, currentInfoScreenIndex);
  
  // Пропускаем сохранение на сервер, если это дубликат
  if (isDuplicateServerSave) {
    if (process.env.NODE_ENV === 'development') {
      clientLogger.log('⏭️ Skipping duplicate server save for question', actualQuestionId);
    }
    return;
  }
  
  // Сохраняем в БД для синхронизации между устройствами (только если Telegram WebApp доступен)
  if (questionnaire && typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
    try {
      const isArray = Array.isArray(value);
      if (addDebugLog) {
        addDebugLog('📤 Saving to server (React Query)', {
          questionnaireId: questionnaire?.id,
          questionId: actualQuestionId,
          questionIdType: typeof actualQuestionId,
          hasValue: !!value,
          isArray,
        });
      }
      // ФИКС: Используем React Query мутацию для сохранения прогресса
      // КРИТИЧНО: Логируем перед сохранением для диагностики
      clientLogger.log('💾 Сохранение ответа в БД', {
        questionnaireId: questionnaire.id,
        questionId: actualQuestionId,
        answerValue: isArray ? undefined : (value as string),
        answerValues: isArray ? (value as string[]) : undefined,
        questionIndex: currentQuestionIndex,
        infoScreenIndex: currentInfoScreenIndex,
        hasInitData: !!window.Telegram?.WebApp?.initData,
      });
      
      await saveQuizProgressMutation.mutateAsync({
        questionnaireId: questionnaire.id,
        questionId: actualQuestionId,
        answerValue: isArray ? undefined : (value as string),
        answerValues: isArray ? (value as string[]) : undefined,
        questionIndex: currentQuestionIndex,
        infoScreenIndex: currentInfoScreenIndex,
      });
      // Сохраняем информацию о последнем сохраненном ответе для дедупликации
      lastSavedAnswerRef.current = { questionId: actualQuestionId, answer: value };
      clientLogger.log('✅ Successfully saved to server (React Query)', {
        questionnaireId: questionnaire.id,
        questionId: actualQuestionId,
      });
    } catch (err: any) {
      // КРИТИЧНО: Логируем все ошибки сохранения для диагностики
      const is401Error = err?.message?.includes('401') || err?.message?.includes('Unauthorized');
      const errorDetails = {
        error: err?.message || 'Unknown error',
        questionId: actualQuestionId,
        questionnaireId: questionnaire?.id,
        status: err?.status,
        stack: err?.stack?.substring(0, 200),
        is401Error,
        hasInitData: !!window.Telegram?.WebApp?.initData,
      };
      
      if (is401Error) {
        // Если ошибка 401 - это нормально, прогресс сохранен локально
        clientLogger.log('ℹ️ Ответ не сохранен в БД (401 Unauthorized - initData недоступен)', errorDetails);
      } else {
        // Другие ошибки - критично, логируем как ошибку
        clientLogger.error('❌ Ошибка сохранения ответа в БД', errorDetails);
        console.error('❌ Ошибка сохранения прогресса на сервер:', errorDetails);
      }
    }
  } else {
    // КРИТИЧНО: Логируем, почему ответ не сохраняется
    const reason = !questionnaire 
      ? 'questionnaire is null' 
      : typeof window === 'undefined' 
        ? 'window is undefined' 
        : !window.Telegram?.WebApp?.initData 
          ? 'initData is not available' 
          : 'unknown';
    
    clientLogger.warn('⚠️ Ответ не сохраняется в БД', {
      questionId: actualQuestionId,
      questionnaireId: questionnaire?.id,
      reason,
      hasQuestionnaire: !!questionnaire,
      hasWindow: typeof window !== 'undefined',
      hasTelegram: typeof window !== 'undefined' && !!window.Telegram,
      hasWebApp: typeof window !== 'undefined' && !!window.Telegram?.WebApp,
      hasInitData: typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData,
    });
  }
  
  // ФИКС A: После изменения ответа на фильтрующие вопросы (age, gender, budget) - нормализация индекса
  // Список фильтрующих вопросов, которые влияют на filterQuestions()
  const filteringQuestionCodes = ['age', 'gender', 'budget'];
  const currentQuestionCode = currentQuestion?.code;
  
  if (currentQuestionCode && filteringQuestionCodes.includes(currentQuestionCode) && 
      setCurrentQuestionIndex && allQuestions.length > 0) {
    // Находим новый индекс вопроса по коду (вопрос мог переместиться после пересчета allQuestions)
    const newQuestionIndex = allQuestions.findIndex(q => q.code === currentQuestionCode);
    
    if (newQuestionIndex >= 0 && newQuestionIndex !== currentQuestionIndex) {
      clientLogger.log('🔧 [Нормализация] Пересчитываем индекс после изменения фильтрующего вопроса', {
        questionCode: currentQuestionCode,
        oldIndex: currentQuestionIndex,
        newIndex: newQuestionIndex,
        allQuestionsLength: allQuestions.length,
      });
      
      // Обновляем индекс
      setCurrentQuestionIndex(newQuestionIndex);
      if (currentQuestionIndexRef) {
        currentQuestionIndexRef.current = newQuestionIndex;
      }
    }
    
    // ВАЖНО: Очищаем сохраненный CURRENT_QUESTION_CODE, чтобы не восстанавливать старый индекс
    if (typeof window !== 'undefined') {
      try {
        const scopedQuestionCodeKey = scopedStorageKeys?.CURRENT_QUESTION_CODE || 
          (scope && questionnaire?.id 
            ? QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE, scope)
            : QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE);
        sessionStorage.removeItem(scopedQuestionCodeKey);
        clientLogger.log('🧹 [Нормализация] Очищен CURRENT_QUESTION_CODE после изменения фильтрующего вопроса', {
          questionCode: currentQuestionCode,
          key: scopedQuestionCodeKey,
        });
      } catch (err) {
        clientLogger.warn('⚠️ Не удалось очистить CURRENT_QUESTION_CODE', err);
      }
    }
  }

  // ФИКС P1: Нормализация после любого изменения ответа - если currentQuestion.code исчез из allQuestions
  // Это может происходить после изменения фильтрующих ответов или других условий фильтрации
  if (currentQuestionCode && setCurrentQuestionIndex && allQuestions.length > 0) {
    // Проверяем, существует ли текущий вопрос в новом списке allQuestions
    const currentQuestionStillExists = allQuestions.some(q => q.code === currentQuestionCode);

    if (!currentQuestionStillExists) {
      // Текущий вопрос исчез из списка - переходим к ближайшему действительному вопросу
      // Находим вопрос с ближайшим индексом, который еще существует
      const closestValidIndex = Math.min(currentQuestionIndex, allQuestions.length - 1);

      clientLogger.log('🔧 [Нормализация] currentQuestion.code исчез из allQuestions, переходим к ближайшему', {
        disappearedQuestionCode: currentQuestionCode,
        oldIndex: currentQuestionIndex,
        newIndex: closestValidIndex,
        allQuestionsLength: allQuestions.length,
        allQuestionCodes: allQuestions.map(q => q.code).slice(0, 5),
      });

      // Устанавливаем новый индекс
      setCurrentQuestionIndex(closestValidIndex);
      if (currentQuestionIndexRef) {
        currentQuestionIndexRef.current = closestValidIndex;
      }

      // Очищаем сохраненный CURRENT_QUESTION_CODE, так как вопрос больше не существует
      if (typeof window !== 'undefined') {
        try {
          const scopedQuestionCodeKey = scopedStorageKeys?.CURRENT_QUESTION_CODE ||
            (scope && questionnaire?.id
              ? QUIZ_CONFIG.getScopedKey(QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE, scope)
              : QUIZ_CONFIG.STORAGE_KEYS.CURRENT_QUESTION_CODE);
          sessionStorage.removeItem(scopedQuestionCodeKey);
          clientLogger.log('🧹 [Нормализация] Очищен CURRENT_QUESTION_CODE - вопрос исчез', {
            questionCode: currentQuestionCode,
            key: scopedQuestionCodeKey,
          });
        } catch (err) {
          clientLogger.warn('⚠️ Не удалось очистить CURRENT_QUESTION_CODE', err);
        }
      }
    }
  }
}

