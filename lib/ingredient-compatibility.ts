// lib/ingredient-compatibility.ts
// Система проверки совместимости активных ингредиентов

export type ActiveIngredient = 
  | 'retinol' | 'retinoid' | 'adapalene' | 'tretinoin'
  | 'vitamin_c' | 'ascorbic_acid'
  | 'niacinamide'
  | 'aha' | 'bha' | 'pha' | 'salicylic_acid' | 'glycolic_acid' | 'lactic_acid'
  | 'azelaic_acid'
  | 'benzoyl_peroxide'
  | 'peptides'
  | 'ceramides'
  | 'hyaluronic_acid';

export interface IngredientConflict {
  ingredients: ActiveIngredient[];
  severity: 'high' | 'medium' | 'low';
  reason: string;
  solution: 'replace' | 'separate_time' | 'warning';
  recommendation: string;
}

// Матрица несовместимых комбинаций
export const INGREDIENT_CONFLICTS: IngredientConflict[] = [
  {
    ingredients: ['retinol', 'aha'],
    severity: 'high',
    reason: 'Риск раздражения и повреждения барьера',
    solution: 'separate_time',
    recommendation: 'Используйте кислоты утром, ретинол вечером. Минимальный интервал 12 часов.',
  },
  {
    ingredients: ['retinol', 'bha'],
    severity: 'high',
    reason: 'Риск раздражения и повреждения барьера',
    solution: 'separate_time',
    recommendation: 'Используйте BHA утром, ретинол вечером. Минимальный интервал 12 часов.',
  },
  {
    ingredients: ['retinoid', 'aha'],
    severity: 'high',
    reason: 'Риск раздражения и повреждения барьера',
    solution: 'separate_time',
    recommendation: 'Используйте кислоты утром, ретиноиды вечером. Минимальный интервал 12 часов.',
  },
  {
    ingredients: ['retinoid', 'bha'],
    severity: 'high',
    reason: 'Риск раздражения и повреждения барьера',
    solution: 'separate_time',
    recommendation: 'Используйте BHA утром, ретиноиды вечером. Минимальный интервал 12 часов.',
  },
  {
    ingredients: ['adapalene', 'bha'],
    severity: 'medium',
    reason: 'Может вызвать раздражение, но адапален 0.1-0.3% более терпим',
    solution: 'separate_time',
    recommendation: 'Используйте BHA утром, адапален вечером. При чувствительности - через день.',
  },
  {
    ingredients: ['tretinoin', 'aha'],
    severity: 'high',
    reason: 'Высокий риск раздражения',
    solution: 'separate_time',
    recommendation: 'Используйте кислоты утром, третиноин вечером. Обязательно увлажнение.',
  },
  {
    ingredients: ['tretinoin', 'bha'],
    severity: 'high',
    reason: 'Высокий риск раздражения',
    solution: 'separate_time',
    recommendation: 'Используйте BHA утром, третиноин вечером. Обязательно увлажнение.',
  },
  {
    ingredients: ['vitamin_c', 'niacinamide'],
    severity: 'medium',
    reason: 'Ослабление эффективности, рост чувствительности у реактивной кожи',
    // ИСПРАВЛЕНО (P0): По умолчанию warning, separate_time только при high/very_high sensitivity или ascorbic_acid
    solution: 'warning',
    recommendation: 'При чувствительной коже используйте раздельно. При нормальной коже можно комбинировать, особенно стабилизированные формы.',
  },
  {
    ingredients: ['ascorbic_acid', 'niacinamide'],
    severity: 'medium',
    reason: 'Ослабление эффективности из-за низкого pH аскорбиновой кислоты, рост чувствительности у реактивной кожи',
    // ИСПРАВЛЕНО (P0): ascorbic_acid (низкий pH) + niacinamide = separate_time по умолчанию
    solution: 'separate_time',
    recommendation: 'Используйте аскорбиновую кислоту утром, ниацинамид вечером. При очень чувствительной коже - через день.',
  },
  {
    ingredients: ['retinol', 'benzoyl_peroxide'],
    severity: 'high',
    reason: 'Риск раздражения и повреждения барьера',
    solution: 'separate_time',
    recommendation: 'Используйте бензоил пероксид утром, ретинол вечером. Исключение: адапален 0.1-0.3% можно комбинировать.',
  },
  {
    ingredients: ['retinoid', 'benzoyl_peroxide'],
    severity: 'high',
    reason: 'Риск раздражения и повреждения барьера',
    solution: 'separate_time',
    recommendation: 'Используйте бензоил пероксид утром, ретиноиды вечером. Исключение: адапален 0.1-0.3% можно комбинировать.',
  },
  {
    ingredients: ['retinol', 'vitamin_c'],
    severity: 'medium',
    reason: 'Может вызвать раздражение у чувствительной кожи',
    solution: 'separate_time',
    recommendation: 'Используйте витамин C утром, ретинол вечером.',
  },
  {
    ingredients: ['aha', 'vitamin_c'],
    severity: 'medium',
    reason: 'Может вызвать раздражение у чувствительной кожи',
    solution: 'separate_time',
    recommendation: 'Используйте витамин C утром, кислоты вечером.',
  },
  {
    ingredients: ['bha', 'vitamin_c'],
    severity: 'medium',
    reason: 'Может вызвать раздражение у чувствительной кожи',
    solution: 'separate_time',
    recommendation: 'Используйте витамин C утром, BHA вечером.',
  },
  {
    ingredients: ['salicylic_acid', 'azelaic_acid'],
    severity: 'low',
    reason: 'Только при сверхчувствительной коже может вызвать раздражение',
    solution: 'warning',
    recommendation: 'При чувствительной коже используйте раздельно. При нормальной коже можно комбинировать.',
  },
];

