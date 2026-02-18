// lib/retake-scoped-recalculation.ts
// ИСПРАВЛЕНО: Topic-scoped recalculation для retake
// При перепрохождении только одной темы пересчитываются только затронутые оси, остальные наследуются

import type { SkinAxes, SkinProfile } from './skinprofile-types';
import type { SkinScore, SkinAxis } from './skin-analysis-engine';
import { calculateSkinAxes, type QuestionnaireAnswers } from './skin-analysis-engine';
import { logger } from './logger';
import type { QuestionTopicId } from './questionnaire-topics';
import { getQuestionCodesForTopic } from './questionnaire-topics';

// ИСПРАВЛЕНО (P1): TopicId теперь union type по реальным topicId
export type TopicId = QuestionTopicId;

/**
 * Маппинг тем на затронутые оси
 * ИСПРАВЛЕНО (P1): Использует реальные QuestionTopicId вместо старых строковых ключей
 * ИСПРАВЛЕНО: Определяет, какие оси нужно пересчитать при изменении темы
 */
const TOPIC_TO_AXES_MAP: Partial<Record<TopicId, Array<SkinAxis>>> = {
  'skin_type': ['oiliness', 'barrier'], // Тип кожи влияет на жирность и барьер
  'concerns_goals': ['inflammation', 'pigmentation', 'photoaging'], // Жалобы и цели влияют на воспаление, пигментацию и фотостарение
  'diagnoses_sensitivity': ['barrier', 'inflammation'], // Диагнозы и чувствительность влияют на барьер и воспаление
  'pregnancy': ['barrier'], // Беременность влияет на барьер (из-за противопоказаний)
  'avoid_ingredients': ['barrier'], // Исключённые ингредиенты влияют на барьер
  'habits_lifestyle': ['hydration', 'photoaging'], // Привычки влияют на гидратацию и фотостарение
  'spf_sun': ['photoaging', 'pigmentation'], // SPF и солнце влияют на фотостарение и пигментацию
  'current_care': ['barrier', 'inflammation'], // Текущий уход влияет на барьер и воспаление
  'budget_preferences': [], // Бюджет и предпочтения не влияют на оси напрямую
  'motivation': [], // Мотивация не влияет на оси
};

/**
 * Определяет, какие оси затронуты изменением темы
 * ИСПРАВЛЕНО: Возвращает список осей, которые нужно пересчитать
 */
export function getAffectedAxesForTopic(topicId: TopicId): Array<SkinScore['axis']> {
  return TOPIC_TO_AXES_MAP[topicId] || [];
}

/**
 * Пересчитывает только затронутые оси при retake темы
 * ИСПРАВЛЕНО (P1): Наследует незатронутые оси из предыдущего профиля
 * ИСПРАВЛЕНО (P2): Убран хардкод allAxes - берём из результата calculateSkinAxes
 */
