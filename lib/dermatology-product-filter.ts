// lib/dermatology-product-filter.ts
// Фильтрация продуктов по дерматологическим протоколам и совместимости

import type { ProductWithBrand } from './product-fallback';
import type { StepCategory } from './step-category-rules';
import {
  checkProductCompatibility,
  checkIngredientDuplication,
  getOptimalTimeOfDay,
  canUseTogether,
  extractActiveIngredients,
  type ActiveIngredient,
} from './ingredient-compatibility';

/**
 * ИСПРАВЛЕНО (P0): Определяет активные ингредиенты из stepCategory
 * Используется как fallback, если product.activeIngredients пусто или ненадежно
 */
function getActiveIngredientsFromStepCategory(stepCategory?: StepCategory): ActiveIngredient[] {
  if (!stepCategory) return [];
  
  const ingredients: ActiveIngredient[] = [];
  
  // Маппинг stepCategory на активные ингредиенты
  if (stepCategory.includes('retinol') || stepCategory === 'treatment_antiage') {
    ingredients.push('retinol');
  }
  if (stepCategory.includes('retinoid')) {
    ingredients.push('retinoid');
  }
  if (stepCategory.includes('adapalene')) {
    ingredients.push('adapalene');
  }
  if (stepCategory.includes('tretinoin')) {
    ingredients.push('tretinoin');
  }
  if (stepCategory.includes('vitc') || stepCategory.includes('vitamin_c')) {
    ingredients.push('vitamin_c');
  }
  if (stepCategory.includes('niacinamide')) {
    ingredients.push('niacinamide');
  }
  if (stepCategory.includes('aha') || stepCategory === 'toner_aha') {
    ingredients.push('aha');
  }
  if (stepCategory.includes('bha') || stepCategory === 'toner_bha') {
    ingredients.push('bha');
  }
  if (stepCategory.includes('exfoliant') || stepCategory.includes('acid') || 
      stepCategory === 'toner_exfoliant' || stepCategory === 'treatment_exfoliant_mild' || 
      stepCategory === 'treatment_exfoliant_strong' || stepCategory === 'mask_acid') {
    ingredients.push('aha', 'bha'); // Может быть любая кислота
  }
  if (stepCategory.includes('azelaic') || stepCategory === 'treatment_acne_azelaic') {
    ingredients.push('azelaic_acid');
  }
  if (stepCategory.includes('bpo') || stepCategory === 'treatment_acne_bpo') {
    ingredients.push('benzoyl_peroxide');
  }
  if (stepCategory.includes('peptide')) {
    ingredients.push('peptides');
  }
  if (stepCategory.includes('ceramide') || stepCategory.includes('barrier')) {
    ingredients.push('ceramides');
  }
  if (stepCategory.includes('hyaluronic') || stepCategory.includes('hydrating')) {
    ingredients.push('hyaluronic_acid');
  }
  
  return [...new Set(ingredients)];
}

/**
 * ИСПРАВЛЕНО (P0): Единая функция для определения активных ингредиентов продукта
 * Использует stepCategory как источник истины, если activeIngredients пусто
 * 
 * Приоритет:
 * 1. extractActiveIngredients из product.activeIngredients (если есть)
 * 2. getActiveIngredientsFromStepCategory из context.stepCategory (если есть)
 * 3. extractActiveIngredients из product.step/category (fallback)
 */
function getIngredientsForProduct(
  product: ProductWithBrand,
  context: ProductSelectionContext
): ActiveIngredient[] {
  // 1. Пытаемся извлечь из реальных activeIngredients
  const extractedFromActives = extractActiveIngredients({
    activeIngredients: product.activeIngredients || [],
    composition: undefined, // ProductWithBrand не имеет composition
  });
  
  if (extractedFromActives.length > 0) {
    return extractedFromActives;
  }
  
  // 2. Если activeIngredients пусто, используем stepCategory как источник истины
  if (context.stepCategory) {
    const fromStepCategory = getActiveIngredientsFromStepCategory(context.stepCategory);
    if (fromStepCategory.length > 0) {
      return fromStepCategory;
    }
  }
  
  // 3. Fallback: пытаемся извлечь из step/category (старая логика)
  const extractedFromStep = extractActiveIngredients({
    activeIngredients: [],
    composition: `${product.step || ''} ${product.category || ''}`.trim() || undefined,
  });
  
  return extractedFromStep;
}
import {
  determineProtocol,
  isProductAllowedByProtocol,
  getIngredientSchedule,
  type DermatologyProtocol,
} from './dermatology-protocols';
import type { ProfileClassification } from './plan-generation-helpers';

