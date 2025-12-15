// lib/retake-scoped-recalculation.ts
// ИСПРАВЛЕНО: Topic-scoped recalculation для retake
// При перепрохождении только одной темы пересчитываются только затронутые оси, остальные наследуются

import type { SkinAxes, SkinProfile } from './skinprofile-types';
import type { SkinScore } from './skin-analysis-engine';
import { calculateSkinAxes, type QuestionnaireAnswers } from './skin-analysis-engine';
import { logger } from './logger';

export type TopicId = string; // ID темы (например, 'acne', 'pigmentation', 'sensitivity')

/**
 * Маппинг тем на затронутые оси
 * ИСПРАВЛЕНО: Определяет, какие оси нужно пересчитать при изменении темы
 */
const TOPIC_TO_AXES_MAP: Record<TopicId, Array<SkinScore['axis']>> = {
  'acne': ['inflammation', 'oiliness'], // Акне влияет на воспаление и жирность
  'pigmentation': ['pigmentation', 'photoaging'], // Пигментация влияет на пигментацию и фотостарение
  'sensitivity': ['barrier', 'inflammation'], // Чувствительность влияет на барьер и воспаление
  'hydration': ['hydration', 'barrier'], // Увлажнение влияет на гидратацию и барьер
  'wrinkles': ['photoaging'], // Морщины влияют на фотостарение
  'redness': ['inflammation', 'barrier'], // Покраснения влияют на воспаление и барьер
  'pores': ['oiliness'], // Поры влияют на жирность
  'texture': ['barrier', 'hydration'], // Текстура влияет на барьер и гидратацию
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
 * ИСПРАВЛЕНО: Наследует незатронутые оси из предыдущего профиля
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
  
  // ИСПРАВЛЕНО: Создаем мапу новых осей для быстрого доступа
  const newAxesMap = new Map(allNewAxes.map(axis => [axis.axis, axis]));
  
  // ИСПРАВЛЕНО: Создаем мапу старых осей для наследования
  const previousAxesMap = new Map(previousAxes.map(axis => [axis.axis, axis]));
  
  // ИСПРАВЛЕНО: Объединяем: затронутые оси из новых ответов, остальные из предыдущих
  const result: SkinAxes = [];
  
  // Все возможные оси
  const allAxes: Array<SkinScore['axis']> = ['oiliness', 'hydration', 'barrier', 'inflammation', 'pigmentation', 'photoaging'];
  
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
    recalculatedAxes: result.filter(a => affectedAxes.includes(a.axis)).map(a => a.axis),
    inheritedAxes: result.filter(a => !affectedAxes.includes(a.axis)).map(a => a.axis),
  });

  return result;
}

/**
 * Определяет, нужно ли пересоздавать профиль при retake темы
 * ИСПРАВЛЕНО: Если меняются только затронутые оси, можно обновить профиль частично
 */
export function shouldRecreateProfileForTopic(
  topicId: TopicId,
  changedAnswers: Record<string, any>
): boolean {
  // ИСПРАВЛЕНО: Если меняются критические поля (skinType, age, gender), нужно пересоздать профиль
  const criticalFields = ['skin_type', 'age', 'gender', 'pregnancy_breastfeeding'];
  const hasCriticalChanges = criticalFields.some(field => field in changedAnswers);
  
  if (hasCriticalChanges) {
    return true; // Критические изменения требуют полного пересоздания
  }

  // ИСПРАВЛЕНО: Если меняется только тема, можно обновить частично
  return false;
}

