import { getAllInfoScreens } from '@/app/(miniapp)/quiz/info-screens';
import { extractQuestionsFromQuestionnaire } from '@/lib/quiz/extractQuestions';
import { prisma } from '@/lib/db';

export interface AdminQuestionnaireOptionBreakdown {
  label: string;
  value: string;
  count: number;
  percent: number;
}

export interface AdminQuestionnaireAnswerBreakdown {
  questionCode: string;
  questionText: string;
  groupTitle: string | null;
  questionType: string;
  totalAnswers: number;
  totalSelections: number;
  unansweredStarted: number;
  options: AdminQuestionnaireOptionBreakdown[];
}

export interface AdminQuestionnaireStage {
  id: string;
  title: string;
  questionCodes: string[];
  questionCount: number;
  reachedCount: number;
  completedCount: number;
  conversionFromStarted: number;
  conversionFromPrev: number;
  completionRate: number;
  dropOffFromPrev: number;
}

export interface AdminQuestionnaireOverview {
  id: number;
  name: string;
  version: number;
  totalGroups: number;
  totalQuestions: number;
  requiredQuestions: number;
  totalInfoScreens: number;
  started: number;
  completed: number;
  inProgress: number;
  averageAnsweredQuestions: number;
  completionRate: number;
  lastAnswerAt: string | null;
}

export interface AdminQuestionnaireAnalytics {
  overview: AdminQuestionnaireOverview;
  answerBreakdowns: AdminQuestionnaireAnswerBreakdown[];
  stages: AdminQuestionnaireStage[];
  internal: {
    activeQuestionnaire: any;
    questionsInOrder: any[];
    startedUserIds: string[];
    completedUserIds: string[];
  };
}

const QUESTION_BREAKDOWN_CODES = [
  'skin_goals',
  'age',
  'gender',
  'skin_type',
  'skin_concerns',
  'skin_sensitivity',
  'seasonal_changes',
  'fitzpatrick_type',
  'medical_diagnoses',
  'pregnancy_breastfeeding',
  'allergies',
  'has_avoid_ingredients',
  'avoid_ingredients',
  'retinoid_usage',
  'retinoid_reaction',
  'prescription_topical',
  'oral_medications',
  'makeup_frequency',
  'care_type',
  'care_steps',
  'budget',
];

const pct = (num: number, den: number) => (den > 0 ? Math.min(100, (num / den) * 100) : 0);

function normalizeCode(code: unknown): string {
  return String(code || '').toLowerCase();
}

function getAnswerValues(answer: { answerValue?: string | null; answerValues?: unknown }): string[] {
  if (Array.isArray(answer.answerValues)) {
    return answer.answerValues
      .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
      .map((value) => String(value))
      .filter(Boolean);
  }

  if (answer.answerValue != null && String(answer.answerValue).trim() !== '') {
    return [String(answer.answerValue)];
  }

  return [];
}

function buildOptionLabelMap(question: any): Map<string, string> {
  const map = new Map<string, string>();
  const options = question?.answerOptions || question?.options || [];

  for (const option of options) {
    const label = String(option?.label || option?.value || option?.id || 'Ответ');
    for (const key of [option?.value, option?.id, option?.label]) {
      if (key != null) {
        map.set(String(key), label);
      }
    }
  }

  return map;
}

function getQuestionGroupTitle(activeQuestionnaire: any, questionId: number): string | null {
  const groups = activeQuestionnaire?.questionGroups || activeQuestionnaire?.groups || [];
  for (const group of groups) {
    const questions = Array.isArray(group?.questions) ? group.questions : [];
    if (questions.some((question: any) => question?.id === questionId)) {
      return group?.title || null;
    }
  }
  return null;
}

