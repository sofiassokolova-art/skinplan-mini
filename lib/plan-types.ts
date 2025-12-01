// lib/plan-types.ts
// Типы для структуры 28-дневного плана ухода

import type { StepCategory } from './step-category-rules';

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
  mainGoals: string[];   // из SkinProfile
}

// Типы для инфографики прогресса по целям
export interface GoalProgressPoint {
  day: number;
  relativeLevel: number; // 0..100
}

export interface GoalProgressCurve {
  goalKey: "acne" | "pores" | "pigmentation" | "barrier" | "hydration" | "wrinkles" | "redness";
  points: GoalProgressPoint[];
}

// Вспомогательные функции
export function getPhaseForDay(dayIndex: number): PlanPhases {
  if (dayIndex >= 1 && dayIndex <= 7) return "adaptation";
  if (dayIndex >= 8 && dayIndex <= 21) return "active";
  return "support";
}

export function getPhaseLabel(phase: PlanPhases): string {
  switch (phase) {
    case "adaptation":
      return "Адаптация";
    case "active":
      return "Активная фаза";
    case "support":
      return "Поддержка";
  }
}

export function getPhaseDescription(phase: PlanPhases, goals: string[]): string {
  const goalsText = goals.length > 0 ? goals.join(", ") : "улучшение состояния кожи";
  
  switch (phase) {
    case "adaptation":
      return `Мягкое внедрение ухода. Мы постепенно знакомим кожу с новыми средствами, минимизируя раздражение. Фокус на ${goalsText}.`;
    case "active":
      return `Активная фаза работы. Подключаем активные ингредиенты для решения задач: ${goalsText}.`;
    case "support":
      return `Фаза закрепления результатов. Поддерживаем достигнутый прогресс и укрепляем барьер кожи.`;
  }
}

// Функция для определения, является ли день недельным фокусом (маска/пилинг)
export function isWeeklyFocusDay(dayIndex: number, weeklySteps: StepCategory[]): boolean {
  if (weeklySteps.length === 0) return false;
  
  // Маски/пилинги обычно делаются 1-2 раза в неделю
  // Распределяем их равномерно: дни 3, 10, 17, 24 (примерно раз в неделю)
  const weeklyDays = [3, 10, 17, 24];
  return weeklyDays.includes(dayIndex);
}

// Создаем пустой SkinProfile для инициализации
export function createEmptySkinProfile() {
  return {
    skinType: null,
    sensitivity: 'low' as const,
    mainGoals: [],
    secondaryGoals: [],
    diagnoses: [],
    seasonality: null,
    pregnancyStatus: null,
    contraindications: [],
    currentTopicals: [],
    currentOralMeds: [],
    spfHabit: 'never' as const,
    makeupFrequency: 'rarely' as const,
    lifestyleFactors: [],
    carePreference: 'any' as const,
    routineComplexity: 'any' as const,
    budgetSegment: 'any' as const,
  };
}

// Функция для получения человекочитаемого названия шага
export function getStepCategoryLabel(stepCategory: StepCategory): string {
  const labels: Record<StepCategory, string> = {
    // Очищение
    cleanser_gentle: "Очищение (мягкое)",
    cleanser_balancing: "Очищение (балансирующее)",
    cleanser_deep: "Очищение (глубокое)",
    // Тоник
    toner_hydrating: "Тоник (увлажняющий)",
    toner_soothing: "Тоник (успокаивающий)",
    // Сыворотки
    serum_hydrating: "Сыворотка (увлажняющая)",
    serum_niacinamide: "Сыворотка (ниацинамид)",
    serum_vitc: "Сыворотка (витамин C)",
    serum_anti_redness: "Сыворотка (против покраснений)",
    serum_brightening_soft: "Сыворотка (осветляющая)",
    // Лечение
    treatment_acne_bpo: "Лечение акне (BPO)",
    treatment_acne_azelaic: "Лечение акне (азелаиновая кислота)",
    treatment_acne_local: "Лечение акне (точечное)",
    treatment_exfoliant_mild: "Эксфолиант (мягкий)",
    treatment_exfoliant_strong: "Эксфолиант (сильный)",
    treatment_pigmentation: "Лечение пигментации",
    treatment_antiage: "Антиэйдж",
    // Увлажнение
    moisturizer_light: "Увлажнение (легкое)",
    moisturizer_balancing: "Увлажнение (балансирующее)",
    moisturizer_barrier: "Увлажнение (барьерное)",
    moisturizer_soothing: "Увлажнение (успокаивающее)",
    // Крем для век
    eye_cream_basic: "Крем для век",
    eye_cream_dark_circles: "Крем для век (темные круги)",
    eye_cream_puffiness: "Крем для век (отеки)",
    // SPF
    spf_50_face: "SPF 50",
    spf_50_oily: "SPF 50 (для жирной кожи)",
    spf_50_sensitive: "SPF 50 (для чувствительной кожи)",
    // Маски
    mask_clay: "Маска (глиняная)",
    mask_hydrating: "Маска (увлажняющая)",
    mask_soothing: "Маска (успокаивающая)",
    mask_sleeping: "Маска (ночная)",
    // Доп. уход
    spot_treatment: "Точечное лечение",
    lip_care: "Уход за губами",
    balm_barrier_repair: "Бальзам (восстановление барьера)",
  };
  
  return labels[stepCategory] || stepCategory;
}

