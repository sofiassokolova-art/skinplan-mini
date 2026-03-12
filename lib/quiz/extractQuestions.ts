// lib/quiz/extractQuestions.ts
// Единая функция для извлечения вопросов из questionnaire с кешированием

type Questionnaire = any;
type Question = any;

/**
 * Извлекает все вопросы из questionnaire (из groups и questions).
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

  // Глобальная защита от дубликатов по коду вопроса:
  // если в анкете по ошибке есть несколько вопросов с одинаковым code,
  // используем только первый экземпляр (по порядку в groups/questions).
  const seenCodes = new Set<string>();
  const dedupedByCode: Question[] = [];
  for (const q of result) {
    const code = (q as any)?.code ? String((q as any).code).toLowerCase() : '';
    if (!code || !seenCodes.has(code)) {
      dedupedByCode.push(q);
      if (code) {
        seenCodes.add(code);
      }
    }
  }
  result = dedupedByCode;

  // Вопрос про имя (USER_NAME) всегда первым — и после инфо-экранов пользователь сразу его видит
  const nameCode = 'user_name';
  const nameQuestions = result.filter((q: any) => (q?.code || '').toLowerCase() === nameCode);
  const otherQuestions = result.filter((q: any) => (q?.code || '').toLowerCase() !== nameCode);

  // Жёстко заданный порядок кодов вопросов согласно seed-questionnaire-v2 (QUIZ_FLOW.md).
  // Это устраняет «рандомный» порядок, если БД возвращает группы/вопросы в другом порядке.
  const CANONICAL_ORDER = [
    'user_name',
    'skin_goals',
    'age',
    'gender',
    'skin_type',
    'skin_concerns',
    'skin_sensitivity',
    'seasonal_changes',
    'medical_diagnoses',
    'pregnancy_breastfeeding',
    'allergies',
    'oral_medications',
    'retinoid_usage',
    'retinoid_reaction',
    'prescription_topical',
    'avoid_ingredients',
    'makeup_frequency',
    'spf_frequency',
    'sun_exposure',
    'lifestyle_habits',
    'care_type',
    'care_steps',
    'budget',
  ];

  const orderMap = new Map<string, number>();
  CANONICAL_ORDER.forEach((code, index) => {
    orderMap.set(code, index);
  });

  const sortedOthers = otherQuestions.slice().sort((a: any, b: any) => {
    const ca = (a?.code || '').toLowerCase();
    const cb = (b?.code || '').toLowerCase();
    const ia = orderMap.has(ca) ? (orderMap.get(ca) as number) : Number.MAX_SAFE_INTEGER;
    const ib = orderMap.has(cb) ? (orderMap.get(cb) as number) : Number.MAX_SAFE_INTEGER;
    if (ia !== ib) return ia - ib;
    // стабильный дополнительный критерий — по id
    const idA = typeof a?.id === 'number' ? a.id : 0;
    const idB = typeof b?.id === 'number' ? b.id : 0;
    return idA - idB;
  });

  if (nameQuestions.length > 0) {
    result = [...nameQuestions, ...sortedOthers];
  } else {
    result = sortedOthers;
  }
  
  if (result.length === 0 && (groups.length > 0 || questions.length > 0)) {
    console.warn('⚠️ extractQuestionsFromQuestionnaire: No questions extracted but data exists', {
      questionnaireId: questionnaire?.id,
      groupsCount: groups.length,
      questionsCount: questions.length,
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