function buildStages(params: {
  activeQuestionnaire: any;
  questionsInOrder: any[];
  startedSet: Set<string>;
  completedSet: Set<string>;
  maxQuestionIndexByUser: Map<string, number>;
}): AdminQuestionnaireStage[] {
  type StageDefinition = {
    id: string;
    title: string;
    questions: any[];
    firstIndex: number;
  };

  const { activeQuestionnaire, questionsInOrder, startedSet, completedSet, maxQuestionIndexByUser } = params;
  const questionIndexById = new Map<number, number>();
  questionsInOrder.forEach((question, index) => {
    if (typeof question?.id === 'number') {
      questionIndexById.set(question.id, index);
    }
  });

  const groups: any[] = (activeQuestionnaire?.questionGroups || activeQuestionnaire?.groups || [])
    .slice()
    .sort((a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0));

  const stageDefinitions: StageDefinition[] = groups
    .map((group: any): StageDefinition | null => {
      const groupQuestionIds = new Set(
        (Array.isArray(group?.questions) ? group.questions : [])
          .map((question: any) => question?.id)
          .filter((id: unknown): id is number => typeof id === 'number')
      );
      const questions = questionsInOrder.filter((question) => groupQuestionIds.has(question.id));
      const indices = questions
        .map((question) => questionIndexById.get(question.id))
        .filter((index): index is number => typeof index === 'number')
        .sort((a, b) => a - b);

      if (indices.length === 0) return null;

      return {
        id: `group_${group.id}`,
        title: String(group?.title || 'Блок анкеты'),
        questions,
        firstIndex: indices[0],
      };
    })
    .filter((stage): stage is StageDefinition => stage !== null);

  let previousReached = startedSet.size;

  return stageDefinitions.map((stage, stageIndex) => {
    const nextStage = stageDefinitions[stageIndex + 1];
    let reachedCount = 0;
    let completedCount = 0;

    for (const userId of startedSet) {
      const maxQuestionIndex = maxQuestionIndexByUser.get(userId);
      const hasCompletedQuestionnaire = completedSet.has(userId);
      const reached =
        hasCompletedQuestionnaire ||
        (typeof maxQuestionIndex === 'number' && maxQuestionIndex >= stage.firstIndex);
      const completed = hasCompletedQuestionnaire
        ? true
        : nextStage
          ? typeof maxQuestionIndex === 'number' && maxQuestionIndex >= nextStage.firstIndex
          : false;

      if (reached) reachedCount++;
      if (completed) completedCount++;
    }

    const conversionFromPrev = pct(reachedCount, previousReached);
    const result: AdminQuestionnaireStage = {
      id: stage.id,
      title: stage.title,
      questionCodes: stage.questions.map((question: any) => String(question.code || '')),
      questionCount: stage.questions.length,
      reachedCount,
      completedCount,
      conversionFromStarted: pct(reachedCount, startedSet.size),
      conversionFromPrev,
      completionRate: pct(completedCount, reachedCount),
      dropOffFromPrev: Math.max(0, previousReached - reachedCount),
    };

    previousReached = reachedCount;
    return result;
  });
}