// Группы ингредиентов для проверки дублирования
export const INGREDIENT_GROUPS: Record<string, ActiveIngredient[]> = {
  retinoids: ['retinol', 'retinoid', 'adapalene', 'tretinoin'],
  acids: ['aha', 'bha', 'pha', 'salicylic_acid', 'glycolic_acid', 'lactic_acid'],
  vitamin_c: ['vitamin_c', 'ascorbic_acid'],
};

/**
 * Извлекает активные ингредиенты из продукта
 * ИСПРАВЛЕНО (P1): 
 * - Проверяем activeIngredients как источник истины, composition - как fallback
 * - Добавлены границы слов для более точного поиска
 * - Добавлены дополнительные формы ингредиентов (retinal, tranexamic acid, arbutin, kojic acid, sulfur)
 */
export function extractActiveIngredients(product: {
  activeIngredients?: string[];
  composition?: string;
}): ActiveIngredient[] {
  const ingredients: ActiveIngredient[] = [];
  
  // ИСПРАВЛЕНО: Сначала проверяем activeIngredients как источник истины
  const activeIngredientsText = (product.activeIngredients || []).join(' ').toLowerCase();
  const compositionText = (product.composition || '').toLowerCase();
  
  // ИСПРАВЛЕНО: Используем composition только как fallback, если activeIngredients пустой
  const ingredientText = activeIngredientsText || compositionText;

  // ИСПРАВЛЕНО: Маппинг с поддержкой границ слов для латиницы
  // Используем регулярные выражения для более точного поиска
  const ingredientPatterns: Array<{ pattern: RegExp; ingredient: ActiveIngredient }> = [
    // Ретиноиды
    { pattern: /\bretinol\b/i, ingredient: 'retinol' },
    { pattern: /\bретинол\b/i, ingredient: 'retinol' },
    { pattern: /\bretinoid\b/i, ingredient: 'retinoid' },
    { pattern: /\bретиноид\b/i, ingredient: 'retinoid' },
    { pattern: /\badapalene\b/i, ingredient: 'adapalene' },
    { pattern: /\bадапален\b/i, ingredient: 'adapalene' },
    { pattern: /\btretinoin\b/i, ingredient: 'tretinoin' },
    { pattern: /\bтретиноин\b/i, ingredient: 'tretinoin' },
    { pattern: /\bretinal(dehyde)?\b/i, ingredient: 'retinoid' }, // ИСПРАВЛЕНО: добавлен retinal/retinaldehyde
    { pattern: /\bретиналь\b/i, ingredient: 'retinoid' },
    
    // Витамин C
    { pattern: /\bvitamin\s+c\b/i, ingredient: 'vitamin_c' },
    { pattern: /\bvitamin_c\d+/i, ingredient: 'vitamin_c' }, // ИСПРАВЛЕНО: vitamin_c10, vitamin_c15, vitamin_c23 и т.д.
    { pattern: /\bvitamin_c\b/i, ingredient: 'vitamin_c' }, // ИСПРАВЛЕНО: точное совпадение vitamin_c
    { pattern: /\bвитамин\s+[сc]\b/i, ingredient: 'vitamin_c' },
    { pattern: /\bascorbic\s+acid\b/i, ingredient: 'ascorbic_acid' },
    { pattern: /\bаскорбиновая\s+кислота\b/i, ingredient: 'ascorbic_acid' },
    { pattern: /\bascorbyl\s+glucoside\b/i, ingredient: 'vitamin_c' }, // ИСПРАВЛЕНО: добавлена форма
    { pattern: /\bascorbyl\s+palmitate\b/i, ingredient: 'vitamin_c' },
    { pattern: /\bmap\b/i, ingredient: 'vitamin_c' }, // Magnesium Ascorbyl Phosphate
    { pattern: /\bsap\b/i, ingredient: 'vitamin_c' }, // Sodium Ascorbyl Phosphate
    
    // Ниацинамид
    { pattern: /\bniacinamide\b/i, ingredient: 'niacinamide' },
    { pattern: /\bниацинамид\b/i, ingredient: 'niacinamide' },
    { pattern: /\bnicotinamide\b/i, ingredient: 'niacinamide' },
    
    // Кислоты
    { pattern: /\baha\b/i, ingredient: 'aha' },
    { pattern: /\bальфа-гидроксикислота\b/i, ingredient: 'aha' },
    { pattern: /\balpha\s+hydroxy\s+acid\b/i, ingredient: 'aha' },
    { pattern: /\bbha\b/i, ingredient: 'bha' },
    { pattern: /\bбета-гидроксикислота\b/i, ingredient: 'bha' },
    { pattern: /\bbeta\s+hydroxy\s+acid\b/i, ingredient: 'bha' },
    { pattern: /\bpha\b/i, ingredient: 'pha' },
    { pattern: /\bpolyhydroxy\s+acid\b/i, ingredient: 'pha' },
    { pattern: /\bsalicylic\s+acid\b/i, ingredient: 'salicylic_acid' },
    { pattern: /\bсалициловая\s+кислота\b/i, ingredient: 'salicylic_acid' },
    { pattern: /\bglycolic\s+acid\b/i, ingredient: 'glycolic_acid' },
    { pattern: /\bгликолевая\s+кислота\b/i, ingredient: 'glycolic_acid' },
    { pattern: /\blactic\s+acid\b/i, ingredient: 'lactic_acid' },
    { pattern: /\bмолочная\s+кислота\b/i, ingredient: 'lactic_acid' },
    { pattern: /\bazelaic\s+acid\b/i, ingredient: 'azelaic_acid' },
    { pattern: /\bазелаиновая\s+кислота\b/i, ingredient: 'azelaic_acid' },
    { pattern: /\btranexamic\s+acid\b/i, ingredient: 'azelaic_acid' }, // ИСПРАВЛЕНО: добавлен tranexamic acid (близок к azelaic)
    { pattern: /\bтранэксамовая\s+кислота\b/i, ingredient: 'azelaic_acid' },
    
    // БПО
    { pattern: /\bbenzoyl\s+peroxide\b/i, ingredient: 'benzoyl_peroxide' },
    { pattern: /\bбензоил\s+пероксид\b/i, ingredient: 'benzoyl_peroxide' },
    { pattern: /\bbpo\b/i, ingredient: 'benzoyl_peroxide' },
    
    // Другие активы
    { pattern: /\bpeptides\b/i, ingredient: 'peptides' },
    { pattern: /\bпептиды\b/i, ingredient: 'peptides' },
    { pattern: /\bceramides\b/i, ingredient: 'ceramides' },
    { pattern: /\bцерамиды\b/i, ingredient: 'ceramides' },
    { pattern: /\bhyaluronic\s+acid\b/i, ingredient: 'hyaluronic_acid' },
    { pattern: /\bгиалуроновая\s+кислота\b/i, ingredient: 'hyaluronic_acid' },
    { pattern: /\barbutin\b/i, ingredient: 'vitamin_c' }, // ИСПРАВЛЕНО: добавлен arbutin (осветляющий)
    { pattern: /\bарбутин\b/i, ingredient: 'vitamin_c' },
    { pattern: /\bkojic\s+acid\b/i, ingredient: 'vitamin_c' }, // ИСПРАВЛЕНО: добавлен kojic acid
    { pattern: /\bkojic\b/i, ingredient: 'vitamin_c' },
    { pattern: /\bкоевая\s+кислота\b/i, ingredient: 'vitamin_c' },
    { pattern: /\bsulfur\b/i, ingredient: 'benzoyl_peroxide' }, // ИСПРАВЛЕНО: добавлен sulfur (антибактериальный)
    { pattern: /\bсера\b/i, ingredient: 'benzoyl_peroxide' },
  ];

  for (const { pattern, ingredient } of ingredientPatterns) {
    if (pattern.test(ingredientText)) {
      ingredients.push(ingredient);
    }
  }

  return [...new Set(ingredients)];
}

