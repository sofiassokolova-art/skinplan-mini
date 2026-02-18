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

// ============================================
// РЕФАКТОРИНГ P2: Консолидированные типы PlanData
// ============================================

/**
 * Информация о пользователе для страницы плана
 */
export interface PlanUserInfo {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Информация о профиле для страницы плана
 * scores - может быть SkinScore[] или упрощенный формат
 */
export interface PlanProfileInfo {
  id: string;
  skinType: string;
  skinTypeRu: string;
  primaryConcernRu: string;
  sensitivityLevel: string | null;
  acneLevel: number | null;
  scores?: unknown[]; // Может быть SkinScore[] или другой формат
}

/**
 * Legacy формат дней плана (для обратной совместимости)
 */
export interface PlanWeekLegacy {
  week: number;
  days: Array<{
    morning: number[];
    evening: number[];
  }>;
}

/**
 * Информация о прогрессе плана
 */
export interface PlanProgressInfo {
  currentDay: number;
  completedDays: number[];
}

/**
 * Информация о продукте в плане
 */
export interface PlanProductInfo {
  id: number;
  name: string;
  brand: { name: string; id?: number };
  price?: number | null;
  volume?: string | null;
  imageUrl?: string | null;
  description?: string;
  step?: string;
  category?: string;
}

/**
 * Консолидированный тип для данных страницы плана
 * Объединяет новый формат (Plan28) и legacy формат
 */
export interface PlanPageData {
  // Новый формат (plan28)
  plan28?: Plan28;
  productsMap?: Map<number, PlanProductInfo>;
  planExpired?: boolean;
  
  // Legacy формат (для обратной совместимости)
  user?: PlanUserInfo;
  profile?: PlanProfileInfo;
  plan?: {
    weeks: PlanWeekLegacy[];
  };
  progress?: PlanProgressInfo;
  
  // Общие поля
  wishlist: number[];
  currentDay: number;
  currentWeek?: number;
  todayProducts?: PlanProductInfo[];
}
