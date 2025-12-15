// lib/unified-product-filter.ts
// ИСПРАВЛЕНО: Единый фильтр продуктов для всех сценариев
// Правила только говорят ЧТО нужно, фильтр решает МОЖНО ЛИ использовать продукт

import type { ProductWithBrand } from './product-fallback';
import type { StepCategory } from './step-category-rules';
import type { ProfileClassification } from './plan-generation-helpers';
import type { DermatologyProtocol } from './dermatology-protocols';
import {
  filterByProtocol,
  checkCompatibilityWithSelected,
  checkForDuplication,
  checkTitrationSchedule,
  type ProductSelectionContext,
  type ProductSelectionResult,
} from './dermatology-product-filter';
import { logger } from './logger';

export type FilterStrictness = 'hard' | 'soft';

export interface ProductFilterContext {
  profileClassification: ProfileClassification;
  protocol?: DermatologyProtocol;
  stepCategory?: StepCategory;
  timeOfDay?: 'morning' | 'evening';
  day?: number;
  week?: number;
  alreadySelected?: ProductWithBrand[];
  strictness?: FilterStrictness;
}

/**
 * Единый фильтр продуктов
 * ИСПРАВЛЕНО: Объединяет всю логику фильтрации из разных мест
 * Правила только говорят ЧТО нужно, фильтр решает МОЖНО ЛИ использовать продукт
 */
export function filterProducts(
  products: ProductWithBrand[],
  context: ProductFilterContext
): ProductSelectionResult[] {
  const {
    profileClassification,
    protocol,
    stepCategory,
    timeOfDay = 'morning',
    day = 1,
    week = 1,
    alreadySelected = [],
    strictness = 'soft',
  } = context;

  if (!products || products.length === 0) {
    return [];
  }

  // ИСПРАВЛЕНО: Базовые проверки (skinType, budget, exclude ingredients)
  let filtered = products.filter(product => {
    // 1. Проверка типа кожи
    const productSkinTypes = (product.skinTypes || []) as string[];
    if (productSkinTypes.length > 0) {
      const normalizedSkinType = profileClassification.skinType || 'normal';
      const matchesSkinType = productSkinTypes.includes(normalizedSkinType) ||
        (normalizedSkinType === 'combo' && (productSkinTypes.includes('combination_dry') || productSkinTypes.includes('combination_oily'))) ||
        (normalizedSkinType === 'combination_dry' && productSkinTypes.includes('dry')) ||
        (normalizedSkinType === 'combination_oily' && productSkinTypes.includes('oily'));
      
      if (!matchesSkinType && strictness === 'hard') {
        return false;
      }
    }

    // 2. Проверка бюджета
    if (profileClassification.budget && profileClassification.budget !== 'любой') {
      const budgetMapping: Record<string, string> = {
        'бюджетный': 'mass',
        'средний': 'mid',
        'премиум': 'premium',
      };
      const expectedPriceSegment = budgetMapping[profileClassification.budget];
      const productPriceSegment = (product as any).priceSegment;
      
      if (expectedPriceSegment && productPriceSegment && productPriceSegment !== expectedPriceSegment) {
        if (strictness === 'hard') {
          return false;
        }
      }
    }

    // 3. Проверка исключенных ингредиентов
    if (profileClassification.exclude && profileClassification.exclude.length > 0) {
      const productIngredients = (product.activeIngredients || []).map(ing => ing.toLowerCase());
      const hasExcluded = profileClassification.exclude.some(excluded => 
        productIngredients.some(ing => ing.includes(excluded.toLowerCase()))
      );
      
      if (hasExcluded && strictness === 'hard') {
        return false;
      }
    }

    // 4. Проверка противопоказаний (беременность)
    if (profileClassification.pregnant) {
      const avoidIf = (product as any).avoidIf || [];
      if (avoidIf.includes('pregnant') || avoidIf.includes('breastfeeding')) {
        if (strictness === 'hard') {
          return false;
        }
      }
    }

    return true;
  });

  // ИСПРАВЛЕНО: Дерматологическая логика (если протокол указан)
  if (protocol) {
    const selectionContext: ProductSelectionContext = {
      timeOfDay,
      day,
      week,
      alreadySelected,
      protocol,
      profileClassification,
    };

    const dermatologyResults = filterByProtocol(filtered, protocol, selectionContext);
    filtered = dermatologyResults
      .filter(r => r.allowed)
      .map(r => r.product);

    // Проверка совместимости с уже выбранными
    const compatibilityResults = filtered.map(product => 
      checkCompatibilityWithSelected(product, selectionContext)
    );
    filtered = compatibilityResults
      .filter(r => r.allowed)
      .map(r => r.product);

    // Проверка дублирования
    const duplicationResults = checkForDuplication(filtered, selectionContext);
    filtered = duplicationResults
      .filter(r => r.allowed)
      .map(r => r.product);

    // Проверка расписания (titration)
    const titrationResults = filtered.map(product => 
      checkTitrationSchedule(product, selectionContext)
    );
    filtered = titrationResults
      .filter(r => r.allowed)
      .map(r => r.product);
  }

  // ИСПРАВЛЕНО: Преобразуем обратно в ProductSelectionResult
  return filtered.map(product => ({
    product,
    allowed: true,
  }));
}

/**
 * Фильтрует продукты по базовым критериям (без дерматологической логики)
 * ИСПРАВЛЕНО: Используется для быстрой фильтрации в правилах
 */
export function filterProductsBasic(
  products: ProductWithBrand[],
  profileClassification: ProfileClassification,
  strictness: FilterStrictness = 'soft'
): ProductWithBrand[] {
  const results = filterProducts(products, {
    profileClassification,
    strictness,
  });

  return results
    .filter(r => r.allowed)
    .map(r => r.product);
}

