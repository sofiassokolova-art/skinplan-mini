// lib/quiz/handlers/handleAnswer.ts
// Вынесена функция handleAnswer из quiz/page.tsx для улучшения читаемости и поддержки

import { clientLogger } from '@/lib/client-logger';
import { safeSessionStorageSet } from '@/lib/storage-utils';
import { QUIZ_CONFIG } from '@/lib/quiz/config/quizConfig';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import type { Question, Questionnaire } from '@/lib/quiz/types';

export interface HandleAnswerParams {
  questionId: number;
  value: string | string[];
  currentQuestion: Question | null;
  answers: Record<number, string | string[]>;
  allQuestions: Question[];
  questionnaire: Questionnaire | null;
  setAnswers: React.Dispatch<React.SetStateAction<Record<number, string | string[]>>>;
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

  // ИСПРАВЛЕНО: Валидация questionId - не должен быть 0 или отрицательным (кроме -1 для метаданных)
  if (actualQuestionId <= 0 && actualQuestionId !== -1) {
    console.error('❌ Invalid questionId:', {
      actualQuestionId,
      providedQuestionId: questionId,
      currentQuestionId: currentQuestion?.id,
      currentQuestionCode: currentQuestion?.code,
    });
    throw new Error(`Invalid questionId: ${actualQuestionId} (must be a positive number or -1 for metadata)`);
  }

  // ИСПРАВЛЕНО: Проверяем, что вопрос существует в анкете (не только в allQuestions)
  // ИСПРАВЛЕНО: Используем extractQuestionsFromQuestionnaire для консистентности
  const questionExistsInAllQuestions = allQuestions.some((q: Question) => q.id === actualQuestionId);
  const questionnaireQuestions = extractQuestionsFromQuestionnaire(questionnaire);
  const questionExistsInQuestionnaire = questionnaireQuestions.some((q: Question) => q.id === actualQuestionId);
  
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
  const isFirstAnswer = Object.keys(answers).length === 0;
  
  // ИСПРАВЛЕНО: Удаляем флаг quiz_progress_cleared после первого ответа в новой сессии
  // Это позволяет восстановить savedProgress при следующей загрузке страницы
  // Флаг должен сбрасываться после ответа на первый вопрос, как указано в требованиях
  if (isFirstAnswer && typeof window !== 'undefined') {
    try {
      const currentScope = questionnaire?.id?.toString() || 'default';
      
      // Удаляем scoped ключ для текущего scope
      sessionStorage.removeItem(QUIZ_CONFIG.getScopedKey('quiz_progress_cleared', currentScope));
      
      // Удаляем unscoped ключи для обратной совместимости
      sessionStorage.removeItem('quiz_progress_cleared');
      sessionStorage.removeItem('default:quiz_progress_cleared');
      
      // Также удаляем все scoped ключи (на случай, если scope изменился)
      const storageKeys = Object.keys(sessionStorage);
      for (const key of storageKeys) {
        if (key.includes(':quiz_progress_cleared') || key.endsWith(':quiz_progress_cleared')) {
          sessionStorage.removeItem(key);
        }
      }
      
      clientLogger.log('✅ Флаг quiz_progress_cleared удален после первого ответа в новой сессии', {
        questionId: actualQuestionId,
        scope: currentScope,
      });
    } catch (err) {
      // Игнорируем ошибки sessionStorage
      clientLogger.warn('⚠️ Ошибка при удалении quiz_progress_cleared после первого ответа', err);
    }
  }
  
  setAnswers(newAnswers);
  
  // ИСПРАВЛЕНО: Обновляем ref синхронно для немедленного использования в handleNext (особенно важно для single_choice)
  if (answersRef) {
    answersRef.current = newAnswers;
  }
  
  // КРИТИЧНО: Сохраняем answers в sessionStorage для восстановления после перемонтирования
  // Это необходимо, так как без initData ответы не сохраняются в БД и не попадают в React Query кэш
  // ИСПРАВЛЕНО: Используем scoped ключ для согласованности с другими частями кода
  const currentScope = questionnaire?.id?.toString() || scope || 'default';
  const answersBackupKey = QUIZ_CONFIG.getScopedKey('quiz_answers_backup', currentScope);
  
  // Сохраняем в scoped ключ
  const saved = safeSessionStorageSet(answersBackupKey, JSON.stringify(newAnswers));
  
  // ИСПРАВЛЕНО: Также сохраняем в unscoped ключ для обратной совместимости
  const savedUnscoped = safeSessionStorageSet('quiz_answers_backup', JSON.stringify(newAnswers));
  
  if (saved || savedUnscoped) {
    clientLogger.log('💾 Сохранены answers в sessionStorage для восстановления', {
      questionId: actualQuestionId,
      answersCount: Object.keys(newAnswers).length,
      scopedKey: answersBackupKey,
      scope: currentScope,
      savedScoped: saved,
      savedUnscoped: savedUnscoped,
    });
  } else {
    clientLogger.warn('⚠️ Не удалось сохранить answers в sessionStorage', {
      scopedKey: answersBackupKey,
      scope: currentScope,
    });
  }
  
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
      // ИСПРАВЛЕНО: Дополнительная валидация перед отправкой на сервер
      if (actualQuestionId <= 0 && actualQuestionId !== -1) {
        clientLogger.error('❌ Пропуск сохранения: невалидный questionId', {
          actualQuestionId,
          currentQuestionId: currentQuestion?.id,
          currentQuestionCode: currentQuestion?.code,
        });
        return; // Не сохраняем, если questionId невалидный
      }