export interface ProductSelectionContext {
  timeOfDay: 'morning' | 'evening';
  day: number;
  week: number;
  alreadySelected: ProductWithBrand[];
  protocol: DermatologyProtocol;
  profileClassification: ProfileClassification;
  // ИСПРАВЛЕНО (P1): Добавлен stepCategory для точного определения типа шага
  // Особенно важно, если activeIngredients пустой/грязный
  stepCategory?: StepCategory;
}

export interface ProductSelectionResult {
  product: ProductWithBrand;
  allowed: boolean;
  reason?: string;
  warning?: string;
  recommendation?: string;
  movedToTime?: 'morning' | 'evening';
}

/**
 * Фильтрует продукты по дерматологическому протоколу
 * ИСПРАВЛЕНО (P0): Передает реальные activeIngredients вместо пустого массива
 */
export function filterByProtocol(
  products: ProductWithBrand[],
  protocol: DermatologyProtocol,
  context: ProductSelectionContext
): ProductSelectionResult[] {
  return products.map(product => {
    // ИСПРАВЛЕНО: Используем единую функцию для определения активов
    const ingredients = getIngredientsForProduct(product, context);
    
    const productForCheck = {
      activeIngredients: ingredients.map(ing => String(ing)), // Преобразуем ActiveIngredient[] в string[]
      step: product.step,
      category: product.category || undefined,
      stepCategory: context.stepCategory, // ИСПРАВЛЕНО: Передаем stepCategory для точной проверки
    };
    
    const check = isProductAllowedByProtocol(
      productForCheck,
      protocol
    );

    if (!check.allowed) {
      return {
        product,
        allowed: false,
        reason: check.reason,
      };
    }

    // ИСПРАВЛЕНО: Добавляем warning, если есть (soft allowlist)
    return {
      product,
      allowed: true,
      warning: check.warning,
    };
  });
}

/**
 * Проверяет совместимость продукта с уже выбранными продуктами
 * ИСПРАВЛЕНО: Использует реальные activeIngredients из продуктов
 */
export function checkCompatibilityWithSelected(
  product: ProductWithBrand,
  context: ProductSelectionContext
): ProductSelectionResult {
  // ИСПРАВЛЕНО: Используем уже импортированные функции из ingredient-compatibility
  // ИСПРАВЛЕНО: Используем реальные activeIngredients из продукта
  const productForCompatibility = {
    activeIngredients: product.activeIngredients || [],
    composition: undefined as string | undefined,
  };
  
  // ИСПРАВЛЕНО: Используем реальные activeIngredients из уже выбранных продуктов
  // ИСПРАВЛЕНО (P0): Передаем skinSensitivity в canUseTogether
  const skinSensitivity = context.profileClassification.sensitivityLevel as 'low' | 'medium' | 'high' | 'very_high' || 'medium';
  const compatibility = canUseTogether(
    productForCompatibility,
    context.alreadySelected.map(p => ({
      activeIngredients: p.activeIngredients || [],
      composition: undefined as string | undefined,
    })),
    context.timeOfDay,
    skinSensitivity
  );

  if (!compatibility.compatible) {
    const conflict = compatibility.conflicts[0];
    
      // Если конфликт можно решить разделением по времени
      if (conflict.solution === 'separate_time') {
        // ИСПРАВЛЕНО (P0): Передаем реальные активы в getOptimalTimeOfDay
        const ingredients = getIngredientsForProduct(product, context);
        const productForTimeCheck = {
          activeIngredients: ingredients.map(ing => String(ing)),
          composition: undefined as string | undefined,
        };
        const optimalTime = getOptimalTimeOfDay(
          productForTimeCheck,
          context.profileClassification.sensitivityLevel as 'low' | 'medium' | 'high' | 'very_high' || 'medium'
        );
      
      // Если оптимальное время отличается от текущего - предлагаем перенести
      if (optimalTime !== context.timeOfDay && optimalTime !== 'both') {
        return {
          product,
          allowed: false,
          reason: conflict.reason,
          recommendation: conflict.recommendation,
          movedToTime: optimalTime,
        };
      }
    }

    return {
      product,
      allowed: false,
      reason: conflict.reason,
      recommendation: conflict.recommendation,
    };
  }

  return {
    product,
    allowed: true,
  };
}

