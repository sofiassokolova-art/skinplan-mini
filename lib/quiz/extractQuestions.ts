// lib/quiz/extractQuestions.ts
// Единая функция для извлечения вопросов из questionnaire с кешированием

type Questionnaire = any;
type Question = any;

// WeakMap кеш: один и тот же объект questionnaire → один и тот же результат.
// Не утекает память: как только questionnaire GC-ится, запись удаляется.
const _cache = new WeakMap<object, Question[]>();

/**
 * Извлекает все вопросы из questionnaire (из groups и questions).
 * Результат кешируется по ссылке объекта (WeakMap).
 */
export function extractQuestionsFromQuestionnaire(questionnaire: Questionnaire | null): Question[] {
  if (questionnaire && _cache.has(questionnaire)) {
    return _cache.get(questionnaire)!;
  }
  if (!questionnaire) {
    return [];
  }

  const groups = questionnaire.groups || questionnaire.questionGroups || [];
  const questions = questionnaire.questions || [];

  if (!Array.isArray(groups) || !Array.isArray(questions)) {
    // ДИАГНОСТИКА: Логируем, если groups или questions не массивы
    console.warn('⚠️ extractQuestionsFromQuestionnaire: groups or questions is not an array', {
      hasQuestionnaire: !!questionnaire,
      questionnaireId: questionnaire?.id,
      groupsType: Array.isArray(groups) ? 'array' : typeof groups,
      questionsType: Array.isArray(questions) ? 'array' : typeof questions,
      groupsValue: groups,
      questionsValue: questions,
    });
    return [];
  }

  // ИСПРАВЛЕНО: Используем Map для удаления дубликатов по questionId
  // Вопросы могут быть и в groups, и в questions
  const questionsMap = new Map<number, Question>();

  // Сначала добавляем вопросы из groups (они имеют приоритет при дубликатах)
  const questionsFromGroups = groups.flatMap((g: any) => {
    if (!g || !g.questions) return [];
    return Array.isArray(g.questions) ? g.questions.filter((q: any) => q && q.id) : [];
  });
  questionsFromGroups.forEach((q: Question) => {
    if (q && q.id && !questionsMap.has(q.id)) {
      questionsMap.set(q.id, q);
    }
  });

  // Затем добавляем вопросы из questions (если их еще нет)
  const questionsFromRoot = questions.filter((q: any) => q && q.id);
  questionsFromRoot.forEach((q: Question) => {
    if (q && q.id && !questionsMap.has(q.id)) {
      questionsMap.set(q.id, q);
    }
  });

  let result = Array.from(questionsMap.values());

  // Вопрос про имя (USER_NAME) всегда первым — и после инфо-экранов пользователь сразу его видит
  const nameCode = 'user_name';
  const nameQuestions = result.filter((q: any) => (q?.code || '').toLowerCase() === nameCode);
  const otherQuestions = result.filter((q: any) => (q?.code || '').toLowerCase() !== nameCode);
  if (nameQuestions.length > 0) {
    result = [...nameQuestions, ...otherQuestions];
  }
  
  if (result.length === 0 && (groups.length > 0 || questions.length > 0)) {
    console.warn('⚠️ extractQuestionsFromQuestionnaire: No questions extracted but data exists', {
      questionnaireId: questionnaire?.id,
      groupsCount: groups.length,
      questionsCount: questions.length,
    });
  }

  if (questionnaire) {
    _cache.set(questionnaire, result);
  }
  return result;
}

/**
 * Нормализует вопрос, приводя options к answerOptions (для совместимости)
 * @param question - вопрос для нормализации
 * @returns нормализованный вопрос
 */
export function normalizeQuestion(question: Question): Question {
  if (!question) return question;
  
  return {
    ...question,
    answerOptions: question.answerOptions || question.options || [],
  };
}
