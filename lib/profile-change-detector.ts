// lib/profile-change-detector.ts
// ИСПРАВЛЕНО: Детектор критических изменений профиля для определения необходимости rebuild плана

import type { SkinProfile } from './skinprofile-types';

/**
 * Критические поля, изменение которых требует пересборки плана
 * ИСПРАВЛЕНО: Не только topicId, но и критические изменения профиля
 */
const CRITICAL_FIELDS = [
  'skinType',
  'sensitivity',
  'mainGoals',
  'diagnoses',
  'pregnancyStatus',
  'contraindications',
  'currentTopicals',
  'currentOralMeds',
] as const;

/**
 * Проверяет, изменились ли критические поля профиля
 * ИСПРАВЛЕНО: Определяет необходимость rebuild плана на основе изменений профиля
 */
export function profileChangedCritically(
  currentProfile: Partial<SkinProfile> | null,
  newProfile: Partial<SkinProfile>
): boolean {
  if (!currentProfile) {
    // Если профиля не было, это критическое изменение
    return true;
  }

  // Проверяем каждое критическое поле
  for (const field of CRITICAL_FIELDS) {
    const currentValue = currentProfile[field];
    const newValue = newProfile[field];

    // Для массивов сравниваем содержимое
    if (Array.isArray(currentValue) && Array.isArray(newValue)) {
      if (currentValue.length !== newValue.length) {
        return true;
      }
      // Проверяем, что все элементы совпадают
      const currentSet = new Set(currentValue);
      const newSet = new Set(newValue);
      if (currentSet.size !== newSet.size) {
        return true;
      }
      for (const item of currentSet) {
        if (!newSet.has(item)) {
          return true;
        }
      }
    } else if (currentValue !== newValue) {
      // Для примитивных значений простое сравнение
      return true;
    }
  }

  return false;
}

/**
 * Определяет причину необходимости rebuild плана
 */
export type RebuildReason =
  | 'TOPIC_REQUIRES_PLAN'
  | 'CRITICAL_CHANGE'
  | 'PROFILE_CREATED'
  | 'NONE';

/**
 * Поля, изменение которых требует safetyLock (блокировка старого плана)
 * ИСПРАВЛЕНО: Безопасность превыше всего - если меняются противопоказания, старый план опасен
 */
const SAFETY_CRITICAL_FIELDS = [
  'pregnancyStatus',
  'diagnoses',
  'contraindications',
  'currentTopicals',
  'currentOralMeds',
  'sensitivity', // Резкий скачок чувствительности может сделать старый план опасным
] as const;

/**
 * Проверяет, нужно ли блокировать старый план (safetyLock)
 * ИСПРАВЛЕНО: Определяет, безопасен ли старый план после изменений
 */
export function requiresSafetyLock(
  currentProfile: Partial<SkinProfile> | null,
  newProfile: Partial<SkinProfile>
): boolean {
  if (!currentProfile) {
    // Новый профиль - безопасно показывать старый план не нужно
    return false;
  }

  // Проверяем каждое критическое для безопасности поле
  for (const field of SAFETY_CRITICAL_FIELDS) {
    const currentValue = currentProfile[field];
    const newValue = newProfile[field];

    // Для массивов сравниваем содержимое
    if (Array.isArray(currentValue) && Array.isArray(newValue)) {
      if (currentValue.length !== newValue.length) {
        return true; // Изменилось количество противопоказаний/диагнозов
      }
      // Проверяем, что все элементы совпадают
      const currentSet = new Set(currentValue);
      const newSet = new Set(newValue);
      if (currentSet.size !== newSet.size) {
        return true;
      }
      for (const item of currentSet) {
        if (!newSet.has(item)) {
          return true; // Появилось/исчезло противопоказание/диагноз
        }
      }
    } else if (currentValue !== newValue) {
      // Для примитивных значений простое сравнение
      // Особенно важно для pregnancyStatus и sensitivity
      return true;
    }
  }

  return false;
}

/**
 * Определяет, нужно ли пересобирать план, и возвращает причину
 */
export function requiresPlanRebuild(
  topicRequiresRebuild: boolean,
  currentProfile: Partial<SkinProfile> | null,
  newProfile: Partial<SkinProfile>
): { requires: boolean; reason: RebuildReason } {
  // Если тема требует rebuild
  if (topicRequiresRebuild) {
    return { requires: true, reason: 'TOPIC_REQUIRES_PLAN' };
  }

  // Если профиля не было
  if (!currentProfile) {
    return { requires: true, reason: 'PROFILE_CREATED' };
  }

  // Если изменились критические поля
  if (profileChangedCritically(currentProfile, newProfile)) {
    return { requires: true, reason: 'CRITICAL_CHANGE' };
  }

  return { requires: false, reason: 'NONE' };
}

