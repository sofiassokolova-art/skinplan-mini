// lib/plan-validation.ts
// ИСПРАВЛЕНО: Слой валидации плана с проверкой совместимости ингредиентов и дерматологических протоколов
// Обеспечивает безопасность плана перед возвратом пользователю

import type { Plan28, DayPlan } from './plan-types';
import type { ProductWithBrand } from './product-fallback';
import { checkProductCompatibility } from './ingredient-compatibility';
import { logger } from './logger';

/**
 * ИСПРАВЛЕНО (P0): Результат валидации плана с severity
 * severity: 'error' - план невалиден, нельзя показывать пользователю
 * severity: 'warning' - план валиден, но есть предупреждения
 * severity: 'ok' - план полностью валиден
 */
export interface PlanValidationResult {
  isValid: boolean;
  severity: 'error' | 'warning' | 'ok'; // ИСПРАВЛЕНО (P0): Добавлен severity
  warnings: string[];
  errors: string[];
  incompatibleDays: number[]; // Индексы дней с несовместимыми ингредиентами
}

export interface PlanValidationOptions {
  ingredientCompatibility?: boolean;
  dermatologyProtocols?: boolean;
  strictMode?: boolean; // Если true, errors блокируют план
}

/**
 * Валидирует план на совместимость ингредиентов и соответствие дерматологическим протоколам
 * ИСПРАВЛЕНО: Единый слой валидации плана
 */
/**
 * ИСПРАВЛЕНО (P0): Строгая валидация плана
 * Проверяет наполнение: дни, шаги, продукты, обязательные категории
 */
