// lib/quiz/extractQuestions.ts
// Единая функция для извлечения вопросов из questionnaire
// Убирает дублирование логики извлечения вопросов

// Используем any для типов, так как в разных местах используются разные интерфейсы Questionnaire
type Questionnaire = any;
type Question = any;

/**
 * Извлекает все вопросы из questionnaire (из groups и questions)
 * @param questionnaire - объект анкеты с groups и questions
 * @returns массив всех вопросов без дубликатов
 */
export function extractQuestionsFromQuestionnaire(questionnaire: Questionnaire | null): Question[] {
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
  
  // ДИАГНОСТИКА: Логируем, если результат пустой, но данные есть
  if (result.length === 0 && (groups.length > 0 || questions.length > 0)) {
    console.warn('⚠️ extractQuestionsFromQuestionnaire: No questions extracted but data exists', {
      questionnaireId: questionnaire?.id,
      groupsCount: groups.length,
      questionsCount: questions.length,
      questionsFromGroupsCount: questionsFromGroups.length,
      questionsFromRootCount: questionsFromRoot.length,
      groupsSample: groups.slice(0, 2).map((g: any) => ({
        id: g?.id,
        hasQuestions: !!g?.questions,
        questionsCount: Array.isArray(g?.questions) ? g.questions.length : 0,
        questionsSample: Array.isArray(g?.questions) ? g.questions.slice(0, 2).map((q: any) => ({ id: q?.id, code: q?.code })) : [],
      })),
      questionsSample: questions.slice(0, 2).map((q: any) => ({ id: q?.id, code: q?.code })),
    });
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
