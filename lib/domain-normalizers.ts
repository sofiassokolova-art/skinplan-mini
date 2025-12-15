// lib/domain-normalizers.ts
// ИСПРАВЛЕНО: Domain normalizers для бизнес-логики
// Эти функции нормализуют значения для использования в правилах, фильтрах, планах
// НЕ для отображения - используйте ui-formatters для UI

import { normalizeSkinTypeForRules, normalizeSensitivityForRules } from './skin-type-normalizer';

/**
 * Нормализует тип кожи для использования в бизнес-логике (правила, фильтры, планы)
 * ИСПРАВЛЕНО: Возвращает канонический тип кожи (dry, oily, combination_dry, combination_oily, normal)
 * НЕ для отображения - используйте formatSkinTypeLabel для UI
 */
export function normalizeSkinType(
  skinType: string | null | undefined,
  context?: {
    oiliness?: number;
    dehydration?: number;
    userId?: string;
  }
): "dry" | "combination_dry" | "normal" | "combination_oily" | "oily" | null {
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
 * Нормализует concerns для использования в бизнес-логике
 * ИСПРАВЛЕНО: Возвращает массив канонических concern ключей
 * НЕ для отображения - используйте formatConcerns для UI
 */
export function normalizeConcerns(
  concerns: string[] | string | null | undefined
): string[] {
  if (!concerns) return [];
  if (typeof concerns === 'string') {
    try {
      const parsed = JSON.parse(concerns);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [concerns];
    }
  }
  if (Array.isArray(concerns)) return concerns;
  return [];
}

