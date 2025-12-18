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
 */
export function filterByProtocol(
  products: ProductWithBrand[],
  protocol: DermatologyProtocol,
  context: ProductSelectionContext
): ProductSelectionResult[] {
  return products.map(product => {
    // Для ProductWithBrand извлекаем ингредиенты из step/category
    // В будущем можно добавить загрузку полной информации о продукте
    const productForCheck = {
      activeIngredients: [] as string[], // Будет определяться по step/category
      step: product.step,
      category: product.category || undefined,
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

    return {
      product,
      allowed: true,
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
  // ИСПРАВЛЕНО: Импортируем функции проверки совместимости синхронно
  const { canUseTogether, getOptimalTimeOfDay } = require('./ingredient-compatibility');
  
  // ИСПРАВЛЕНО: Используем реальные activeIngredients из продукта
  const productForCompatibility = {
    activeIngredients: product.activeIngredients || [],
    composition: undefined as string | undefined,
  };
  
  // ИСПРАВЛЕНО: Используем реальные activeIngredients из уже выбранных продуктов
  const compatibility = canUseTogether(
    productForCompatibility,
    context.alreadySelected.map(p => ({
      activeIngredients: p.activeIngredients || [],
      composition: undefined as string | undefined,
    })),
    context.timeOfDay
  );

  if (!compatibility.compatible) {
    const conflict = compatibility.conflicts[0];
    
      // Если конфликт можно решить разделением по времени
      if (conflict.solution === 'separate_time') {
        const productForTimeCheck: { step?: string; category?: string | null; activeIngredients?: string[]; composition?: string } = {
          step: product.step,
          category: product.category,
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
 */
export function checkForDuplication(
  products: ProductWithBrand[],
  context: ProductSelectionContext
): ProductSelectionResult[] {
  const allProducts = [...context.alreadySelected, ...products];
  // Преобразуем ProductWithBrand в формат для checkIngredientDuplication
  const productsForCheck = allProducts.map(p => ({
    activeIngredients: [] as string[],
    composition: undefined as string | undefined,
  }));
  const duplicates = checkIngredientDuplication(productsForCheck);

  return products.map(product => {
    const productIndex = allProducts.indexOf(product);
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
 */
export function checkTitrationSchedule(
  product: ProductWithBrand,
  context: ProductSelectionContext
): ProductSelectionResult {
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
  const schedule = context.protocol.titrationSchedule || [];

  for (const ingredient of ingredients) {
    const ingredientSchedule = schedule.find(s => s.ingredient === ingredient);
    if (ingredientSchedule) {
      const weekSchedule = getIngredientSchedule(ingredient, context.protocol, context.week);
      
      // Проверяем, можно ли применять в этот день недели
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

      // Проверяем частоту применения
      const maxFrequency = weekSchedule.frequency;
      if (maxFrequency === 0) {
        return {
          product,
          allowed: false,
          reason: `Ингредиент ${ingredient} не должен применяться на ${context.week} неделе`,
        };
      }
    }
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

  // Если есть несовместимые, но они могут быть перенесены на другое время - помечаем это
  const canBeMoved = incompatible.filter(r => r.movedToTime);
  
  return [
    ...finalCompatible,
    ...finalIncompatible,
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