export async function getAdminQuestionnaireAnalytics(): Promise<AdminQuestionnaireAnalytics | null> {
  const activeQuestionnaire = await prisma.questionnaire.findFirst({
    where: { isActive: true },
    include: {
      questionGroups: {
        orderBy: { position: 'asc' },
        include: {
          questions: {
            orderBy: { position: 'asc' },
            include: {
              answerOptions: { orderBy: { position: 'asc' } },
            },
          },
        },
      },
      questions: {
        orderBy: [{ groupId: 'asc' }, { position: 'asc' }],
        include: {
          answerOptions: { orderBy: { position: 'asc' } },
        },
      },
    },
  });

  if (!activeQuestionnaire) return null;

  const questionsInOrder = extractQuestionsFromQuestionnaire({
    ...activeQuestionnaire,
    groups: activeQuestionnaire.questionGroups,
  });
  const questionIndexById = new Map<number, number>();
  questionsInOrder.forEach((question, index) => {
    if (typeof question?.id === 'number') {
      questionIndexById.set(question.id, index);
    }
  });

  const [answerRows, progressRows, submissionRows] = await Promise.all([
    prisma.userAnswer.findMany({
      where: { questionnaireId: activeQuestionnaire.id },
      select: {
        userId: true,
        questionId: true,
        answerValue: true,
        answerValues: true,
        createdAt: true,
      },
    }),
    prisma.questionnaireProgress.findMany({
      where: { questionnaireId: activeQuestionnaire.id },
      select: {
        userId: true,
        questionIndex: true,
      },
    }).catch(() => [] as Array<{ userId: string; questionIndex: number }>),
    prisma.questionnaireSubmission.findMany({
      where: {
        questionnaireId: activeQuestionnaire.id,
        status: 'completed',
      },
      select: {
        userId: true,
        createdAt: true,
      },
    }).catch(() => [] as Array<{ userId: string; createdAt: Date }>),
  ]);

  const startedSet = new Set<string>();
  const completedSet = new Set<string>();
  const answersByQuestionId = new Map<number, typeof answerRows>();
  const answeredQuestionIdsByUser = new Map<string, Set<number>>();
  const maxQuestionIndexByUser = new Map<string, number>();
  let lastAnswerAt: Date | null = null;

  for (const row of progressRows) {
    startedSet.add(row.userId);
    const safeQuestionIndex = Math.max(0, Math.min(row.questionIndex, Math.max(0, questionsInOrder.length - 1)));
    const previous = maxQuestionIndexByUser.get(row.userId);
    if (previous === undefined || safeQuestionIndex > previous) {
      maxQuestionIndexByUser.set(row.userId, safeQuestionIndex);
    }
  }

  for (const answer of answerRows) {
    startedSet.add(answer.userId);
    const existingRows = answersByQuestionId.get(answer.questionId) || [];
    existingRows.push(answer);
    answersByQuestionId.set(answer.questionId, existingRows);

    if (!answeredQuestionIdsByUser.has(answer.userId)) {
      answeredQuestionIdsByUser.set(answer.userId, new Set<number>());
    }
    answeredQuestionIdsByUser.get(answer.userId)!.add(answer.questionId);

    const questionIndex = questionIndexById.get(answer.questionId);
    const previous = maxQuestionIndexByUser.get(answer.userId);
    if (typeof questionIndex === 'number' && (previous === undefined || questionIndex > previous)) {
      maxQuestionIndexByUser.set(answer.userId, questionIndex);
    }

    if (!lastAnswerAt || answer.createdAt > lastAnswerAt) {
      lastAnswerAt = answer.createdAt;
    }
  }

  for (const row of submissionRows) {
    startedSet.add(row.userId);
    completedSet.add(row.userId);
    if (!lastAnswerAt || row.createdAt > lastAnswerAt) {
      lastAnswerAt = row.createdAt;
    }
  }

  const lastQuestion = questionsInOrder[questionsInOrder.length - 1];
  if (lastQuestion) {
    for (const answer of answersByQuestionId.get(lastQuestion.id) || []) {
      completedSet.add(answer.userId);
    }
  }

  const totalAnsweredQuestions = Array.from(answeredQuestionIdsByUser.values())
    .reduce((sum, questionIds) => sum + questionIds.size, 0);

  const answerBreakdowns = QUESTION_BREAKDOWN_CODES.map((code) => {
    const question = questionsInOrder.find((item) => normalizeCode(item?.code) === code);
    if (!question) return null;

    const rows = answersByQuestionId.get(question.id) || [];
    const answeredUsers = new Set(rows.map((row) => row.userId));
    const labelMap = buildOptionLabelMap(question);
    const counts = new Map<string, { label: string; count: number; value: string }>();

    for (const row of rows) {
      const values = getAnswerValues(row);
      if (values.length === 0) continue;

      for (const value of values) {
        const label = labelMap.get(value) || value;
        const key = label;
        const current = counts.get(key) || { label, count: 0, value };
        current.count += 1;
        counts.set(key, current);
      }
    }

    const totalAnswers = answeredUsers.size;
    const totalSelections = Array.from(counts.values()).reduce((sum, item) => sum + item.count, 0);

    return {
      questionCode: String(question.code || code),
      questionText: String(question.text || code),
      groupTitle: getQuestionGroupTitle(activeQuestionnaire, question.id),
      questionType: String(question.type || ''),
      totalAnswers,
      totalSelections,
      unansweredStarted: Math.max(0, startedSet.size - totalAnswers),
      options: Array.from(counts.values())
        .map((item) => ({
          label: item.label,
          value: item.value,
          count: item.count,
          percent: pct(item.count, Math.max(1, totalAnswers)),
        }))
        .sort((a, b) => b.count - a.count),
    };
  }).filter((item): item is AdminQuestionnaireAnswerBreakdown => item !== null);

  const stages = buildStages({
    activeQuestionnaire,
    questionsInOrder,
    startedSet,
    completedSet,
    maxQuestionIndexByUser,
  });

  return {
    overview: {
      id: activeQuestionnaire.id,
      name: activeQuestionnaire.name,
      version: activeQuestionnaire.version,
      totalGroups: activeQuestionnaire.questionGroups.length,
      totalQuestions: questionsInOrder.length,
      requiredQuestions: questionsInOrder.filter((question) => question?.isRequired).length,
      totalInfoScreens: getAllInfoScreens().length,
      started: startedSet.size,
      completed: completedSet.size,
      inProgress: Math.max(0, startedSet.size - completedSet.size),
      averageAnsweredQuestions: startedSet.size > 0
        ? Math.round((totalAnsweredQuestions / startedSet.size) * 10) / 10
        : 0,
      completionRate: pct(completedSet.size, startedSet.size),
      lastAnswerAt: lastAnswerAt ? lastAnswerAt.toISOString() : null,
    },
    answerBreakdowns,
    stages,
    internal: {
      activeQuestionnaire,
      questionsInOrder,
      startedUserIds: Array.from(startedSet),
      completedUserIds: Array.from(completedSet),
    },
  };
}