/**
 * Проверяет дублирование активных ингредиентов
 * ИСПРАВЛЕНО (P0): Использует stepCategory для определения активов, если product.activeIngredients пусто
 */
export function checkForDuplication(
  products: ProductWithBrand[],
  context: ProductSelectionContext
): ProductSelectionResult[] {
  const allProducts = [...context.alreadySelected, ...products];
  
  // ИСПРАВЛЕНО (P0): Используем реальные activeIngredients вместо пустого массива
  // ИСПРАВЛЕНО (P1): Создаем мапу product.id -> index для безопасного матчинга
  const productIdToIndex = new Map<number, number>();
  allProducts.forEach((p, index) => {
    if (p.id) {
      productIdToIndex.set(p.id, index);
    }
  });
  
  const productsForCheck = allProducts.map((p, index) => {
    // ИСПРАВЛЕНО: Используем единую функцию для определения активов
    // Для alreadySelected stepCategory не применяется (они уже выбраны ранее)
    const stepCategory = index >= context.alreadySelected.length ? context.stepCategory : undefined;
    const tempContext: ProductSelectionContext = {
      ...context,
      stepCategory,
    };
    const ingredients = getIngredientsForProduct(p, tempContext);
    
    return {
      activeIngredients: ingredients.map(ing => String(ing)), // Преобразуем ActiveIngredient[] в string[]
      composition: undefined as string | undefined,
    };
  });
  const duplicates = checkIngredientDuplication(productsForCheck);

  return products.map(product => {
    // ИСПРАВЛЕНО (P1): Используем product.id для безопасного матчинга вместо indexOf
    const productIndex = product.id && productIdToIndex.has(product.id)
      ? productIdToIndex.get(product.id)!
      : allProducts.findIndex(p => p.id === product.id || (p.step === product.step && p.name === product.name));
    
    const duplicate = duplicates.find(d => d.products.includes(productIndex));

    if (duplicate) {
      // Проверяем, не является ли это первым продуктом в группе
      const isFirst = duplicate.products[0] === productIndex;
      
      if (!isFirst) {
        return {
          product,
          allowed: false,
          reason: duplicate.message,
          recommendation: 'Выберите один продукт из группы дублирующихся ингредиентов',
        };
      }
    }

    return {
      product,
      allowed: true,
    };
  });
}

/**
 * Проверяет, соответствует ли продукт расписанию применения активных ингредиентов
 * ИСПРАВЛЕНО (P0): Использует stepCategory для определения активов, если product.activeIngredients пусто
 */
export function checkTitrationSchedule(
  product: ProductWithBrand,
  context: ProductSelectionContext
): ProductSelectionResult {
  // ИСПРАВЛЕНО (P0): Используем единую функцию для определения активов
  // Это гарантирует использование реальных activeIngredients и stepCategory как fallback
  const ingredients = getIngredientsForProduct(product, context);
  const schedule = context.protocol.titrationSchedule || [];

  for (const ingredient of ingredients) {
    // ИСПРАВЛЕНО (P0): Проверяем и titrationSchedule, и cyclingRules через getIngredientSchedule
    const weekSchedule = getIngredientSchedule(ingredient, context.protocol, context.week);
    
    // ИСПРАВЛЕНО (P1): frequency: null означает "нет ограничений" - пропускаем проверку
    if (weekSchedule.frequency === null || weekSchedule.frequency === undefined) {
      continue; // Нет ограничений для этого ингредиента
    }
    
    // ИСПРАВЛЕНО (P0): Проверяем фиксированные дни из cyclingRules (приоритет)
    const dayOfWeek = ((context.day - 1) % 7) + 1;
    const allowedDays = weekSchedule.days || [];
    
    if (allowedDays.length > 0 && !allowedDays.includes(dayOfWeek)) {
      return {
        product,
        allowed: false,
        reason: `Ингредиент ${ingredient} не должен применяться в этот день согласно расписанию`,
        recommendation: `Применяйте ${ingredient} в дни: ${allowedDays.join(', ')}`,
      };
    }

    // Проверяем частоту применения (если нет фиксированных дней)
    if (allowedDays.length === 0 && weekSchedule.frequency === 0) {
      return {
        product,
        allowed: false,
        reason: `Ингредиент ${ingredient} не должен применяться на ${context.week} неделе`,
      };
    }
    // Если frequency > 0 и нет фиксированных дней - проверка частоты будет в другом месте (счетчик применений)
  }

  return {
    product,
    allowed: true,
  };
}

