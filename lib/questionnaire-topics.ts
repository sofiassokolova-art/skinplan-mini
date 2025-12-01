// lib/questionnaire-topics.ts
// Структура тем для частичного перепрохождения анкеты

export type QuestionTopicId = 
  | 'skin_type'
  | 'concerns_goals'
  | 'diagnoses_sensitivity'
  | 'pregnancy'
  | 'avoid_ingredients'
  | 'habits_lifestyle'
  | 'spf_sun'
  | 'current_care'
  | 'budget_preferences'
  | 'motivation';

export interface QuestionTopic {
  id: QuestionTopicId;
  title: string;
  description: string;
  questionCodes: string[]; // Коды вопросов, которые относятся к этой теме
  requiresPlanRebuild: boolean; // Требует ли пересборки плана
  affectsFields: string[]; // Какие поля SkinProfile могут измениться
}

// Маппинг тем к кодам вопросов
export const QUESTION_TOPICS: Record<QuestionTopicId, QuestionTopic> = {
  skin_type: {
    id: 'skin_type',
    title: 'Тип кожи',
    description: 'Определение типа кожи и сезонности',
    questionCodes: ['skin_type', 'seasonal_changes'],
    requiresPlanRebuild: true,
    affectsFields: ['skinType', 'seasonality'],
  },
  concerns_goals: {
    id: 'concerns_goals',
    title: 'Жалобы и цели',
    description: 'Основные проблемы и цели ухода',
    questionCodes: ['skin_goals', 'skin_concerns'],
    requiresPlanRebuild: true,
    affectsFields: ['mainGoals', 'secondaryGoals'],
  },
  diagnoses_sensitivity: {
    id: 'diagnoses_sensitivity',
    title: 'Диагнозы и чувствительность',
    description: 'Медицинские диагнозы и уровень чувствительности',
    questionCodes: ['medical_diagnoses', 'skin_sensitivity', 'allergies'],
    requiresPlanRebuild: true,
    affectsFields: ['diagnoses', 'sensitivity', 'contraindications'],
  },
  pregnancy: {
    id: 'pregnancy',
    title: 'Беременность/ГВ',
    description: 'Статус беременности и грудного вскармливания',
    questionCodes: ['pregnancy_breastfeeding'],
    requiresPlanRebuild: true,
    affectsFields: ['pregnancyStatus', 'contraindications'],
  },
  avoid_ingredients: {
    id: 'avoid_ingredients',
    title: 'Нежелательные ингредиенты',
    description: 'Ингредиенты, которые нужно исключить',
    questionCodes: ['avoid_ingredients'],
    requiresPlanRebuild: true,
    affectsFields: ['contraindications'],
  },
  habits_lifestyle: {
    id: 'habits_lifestyle',
    title: 'Привычки и образ жизни',
    description: 'Образ жизни и ежедневные привычки',
    questionCodes: ['makeup_frequency', 'lifestyle_factors'],
    requiresPlanRebuild: false,
    affectsFields: ['makeupFrequency', 'lifestyleFactors'],
  },
  spf_sun: {
    id: 'spf_sun',
    title: 'SPF и солнце',
    description: 'Привычки использования SPF и пребывания на солнце',
    questionCodes: ['spf_frequency', 'sun_exposure'],
    requiresPlanRebuild: false,
    affectsFields: ['spfHabit'],
  },
  current_care: {
    id: 'current_care',
    title: 'Текущий уход и реакция кожи',
    description: 'Текущие средства и реакция кожи на них',
    questionCodes: ['current_topicals', 'current_oral_meds', 'retinol_reaction', 'aha_bha_reaction'],
    requiresPlanRebuild: true,
    affectsFields: ['currentTopicals', 'currentOralMeds', 'contraindications'],
  },
  budget_preferences: {
    id: 'budget_preferences',
    title: 'Бюджет и предпочтения ухода',
    description: 'Бюджетный сегмент и предпочтения по уходу',
    questionCodes: ['budget', 'care_preference', 'routine_complexity'],
    requiresPlanRebuild: true,
    affectsFields: ['budgetSegment', 'carePreference', 'routineComplexity'],
  },
  motivation: {
    id: 'motivation',
    title: 'Мотивация',
    description: 'Мотивационные вопросы (тильда-свайпы)',
    questionCodes: ['motivation_questions'], // Это может быть группа вопросов
    requiresPlanRebuild: false,
    affectsFields: [],
  },
};

// Получить тему по ID
export function getTopicById(id: QuestionTopicId): QuestionTopic {
  return QUESTION_TOPICS[id];
}

// Получить все темы
export function getAllTopics(): QuestionTopic[] {
  return Object.values(QUESTION_TOPICS);
}

// Проверить, требует ли тема пересборки плана
export function topicRequiresPlanRebuild(topicId: QuestionTopicId): boolean {
  return QUESTION_TOPICS[topicId]?.requiresPlanRebuild ?? false;
}

// Получить коды вопросов для темы
export function getQuestionCodesForTopic(topicId: QuestionTopicId): string[] {
  return QUESTION_TOPICS[topicId]?.questionCodes ?? [];
}

