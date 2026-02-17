// lib/unified-product-filter.ts
// ИСПРАВЛЕНО: Единый фильтр продуктов для всех сценариев
// Правила только говорят ЧТО нужно, фильтр решает МОЖНО ЛИ использовать продукт

import type { ProductWithBrand } from './product-fallback';
import type { StepCategory } from './step-category-rules';
import type { ProfileClassification } from './plan-generation-helpers';
import type { DermatologyProtocol } from './dermatology-protocols';
import { determineProtocol } from './dermatology-protocols';
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
export async function filterProducts(
  products: ProductWithBrand[],
  context: ProductFilterContext
): Promise<ProductSelectionResult[]> {
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

  // ИСПРАВЛЕНО: Импортируем функцию нормализации чувствительности заранее (синхронно)
  const { normalizeSensitivityForRules } = await import('./skin-type-normalizer');
  
  // ИСПРАВЛЕНО: Базовые проверки (skinType, budget, exclude ingredients, противопоказания)
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

    // 4. Проверка противопоказаний из avoidIf
    const avoidIf = (product as any).avoidIf || [];
    if (Array.isArray(avoidIf) && avoidIf.length > 0) {
      // 4.1. Проверка беременности/лактации
      if (profileClassification.pregnant) {
        if (avoidIf.includes('pregnant') || avoidIf.includes('breastfeeding')) {
          if (strictness === 'hard') {
            return false;
          }
        }
      }
      
      // 4.2. Проверка чувствительности
      // ИСПРАВЛЕНО: Проверяем very_high_sensitivity из avoidIf
      if (avoidIf.includes('very_high_sensitivity')) {
        const normalizedSensitivity = normalizeSensitivityForRules(profileClassification.sensitivityLevel);
        if (normalizedSensitivity === 'very_high') {
          if (strictness === 'hard') {
            return false;
          }
        }
      }
      
      // 4.3. Проверка аллергий
      // ИСПРАВЛЕНО: Проверяем аллергии из avoidIf против аллергий пользователя
      if (profileClassification.allergies && profileClassification.allergies.length > 0) {
        const userAllergies = profileClassification.allergies.map(a => a.toLowerCase());
        const allergyContraindications = avoidIf.filter((contra: string) => 
          contra.includes('_allergy') || contra.includes('allergy')
        );
        
        for (const contra of allergyContraindications) {
          // Проверяем соответствие аллергии (например, retinol_allergy, aha_bha_allergy)
          const contraLower = contra.toLowerCase();
          const hasMatchingAllergy = userAllergies.some(userAllergy => {
            const userAllergyLower = userAllergy.toLowerCase();
            // Проверяем точное совпадение или частичное (например, "retinol" в "retinol_allergy")
            if (contraLower.includes(userAllergyLower) || userAllergyLower.includes(contraLower.replace('_allergy', ''))) {
              return true;
            }
            // Специальные проверки для общих аллергий
            if ((contraLower.includes('aha') || contraLower.includes('bha')) && 
                (userAllergyLower.includes('кислот') || userAllergyLower.includes('acid') || 
                 userAllergyLower.includes('aha') || userAllergyLower.includes('bha'))) {
              return true;
            }
            if (contraLower.includes('retinol') && 
                (userAllergyLower.includes('ретинол') || userAllergyLower.includes('retinol'))) {
              return true;
            }
            return false;
          });
          
          if (hasMatchingAllergy) {
            if (strictness === 'hard') {
              return false;
            }
          }
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
      stepCategory, // ИСПРАВЛЕНО (P1): Передаем stepCategory для точного определения типа шага
    };

    const dermatologyResults = filterByProtocol(filtered, protocol, selectionContext);
    // ИСПРАВЛЕНО (P0): Проверка контракта - массив должен быть той же длины
    if (process.env.NODE_ENV !== 'production' && dermatologyResults.length !== filtered.length) {
      logger.error('filterByProtocol contract violated', {
        inputLength: filtered.length,
        outputLength: dermatologyResults.length,
        stepCategory,
      });
    }
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
    // ИСПРАВЛЕНО (P0): Проверка контракта - массив должен быть той же длины
    if (process.env.NODE_ENV !== 'production' && duplicationResults.length !== filtered.length) {
      logger.error('checkForDuplication contract violated', {
        inputLength: filtered.length,
        outputLength: duplicationResults.length,
        stepCategory,
      });
    }
    filtered = duplicationResults
      .filter(r => r.allowed)
      .map(r => r.product);

    // Проверка расписания (titration)
    const titrationResults = filtered.map(product => 
      checkTitrationSchedule(product, selectionContext)
    );
    // ИСПРАВЛЕНО (P0): Проверка контракта - массив должен быть той же длины
    if (process.env.NODE_ENV !== 'production' && titrationResults.length !== filtered.length) {
      logger.error('checkTitrationSchedule contract violated', {
        inputLength: filtered.length,
        outputLength: titrationResults.length,
        stepCategory,
      });
    }
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
export async function filterProductsWithReasons(
  products: ProductWithBrand[],
  context: ProductFilterContext
): Promise<ProductSelectionResult[]> {
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

  // ИСПРАВЛЕНО: Импортируем функцию нормализации чувствительности заранее (синхронно)
  const { normalizeSensitivityForRules } = await import('./skin-type-normalizer');

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

    // 4. Проверка противопоказаний из avoidIf
    const avoidIf = (product as any).avoidIf || [];
    if (Array.isArray(avoidIf) && avoidIf.length > 0) {
      // 4.1. Проверка беременности/лактации
      if (profileClassification.pregnant) {
        if (avoidIf.includes('pregnant') || avoidIf.includes('breastfeeding')) {
          if (strictness === 'hard') {
            allowed = false;
            reasons.push('Противопоказан при беременности/лактации');
          } else {
            reasons.push('Не рекомендуется при беременности/лактации');
          }
        }
      }
      
      // 4.2. Проверка чувствительности
      // ИСПРАВЛЕНО: Проверяем very_high_sensitivity из avoidIf
      if (avoidIf.includes('very_high_sensitivity')) {
        const normalizedSensitivity = normalizeSensitivityForRules(profileClassification.sensitivityLevel);
        if (normalizedSensitivity === 'very_high') {
          if (strictness === 'hard') {
            allowed = false;
            reasons.push('Противопоказан при очень высокой чувствительности');
          } else {
            reasons.push('Не рекомендуется при очень высокой чувствительности');
          }
        }
      }
      
      // 4.3. Проверка аллергий
      // ИСПРАВЛЕНО: Проверяем аллергии из avoidIf против аллергий пользователя
      if (profileClassification.allergies && profileClassification.allergies.length > 0) {
        const userAllergies = profileClassification.allergies.map(a => a.toLowerCase());
        const allergyContraindications = avoidIf.filter((contra: string) => 
          contra.includes('_allergy') || contra.includes('allergy')
        );
        
        for (const contra of allergyContraindications) {
          const contraLower = contra.toLowerCase();
          const hasMatchingAllergy = userAllergies.some(userAllergy => {
            const userAllergyLower = userAllergy.toLowerCase();
            if (contraLower.includes(userAllergyLower) || userAllergyLower.includes(contraLower.replace('_allergy', ''))) {
              return true;
            }
            if ((contraLower.includes('aha') || contraLower.includes('bha')) && 
                (userAllergyLower.includes('кислот') || userAllergyLower.includes('acid') || 
                 userAllergyLower.includes('aha') || userAllergyLower.includes('bha'))) {
              return true;
            }
            if (contraLower.includes('retinol') && 
                (userAllergyLower.includes('ретинол') || userAllergyLower.includes('retinol'))) {
              return true;
            }
            return false;
          });
          
          if (hasMatchingAllergy) {
            if (strictness === 'hard') {
              allowed = false;
              reasons.push(`Противопоказан из-за аллергии: ${contra}`);
            } else {
              reasons.push(`Не рекомендуется из-за аллергии: ${contra}`);
            }
          }
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
      stepCategory, // ИСПРАВЛЕНО (P1): Передаем stepCategory для точного определения типа шага
    };

    // 1. Фильтрация по протоколу
    const protocolResults = filterByProtocol(
      results.map(r => r.product),
      protocol,
      selectionContext
    );
    // ИСПРАВЛЕНО (P0): Проверка контракта - массив должен быть той же длины
    if (process.env.NODE_ENV !== 'production' && protocolResults.length !== results.length) {
      logger.error('filterByProtocol contract violated in filterProductsWithReasons', {
        inputLength: results.length,
        outputLength: protocolResults.length,
        stepCategory,
      });
    }
    results = results.map((result, index) => {
      const protocolResult = protocolResults[index];
      if (!protocolResult || !protocolResult.allowed) {
        return {
          ...result,
          allowed: strictness === 'soft' ? result.allowed : false, // ИСПРАВЛЕНО (P1): При soft не меняем allowed, только добавляем reason
          reason: result.reason 
            ? `${result.reason}; ${protocolResult?.reason || 'Не разрешен протоколом'}`
            : protocolResult?.reason || 'Не разрешен протоколом',
        };
      }
      // ИСПРАВЛЕНО: Добавляем warning из протокола (soft allowlist)
      return {
        ...result,
        warning: protocolResult.warning || result.warning,
      };
    });
    // ИСПРАВЛЕНО (P1): При soft не фильтруем allowed=false, только помечаем reason
    if (strictness === 'hard') {
      results = results.filter(r => r.allowed);
    }

    // 2. Проверка совместимости с уже выбранными
    const compatibilityResults = results.map(result => {
      const compatCheck = checkCompatibilityWithSelected(result.product, selectionContext);
      if (!compatCheck.allowed) {
        return {
          ...result,
          allowed: strictness === 'soft' ? result.allowed : false, // ИСПРАВЛЕНО (P1): При soft не меняем allowed, только добавляем reason
          reason: result.reason 
            ? `${result.reason}; ${compatCheck.reason || 'Несовместим с выбранными продуктами'}`
            : compatCheck.reason || 'Несовместим с выбранными продуктами',
          recommendation: compatCheck.recommendation,
          movedToTime: compatCheck.movedToTime,
        };
      }
      return result;
    });
    // ИСПРАВЛЕНО (P1): При soft не фильтруем allowed=false, только помечаем reason
    results = strictness === 'hard' ? compatibilityResults.filter(r => r.allowed) : compatibilityResults;

    // 3. Проверка дублирования
    const duplicationResults = checkForDuplication(
      results.map(r => r.product),
      selectionContext
    );
    // ИСПРАВЛЕНО (P0): Проверка контракта - массив должен быть той же длины
    if (process.env.NODE_ENV !== 'production' && duplicationResults.length !== results.length) {
      logger.error('checkForDuplication contract violated in filterProductsWithReasons', {
        inputLength: results.length,
        outputLength: duplicationResults.length,
        stepCategory,
      });
    }
    results = results.map((result, index) => {
      const dupCheck = duplicationResults[index];
      if (!dupCheck || !dupCheck.allowed) {
        return {
          ...result,
          allowed: strictness === 'soft' ? result.allowed : false, // ИСПРАВЛЕНО (P1): При soft не меняем allowed, только добавляем reason
          reason: result.reason 
            ? `${result.reason}; ${dupCheck?.reason || 'Дублирует активные ингредиенты'}`
            : dupCheck?.reason || 'Дублирует активные ингредиенты',
          recommendation: dupCheck?.recommendation,
        };
      }
      return result;
    });
    // ИСПРАВЛЕНО (P1): При soft не фильтруем allowed=false, только помечаем reason
    if (strictness === 'hard') {
      results = results.filter(r => r.allowed);
    }

    // 4. Проверка расписания (titration)
    const titrationResults = results.map(result => {
      const titrationCheck = checkTitrationSchedule(result.product, selectionContext);
      if (!titrationCheck.allowed) {
        return {
          ...result,
          allowed: strictness === 'soft' ? result.allowed : false, // ИСПРАВЛЕНО (P1): При soft не меняем allowed, только добавляем reason
          reason: result.reason 
            ? `${result.reason}; ${titrationCheck.reason || 'Не соответствует расписанию применения'}`
            : titrationCheck.reason || 'Не соответствует расписанию применения',
          recommendation: titrationCheck.recommendation,
        };
      }
      return result;
    });
    // ИСПРАВЛЕНО (P1): При soft не фильтруем allowed=false, только помечаем reason
    results = strictness === 'hard' ? titrationResults.filter(r => r.allowed) : titrationResults;
  }

  return results;
}

/**
 * Фильтрует продукты по базовым критериям.
 * ИСПРАВЛЕНО: При наличии diagnoses или rosaceaRisk применяет дерматологический протокол
 * (исключает Vitamin C, AHA, BHA при розацеа и т.д.).
 */
export async function filterProductsBasic(
  products: ProductWithBrand[],
  profileClassification: ProfileClassification,
  strictness: FilterStrictness = 'soft',
  options?: { stepCategory?: StepCategory }
): Promise<ProductWithBrand[]> {
  const hasDiagnoses = Array.isArray(profileClassification.diagnoses) && profileClassification.diagnoses.length > 0;
  const hasRosaceaRisk = profileClassification.rosaceaRisk &&
    ['medium', 'high', 'critical'].includes((profileClassification.rosaceaRisk || '').toLowerCase());

  const protocol: DermatologyProtocol | undefined =
    hasDiagnoses || hasRosaceaRisk
      ? determineProtocol({
          diagnoses: profileClassification.diagnoses || [],
          concerns: profileClassification.concerns || [],
          skinType: profileClassification.skinType || undefined,
          sensitivityLevel: profileClassification.sensitivityLevel || undefined,
          rosaceaRisk: profileClassification.rosaceaRisk || undefined,
        })
      : undefined;

  const results = await filterProducts(products, {
    profileClassification,
    strictness,
    protocol,
    stepCategory: options?.stepCategory,
  });

  return results
    .filter(r => r.allowed)
    .map(r => r.product);
}

