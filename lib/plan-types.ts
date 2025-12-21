// lib/plan-types.ts
// Типы для структуры 28-дневного плана ухода
// ИСПРАВЛЕНО: Только типы, функции вынесены в plan-formatters.ts

import type { StepCategory } from './step-category-rules';
import type { GoalKey } from './concern-taxonomy';

export type PlanPhases = "adaptation" | "active" | "support";

export interface DayStep {
  stepCategory: StepCategory;
  productId: string | null;       // рекомендованный продукт
  alternatives: string[];         // ids возможных замен
}

export interface DayRoutine {
  morning: DayStep[];
  evening: DayStep[];
  weekly: DayStep[];              // шаги, которые в этот день должны быть (маски/пилинги)
}

export interface DayMeta {
  dayIndex: number;        // 1..28
  phase: PlanPhases;
  isWeeklyFocusDay: boolean; // день маски/пилинга
}

export interface DayPlan extends DayMeta, DayRoutine {}

export interface Plan28 {
  userId: string;
  skinProfileId: string;
  days: DayPlan[];       // 28 элементов
  mainGoals: GoalKey[];   // ИСПРАВЛЕНО: используем GoalKey вместо string[]
}

// Нормализованный тип продукта для DomainContext (обёртка над ProductWithBrand)
// ИСПРАВЛЕНО: Используем type import для избежания циклических зависимостей
export type Product = import('./product-fallback').ProductWithBrand;

// Типы для инфографики прогресса по целям
export interface GoalProgressPoint {
  day: number;
  relativeLevel: number; // 0..100
}

export interface GoalProgressCurve {
  goalKey: GoalKey;
  points: GoalProgressPoint[];
}

// ИСПРАВЛЕНО: Функции вынесены в plan-formatters.ts
// Реэкспортируем для обратной совместимости
export {
  getPhaseForDay,
  getPhaseLabel,
  getPhaseDescription,
  isWeeklyFocusDay,
  getStepDescription,
  getStepCategoryLabel,
} from './plan-formatters';

// Реэкспортируем тип отдельно (интерфейс нужно экспортировать через export type)
export type { StepDescription } from './plan-formatters';