export function recalculateAxesScoped(
  newAnswers: QuestionnaireAnswers,
  previousAxes: SkinAxes,
  topicId: TopicId
): SkinAxes {
  const affectedAxes = getAffectedAxesForTopic(topicId);
  
  if (affectedAxes.length === 0) {
    logger.warn('No affected axes for topic, recalculating all', { topicId });
    // Если тема не маппится на оси, пересчитываем все (fallback)
    return calculateSkinAxes(newAnswers);
  }

  // ИСПРАВЛЕНО: Вычисляем все оси из новых ответов
  const allNewAxes = calculateSkinAxes(newAnswers);
  
  // ИСПРАВЛЕНО (P2): Создаём Set всех возможных осей из новых и предыдущих
  // Это гарантирует, что мы не потеряем оси, если они появятся/исчезнут
  const axisSet = new Set<SkinAxis>();
  allNewAxes.forEach(axis => axisSet.add(axis.axis));
  previousAxes.forEach(axis => axisSet.add(axis.axis));
  const allAxes = Array.from(axisSet);
  
  // ИСПРАВЛЕНО: Создаем мапу новых осей для быстрого доступа
  const newAxesMap = new Map(allNewAxes.map(axis => [axis.axis, axis]));
  
  // ИСПРАВЛЕНО: Создаем мапу старых осей для наследования
  const previousAxesMap = new Map(previousAxes.map(axis => [axis.axis, axis]));
  
  // ИСПРАВЛЕНО: Объединяем: затронутые оси из новых ответов, остальные из предыдущих
  const result: SkinAxes = [];
  
  for (const axisName of allAxes) {
    if (affectedAxes.includes(axisName)) {
      // Затронутая ось - используем новое значение
      const newAxis = newAxesMap.get(axisName);
      if (newAxis) {
        result.push(newAxis);
      } else {
        // Если ось не найдена в новых, используем старую (fallback)
        const oldAxis = previousAxesMap.get(axisName);
        if (oldAxis) {
          result.push(oldAxis);
        }
      }
    } else {
      // Незатронутая ось - наследуем из предыдущего профиля
      const oldAxis = previousAxesMap.get(axisName);
      if (oldAxis) {
        result.push(oldAxis);
      } else {
        // Если старая ось не найдена, вычисляем из новых ответов (fallback)
        const newAxis = newAxesMap.get(axisName);
        if (newAxis) {
          result.push(newAxis);
        }
      }
    }
  }

  logger.info('Axes recalculated scoped', {
    topicId,
    affectedAxes,
    allAxes,
    recalculatedAxes: result.filter(a => affectedAxes.includes(a.axis)).map(a => a.axis),
    inheritedAxes: result.filter(a => !affectedAxes.includes(a.axis)).map(a => a.axis),
  });

  return result;
}

/**
 * Коды вопросов, изменение которых требует полного пересоздания профиля
 * ИСПРАВЛЕНО (P2): Используем централизованные коды из questionnaire-topics
 */
const CRITICAL_QUESTION_CODES = [
  'skin_type',
  'age',
  'gender',
  'pregnancy_breastfeeding',
] as const;

/**
 * Определяет, нужно ли пересоздавать профиль при retake темы
 * ИСПРАВЛЕНО (P1): Использует topicId для определения критичности
 * ИСПРАВЛЕНО (P2): Использует централизованные коды вопросов
 */
export function shouldRecreateProfileForTopic(
  topicId: TopicId,
  changedAnswers: Record<string, any>
): boolean {
  // ИСПРАВЛЕНО (P1): Используем topicId для определения критичности
  // Темы, которые влияют на безопасность/структуру профиля, требуют полного пересоздания
  const criticalTopics: TopicId[] = [
    'skin_type', // Тип кожи - основа профиля
    'pregnancy', // Беременность - критично для безопасности
    'diagnoses_sensitivity', // Диагнозы и чувствительность - влияют на протоколы
  ];

  if (criticalTopics.includes(topicId)) {
    return true; // Критические темы требуют полного пересоздания
  }

  // ИСПРАВЛЕНО (P2): Проверяем коды вопросов через централизованные коды темы
  const topicQuestionCodes = getQuestionCodesForTopic(topicId);
  const hasCriticalQuestionCodes = topicQuestionCodes.some(code =>
    CRITICAL_QUESTION_CODES.includes(code as any)
  );

  if (hasCriticalQuestionCodes) {
    return true; // Если тема содержит критические вопросы, пересоздаём профиль
  }

  // ИСПРАВЛЕНО (P2): Проверяем changedAnswers на критические коды
  const hasCriticalChanges = CRITICAL_QUESTION_CODES.some(field => field in changedAnswers);
  
  if (hasCriticalChanges) {
    return true; // Критические изменения требуют полного пересоздания
  }

  // ИСПРАВЛЕНО: Если меняется только безопасная тема, можно обновить частично
  return false;
}

