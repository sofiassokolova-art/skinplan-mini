// lib/quiz-topics.ts
// Группировка вопросов анкеты по темам для частичного перепрохождения

export interface QuizTopic {
  id: string;
  title: string;
  description: string;
  questionIds: number[]; // ID вопросов, которые относятся к этой теме
  questionCodes?: string[]; // Альтернативно: коды вопросов
  icon?: string;
  triggersPlanRebuild: boolean; // Триггерит ли пересборку плана
}

export const QUIZ_TOPICS: QuizTopic[] = [
  {
    id: 'skin_type',
    title: 'Тип кожи',
    description: 'Определение типа кожи и сезонности',
    questionIds: [8, 9, 12], // Примерные ID, нужно проверить реальные
    questionCodes: ['OILINESS', 'SEASONALITY'], // Коды вопросов
    icon: '🎨',
    triggersPlanRebuild: true, // skinType влияет на план
  },
  {
    id: 'concerns_goals',
    title: 'Жалобы и цели',
    description: 'Основные проблемы кожи и желаемые результаты',
    questionIds: [5, 10],
    questionCodes: ['SKIN_CONCERNS', 'SKIN_GOALS'],
    icon: '🎯',
    triggersPlanRebuild: true, // mainGoals влияют на план
  },
  {
    id: 'diagnoses_sensitivity',
    title: 'Диагнозы и чувствительность',
    description: 'Медицинские диагнозы и уровень чувствительности кожи',
    questionIds: [14, 15, 16, 17],
    questionCodes: ['DIAGNOSES', 'SENSITIVITY'],
    icon: '🏥',
    triggersPlanRebuild: true, // diagnoses и sensitivity влияют на план
  },
  {
    id: 'pregnancy',
    title: 'Беременность/ГВ',
    description: 'Статус беременности и грудного вскармливания',
    questionIds: [16], // Если пол — женский
    questionCodes: ['PREGNANCY', 'BREASTFEEDING'],
    icon: '🤰',
    triggersPlanRebuild: true, // противопоказания влияют на план
  },
  {
    id: 'excluded_ingredients',
    title: 'Нежелательные ингредиенты',
    description: 'Ингредиенты, которые нужно исключить',
    questionIds: [18],
    questionCodes: ['EXCLUDE_INGREDIENTS', 'ALLERGIES'],
    icon: '🚫',
    triggersPlanRebuild: true, // противопоказания влияют на план
  },
  {
    id: 'lifestyle',
    title: 'Привычки и образ жизни',
    description: 'Образ жизни и привычки ухода',
    questionIds: [26, 27, 28, 29],
    questionCodes: ['LIFESTYLE', 'HABITS'],
    icon: '🌱',
    triggersPlanRebuild: false, // не влияет напрямую на план
  },
  {
    id: 'spf_sun',
    title: 'SPF и солнце',
    description: 'Привычки использования SPF и пребывания на солнце',
    questionIds: [27, 28],
    questionCodes: ['SPF_FREQUENCY', 'SUN_EXPOSURE'],
    icon: '☀️',
    triggersPlanRebuild: false, // не влияет напрямую на план
  },
  {
    id: 'current_care',
    title: 'Текущий уход и реакция кожи',
    description: 'Текущие средства и реакция кожи на них',
    questionIds: [20, 21, 22, 23, 24],
    questionCodes: ['CURRENT_CARE', 'SKIN_REACTION'],
    icon: '💆',
    triggersPlanRebuild: false, // не влияет напрямую на план
  },
  {
    id: 'budget_preferences',
    title: 'Бюджет и предпочтения ухода',
    description: 'Бюджет и предпочтения по уходу',
    questionIds: [31, 32, 33, 34],
    questionCodes: ['BUDGET', 'CARE_PREFERENCES'],
    icon: '💰',
    triggersPlanRebuild: true, // budgetSegment влияет на план
  },
  {
    id: 'motivation',
    title: 'Мотивация',
    description: 'Мотивационные вопросы (тильда-свайпы)',
    questionIds: [37, 38, 39, 40, 41],
    questionCodes: ['MOTIVATION'],
    icon: '💪',
    triggersPlanRebuild: false, // не влияет на план
  },
];

// Функция для получения темы по ID
export function getTopicById(topicId: string): QuizTopic | undefined {
  return QUIZ_TOPICS.find(t => t.id === topicId);
}

// Функция для получения всех тем
export function getAllTopics(): QuizTopic[] {
  return QUIZ_TOPICS;
}

// Функция для проверки, нужно ли пересобирать план после обновления темы
export function shouldRebuildPlan(topicId: string): boolean {
  const topic = getTopicById(topicId);
  return topic?.triggersPlanRebuild || false;
}