/**
 * Проверяет совместимость двух продуктов
 * ИСПРАВЛЕНО (P0): Для конфликта из 2 ингредиентов проверяем, что один продукт содержит A, другой содержит B
 * (а не оба содержат один и тот же ингредиент из конфликта)
 */
export function checkProductCompatibility(
  product1: { activeIngredients?: string[]; composition?: string },
  product2: { activeIngredients?: string[]; composition?: string }
): IngredientConflict | null {
  const ingredients1 = extractActiveIngredients(product1);
  const ingredients2 = extractActiveIngredients(product2);

  for (const conflict of INGREDIENT_CONFLICTS) {
    // ИСПРАВЛЕНО: Для конфликта из 2 ингредиентов проверяем, что один продукт содержит A, другой содержит B
    if (conflict.ingredients.length === 2) {
      const [a, b] = conflict.ingredients;
      const p1a = ingredients1.includes(a);
      const p1b = ingredients1.includes(b);
      const p2a = ingredients2.includes(a);
      const p2b = ingredients2.includes(b);

      // Конфликт есть, если один продукт содержит A, а другой содержит B (в любом порядке)
      if ((p1a && p2b) || (p1b && p2a)) {
        return conflict;
      }
    } else {
      // Для конфликтов с >2 ингредиентами используем старую логику (покрытие набора)
      // Пока таких конфликтов нет, но оставляем для будущего расширения
      const hasIngredient1 = conflict.ingredients.some(ing => ingredients1.includes(ing));
      const hasIngredient2 = conflict.ingredients.some(ing => ingredients2.includes(ing));

      if (hasIngredient1 && hasIngredient2) {
        return conflict;
      }
    }
  }

  return null;
}

