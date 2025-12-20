// lib/concern-taxonomy.ts
// ИСПРАВЛЕНО: Единая таксономия concerns для primaryFocus и product.concerns
// Обеспечивает согласованность между определением primaryFocus и фильтрацией продуктов

/**
 * Канонические concern ключи
 * ИСПРАВЛЕНО: Единая таксономия для primaryFocus и product.concerns
 */
export type ConcernKey = 
  | 'acne'
  | 'pores'
  | 'pigmentation'
  | 'wrinkles'
  | 'barrier'
  | 'dehydration'
  | 'dryness'
  | 'oiliness'
  | 'sensitivity'
  | 'redness'
  | 'rosacea';

/**
 * PrimaryFocus значения
 * ИСПРАВЛЕНО: Маппинг primaryFocus к concern ключам
 */
export type PrimaryFocus = 
  | 'acne'
  | 'pores'
  | 'pigmentation'
  | 'wrinkles'
  | 'barrier'
  | 'dehydration'
  | 'dryness'
  | 'general';

/**
 * GoalKey - канонические ключи для mainGoals
 * ИСПРАВЛЕНО: Union тип вместо string для типобезопасности
 */
export type GoalKey = 
  | 'acne'
  | 'pores'
  | 'pigmentation'
  | 'barrier'
  | 'dehydration'
  | 'wrinkles'
  | 'antiage'
  | 'general'
  | 'dark_circles';

/**
 * Маппинг primaryFocus к concern ключам
 * ИСПРАВЛЕНО: Обеспечивает согласованность между primaryFocus и product.concerns
 */
export const PRIMARY_FOCUS_TO_CONCERNS: Record<PrimaryFocus, ConcernKey[]> = {
  acne: ['acne'],
  pores: ['pores', 'oiliness'],
  pigmentation: ['pigmentation'],
  wrinkles: ['wrinkles'],
  barrier: ['barrier', 'sensitivity'],
  dehydration: ['dehydration', 'dryness'],
  dryness: ['dryness', 'barrier'],
  general: [], // general не маппится на конкретные concerns
};

/**
 * Маппинг concern ключей к primaryFocus
 * ИСПРАВЛЕНО: Обратный маппинг для нормализации
 */
export const CONCERN_TO_PRIMARY_FOCUS: Record<ConcernKey, PrimaryFocus> = {
  acne: 'acne',
  pores: 'pores',
  pigmentation: 'pigmentation',
  wrinkles: 'wrinkles',
  barrier: 'barrier',
  dehydration: 'dehydration',
  dryness: 'dryness',
  oiliness: 'pores', // oiliness маппится в pores
  sensitivity: 'barrier', // sensitivity маппится в barrier
  redness: 'barrier', // redness маппится в barrier
  rosacea: 'barrier', // rosacea маппится в barrier
};

/**
 * Нормализует primaryFocus к каноническому значению
 * ИСПРАВЛЕНО: Использует единую таксономию
 */
export function normalizePrimaryFocus(
  focus: string | null | undefined,
  concerns?: string[]
): PrimaryFocus {
  if (!focus) {
    // Если focus не указан, пытаемся определить из concerns
    if (concerns && concerns.length > 0) {
      for (const concern of concerns) {
        const normalizedConcern = concern.toLowerCase().trim() as ConcernKey;
        if (CONCERN_TO_PRIMARY_FOCUS[normalizedConcern]) {
          return CONCERN_TO_PRIMARY_FOCUS[normalizedConcern];
        }
      }
    }
    return 'general';
  }

  const normalizedFocus = focus.toLowerCase().trim() as PrimaryFocus;
  
  // Проверяем, является ли это валидным primaryFocus
  if (PRIMARY_FOCUS_TO_CONCERNS[normalizedFocus]) {
    return normalizedFocus;
  }

  // Пробуем маппинг через concerns
  if (concerns && concerns.length > 0) {
    for (const concern of concerns) {
      const normalizedConcern = concern.toLowerCase().trim() as ConcernKey;
      if (CONCERN_TO_PRIMARY_FOCUS[normalizedConcern]) {
        return CONCERN_TO_PRIMARY_FOCUS[normalizedConcern];
      }
    }
  }

  return 'general';
}

/**
 * Нормализует concern строки к каноническим ключам
 * ИСПРАВЛЕНО: Использует единую таксономию
 */
export function normalizeConcernKey(concern: string): ConcernKey | null {
  if (!concern) return null;

  const normalized = concern.toLowerCase().trim();
  
  // Прямые соответствия
  const concernMap: Record<string, ConcernKey> = {
    'acne': 'acne',
    'акне': 'acne',
    'pores': 'pores',
    'поры': 'pores',
    'расширенные поры': 'pores',
    'pigmentation': 'pigmentation',
    'пигментация': 'pigmentation',
    'wrinkles': 'wrinkles',
    'морщины': 'wrinkles',
    'barrier': 'barrier',
    'барьер': 'barrier',
    'dehydration': 'dehydration',
    'обезвоженность': 'dehydration',
    'dryness': 'dryness',
    'сухость': 'dryness',
    'oiliness': 'oiliness',
    'жирность': 'oiliness',
    'sensitivity': 'sensitivity',
    'чувствительность': 'sensitivity',
    'redness': 'redness',
    'покраснения': 'redness',
    'rosacea': 'rosacea',
    'розацеа': 'rosacea',
  };

  return concernMap[normalized] || null;
}

/**
 * Нормализует массив concerns к каноническим ключам
 * ИСПРАВЛЕНО: Использует единую таксономию
 */
export function normalizeConcerns(concerns: string[] | string | null | undefined): ConcernKey[] {
  if (!concerns) return [];
  
  const concernsArray = Array.isArray(concerns) ? concerns : [concerns];
  const normalized: ConcernKey[] = [];
  
  for (const concern of concernsArray) {
    const normalizedKey = normalizeConcernKey(concern);
    if (normalizedKey && !normalized.includes(normalizedKey)) {
      normalized.push(normalizedKey);
    }
  }
  
  return normalized;
}

/**
 * Получает concerns для primaryFocus
 * ИСПРАВЛЕНО: Использует единую таксономию
 */
export function getConcernsForPrimaryFocus(focus: PrimaryFocus): ConcernKey[] {
  return PRIMARY_FOCUS_TO_CONCERNS[focus] || [];
}

/**
 * Проверяет, соответствует ли product.concerns primaryFocus
 * ИСПРАВЛЕНО: Использует единую таксономию для согласованной фильтрации
 */
export function productConcernsMatchPrimaryFocus(
  productConcerns: string[] | null | undefined,
  primaryFocus: PrimaryFocus
): boolean {
  if (!productConcerns || productConcerns.length === 0) {
    // Если у продукта нет concerns, он подходит для general
    return primaryFocus === 'general';
  }

  const normalizedProductConcerns = normalizeConcerns(productConcerns);
  const focusConcerns = getConcernsForPrimaryFocus(primaryFocus);

  // Если primaryFocus = 'general', продукт подходит всегда
  if (primaryFocus === 'general') {
    return true;
  }

  // Проверяем пересечение concerns
  return focusConcerns.some(focusConcern => 
    normalizedProductConcerns.includes(focusConcern)
  );
}

