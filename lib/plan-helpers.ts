// lib/plan-helpers.ts
// ИСПРАВЛЕНО (P0): Вспомогательные функции для работы с планом ухода
// Helpers возвращают информацию о пустоте для валидации

import type { StepCategory } from './step-category-rules';
import type { Plan28, DayPlan, DayStep } from './plan-types';
// ИСПРАВЛЕНО: Используем StepType для базовых шагов
import { StepType, getStepTypeFromCategory } from './step-type';

/**
 * Получает базовый шаг из StepCategory
 * ИСПРАВЛЕНО: Использует StepType enum для согласованности
 * Например: 'toner_hydrating' -> 'toner', 'serum_niacinamide' -> 'serum'
 */

export function getBaseStepFromStepCategory(stepCategory: StepCategory): string {
  // ИСПРАВЛЕНО: Используем StepType для согласованности
  const stepType = getStepTypeFromCategory(stepCategory);
  return stepType; // StepType enum value is already a string
}

/**
 * Проверяет, является ли шаг очищающим средством
 */
export function isCleanserStep(step: StepCategory | string): boolean {
  return typeof step === 'string' && (step.startsWith('cleanser_') || step === 'cleanser');
}

/**
 * Проверяет, является ли шаг SPF
 */
export function isSPFStep(step: StepCategory | string): boolean {
  return typeof step === 'string' && (step.startsWith('spf_') || step === 'spf' || step.toLowerCase().includes('spf'));
}

/**
 * Проверяет, является ли шаг тонером
 */
export function isTonerStep(step: StepCategory | string): boolean {
  return typeof step === 'string' && (step.startsWith('toner_') || step === 'toner');
}

/**
 * Проверяет, является ли шаг сывороткой
 */
export function isSerumStep(step: StepCategory | string): boolean {
  return typeof step === 'string' && (step.startsWith('serum_') || step === 'serum');
}

/**
 * Проверяет, является ли шаг увлажняющим кремом
 */
export function isMoisturizerStep(step: StepCategory | string): boolean {
  return typeof step === 'string' && (
    step.startsWith('moisturizer_') ||
    step.startsWith('eye_cream_') ||
    step.startsWith('balm_') ||
    step === 'moisturizer'
  );
}

/**
 * ИСПРАВЛЕНО (P0): Получает все шаги из плана с проверкой на пустоту
 */
export function getAllSteps(plan: Plan28): { steps: DayStep[]; isEmpty: boolean; count: number } {
  const steps: DayStep[] = [];
  
  for (const day of plan.days) {
    steps.push(...(day.morning || []));
    steps.push(...(day.evening || []));
    steps.push(...(day.weekly || []));
  }
  
  return {
    steps,
    isEmpty: steps.length === 0,
    count: steps.length,
  };
}

/**
 * ИСПРАВЛЕНО (P0): Получает все продукты из плана с проверкой на пустоту
 */
export function getAllProducts(plan: Plan28): { productIds: string[]; isEmpty: boolean; count: number } {
  const productIds = new Set<string>();
  
  for (const day of plan.days) {
    [...(day.morning || []), ...(day.evening || []), ...(day.weekly || [])]
      .forEach(step => {
        if (step.productId) {
          productIds.add(step.productId);
        }
      });
  }
  
  const productIdsArray = Array.from(productIds);
  
  return {
    productIds: productIdsArray,
    isEmpty: productIdsArray.length === 0,
    count: productIdsArray.length,
  };
}

/**
 * ИСПРАВЛЕНО (P0): Подсчитывает шаги по категориям с проверкой на пустоту
 */
export function countStepsByCategory(plan: Plan28): { 
  counts: Record<string, number>; 
  isEmpty: boolean; 
  totalCount: number;
} {
  const counts: Record<string, number> = {};
  let totalCount = 0;
  
  for (const day of plan.days) {
    [...(day.morning || []), ...(day.evening || []), ...(day.weekly || [])]
      .forEach(step => {
        const category = step.stepCategory;
        counts[category] = (counts[category] || 0) + 1;
        totalCount++;
      });
  }
  
  return {
    counts,
    isEmpty: totalCount === 0,
    totalCount,
  };
}

/**
 * ИСПРАВЛЕНО (P2): Анализирует покрытие плана (coverage)
 * Проверяет, насколько хорошо план покрывает все необходимые категории шагов
 */
export function analyzePlanCoverage(plan: Plan28): {
  coverage: number; // 0-100, процент покрытия
  missingCategories: string[];
  coveredCategories: string[];
} {
  const requiredCategories = ['cleanser', 'moisturizer'];
  const recommendedCategories = ['toner', 'serum', 'spf'];
  
  const categoryCounts = countStepsByCategory(plan);
  const coveredCategories: string[] = [];
  const missingCategories: string[] = [];
  
  // Проверяем обязательные категории
  for (const category of requiredCategories) {
    const hasCategory = Object.keys(categoryCounts.counts).some(cat => cat.startsWith(category));
    if (hasCategory) {
      coveredCategories.push(category);
    } else {
      missingCategories.push(category);
    }
  }
  
  // Проверяем рекомендуемые категории
  for (const category of recommendedCategories) {
    const hasCategory = Object.keys(categoryCounts.counts).some(cat => cat.startsWith(category));
    if (hasCategory) {
      coveredCategories.push(category);
    }
  }
  
  // Вычисляем покрытие: обязательные = 100%, рекомендуемые = бонус
  const requiredCoverage = (coveredCategories.filter(c => requiredCategories.includes(c)).length / requiredCategories.length) * 100;
  const recommendedCoverage = (coveredCategories.filter(c => recommendedCategories.includes(c)).length / recommendedCategories.length) * 20; // Максимум 20% бонуса
  const coverage = Math.min(100, requiredCoverage + recommendedCoverage);
  
  return {
    coverage,
    missingCategories,
    coveredCategories,
  };
}

