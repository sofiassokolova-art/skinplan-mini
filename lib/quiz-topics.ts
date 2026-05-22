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
    id: 'concerns_goals',
    title: 'Жалобы и цели',
    description: 'Основные проблемы кожи и желаемые результаты',
    questionIds: [26, 30], // skin_goals, skin_concerns
    questionCodes: ['skin_goals', 'skin_concerns'],
    icon: '🎯',
    triggersPlanRebuild: true, // mainGoals влияют на план
  },
  {
    id: 'skin_type',
    title: 'Тип кожи',
    description: 'Определение типа кожи и сезонности',
    questionIds: [29, 32], // skin_type, seasonal_changes
    questionCodes: ['skin_type', 'seasonal_changes'],
    icon: '🎨',
    triggersPlanRebuild: true, // skinType влияет на план
  },
  {
    id: 'diagnoses_sensitivity',
    title: 'Диагнозы и чувствительность',
    description: 'Медицинские диагнозы и уровень чувствительности кожи',
    questionIds: [31, 33], // skin_sensitivity, medical_diagnoses
    questionCodes: ['skin_sensitivity', 'medical_diagnoses'],
    icon: '🏥',
    triggersPlanRebuild: true, // diagnoses и sensitivity влияют на план
  },
  {
    id: 'pregnancy',
    title: 'Беременность/ГВ',
    description: 'Статус беременности и грудного вскармливания',
    questionIds: [34], // pregnancy_breastfeeding
    questionCodes: ['pregnancy_breastfeeding'],
    icon: '🤰',
    triggersPlanRebuild: true, // противопоказания влияют на план
  },
  {
    id: 'excluded_ingredients',
    title: 'Нежелательные ингредиенты',
    description: 'Ингредиенты, которые нужно исключить',
    questionIds: [35, 36], // allergies, avoid_ingredients
    questionCodes: ['allergies', 'avoid_ingredients'],
    icon: '🚫',
    triggersPlanRebuild: true, // противопоказания влияют на план
  },
  {
    id: 'current_care',
    title: 'Текущий уход и реакция кожи',
    description: 'Текущие средства и реакция кожи на них',
    // retinoid_reaction удалён из анкеты (не использовался downstream).
    // ID-ы оставлены без 38 (retinoid_reaction). Логика обновления тем матчит по questionCodes.
    questionIds: [37, 39, 40],
    questionCodes: ['retinoid_usage', 'prescription_topical', 'oral_medications'],
    icon: '💆',
    triggersPlanRebuild: false, // не влияет напрямую на план
  },
  // spf_sun удалён: вопросы spf_frequency / sun_exposure убраны из анкеты,
  // SPF в плане включён по умолчанию для всех пользователей.
  // Топик 'lifestyle' удалён: единственный оставшийся вопрос makeup_frequency
  // перемещён в budget_preferences (см. seed-questionnaire-v2.ts).
  {
    id: 'budget_preferences',
    title: 'Бюджет и предпочтения ухода',
    description: 'Бюджет и предпочтения по уходу',
    // makeup_frequency перенесён сюда из удалённого топика 'lifestyle'.
    questionIds: [41, 45],
    questionCodes: ['makeup_frequency', 'care_type', 'care_steps', 'budget'],
    icon: '💰',
    triggersPlanRebuild: true, // budgetSegment влияет на план
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

