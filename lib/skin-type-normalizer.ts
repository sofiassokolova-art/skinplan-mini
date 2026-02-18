// lib/skin-type-normalizer.ts
// ИСПРАВЛЕНО: Единая точка нормализации типов кожи
// Все значения типа кожи должны проходить через этот нормализатор

import { logger } from './logger';

/**
 * ИСПРАВЛЕНО: Канонический тип кожи - единый источник правды
 * Используется везде вместо string для типобезопасности
 */
export type SkinTypeKey = 
  | 'dry'
  | 'combination_dry'
  | 'normal'
  | 'combination_oily'
  | 'oily';

/**
 * Нормализует тип кожи из БД в формат, используемый в правилах
 * 
 * В БД используется: "combo", "dry", "oily", "normal", "sensitive"
 * В правилах используется: "combination_dry", "combination_oily", "dry", "oily", "normal"
 * 
 * @param skinType - Тип кожи из БД
 * @param context - Контекст для определения направления нормализации (для "combo")
 * @returns Нормализованный тип кожи для правил
 */
/**
 * ИСПРАВЛЕНО: Единая точка нормализации типа кожи
 * Все значения должны проходить через эту функцию перед использованием в бизнес-логике
 */
export function normalizeSkinTypeForRules(
  skinType: string | null | undefined,
  context?: {
    oiliness?: number;
    dehydration?: number;
    userId?: string;
  }
): SkinTypeKey | null {
  if (!skinType) return null;

  // ИСПРАВЛЕНО: Преобразуем в строку для проверки
  // Используем явное приведение типа для обхода проверки TypeScript
  const skinTypeStr = String(skinType);
  const skinTypeLower = skinTypeStr.toLowerCase();
  
  // Нормализация "combo" в "combination_dry" или "combination_oily"
  // ИСПРАВЛЕНО: Используем type assertion для обхода проверки TypeScript
  // TypeScript не знает о "combo" в типе параметра, но это валидное значение из БД
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skinTypeAny = skinType as any;
  if (skinTypeLower === 'combo' || skinTypeStr === 'combo' || skinTypeAny === 'combo') {
    // Если есть контекст с oiliness/dehydration, используем его для определения направления
    if (context && (context.oiliness !== undefined || context.dehydration !== undefined)) {
      const { oiliness = 0, dehydration = 0, userId } = context;
      // Если больше жирности - combination_oily, если больше сухости - combination_dry
      if (oiliness > dehydration) {
        if (userId) {
          logger.info('Normalized "combo" to "combination_oily" based on context', {
            oiliness,
            dehydration,
            userId,
          });
        }
        return 'combination_oily';
      } else {
        if (userId) {
          logger.info('Normalized "combo" to "combination_dry" based on context', {
            oiliness,
            dehydration,
            userId,
          });
        }
        return 'combination_dry';
      }
    }
    // По умолчанию используем "combination_oily" (более распространенный вариант)
    if (context?.userId) {
      logger.info('Normalized "combo" to "combination_oily" (default)', {
        userId: context.userId,
      });
    }
    return 'combination_oily';
  }

  // Нормализация "sensitive" (если используется как тип кожи)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (skinTypeLower === 'sensitive' || skinTypeStr === 'sensitive' || (skinType as any) === 'sensitive') {
    // "sensitive" обычно означает сухую чувствительную кожу
    if (context?.userId) {
      logger.info('Normalized "sensitive" to "dry"', {
        userId: context.userId,
      });
    }
    return 'dry';
  }

  // Прямые соответствия (после нормализации "combo" и "sensitive")
  if (skinTypeStr === 'dry') return 'dry';
  if (skinTypeStr === 'oily') return 'oily';
  if (skinTypeStr === 'normal') return 'normal';
  if (skinTypeStr === 'combination_dry') return 'combination_dry';
  if (skinTypeStr === 'combination_oily') return 'combination_oily';

  // Если тип не распознан, логируем предупреждение и возвращаем "normal" как fallback
  if (context?.userId) {
    logger.warn('Unknown skin type, using "normal" as fallback', {
      skinType: skinTypeStr,
      userId: context.userId,
    });
  }
  return 'normal';
}

/**
 * Нормализует уровень чувствительности из БД в формат, используемый в правилах
 * 
 * В БД используется: "low", "medium", "high"
 * В правилах (avoidIfContra): "very_high_sensitivity"
 * В SkinProfile типе: "low" | "medium" | "high" | "very_high"
 * 
 * @param sensitivityLevel - Уровень чувствительности из БД
 * @returns Нормализованный уровень чувствительности
 */
export function normalizeSensitivityForRules(
  sensitivityLevel: string | null | undefined
): "low" | "medium" | "high" | "very_high" | null {
  if (!sensitivityLevel) return null;

  // Прямые соответствия
  if (sensitivityLevel === 'low') return 'low';
  if (sensitivityLevel === 'medium') return 'medium';
  if (sensitivityLevel === 'high') return 'high';
  if (sensitivityLevel === 'very_high') return 'very_high';

  // Если значение не распознано, возвращаем null
  logger.warn('Unknown sensitivity level', { sensitivityLevel });
  return null;
}

/**
 * Проверяет, соответствует ли уровень чувствительности противопоказанию в правилах
 * 
 * @param sensitivityLevel - Уровень чувствительности из БД
 * @param contraindication - Противопоказание из правил (например, "very_high_sensitivity")
 * @returns true, если уровень чувствительности соответствует противопоказанию
 */
export function matchesSensitivityContraindication(
  sensitivityLevel: string | null | undefined,
  contraindication: string
): boolean {
  if (!sensitivityLevel) return false;

  // Проверяем "very_high_sensitivity"
  if (contraindication === 'very_high_sensitivity') {
    const normalized = normalizeSensitivityForRules(sensitivityLevel);
    return normalized === 'very_high';
  }

  // Можно добавить другие проверки при необходимости
  return false;
}

/**
 * Нормализует тип кожи для сохранения в БД
 * 
 * Преобразует значения из правил в формат БД
 * 
 * @param skinType - Тип кожи из правил
 * @returns Тип кожи для БД
 */
export function normalizeSkinTypeForDb(
  skinType: string | null | undefined
): string | null {
  if (!skinType) return null;

  // Прямые соответствия
  if (skinType === 'dry') return 'dry';
  if (skinType === 'oily') return 'oily';
  if (skinType === 'normal') return 'normal';
  if (skinType === 'combo') return 'combo';

  // Преобразуем "combination_dry" и "combination_oily" в "combo" для БД
  if (skinType === 'combination_dry' || skinType === 'combination_oily') {
    return 'combo';
  }

  return skinType;
}