/**
 * Полный фильтр продуктов с применением всей дерматологической логики
 */
export function filterProductsWithDermatologyLogic(
  products: ProductWithBrand[],
  context: ProductSelectionContext
): ProductSelectionResult[] {
  // 1. Фильтрация по протоколу
  let filtered = filterByProtocol(products, context.protocol, context);
  filtered = filtered.filter(r => r.allowed);

  // 2. Проверка дублирования
  const duplicationCheck = checkForDuplication(
    filtered.map(r => r.product),
    context
  );
  filtered = filtered.map((result, index) => {
    const dupCheck = duplicationCheck[index];
    if (!dupCheck.allowed) {
      return {
        ...result,
        allowed: false,
        reason: dupCheck.reason,
        recommendation: dupCheck.recommendation,
      };
    }
    return result;
  });
  filtered = filtered.filter(r => r.allowed);

  // 3. Проверка совместимости с уже выбранными
  const compatibilityResults = filtered.map(result => {
    const compatCheck = checkCompatibilityWithSelected(result.product, context);
    if (!compatCheck.allowed) {
      return {
        ...result,
        allowed: false,
        reason: compatCheck.reason,
        recommendation: compatCheck.recommendation,
        movedToTime: compatCheck.movedToTime,
      };
    }
    return result;
  });

  // Разделяем на совместимые и несовместимые
  const compatible = compatibilityResults.filter(r => r.allowed);
  const incompatible = compatibilityResults.filter(r => !r.allowed);

  // 4. Проверка расписания применения (titration)
  const titrationResults = compatible.map(result => {
    const titrationCheck = checkTitrationSchedule(result.product, context);
    if (!titrationCheck.allowed) {
      return {
        ...result,
        allowed: false,
        reason: titrationCheck.reason,
        recommendation: titrationCheck.recommendation,
      };
    }
    return result;
  });

  const finalCompatible = titrationResults.filter(r => r.allowed);
  const finalIncompatible = titrationResults.filter(r => !r.allowed);

  // ИСПРАВЛЕНО (P1): Разделяем несовместимые на те, что можно перенести, и те, что нельзя
  // Убираем дублирование - один продукт не должен попадать дважды
  const canBeMoved = incompatible.filter(r => r.movedToTime);
  const hardIncompatible = incompatible.filter(r => !r.movedToTime);
  
  return [
    ...finalCompatible,
    ...finalIncompatible,
    ...hardIncompatible,
    ...canBeMoved,
  ];
}

/**
 * Генерирует обоснование выбора продукта
 */