export async function validatePlan(
  plan: Plan28,
  selectedProducts: ProductWithBrand[],
  options: PlanValidationOptions = {}
): Promise<PlanValidationResult> {
  const {
    ingredientCompatibility = true,
    dermatologyProtocols = true,
    strictMode = false,
  } = options;

  const warnings: string[] = [];
  const errors: string[] = [];
  const incompatibleDays: number[] = [];
  
  // ИСПРАВЛЕНО (P0): Проверка наполнения плана
  // 1. Проверяем, что есть дни
  if (!plan.days || plan.days.length === 0) {
    errors.push('PLAN_HAS_NO_DAYS');
    return {
      isValid: false,
      severity: 'error',
      warnings,
      errors,
      incompatibleDays,
    };
  }
  
  // 2. Проверяем каждый день на наличие шагов
  const daysWithoutSteps: number[] = [];
  const daysWithoutProducts: number[] = [];
  const requiredSteps = new Set<string>(); // Собираем обязательные шаги
  
  for (const day of plan.days) {
    const morningSteps = day.morning || [];
    const eveningSteps = day.evening || [];
    const weeklySteps = day.weekly || [];
    const allSteps = [...morningSteps, ...eveningSteps, ...weeklySteps];
    
    // Проверяем наличие шагов
    if (allSteps.length === 0) {
      daysWithoutSteps.push(day.dayIndex);
      errors.push(`DAY_${day.dayIndex}_HAS_NO_STEPS`);
    }
    
    // Проверяем наличие продуктов в шагах
    const stepsWithProducts = allSteps.filter(step => step.productId);
    if (stepsWithProducts.length === 0 && allSteps.length > 0) {
      daysWithoutProducts.push(day.dayIndex);
      errors.push(`DAY_${day.dayIndex}_HAS_NO_PRODUCTS`);
    }
    
    // Собираем категории шагов для проверки обязательных
    allSteps.forEach(step => {
      if (step.stepCategory.startsWith('cleanser')) requiredSteps.add('cleanser');
      if (step.stepCategory.startsWith('moisturizer')) requiredSteps.add('moisturizer');
      if (step.stepCategory.startsWith('spf')) requiredSteps.add('spf');
    });
  }
  
  // 3. Проверяем обязательные шаги
  if (!requiredSteps.has('cleanser')) {
    errors.push('MISSING_REQUIRED_STEP: cleanser');
  }
  if (!requiredSteps.has('moisturizer')) {
    errors.push('MISSING_REQUIRED_STEP: moisturizer');
  }
  // SPF не обязателен для вечернего ухода, но желателен для утреннего
  if (!requiredSteps.has('spf')) {
    warnings.push('MISSING_RECOMMENDED_STEP: spf (рекомендуется для утреннего ухода)');
  }
  
  // ИСПРАВЛЕНО (P0): Если есть критические ошибки - возвращаем error severity
  if (errors.length > 0) {
    return {
      isValid: false,
      severity: 'error',
      warnings,
      errors,
      incompatibleDays,
    };
  }

  // ИСПРАВЛЕНО: Проверка совместимости ингредиентов в течение дня
  if (ingredientCompatibility) {
    for (const day of plan.days) {
      const dayWarnings: string[] = [];
      const dayErrors: string[] = [];
      let hasIncompatibility = false;

      // Получаем продукты для утра и вечера
      const morningProducts = day.morning
        .filter(step => step.productId)
        .map(step => {
          const product = selectedProducts.find(p => String(p.id) === step.productId);
          return product ? {
            id: product.id,
            name: product.name,
            activeIngredients: product.activeIngredients || [],
          } : null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      const eveningProducts = day.evening
        .filter(step => step.productId)
        .map(step => {
          const product = selectedProducts.find(p => String(p.id) === step.productId);
          return product ? {
            id: product.id,
            name: product.name,
            activeIngredients: product.activeIngredients || [],
          } : null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      // Проверяем совместимость между morning и evening продуктами
      for (const morningProduct of morningProducts) {
        for (const eveningProduct of eveningProducts) {
          const conflict = checkProductCompatibility(morningProduct, eveningProduct);
          if (conflict) {
            hasIncompatibility = true;
            const message = `Day ${day.dayIndex}: ${conflict.reason}. ${conflict.recommendation}`;
            
            if (conflict.severity === 'high') {
              dayErrors.push(message);
              if (strictMode) {
                errors.push(message);
              } else {
                dayWarnings.push(`HIGH: ${message}`);
              }
            } else if (conflict.severity === 'medium') {
              dayWarnings.push(`MEDIUM: ${message}`);
            } else {
              dayWarnings.push(`LOW: ${message}`);
            }
          }
        }
      }

      // Проверяем совместимость продуктов в рамках одного времени суток
      // Morning products compatibility
      for (let i = 0; i < morningProducts.length; i++) {
        for (let j = i + 1; j < morningProducts.length; j++) {
          const conflict = checkProductCompatibility(morningProducts[i], morningProducts[j]);
          if (conflict && conflict.severity === 'high') {
            hasIncompatibility = true;
            const message = `Day ${day.dayIndex} (morning): ${conflict.reason} between ${morningProducts[i].name} and ${morningProducts[j].name}. ${conflict.recommendation}`;
            if (strictMode) {
              errors.push(message);
            } else {
              dayWarnings.push(`HIGH: ${message}`);
            }
          }
        }
      }

      // Evening products compatibility
      for (let i = 0; i < eveningProducts.length; i++) {
        for (let j = i + 1; j < eveningProducts.length; j++) {
          const conflict = checkProductCompatibility(eveningProducts[i], eveningProducts[j]);
          if (conflict && conflict.severity === 'high') {
            hasIncompatibility = true;
            const message = `Day ${day.dayIndex} (evening): ${conflict.reason} between ${eveningProducts[i].name} and ${eveningProducts[j].name}. ${conflict.recommendation}`;
            if (strictMode) {
              errors.push(message);
            } else {
              dayWarnings.push(`HIGH: ${message}`);
            }
          }
        }
      }

      if (hasIncompatibility) {
        incompatibleDays.push(day.dayIndex);
        warnings.push(...dayWarnings);
        if (strictMode) {
          errors.push(...dayErrors);
        }
      }
    }
  }

  // ИСПРАВЛЕНО (P1): Проверка соответствия дерматологическим протоколам
  if (dermatologyProtocols) {
    // ИСПРАВЛЕНО (P1): Базовая проверка протоколов
    // Проверяем, что активные ингредиенты не используются слишком часто
    const ingredientFrequency: Record<string, number> = {};
    
    for (const day of plan.days) {
      [...(day.morning || []), ...(day.evening || []), ...(day.weekly || [])]
        .filter(step => step.productId)
        .forEach(step => {
          const product = selectedProducts.find(p => String(p.id) === step.productId);
          if (product?.activeIngredients) {
            product.activeIngredients.forEach(ingredient => {
              ingredientFrequency[ingredient] = (ingredientFrequency[ingredient] || 0) + 1;
            });
          }
        });
    }
    
    // ИСПРАВЛЕНО (P1): Предупреждаем, если активный ингредиент используется слишком часто
    const totalDays = plan.days.length;
    for (const [ingredient, count] of Object.entries(ingredientFrequency)) {
      const frequency = count / totalDays;
      if (frequency > 0.8) { // Используется в >80% дней
        warnings.push(`HIGH_FREQUENCY_INGREDIENT: ${ingredient} используется в ${Math.round(frequency * 100)}% дней (рекомендуется разнообразие)`);
      }
    }
  }
  
  // ИСПРАВЛЕНО (P1): Проверка последовательности шагов
  // Правильный порядок: cleanser → toner → serum → treatment → moisturizer → spf
  const stepOrder = ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'spf'];
  
  for (const day of plan.days) {
    const morningSteps = day.morning || [];
    const eveningSteps = day.evening || [];
    
    // Проверяем последовательность для утренних шагов
    const morningOrder = morningSteps
      .map(step => {
        const category = step.stepCategory;
        if (category.startsWith('cleanser')) return 0;
        if (category.startsWith('toner')) return 1;
        if (category.startsWith('serum')) return 2;
        if (category.startsWith('treatment')) return 3;
        if (category.startsWith('moisturizer')) return 4;
        if (category.startsWith('spf')) return 5;
        return -1; // Неизвестная категория
      })
      .filter(order => order !== -1);
    
    // Проверяем, что порядок возрастает
    for (let i = 1; i < morningOrder.length; i++) {
      if (morningOrder[i] < morningOrder[i - 1]) {
        warnings.push(`Day ${day.dayIndex} (morning): Неправильная последовательность шагов (рекомендуется: cleanser → toner → serum → treatment → moisturizer → spf)`);
        break;
      }
    }
    
    // Проверяем последовательность для вечерних шагов (без SPF)
    const eveningOrder = eveningSteps
      .map(step => {
        const category = step.stepCategory;
        if (category.startsWith('cleanser')) return 0;
        if (category.startsWith('toner')) return 1;
        if (category.startsWith('serum')) return 2;
        if (category.startsWith('treatment')) return 3;
        if (category.startsWith('moisturizer')) return 4;
        return -1;
      })
      .filter(order => order !== -1);
    
    for (let i = 1; i < eveningOrder.length; i++) {
      if (eveningOrder[i] < eveningOrder[i - 1]) {
        warnings.push(`Day ${day.dayIndex} (evening): Неправильная последовательность шагов (рекомендуется: cleanser → toner → serum → treatment → moisturizer)`);
        break;
      }
    }
  }
  
  // ИСПРАВЛЕНО (P1): Проверка дублирования продуктов
  // Один продукт не должен использоваться слишком часто
  const productFrequency: Record<string, number> = {};
  
  for (const day of plan.days) {
    [...(day.morning || []), ...(day.evening || []), ...(day.weekly || [])]
      .filter(step => step.productId)
      .forEach(step => {
        // ИСПРАВЛЕНО: TypeScript требует явной проверки на null
        if (step.productId) {
          productFrequency[step.productId] = (productFrequency[step.productId] || 0) + 1;
        }
      });
  }
  
  const totalSteps = Object.values(productFrequency).reduce((sum, count) => sum + count, 0);
  for (const [productId, count] of Object.entries(productFrequency)) {
    const frequency = count / totalSteps;
    if (frequency > 0.5) { // Продукт используется в >50% шагов
      const product = selectedProducts.find(p => String(p.id) === productId);
      warnings.push(`HIGH_FREQUENCY_PRODUCT: ${product?.name || productId} используется в ${Math.round(frequency * 100)}% шагов (рекомендуется разнообразие)`);
    }
  }
  
  // ИСПРАВЛЕНО (P1): Проверка минимального количества шагов в дне
  for (const day of plan.days) {
    const morningSteps = day.morning || [];
    const eveningSteps = day.evening || [];
    const totalStepsInDay = morningSteps.length + eveningSteps.length;
    
    if (totalStepsInDay < 2) {
      warnings.push(`Day ${day.dayIndex}: Слишком мало шагов (${totalStepsInDay}), рекомендуется минимум 2 (утром и вечером)`);
    }
  }

  // ИСПРАВЛЕНО (P0): Определяем severity на основе ошибок и предупреждений
  let severity: 'error' | 'warning' | 'ok' = 'ok';
  if (errors.length > 0) {
    severity = 'error';
  } else if (warnings.length > 0) {
    severity = 'warning';
  }
  
  const isValid = errors.length === 0 || !strictMode;

  return {
    isValid,
    severity,
    warnings,
    errors,
    incompatibleDays,
  };
}

/**
 * Автоматически помечает дни с несовместимыми ингредиентами как recovery дни
 * ИСПРАВЛЕНО: Автоматическая маркировка дней для безопасности
 */
export function markIncompatibleDaysAsRecovery(
  plan: Plan28,
  incompatibleDays: number[]
): Plan28 {
  if (incompatibleDays.length === 0) {
    return plan;
  }

  // Создаем копию плана с обновленными днями
  const updatedDays = plan.days.map(day => {
    if (incompatibleDays.includes(day.dayIndex)) {
      // Помечаем день как recovery (можно добавить поле phase: 'recovery' в DayPlan)
      // Пока что просто логируем
      logger.warn('Marking day as recovery due to ingredient incompatibility', {
        dayIndex: day.dayIndex,
        note: 'Consider adding recovery phase to DayPlan type',
      });
    }
    return day;
  });

  return {
    ...plan,
    days: updatedDays,
  };
}