/**
 * Проверяет дублирование активных ингредиентов в списке продуктов
 */
export function checkIngredientDuplication(
  products: Array<{ activeIngredients?: string[]; composition?: string }>
): Array<{ products: number[]; group: string; message: string }> {
  const duplicates: Array<{ products: number[]; group: string; message: string }> = [];

  for (const [groupName, groupIngredients] of Object.entries(INGREDIENT_GROUPS)) {
    const productsWithGroup: number[] = [];

    products.forEach((product, index) => {
      const ingredients = extractActiveIngredients(product);
      if (groupIngredients.some(ing => ingredients.includes(ing))) {
        productsWithGroup.push(index);
      }
    });

    if (productsWithGroup.length > 1) {
      duplicates.push({
        products: productsWithGroup,
        group: groupName,
        message: `Обнаружено дублирование ${groupName}: ${productsWithGroup.length} продукта(ов) содержат одинаковые активные ингредиенты`,
      });
    }
  }

  return duplicates;
}

/**
 * Определяет оптимальное время применения продукта (утро/вечер)
 */
export function getOptimalTimeOfDay(
  product: { activeIngredients?: string[]; composition?: string },
  skinSensitivity: 'low' | 'medium' | 'high' | 'very_high' = 'medium'
): 'morning' | 'evening' | 'both' {
  const ingredients = extractActiveIngredients(product);

  // Вечерние ингредиенты
  const eveningIngredients: ActiveIngredient[] = [
    'retinol', 'retinoid', 'adapalene', 'tretinoin',
    'aha', 'bha', 'pha', 'salicylic_acid', 'glycolic_acid', 'lactic_acid',
  ];

  // Утренние ингредиенты
  const morningIngredients: ActiveIngredient[] = [
    'vitamin_c', 'ascorbic_acid',
    'niacinamide',
  ];

  // Универсальные (можно и утром, и вечером)
  const universalIngredients: ActiveIngredient[] = [
    'azelaic_acid', // при чувствительной коже - утром
    'peptides',
    'ceramides',
    'hyaluronic_acid',
  ];

  const hasEvening = ingredients.some(ing => eveningIngredients.includes(ing));
  const hasMorning = ingredients.some(ing => morningIngredients.includes(ing));
  const hasUniversal = ingredients.some(ing => universalIngredients.includes(ing));

  // Азелаиновая кислота при чувствительной коже - утром
  if (ingredients.includes('azelaic_acid') && (skinSensitivity === 'high' || skinSensitivity === 'very_high')) {
    return 'morning';
  }

  if (hasEvening && !hasMorning) return 'evening';
  if (hasMorning && !hasEvening) return 'morning';
  if (hasUniversal && !hasEvening && !hasMorning) return 'both';
  
  // По умолчанию - вечер (для безопасности)
  return hasEvening ? 'evening' : 'both';
}