export function generateProductJustification(
  product: ProductWithBrand,
  protocol: DermatologyProtocol,
  profileClassification: ProfileClassification
): string {
  // Определяем ингредиенты по step/category (упрощенная версия)
  const ingredients: ActiveIngredient[] = [];
  const stepLower = (product.step || '').toLowerCase();
  const categoryLower = (product.category || '').toLowerCase();
  
  if (stepLower.includes('retinol') || categoryLower.includes('retinol')) {
    ingredients.push('retinol');
  }
  if (stepLower.includes('bha') || categoryLower.includes('bha') || stepLower.includes('salicylic')) {
    ingredients.push('bha');
  }
  if (stepLower.includes('aha') || categoryLower.includes('aha')) {
    ingredients.push('aha');
  }
  if (stepLower.includes('vitamin c') || stepLower.includes('vitc') || categoryLower.includes('vitamin c')) {
    ingredients.push('vitamin_c');
  }
  if (stepLower.includes('azelaic') || categoryLower.includes('azelaic')) {
    ingredients.push('azelaic_acid');
  }
  if (stepLower.includes('niacinamide') || categoryLower.includes('niacinamide')) {
    ingredients.push('niacinamide');
  }
  const concerns = profileClassification.concerns || [];
  const diagnoses = profileClassification.diagnoses || [];

  const justifications: string[] = [];

  // Обоснование по ингредиентам
  if (ingredients.includes('azelaic_acid')) {
    if (concerns.some(c => c.toLowerCase().includes('покраснени') || c.toLowerCase().includes('краснот'))) {
      justifications.push('Азелаиновая кислота снижает покраснения и воспаление');
    }
    if (concerns.some(c => c.toLowerCase().includes('акне') || c.toLowerCase().includes('высыпани'))) {
      justifications.push('Азелаиновая кислота эффективна при акне и постакне');
    }
  }

  if (ingredients.includes('niacinamide')) {
    justifications.push('Ниацинамид выравнивает тон кожи и укрепляет барьер');
  }

  if (ingredients.includes('retinol') || ingredients.includes('retinoid')) {
    if (concerns.some(c => c.toLowerCase().includes('морщин') || c.toLowerCase().includes('возраст'))) {
      justifications.push('Ретинол стимулирует обновление клеток и уменьшает признаки старения');
    }
    if (concerns.some(c => c.toLowerCase().includes('акне'))) {
      justifications.push('Ретинол нормализует работу сальных желез');
    }
  }

  if (ingredients.includes('bha') || ingredients.includes('salicylic_acid')) {
    if (concerns.some(c => c.toLowerCase().includes('акне') || c.toLowerCase().includes('поры'))) {
      justifications.push('Салициловая кислота очищает поры и предотвращает высыпания');
    }
  }

  if (ingredients.includes('vitamin_c') || ingredients.includes('ascorbic_acid')) {
    if (concerns.some(c => c.toLowerCase().includes('пигмент') || c.toLowerCase().includes('тон'))) {
      justifications.push('Витамин C осветляет пигментацию и выравнивает тон');
    }
    justifications.push('Витамин C защищает от свободных радикалов');
  }

  // Обоснование по протоколу
  if (protocol.condition === 'acne') {
    justifications.push('Продукт соответствует протоколу для акне');
  } else if (protocol.condition === 'rosacea') {
    justifications.push('Продукт безопасен для чувствительной кожи с розацеа');
  } else if (protocol.condition === 'atopic_dermatitis') {
    justifications.push('Продукт восстанавливает защитный барьер кожи');
  }

  return justifications.length > 0
    ? justifications.join('. ') + '.'
    : 'Продукт подобран на основе вашего профиля кожи';
}

/**
 * Генерирует предупреждения для продукта
 */
export function generateProductWarnings(
  product: ProductWithBrand,
  protocol: DermatologyProtocol,
  profileClassification: ProfileClassification
): string[] {
  const warnings: string[] = [];
  // Определяем ингредиенты по step/category (упрощенная версия)
  const ingredients: ActiveIngredient[] = [];
  const stepLower = (product.step || '').toLowerCase();
  const categoryLower = (product.category || '').toLowerCase();
  
  if (stepLower.includes('retinol') || categoryLower.includes('retinol')) {
    ingredients.push('retinol');
  }
  if (stepLower.includes('bha') || categoryLower.includes('bha') || stepLower.includes('salicylic')) {
    ingredients.push('bha');
  }
  if (stepLower.includes('aha') || categoryLower.includes('aha')) {
    ingredients.push('aha');
  }
  if (stepLower.includes('azelaic') || categoryLower.includes('azelaic')) {
    ingredients.push('azelaic_acid');
  }
  const sensitivity = profileClassification.sensitivityLevel || 'medium';

  // Предупреждения по ингредиентам
  if (ingredients.includes('retinol') || ingredients.includes('retinoid')) {
    warnings.push('Возможна сухость в первые 7-14 дней');
    warnings.push('Покраснение по ощущениям ≤ 20 минут — норма');
    if (sensitivity === 'high' || sensitivity === 'very_high') {
      warnings.push('Начните с 1 раза в неделю, постепенно увеличивая частоту');
    }
  }

  if (ingredients.includes('aha') || ingredients.includes('bha')) {
    warnings.push('Возможна сухость и легкое покалывание в первые дни');
    warnings.push('Если жжение длится > 2 часов — прекратите использование');
    if (sensitivity === 'high' || sensitivity === 'very_high') {
      warnings.push('Используйте не чаще 1-2 раз в неделю');
    }
  }

  if (ingredients.includes('azelaic_acid')) {
    if (sensitivity === 'high' || sensitivity === 'very_high') {
      warnings.push('Начните с применения через день');
    }
  }

  // Предупреждения из протокола
  warnings.push(...protocol.warnings);

  return warnings;
}

