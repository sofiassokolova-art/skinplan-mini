// lib/quiz/services/QuizValidationService.ts
// Чистые функции для валидации ответов анкеты
// Легко тестировать (unit tests)

import type { Question } from '@/lib/quiz/types';

/**
 * Результат валидации ответа
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Валидирует ответ на вопрос
 */
export function validateAnswer(question: Question, answer: string | string[]): ValidationResult {
  // Проверка обязательности
  if (question.isRequired) {
    if (Array.isArray(answer)) {
      if (answer.length === 0) {
        return {
          isValid: false,
          error: 'Этот вопрос обязателен для ответа',
        };
      }
    } else {
      if (!answer || answer.trim() === '') {
        return {
          isValid: false,
          error: 'Этот вопрос обязателен для ответа',
        };
      }
    }
  }

  // Валидация в зависимости от типа вопроса
  switch (question.type) {
    case 'single_choice':
    case 'single':
      return validateSingleChoice(question, answer);
    
    case 'multi_choice':
    case 'multi':
      return validateMultiChoice(question, answer);
    
    case 'scale':
    case 'slider':
      return validateScale(question, answer);
    
    case 'free_text':
    case 'input':
      return validateFreeText(question, answer);
    
    default:
      return { isValid: true };
  }
}

/**
 * Валидирует ответ типа single_choice
 */
function validateSingleChoice(question: Question, answer: string | string[]): ValidationResult {
  if (Array.isArray(answer)) {
    return {
      isValid: false,
      error: 'Для этого вопроса можно выбрать только один вариант',
    };
  }

  if (!question.options) {
    return { isValid: true };
  }

  const validValues = question.options.map(opt => opt.value);
  if (!validValues.includes(answer)) {
    return {
      isValid: false,
      error: 'Выбран недопустимый вариант ответа',
    };
  }

  return { isValid: true };
}

/**
 * Валидирует ответ типа multi_choice
 */
function validateMultiChoice(question: Question, answer: string | string[]): ValidationResult {
  if (!Array.isArray(answer)) {
    return {
      isValid: false,
      error: 'Для этого вопроса нужно выбрать несколько вариантов',
    };
  }

  if (!question.options) {
    return { isValid: true };
  }

  const validValues = question.options.map(opt => opt.value);
  const invalidValues = answer.filter(val => !validValues.includes(val));
  
  if (invalidValues.length > 0) {
    return {
      isValid: false,
      error: 'Выбраны недопустимые варианты ответа',
    };
  }

  return { isValid: true };
}

/**
 * Валидирует ответ типа scale/slider
 */
function validateScale(question: Question, answer: string | string[]): ValidationResult {
  if (Array.isArray(answer)) {
    return {
      isValid: false,
      error: 'Для этого вопроса нужно выбрать одно значение',
    };
  }

  const numValue = Number(answer);
  if (isNaN(numValue)) {
    return {
      isValid: false,
      error: 'Ответ должен быть числом',
    };
  }

  if (question.min !== undefined && numValue < question.min) {
    return {
      isValid: false,
      error: `Значение должно быть не меньше ${question.min}`,
    };
  }

  if (question.max !== undefined && numValue > question.max) {
    return {
      isValid: false,
      error: `Значение должно быть не больше ${question.max}`,
    };
  }

  return { isValid: true };
}

/**
 * Валидирует ответ типа free_text/input
 */
function validateFreeText(question: Question, answer: string | string[]): ValidationResult {
  if (Array.isArray(answer)) {
    return {
      isValid: false,
      error: 'Для этого вопроса нужен текстовый ответ',
    };
  }

  const text = answer.trim();
  
  if (question.min !== undefined && text.length < question.min) {
    return {
      isValid: false,
      error: `Минимальная длина ответа: ${question.min} символов`,
    };
  }

  if (question.max !== undefined && text.length > question.max) {
    return {
      isValid: false,
      error: `Максимальная длина ответа: ${question.max} символов`,
    };
  }

  return { isValid: true };
}

/**
 * Проверяет, все ли обязательные вопросы отвечены
 */
export function validateAllRequiredQuestions(
  questions: Question[],
  answers: Record<number, string | string[]>
): ValidationResult {
  const unansweredRequired = questions.filter(q => {
    if (!q.isRequired) {
      return false;
    }
    const answer = answers[q.id];
    if (!answer) {
      return true;
    }
    if (Array.isArray(answer) && answer.length === 0) {
      return true;
    }
    if (typeof answer === 'string' && answer.trim() === '') {
      return true;
    }
    return false;
  });

  if (unansweredRequired.length > 0) {
    return {
      isValid: false,
      error: `Не отвечены обязательные вопросы: ${unansweredRequired.map(q => q.text).join(', ')}`,
    };
  }

  return { isValid: true };
}

/**
 * Проверяет, можно ли завершить анкету
 */
export function canCompleteQuiz(
  questions: Question[],
  answers: Record<number, string | string[]>
): boolean {
  const validation = validateAllRequiredQuestions(questions, answers);
  return validation.isValid;
}