      // Добавляем сохранение в последовательную фоновую очередь. UI и навигация
      // не должны ждать сеть, а быстрые изменения одного вопроса схлопываются.
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
      // Сохраняем последнее поставленное в очередь значение для дедупликации.
      lastSavedAnswerRef.current = { questionId: actualQuestionId, answer: value };
      clientLogger.log('✅ Ответ поставлен в очередь фонового сохранения', {
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
  
  // ФИКС A: После изменения ответа на фильтрующие вопросы - нормализация индекса
  // Список фильтрующих вопросов, которые влияют на filterQuestions()
  const filteringQuestionCodes = ['age', 'gender', 'budget', 'has_avoid_ingredients'];
  const currentQuestionCode = currentQuestion?.code;
  
  if (currentQuestionCode && filteringQuestionCodes.includes(currentQuestionCode) && 
      setCurrentQuestionIndex && allQuestions.length > 0) {
    // Находим новый индекс вопроса по коду (вопрос мог переместиться после пересчета allQuestions)
    const newQuestionIndex = allQuestions.findIndex(q => q.code === currentQuestionCode);
    
    // ИСПРАВЛЕНО: Проверяем, что новый индекс валиден и не выходит за границы массива
    if (newQuestionIndex >= 0 && newQuestionIndex < allQuestions.length && newQuestionIndex !== currentQuestionIndex) {
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
    } else if (newQuestionIndex < 0 || newQuestionIndex >= allQuestions.length) {
      // ИСПРАВЛЕНО: Если вопрос не найден или индекс выходит за границы, не обновляем индекс
      clientLogger.warn('⚠️ [Нормализация] Вопрос не найден или индекс выходит за границы, не обновляем', {
        questionCode: currentQuestionCode,
        oldIndex: currentQuestionIndex,
        newIndex: newQuestionIndex,
        allQuestionsLength: allQuestions.length,
      });
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
  // ИСПРАВЛЕНО: Выполняем нормализацию ТОЛЬКО для фильтрующих вопросов
  // Вопросы типа user_name (имя) НЕ должны вызывать нормализацию индекса, чтобы не пропускать вопрос
  const isFilteringQuestion = currentQuestionCode && filteringQuestionCodes.includes(currentQuestionCode);
  const isNameQuestion = currentQuestionCode?.toLowerCase() === 'user_name';
  
  // ИСПРАВЛЕНО: Нормализация выполняется ТОЛЬКО для фильтрующих вопросов
  // Это предотвращает обнуление или изменение индекса для вопроса с именем
  if (isFilteringQuestion && currentQuestionCode && setCurrentQuestionIndex && allQuestions.length > 0) {
    // Проверяем, существует ли текущий вопрос в новом списке allQuestions
    const currentQuestionStillExists = allQuestions.some(q => q.code === currentQuestionCode);

    if (!currentQuestionStillExists) {
      // Текущий вопрос исчез из списка - переходим к ближайшему действительному вопросу
      // Находим вопрос с ближайшим индексом, который еще существует
      const closestValidIndex = currentQuestionIndex < allQuestions.length 
        ? currentQuestionIndex 
        : Math.max(0, Math.min(currentQuestionIndex, allQuestions.length - 1));

      clientLogger.log('🔧 [Нормализация] currentQuestion.code исчез из allQuestions, переходим к ближайшему', {
        disappearedQuestionCode: currentQuestionCode,
        oldIndex: currentQuestionIndex,
        newIndex: closestValidIndex,
        allQuestionsLength: allQuestions.length,
        allQuestionCodes: allQuestions.map(q => q.code).slice(0, 5),
        isFilteringQuestion,
      });

      // Устанавливаем новый индекс только если он действительно изменился
      if (closestValidIndex !== currentQuestionIndex) {
        setCurrentQuestionIndex(closestValidIndex);
        if (currentQuestionIndexRef) {
          currentQuestionIndexRef.current = closestValidIndex;
        }
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
    } else {
      // Для фильтрующих вопросов выполняем нормализацию индекса, даже если вопрос все еще существует
      // (вопрос мог переместиться в списке после пересчета)
      const newQuestionIndex = allQuestions.findIndex(q => q.code === currentQuestionCode);
      
      // ИСПРАВЛЕНО: Не устанавливаем индекс, если он выходит за границы массива
      // Это важно, потому что allQuestions может быть неотфильтрованным, а useQuizComputed использует отфильтрованный
      // Если newQuestionIndex >= allQuestions.length, значит вопрос был отфильтрован или индекс невалиден
      if (newQuestionIndex >= 0 && newQuestionIndex < allQuestions.length && newQuestionIndex !== currentQuestionIndex) {
        clientLogger.log('🔧 [Нормализация] Пересчитываем индекс для фильтрующего вопроса', {
          questionCode: currentQuestionCode,
          oldIndex: currentQuestionIndex,
          newQuestionIndex,
          allQuestionsLength: allQuestions.length,
        });
        
        setCurrentQuestionIndex(newQuestionIndex);
        if (currentQuestionIndexRef) {
          currentQuestionIndexRef.current = newQuestionIndex;
        }
      } else if (newQuestionIndex >= allQuestions.length) {
        // ИСПРАВЛЕНО: Если новый индекс выходит за границы, не обновляем индекс
        // Это может произойти, если allQuestions неотфильтрован, а useQuizComputed использует отфильтрованный массив
        clientLogger.warn('⚠️ [Нормализация] Новый индекс выходит за границы массива, не обновляем', {
          questionCode: currentQuestionCode,
          oldIndex: currentQuestionIndex,
          newQuestionIndex,
          allQuestionsLength: allQuestions.length,
        });
      }
    }
  }
}
