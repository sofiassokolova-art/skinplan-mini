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

  const groups = questionnaire.groups || [];
  const questions = questionnaire.questions || [];

  if (!Array.isArray(groups) || !Array.isArray(questions)) {
    return [];
  }

  // ИСПРАВЛЕНО: Используем Map для удаления дубликатов по questionId
  // Вопросы могут быть и в groups, и в questions
  const questionsMap = new Map<number, Question>();

  // Сначала добавляем вопросы из groups (они имеют приоритет при дубликатах)
  const questionsFromGroups = groups.flatMap((g: any) => (g.questions || []).filter((q: any) => q && q.id));
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

  return Array.from(questionsMap.values());
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

