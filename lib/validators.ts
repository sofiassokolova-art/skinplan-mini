// lib/validators.ts
// Валидация входных данных для API
// РЕФАКТОРИНГ P2: Заменены any на unknown для лучшей типобезопасности

// Type guard для проверки объекта
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface ValidationResult<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface ValidatedAnswer {
  questionId: number;
  answerValue: string | null;
  answerValues: string[] | null;
  questionIndex: number | null;
  infoScreenIndex: number | null;
}

/**
 * Валидация ответа на вопрос анкеты
 */
export function validateAnswerInput(data: unknown): ValidationResult<ValidatedAnswer> {
  if (!data || !isRecord(data)) {
    return { success: false, error: 'Missing answer data' };
  }

  if (data.questionId === undefined || data.questionId === null) {
    return { success: false, error: 'Missing questionId' };
  }

  const questionId = Number(data.questionId);
  if (isNaN(questionId) || questionId <= 0) {
    return { success: false, error: 'Invalid questionId' };
  }

  // answerValue или answerValues должны быть предоставлены (но могут быть null для очистки)
  if (data.answerValue === undefined && data.answerValues === undefined) {
    return { success: false, error: 'Missing answerValue or answerValues' };
  }

  // Если answerValues - должен быть массив
  if (data.answerValues !== undefined && !Array.isArray(data.answerValues)) {
    return { success: false, error: 'answerValues must be an array' };
  }

  return {
    success: true,
    data: {
      questionId,
      answerValue: (data.answerValue as string) ?? null,
      answerValues: (data.answerValues as string[]) ?? null,
      questionIndex: (data.questionIndex as number) ?? null,
      infoScreenIndex: (data.infoScreenIndex as number) ?? null,
    },
  };
}

/**
 * Валидация productId
 */
export function validateProductId(productId: unknown): ValidationResult<number> {
  if (productId === undefined || productId === null) {
    return { success: false, error: 'Missing productId' };
  }

  const id = Number(productId);
  if (isNaN(id) || id <= 0) {
    return { success: false, error: 'Invalid productId' };
  }

  return { success: true, data: id };
}

/**
 * Валидация questionnaireId
 */
export function validateQuestionnaireId(questionnaireId: unknown): ValidationResult<number> {
  if (questionnaireId === undefined || questionnaireId === null) {
    return { success: false, error: 'Missing questionnaireId' };
  }

  const id = Number(questionnaireId);
  if (isNaN(id) || id <= 0) {
    return { success: false, error: 'Invalid questionnaireId' };
  }

  return { success: true, data: id };
}

/**
 * Валидация массива ответов
 */
export function validateAnswersArray(answers: unknown): ValidationResult<ValidatedAnswer[]> {
  if (!Array.isArray(answers)) {
    return { success: false, error: 'Answers must be an array' };
  }

  if (answers.length === 0) {
    return { success: false, error: 'Answers array cannot be empty' };
  }

  const validatedAnswers: ValidatedAnswer[] = [];
  for (const answer of answers) {
    const result = validateAnswerInput(answer);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    if (result.data) {
      validatedAnswers.push(result.data);
    }
  }

  return { success: true, data: validatedAnswers };
}

// Допустимые topicId
export type TopicId = 
  | 'skin-type'
  | 'concerns-goals'
  | 'diagnoses'
  | 'allergies'
  | 'current-products'
  | 'lifestyle'
  | 'spf-habits';

const VALID_TOPIC_IDS: TopicId[] = [
  'skin-type',
  'concerns-goals',
  'diagnoses',
  'allergies',
  'current-products',
  'lifestyle',
  'spf-habits',
];

/**
 * Валидация topicId для частичного обновления анкеты
 */
export function validateTopicId(topicId: unknown): ValidationResult<TopicId> {
  if (!topicId || typeof topicId !== 'string') {
    return { success: false, error: 'Invalid topicId' };
  }

  if (!VALID_TOPIC_IDS.includes(topicId as TopicId)) {
    return { success: false, error: 'Unknown topicId' };
  }

  return { success: true, data: topicId as TopicId };
}

