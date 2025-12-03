// lib/validators.ts
// Валидация входных данных для API

export interface ValidationResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Валидация ответа на вопрос анкеты
 */
export function validateAnswerInput(data: any): ValidationResult {
  if (!data) {
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
      answerValue: data.answerValue ?? null,
      answerValues: data.answerValues ?? null,
      questionIndex: data.questionIndex ?? null,
      infoScreenIndex: data.infoScreenIndex ?? null,
    },
  };
}

/**
 * Валидация productId
 */
export function validateProductId(productId: any): ValidationResult {
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
export function validateQuestionnaireId(questionnaireId: any): ValidationResult {
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
export function validateAnswersArray(answers: any): ValidationResult {
  if (!Array.isArray(answers)) {
    return { success: false, error: 'Answers must be an array' };
  }

  if (answers.length === 0) {
    return { success: false, error: 'Answers array cannot be empty' };
  }

  const validatedAnswers = [];
  for (const answer of answers) {
    const result = validateAnswerInput(answer);
    if (!result.success) {
      return result;
    }
    validatedAnswers.push(result.data);
  }

  return { success: true, data: validatedAnswers };
}

/**
 * Валидация topicId для частичного обновления анкеты
 */
export function validateTopicId(topicId: any): ValidationResult {
  if (!topicId || typeof topicId !== 'string') {
    return { success: false, error: 'Invalid topicId' };
  }

  // Проверяем, что topicId валидный
  const validTopicIds = [
    'skin-type',
    'concerns-goals',
    'diagnoses',
    'allergies',
    'current-products',
    'lifestyle',
    'spf-habits',
  ];

  if (!validTopicIds.includes(topicId)) {
    return { success: false, error: 'Unknown topicId' };
  }

  return { success: true, data: topicId };
}