/**
 * Проверяет, можно ли использовать продукт одновременно с другими
 * ИСПРАВЛЕНО (P0): Передаем skinSensitivity в getOptimalTimeOfDay() для правильного определения времени применения
 */
export function canUseTogether(
  product: { activeIngredients?: string[]; composition?: string },
  otherProducts: Array<{ activeIngredients?: string[]; composition?: string }>,
  timeOfDay: 'morning' | 'evening',
  skinSensitivity: 'low' | 'medium' | 'high' | 'very_high' = 'medium'
): { compatible: boolean; conflicts: IngredientConflict[] } {
  const conflicts: IngredientConflict[] = [];

  for (const otherProduct of otherProducts) {
    const conflict = checkProductCompatibility(product, otherProduct);
    if (conflict) {
      // ИСПРАВЛЕНО (P0): Для vitamin_c + niacinamide проверяем sensitivity и форму vitC
      if (conflict.ingredients.includes('vitamin_c') && conflict.ingredients.includes('niacinamide')) {
        // Если sensitivity high/very_high или это ascorbic_acid - separate_time
        const ingredients1 = extractActiveIngredients(product);
        const ingredients2 = extractActiveIngredients(otherProduct);
        const hasAscorbicAcid = ingredients1.includes('ascorbic_acid') || ingredients2.includes('ascorbic_acid');
        
        if ((skinSensitivity === 'high' || skinSensitivity === 'very_high') || hasAscorbicAcid) {
          // Применяем логику separate_time
          const productTime = getOptimalTimeOfDay(product, skinSensitivity);
          const otherTime = getOptimalTimeOfDay(otherProduct, skinSensitivity);
          
          if (
            (productTime === timeOfDay || productTime === 'both') &&
            (otherTime === timeOfDay || otherTime === 'both')
          ) {
            conflicts.push({
              ...conflict,
              solution: 'separate_time',
            });
          }
        } else {
          // Для нормальной кожи - только warning
          conflicts.push({
            ...conflict,
            solution: 'warning',
          });
        }
      } else if (conflict.solution === 'separate_time') {
        // ИСПРАВЛЕНО: Передаем skinSensitivity в getOptimalTimeOfDay
        const productTime = getOptimalTimeOfDay(product, skinSensitivity);
        const otherTime = getOptimalTimeOfDay(otherProduct, skinSensitivity);
        
        // Если оба продукта в одно время - конфликт
        if (
          (productTime === timeOfDay || productTime === 'both') &&
          (otherTime === timeOfDay || otherTime === 'both')
        ) {
          conflicts.push(conflict);
        }
      } else {
        conflicts.push(conflict);
      }
    }
  }

  return {
    compatible: conflicts.length === 0,
    conflicts,
  };
}

