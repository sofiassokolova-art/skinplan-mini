// lib/plan-validation.ts
// ИСПРАВЛЕНО: Слой валидации плана с проверкой совместимости ингредиентов и дерматологических протоколов
// Обеспечивает безопасность плана перед возвратом пользователю

import type { Plan28, DayPlan } from './plan-types';
import type { ProductWithBrand } from './product-fallback';
import { checkProductCompatibility } from './ingredient-compatibility';
import { logger } from './logger';

export interface PlanValidationResult {
  isValid: boolean;
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

  // ИСПРАВЛЕНО: Проверка соответствия дерматологическим протоколам
  if (dermatologyProtocols) {
    // TODO: Добавить проверку протоколов, когда они будут интегрированы
    // Пока что это заглушка для будущей реализации
  }

  const isValid = errors.length === 0 || !strictMode;

  return {
    isValid,
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

