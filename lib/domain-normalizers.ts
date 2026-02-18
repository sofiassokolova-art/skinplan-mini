// lib/domain-normalizers.ts
// ИСПРАВЛЕНО: Обязательный normalization layer после анкеты
// Все значения из анкеты/БД/API должны проходить через эти нормализаторы
// Возвращают канонические типы (ConcernKey, SkinTypeKey, IngredientKey) вместо string

import { normalizeSkinTypeForRules, normalizeSensitivityForRules, type SkinTypeKey } from './skin-type-normalizer';
import { normalizeConcernKey, normalizeConcerns as normalizeConcernsArray, type ConcernKey } from './concern-taxonomy';
import { normalizeIngredientName, type IngredientKey } from './ingredient-normalizer';

/**
 * ИСПРАВЛЕНО: Нормализует тип кожи для использования в бизнес-логике
 * Возвращает канонический SkinTypeKey вместо string
 * ОБЯЗАТЕЛЬНО использовать после получения данных из анкеты/БД/API
 */
export function normalizeSkinType(
  skinType: string | null | undefined,
  context?: {
    oiliness?: number;
    dehydration?: number;
    userId?: string;
  }
): SkinTypeKey | null {
  return normalizeSkinTypeForRules(skinType, context);
}

/**
 * Нормализует уровень чувствительности для использования в бизнес-логике
 * ИСПРАВЛЕНО: Возвращает канонический уровень (low, medium, high, very_high)
 * НЕ для отображения - используйте formatSensitivityLabel для UI
 */
export function normalizeSensitivity(
  sensitivity: string | null | undefined
): "low" | "medium" | "high" | "very_high" | null {
  return normalizeSensitivityForRules(sensitivity);
}

/**
 * Нормализует возрастную группу для использования в бизнес-логике
 * ИСПРАВЛЕНО: Возвращает канонический формат (18_24, 25_34, 35_44, 45plus)
 * НЕ для отображения - используйте formatAgeGroupLabel для UI
 */
export function normalizeAgeGroup(
  age: string | number | null | undefined
): "u18" | "18_24" | "25_34" | "35_44" | "45plus" | null {
  if (!age) return null;
  
  // Если это уже строка в каноническом формате
  if (typeof age === 'string') {
    const normalized = age.toLowerCase().trim();
    if (['u18', '18_24', '25_34', '35_44', '45plus'].includes(normalized)) {
      return normalized as "u18" | "18_24" | "25_34" | "35_44" | "45plus";
    }
    // Пробуем распарсить диапазон (например, "26_30" -> "25_34")
    if (normalized.includes('_')) {
      const parts = normalized.split('_');
      const min = parseInt(parts[0] || '0');
      if (min < 18) return 'u18';
      if (min < 25) return '18_24';
      if (min < 35) return '25_34';
      if (min < 45) return '35_44';
      return '45plus';
    }
  }
  
  // Если это число
  if (typeof age === 'number') {
    if (age < 18) return 'u18';
    if (age < 25) return '18_24';
    if (age < 35) return '25_34';
    if (age < 45) return '35_44';
    return '45plus';
  }
  
  return null;
}

/**
 * ИСПРАВЛЕНО: Нормализует concerns для использования в бизнес-логике
 * Возвращает массив канонических ConcernKey вместо string[]
 * ОБЯЗАТЕЛЬНО использовать после получения данных из анкеты/БД/API
 */
export function normalizeConcerns(
  concerns: string[] | string | null | undefined
): ConcernKey[] {
  return normalizeConcernsArray(concerns);
}

/**
 * ИСПРАВЛЕНО: Нормализует один concern к каноническому ключу
 * Возвращает ConcernKey | null вместо string | null
 */
export function normalizeConcern(
  concern: string | null | undefined
): ConcernKey | null {
  if (!concern) return null;
  return normalizeConcernKey(concern);
}

/**
 * ИСПРАВЛЕНО: Нормализует ингредиент к каноническому ключу
 * Возвращает IngredientKey | null вместо string | null
 * ОБЯЗАТЕЛЬНО использовать после получения данных из анкеты/БД/API
 */
export function normalizeIngredient(
  ingredient: string | null | undefined
): IngredientKey | null {
  return normalizeIngredientName(ingredient);
}

/**
 * ИСПРАВЛЕНО: Нормализует массив ингредиентов к каноническим ключам
 * Возвращает IngredientKey[] вместо string[]
 */
export function normalizeIngredients(
  ingredients: string[] | string | null | undefined
): IngredientKey[] {
  if (!ingredients) return [];
  const ingredientsArray = Array.isArray(ingredients) ? ingredients : [ingredients];
  const normalized: IngredientKey[] = [];
  
  for (const ing of ingredientsArray) {
    const normalizedKey = normalizeIngredientName(ing);
    if (normalizedKey && !normalized.includes(normalizedKey)) {
      normalized.push(normalizedKey);
    }
  }
  
  return normalized;
}

