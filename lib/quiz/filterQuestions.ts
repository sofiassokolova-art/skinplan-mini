// lib/quiz/filterQuestions.ts
// Единая утилита для фильтрации вопросов анкеты
// Используется в основном потоке, resume и retake экранах

import type { Question } from './types';

export type { Question };

export interface FilterQuestionsOptions {
  questions: Question[];
  answers: Record<number, string | string[]>;
  savedProgressAnswers?: Record<number, string | string[]>;
  isRetakingQuiz?: boolean;
  showRetakeScreen?: boolean;
  logger?: {
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
}

/**
 * Получает эффективные ответы (объединение answers и savedProgressAnswers)
 * ИСПРАВЛЕНО: Экспортирована для использования в quiz/page.tsx
 * Приоритет: savedProgressAnswers (базовые) + answers (текущие, перезаписывают базовые)
 */
export function getEffectiveAnswers(
  answers: Record<number, string | string[]>,
  savedProgressAnswers?: Record<number, string | string[]>
): Record<number, string | string[]> {
  return { ...(savedProgressAnswers || {}), ...answers };
}

/**
 * Получает нормализованное значение ответа (yes/no/sometimes)
 * ИСПРАВЛЕНО: Использует value опции вместо label для стабильности
 */
function getNormalizedAnswerValue(
  question: Question,
  answerValue: string | string[],
  allQuestions: Question[]
): 'yes' | 'no' | 'sometimes' | string | null {
  if (!question.options || question.options.length === 0) {
    return Array.isArray(answerValue) ? answerValue[0] : answerValue;
  }

  const value = Array.isArray(answerValue) ? answerValue[0] : answerValue;
  
  // Ищем соответствующую опцию
  const matchingOption = question.options.find(opt => 
    opt.id.toString() === value || 
    opt.value === value ||
    opt.value?.toLowerCase() === value?.toLowerCase() ||
    opt.label === value ||
    opt.label?.toLowerCase() === value?.toLowerCase()
  );

  if (!matchingOption) {
    return value;
  }

  // ИСПРАВЛЕНО: Используем value опции, а не label
  // Если value содержит yes/no/sometimes - используем его напрямую
  const optionValue = (matchingOption.value || '').toLowerCase().trim();
  const optionLabel = (matchingOption.label || '').toLowerCase().trim();
  
  // Приоритет 1: точное совпадение value с enum
  if (optionValue === 'yes' || optionValue === 'no' || optionValue === 'sometimes') {
    return optionValue as 'yes' | 'no' | 'sometimes';
  }
  
  // Приоритет 2: проверка по стандартизированным значениям в value (без includes для безопасности)
  if (optionValue === 'true' || optionValue === '1' || optionValue === 'y') {
    return 'yes';
  }
  if (optionValue === 'false' || optionValue === '0' || optionValue === 'n') {
    return 'no';
  }
  
  // Приоритет 3: fallback на проверку label для обратной совместимости (но только точные совпадения)
  // ИСПРАВЛЕНО: Убрали includes('да') чтобы избежать ложных срабатываний
  if (optionLabel === 'да' || optionLabel === 'yes' || optionLabel === 'true') {
    return 'yes';
  }
  if (optionLabel === 'нет' || optionLabel === 'no' || optionLabel === 'false') {
    return 'no';
  }
  if (optionLabel === 'иногда' || optionLabel === 'sometimes') {
    return 'sometimes';
  }

  // Если ничего не подошло, возвращаем исходное value
  return optionValue || optionLabel || value;
}

/**
 * Проверяет, является ли пол "мужской"
 */
function isMaleGender(
  genderValue: string | undefined,
  genderOption: { id: number; value: string; label: string } | undefined,
  genderQuestion: Question | undefined,
  answers: Record<number, string | string[]>
): boolean {
  if (genderOption) {
    const optLabel = (genderOption.label || '').toLowerCase().trim();
    const optValue = (genderOption.value || '').toLowerCase().trim();
    return optLabel.includes('мужск') || 
           optValue.includes('мужск') ||
           optValue.includes('male') ||
           optLabel.includes('male') ||
           optValue === 'gender_2' ||
           optLabel === 'мужской';
  }
  
  if (genderValue) {
    const normalizedValue = genderValue.toLowerCase().trim();
    return normalizedValue.includes('мужск') || 
           normalizedValue.includes('male') ||
           normalizedValue === 'male' ||
           normalizedValue === 'мужской' ||
           normalizedValue === 'gender_2' ||
           normalizedValue === '137';
  }
  
  if (genderQuestion && answers[genderQuestion.id]) {
    const answerValue = String(answers[genderQuestion.id]);
    return answerValue === '137' || 
           answerValue === 'gender_2' ||
           answerValue.toLowerCase().includes('мужск') ||
           answerValue.toLowerCase().includes('male');
  }
  
  return false;
}

/**
 * Получает ответ на вопрос по коду
 */
function getAnswerByCode(
  code: string,
  allQuestions: Question[],
  effectiveAnswers: Record<number, string | string[]>
): {
  value: string | undefined;
  question: Question | undefined;
  option: { id: number; value: string; label: string } | undefined;
} {
  const question = allQuestions.find(q => q.code === code);
  if (!question) {
    return { value: undefined, question: undefined, option: undefined };
  }

  const answerValue = effectiveAnswers[question.id];
  if (!answerValue) {
    return { value: undefined, question, option: undefined };
  }

  const value = Array.isArray(answerValue) ? answerValue[0] : String(answerValue);
  
  let option: { id: number; value: string; label: string } | undefined;
  if (question.options && question.options.length > 0) {
    option = question.options.find(opt => 
      opt.id.toString() === value || 
      String(opt.id) === value ||
      opt.value === value ||
      opt.value?.toLowerCase() === value?.toLowerCase() ||
      opt.label === value ||
      opt.label?.toLowerCase() === value?.toLowerCase()
    );
  }

  const finalValue = option 
    ? (option.label || option.value || value)
    : value;

  return { value: finalValue, question, option };
}

/**
 * Фильтрует вопросы анкеты на основе ответов и контекста
 * ИСПРАВЛЕНО: Единая логика для всех экранов (main flow, resume, retake)
 */
export function filterQuestions(options: FilterQuestionsOptions): Question[] {
  const {
    questions,
    answers,
    savedProgressAnswers,
    isRetakingQuiz = false,
    showRetakeScreen = false,
    logger,
  } = options;
  
  // Используем переданный logger или console по умолчанию
  const log = logger?.log || console.log.bind(console);
  const warn = logger?.warn || console.warn.bind(console);
  const error = logger?.error || console.error.bind(console);

  if (!questions || questions.length === 0) {
    warn('⚠️ filterQuestions: questions is empty', { questions });
    return [];
  }

  // ИСПРАВЛЕНО: Используем эффективные ответы (объединение answers и savedProgressAnswers)
  const effectiveAnswers = getEffectiveAnswers(answers, savedProgressAnswers);

  // ИСПРАВЛЕНО: Проверяем, есть ли ответы вообще
  // Если ответов нет (новый пользователь), показываем все вопросы без фильтрации
  const hasAnyAnswers = Object.keys(effectiveAnswers).length > 0;
  
  // КРИТИЧНО: Логируем короткие ключевые данные отдельно для видимости в обрезанных логах
  log(`🔍 filterQuestions: START ${questions.length} questions, ${Object.keys(effectiveAnswers).length} answers`, {
    questions: questions.length,
    answers: Object.keys(effectiveAnswers).length,
    hasAnyAnswers,
    isRetakingQuiz,
    showRetakeScreen,
  });
  
  // ДИАГНОСТИКА: Логируем полные входные данные
  log('🔍 filterQuestions: Starting filter (full)', {
    questionsCount: questions.length,
    answersCount: Object.keys(answers || {}).length,
    savedProgressAnswersCount: Object.keys(savedProgressAnswers || {}).length,
    effectiveAnswersCount: Object.keys(effectiveAnswers).length,
    hasAnyAnswers,
    isRetakingQuiz,
    showRetakeScreen,
    questionCodes: questions.map(q => q.code).slice(0, 10),
    hasLogger: !!logger,
  });
  
  let filteredCount = 0;
  let excludedCount = 0;
  const excludedReasons: Record<string, number> = {};
  
  const filteredQuestions = questions.filter((question) => {
    try {
      // ИСПРАВЛЕНО: Если нет ответов, показываем все вопросы
      // Это предотвращает ситуацию, когда все вопросы отфильтрованы при первой загрузке
      if (!hasAnyAnswers) {
        filteredCount++;
        return true;
      }
      
      // ИСПРАВЛЕНО: Используем normalizedCode для всех проверок
      const normalizedCode = question.code?.toLowerCase();
      
      // 1. Фильтрация retinoid_reaction на основе retinoid_usage
      // ИСПРАВЛЕНО: Используем только question.code для стабильности
      // ФИКС: Вопрос retinoid_reaction должен показываться до ответа на retinoid_usage
      const isRetinoidReactionQuestion = normalizedCode === 'retinoid_reaction';
      
      if (isRetinoidReactionQuestion) {
        // ФИКС: Если нет ответов вообще, показываем вопрос (он будет отфильтрован после ответа на retinoid_usage)
        if (!hasAnyAnswers) {
          filteredCount++;
          return true;
        }
        
        const retinoidUsage = getAnswerByCode('retinoid_usage', questions, effectiveAnswers);
        if (!retinoidUsage.question) {
          // Вопрос о ретиноле еще не найден - показываем вопрос (он будет скрыт позже)
          filteredCount++;
          return true;
        }

        // ФИКС: Проверяем, есть ли ответ на retinoid_usage
        const hasRetinoidUsageAnswer = retinoidUsage.question.id in effectiveAnswers;
        if (!hasRetinoidUsageAnswer) {
          // Ответа еще нет - показываем вопрос
          filteredCount++;
          return true;
        }

        const normalizedValue = getNormalizedAnswerValue(
          retinoidUsage.question,
          effectiveAnswers[retinoidUsage.question.id] || '',
          questions
        );

        // Показываем только если ответили "yes" (да)
        const shouldShow = normalizedValue === 'yes';
        if (!shouldShow) {
          excludedCount++;
          excludedReasons['retinoid_reaction_no'] = (excludedReasons['retinoid_reaction_no'] || 0) + 1;
        } else {
          filteredCount++;
        }
        return shouldShow;
      }

      // 3. Фильтрация вопросов про макияж (только для женщин)
      // ИСПРАВЛЕНО: Используем только question.code для стабильности
      const isMakeupQuestion = normalizedCode === 'makeup_frequency';
      
      if (isMakeupQuestion) {
        const gender = getAnswerByCode('gender', questions, effectiveAnswers);
        if (!gender.question || !gender.value) {
          // Пол еще не выбран - показываем вопрос (он будет скрыт позже)
          return true;
        }

        const isMale = isMaleGender(gender.value, gender.option, gender.question, effectiveAnswers);
        const shouldShow = !isMale; // Показываем только если не мужчина
        if (!shouldShow) {
          excludedCount++;
          excludedReasons['makeup_male'] = (excludedReasons['makeup_male'] || 0) + 1;
        } else {
          filteredCount++;
        }
        return shouldShow;
      }

      // 4. Фильтрация вопросов про беременность (только для женщин)
      // ИСПРАВЛЕНО: Используем только question.code для стабильности
      const isPregnancyQuestion = normalizedCode === 'pregnancy_breastfeeding' || 
                                   normalizedCode === 'pregnancy';
      
      if (isPregnancyQuestion) {
        const gender = getAnswerByCode('gender', questions, effectiveAnswers);
        if (!gender.question || !gender.value) {
          // Пол еще не выбран - показываем вопрос (он будет скрыт позже)
          filteredCount++;
          return true;
        }

        const isMale = isMaleGender(gender.value, gender.option, gender.question, effectiveAnswers);
        const shouldShow = !isMale; // Показываем только если не мужчина
        if (!shouldShow) {
          excludedCount++;
          excludedReasons['pregnancy_male'] = (excludedReasons['pregnancy_male'] || 0) + 1;
        } else {
          filteredCount++;
        }
        return shouldShow;
      }

      // Все остальные вопросы показываем
      filteredCount++;
      return true;
    } catch (err) {
      error('❌ Error filtering question:', err, question);
      // В случае ошибки показываем вопрос (безопасный вариант)
      return true;
    }
  });
  
  // ДИАГНОСТИКА: Логируем результат фильтрации
  // КРИТИЧНО: Логируем отдельно для лучшей видимости
  if (filteredQuestions.length === 0 && questions.length > 0) {
    // КРИТИЧЕСКАЯ ОШИБКА: Все вопросы отфильтрованы
    error('❌ filterQuestions: ВСЕ ВОПРОСЫ ОТФИЛЬТРОВАНЫ!', {
      originalCount: questions.length,
      filteredCount: filteredQuestions.length,
      excludedCount,
      excludedReasons,
      hasAnyAnswers,
      isRetakingQuiz,
      showRetakeScreen,
      allQuestionCodes: questions.map(q => q.code),
      effectiveAnswersCount: Object.keys(effectiveAnswers).length,
      effectiveAnswers: effectiveAnswers,
    });
  } else {
    // КРИТИЧНО: Логируем короткие ключевые данные отдельно для видимости в обрезанных логах
    log(`✅ filterQuestions: ${questions.length}→${filteredQuestions.length} (excluded: ${excludedCount})`, {
      original: questions.length,
      filtered: filteredQuestions.length,
      excluded: excludedCount,
    });
    
    // УСПЕШНАЯ ФИЛЬТРАЦИЯ: Логируем полный результат
    log('✅ filterQuestions: Filter completed (full)', {
      originalCount: questions.length,
      filteredCount: filteredQuestions.length,
      excludedCount,
      excludedReasons,
      hasAnyAnswers,
      isRetakingQuiz,
      showRetakeScreen,
      filteredQuestionCodes: filteredQuestions.map(q => q.code).slice(0, 20),
      effectiveAnswersCount: Object.keys(effectiveAnswers).length,
    });
    
    // ДОПОЛНИТЕЛЬНО: Если отфильтровано много вопросов, логируем предупреждение
    if (filteredQuestions.length < questions.length && filteredQuestions.length > 0) {
      warn(`⚠️ filterQuestions: ${excludedCount} вопросов отфильтровано`, {
        originalCount: questions.length,
        filteredCount: filteredQuestions.length,
        excludedCount,
        excludedReasons,
      });
    }
  }
  
  // ИСПРАВЛЕНО: Если после фильтрации не осталось вопросов, возвращаем все вопросы
  // Это предотвращает ситуацию, когда все вопросы отфильтрованы при первой загрузке
  if (filteredQuestions.length === 0 && questions.length > 0) {
    error('❌ CRITICAL: All questions filtered out!', {
      originalCount: questions.length,
      hasAnyAnswers,
      isRetakingQuiz,
      showRetakeScreen,
      excludedReasons,
      questionCodes: questions.map(q => q.code),
    });
    // Возвращаем все вопросы, кроме исключений для retake
    const fallbackQuestions = questions.filter((question) => {
      if (isRetakingQuiz && !showRetakeScreen) {
        const normalizedCode = question.code?.toLowerCase();
        if (normalizedCode === 'gender' || normalizedCode === 'age') {
          return false;
        }
      }
      return true;
    });
    log('🔄 filterQuestions: Returning fallback questions', {
      fallbackCount: fallbackQuestions.length,
      fallbackQuestionCodes: fallbackQuestions.map(q => q.code).slice(0, 10),
    });
    return fallbackQuestions;
  }

  // Никак не переупорядочиваем вопросы — полностью доверяем порядку из анкеты.
  // Фильтрация выше только скрывает отдельные вопросы (например, про беременность для мужчин),
  // но не меняет относительный порядок оставшихся.
  return filteredQuestions;
}

