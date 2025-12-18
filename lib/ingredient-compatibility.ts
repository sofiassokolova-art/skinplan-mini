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
    solution: 'separate_time',
    recommendation: 'Используйте витамин C утром, ниацинамид вечером. Или используйте стабилизированные формы.',
  },
  {
    ingredients: ['ascorbic_acid', 'niacinamide'],
    severity: 'medium',
    reason: 'Ослабление эффективности, рост чувствительности у реактивной кожи',
    solution: 'separate_time',
    recommendation: 'Используйте аскорбиновую кислоту утром, ниацинамид вечером.',
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
 */
export function extractActiveIngredients(product: {
  activeIngredients?: string[];
  composition?: string;
}): ActiveIngredient[] {
  const ingredients: ActiveIngredient[] = [];
  const ingredientText = [
    ...(product.activeIngredients || []),
    product.composition || '',
  ].join(' ').toLowerCase();

  // Маппинг текстовых названий на типы ингредиентов
  const ingredientMap: Record<string, ActiveIngredient> = {
    'ретинол': 'retinol',
    'retinol': 'retinol',
    'ретиноид': 'retinoid',
    'retinoid': 'retinoid',
    'адапален': 'adapalene',
    'adapalene': 'adapalene',
    'третиноин': 'tretinoin',
    'tretinoin': 'tretinoin',
    'витамин c': 'vitamin_c',
    'витамин с': 'vitamin_c',
    'vitamin c': 'vitamin_c',
    'аскорбиновая кислота': 'ascorbic_acid',
    'ascorbic acid': 'ascorbic_acid',
    'ниацинамид': 'niacinamide',
    'niacinamide': 'niacinamide',
    'aha': 'aha',
    'альфа-гидроксикислота': 'aha',
    'bha': 'bha',
    'бета-гидроксикислота': 'bha',
    'салициловая кислота': 'salicylic_acid',
    'salicylic acid': 'salicylic_acid',
    'гликолевая кислота': 'glycolic_acid',
    'glycolic acid': 'glycolic_acid',
    'молочная кислота': 'lactic_acid',
    'lactic acid': 'lactic_acid',
    'азелаиновая кислота': 'azelaic_acid',
    'azelaic acid': 'azelaic_acid',
    'бензоил пероксид': 'benzoyl_peroxide',
    'benzoyl peroxide': 'benzoyl_peroxide',
    'пептиды': 'peptides',
    'peptides': 'peptides',
    'церамиды': 'ceramides',
    'ceramides': 'ceramides',
    'гиалуроновая кислота': 'hyaluronic_acid',
    'hyaluronic acid': 'hyaluronic_acid',
  };

  for (const [text, ingredient] of Object.entries(ingredientMap)) {
    if (ingredientText.includes(text)) {
      ingredients.push(ingredient);
    }
  }

  return [...new Set(ingredients)];
}

/**
 * Проверяет совместимость двух продуктов
 */
export function checkProductCompatibility(
  product1: { activeIngredients?: string[]; composition?: string },
  product2: { activeIngredients?: string[]; composition?: string }
): IngredientConflict | null {
  const ingredients1 = extractActiveIngredients(product1);
  const ingredients2 = extractActiveIngredients(product2);

  for (const conflict of INGREDIENT_CONFLICTS) {
    const hasIngredient1 = conflict.ingredients.some(ing => ingredients1.includes(ing));
    const hasIngredient2 = conflict.ingredients.some(ing => ingredients2.includes(ing));

    if (hasIngredient1 && hasIngredient2) {
      return conflict;
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
 */
export function canUseTogether(
  product: { activeIngredients?: string[]; composition?: string },
  otherProducts: Array<{ activeIngredients?: string[]; composition?: string }>,
  timeOfDay: 'morning' | 'evening'
): { compatible: boolean; conflicts: IngredientConflict[] } {
  const conflicts: IngredientConflict[] = [];

  for (const otherProduct of otherProducts) {
    const conflict = checkProductCompatibility(product, otherProduct);
    if (conflict) {
      // Если конфликт требует разделения по времени, проверяем время применения
      if (conflict.solution === 'separate_time') {
        const productTime = getOptimalTimeOfDay(product);
        const otherTime = getOptimalTimeOfDay(otherProduct);
        
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

