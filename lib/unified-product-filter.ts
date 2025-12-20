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
 * ИСПРАВЛЕНО: Фильтрует продукты с полным трейсом причин фильтрации
 * Возвращает ProductSelectionResult[] с reasons для каждого продукта
 * Полезно для дебага, админки и логирования
 */
export function filterProductsWithReasons(
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

  // ИСПРАВЛЕНО: Базовые проверки с сохранением причин
  let results: ProductSelectionResult[] = products.map(product => {
    const reasons: string[] = [];
    let allowed = true;

    // 1. Проверка типа кожи
    const productSkinTypes = (product.skinTypes || []) as string[];
    if (productSkinTypes.length > 0) {
      const normalizedSkinType = profileClassification.skinType || 'normal';
      const matchesSkinType = productSkinTypes.includes(normalizedSkinType) ||
        (normalizedSkinType === 'combo' && (productSkinTypes.includes('combination_dry') || productSkinTypes.includes('combination_oily'))) ||
        (normalizedSkinType === 'combination_dry' && productSkinTypes.includes('dry')) ||
        (normalizedSkinType === 'combination_oily' && productSkinTypes.includes('oily'));
      
      if (!matchesSkinType) {
        if (strictness === 'hard') {
          allowed = false;
          reasons.push(`Тип кожи не подходит: требуется ${normalizedSkinType}, продукт для ${productSkinTypes.join(', ')}`);
        } else {
          reasons.push(`Тип кожи частично не совпадает: ${normalizedSkinType} vs ${productSkinTypes.join(', ')}`);
        }
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
          allowed = false;
          reasons.push(`Бюджет не совпадает: требуется ${expectedPriceSegment}, продукт ${productPriceSegment}`);
        } else {
          reasons.push(`Бюджет частично не совпадает: ${expectedPriceSegment} vs ${productPriceSegment}`);
        }
      }
    }

    // 3. Проверка исключенных ингредиентов
    if (profileClassification.exclude && profileClassification.exclude.length > 0) {
      const productIngredients = (product.activeIngredients || []).map(ing => ing.toLowerCase());
      const excludedFound = profileClassification.exclude.filter(excluded => 
        productIngredients.some(ing => ing.includes(excluded.toLowerCase()))
      );
      
      if (excludedFound.length > 0) {
        if (strictness === 'hard') {
          allowed = false;
          reasons.push(`Содержит исключенные ингредиенты: ${excludedFound.join(', ')}`);
        } else {
          reasons.push(`Содержит частично исключенные ингредиенты: ${excludedFound.join(', ')}`);
        }
      }
    }

    // 4. Проверка противопоказаний (беременность)
    if (profileClassification.pregnant) {
      const avoidIf = (product as any).avoidIf || [];
      if (avoidIf.includes('pregnant') || avoidIf.includes('breastfeeding')) {
        if (strictness === 'hard') {
          allowed = false;
          reasons.push('Противопоказан при беременности/лактации');
        } else {
          reasons.push('Не рекомендуется при беременности/лактации');
        }
      }
    }

    return {
      product,
      allowed,
      reason: reasons.length > 0 ? reasons.join('; ') : undefined,
    };
  });

  // Фильтруем по базовым проверкам
  results = results.filter(r => r.allowed || strictness === 'soft');

  // ИСПРАВЛЕНО: Дерматологическая логика (если протокол указан) с сохранением причин
  if (protocol && results.length > 0) {
    const selectionContext: ProductSelectionContext = {
      timeOfDay,
      day,
      week,
      alreadySelected,
      protocol,
      profileClassification,
    };

    // 1. Фильтрация по протоколу
    const protocolResults = filterByProtocol(
      results.map(r => r.product),
      protocol,
      selectionContext
    );
    results = results.map((result, index) => {
      const protocolResult = protocolResults[index];
      if (!protocolResult.allowed) {
        return {
          ...result,
          allowed: false,
          reason: result.reason 
            ? `${result.reason}; ${protocolResult.reason || 'Не разрешен протоколом'}`
            : protocolResult.reason || 'Не разрешен протоколом',
        };
      }
      return result;
    });
    results = results.filter(r => r.allowed);

    // 2. Проверка совместимости с уже выбранными
    const compatibilityResults = results.map(result => {
      const compatCheck = checkCompatibilityWithSelected(result.product, selectionContext);
      if (!compatCheck.allowed) {
        return {
          ...result,
          allowed: false,
          reason: result.reason 
            ? `${result.reason}; ${compatCheck.reason || 'Несовместим с выбранными продуктами'}`
            : compatCheck.reason || 'Несовместим с выбранными продуктами',
          recommendation: compatCheck.recommendation,
          movedToTime: compatCheck.movedToTime,
        };
      }
      return result;
    });
    results = compatibilityResults.filter(r => r.allowed);

    // 3. Проверка дублирования
    const duplicationResults = checkForDuplication(
      results.map(r => r.product),
      selectionContext
    );
    results = results.map((result, index) => {
      const dupCheck = duplicationResults[index];
      if (!dupCheck.allowed) {
        return {
          ...result,
          allowed: false,
          reason: result.reason 
            ? `${result.reason}; ${dupCheck.reason || 'Дублирует активные ингредиенты'}`
            : dupCheck.reason || 'Дублирует активные ингредиенты',
          recommendation: dupCheck.recommendation,
        };
      }
      return result;
    });
    results = results.filter(r => r.allowed);

    // 4. Проверка расписания (titration)
    const titrationResults = results.map(result => {
      const titrationCheck = checkTitrationSchedule(result.product, selectionContext);
      if (!titrationCheck.allowed) {
        return {
          ...result,
          allowed: false,
          reason: result.reason 
            ? `${result.reason}; ${titrationCheck.reason || 'Не соответствует расписанию применения'}`
            : titrationCheck.reason || 'Не соответствует расписанию применения',
          recommendation: titrationCheck.recommendation,
        };
      }
      return result;
    });
    results = titrationResults;
  }

  return results;
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