/**
 * ИСПРАВЛЕНО (P2): Анализирует разнообразие продуктов (diversity)
 * Проверяет, насколько разнообразны продукты в плане
 */
export function analyzeProductDiversity(plan: Plan28): {
  diversity: number; // 0-100, индекс разнообразия
  uniqueProducts: number;
  totalSteps: number;
  productFrequency: Record<string, number>;
} {
  const productFrequency: Record<string, number> = {};
  let totalSteps = 0;
  
  for (const day of plan.days) {
    [...(day.morning || []), ...(day.evening || []), ...(day.weekly || [])]
      .filter(step => step.productId)
      .forEach(step => {
        // ИСПРАВЛЕНО: TypeScript требует явной проверки на null
        if (step.productId) {
          productFrequency[step.productId] = (productFrequency[step.productId] || 0) + 1;
          totalSteps++;
        }
      });
  }
  
  const uniqueProducts = Object.keys(productFrequency).length;
  
  // Вычисляем индекс разнообразия (Shannon diversity index упрощённый)
  // Максимальное разнообразие = все продукты используются одинаково часто
  let diversity = 0;
  if (uniqueProducts > 0 && totalSteps > 0) {
    const maxDiversity = Math.log(uniqueProducts);
    let shannonIndex = 0;
    
    for (const count of Object.values(productFrequency)) {
      const proportion = count / totalSteps;
      if (proportion > 0) {
        shannonIndex -= proportion * Math.log(proportion);
      }
    }
    
    // Нормализуем к 0-100
    diversity = maxDiversity > 0 ? (shannonIndex / maxDiversity) * 100 : 0;
  }
  
  return {
    diversity: Math.round(diversity),
    uniqueProducts,
    totalSteps,
    productFrequency,
  };
}

/**
 * ИСПРАВЛЕНО (P2): Анализирует баланс плана (balance)
 * Проверяет, насколько сбалансирован план по времени суток и фазам
 */
export function analyzePlanBalance(plan: Plan28): {
  morningSteps: number;
  eveningSteps: number;
  weeklySteps: number;
  balance: number; // 0-100, баланс между утром и вечером
  phaseDistribution: Record<string, number>; // Распределение по фазам
} {
  let morningSteps = 0;
  let eveningSteps = 0;
  let weeklySteps = 0;
  const phaseDistribution: Record<string, number> = {};
  
  for (const day of plan.days) {
    morningSteps += (day.morning || []).length;
    eveningSteps += (day.evening || []).length;
    weeklySteps += (day.weekly || []).length;
    
    const phase = day.phase || 'unknown';
    phaseDistribution[phase] = (phaseDistribution[phase] || 0) + 1;
  }
  
  // Вычисляем баланс: идеальный баланс = утро и вечер примерно равны
  const totalDailySteps = morningSteps + eveningSteps;
  const balance = totalDailySteps > 0
    ? 100 - Math.abs((morningSteps - eveningSteps) / totalDailySteps) * 100
    : 0;
  
  return {
    morningSteps,
    eveningSteps,
    weeklySteps,
    balance: Math.round(balance),
    phaseDistribution,
  };
}

/**
 * ИСПРАВЛЕНО (P2): Проверяет последовательность шагов в дне
 * Возвращает true, если последовательность правильная
 */
export function validateStepSequence(day: DayPlan): {
  isValid: boolean;
  morningSequence: string[];
  eveningSequence: string[];
  issues: string[];
} {
  const stepOrder = ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'spf'];
  
  const getStepOrder = (category: string): number => {
    if (category.startsWith('cleanser')) return 0;
    if (category.startsWith('toner')) return 1;
    if (category.startsWith('serum')) return 2;
    if (category.startsWith('treatment')) return 3;
    if (category.startsWith('moisturizer')) return 4;
    if (category.startsWith('spf')) return 5;
    return -1;
  };
  
  const morningSteps = (day.morning || []).map(step => step.stepCategory);
  const eveningSteps = (day.evening || []).map(step => step.stepCategory);
  
  const morningOrder = morningSteps.map(getStepOrder).filter(order => order !== -1);
  const eveningOrder = eveningSteps.map(getStepOrder).filter(order => order !== -1);
  
  const issues: string[] = [];
  let isValid = true;
  
  // Проверяем последовательность утренних шагов
  for (let i = 1; i < morningOrder.length; i++) {
    if (morningOrder[i] < morningOrder[i - 1]) {
      isValid = false;
      issues.push(`Morning: неправильная последовательность шагов`);
      break;
    }
  }
  
  // Проверяем последовательность вечерних шагов
  for (let i = 1; i < eveningOrder.length; i++) {
    if (eveningOrder[i] < eveningOrder[i - 1]) {
      isValid = false;
      issues.push(`Evening: неправильная последовательность шагов`);
      break;
    }
  }
  
  return {
    isValid,
    morningSequence: morningSteps,
    eveningSequence: eveningSteps,
    issues,
  };
}

