// lib/care-plan-templates.ts
// Слой Care Plan Template: структурированные шаблоны ухода (утро/вечер/неделя)
//
// Шаблоны опираются на:
// - skinType (из SkinProfile)
// - mainGoals (основные цели: acne, pigmentation, barrier, antiage и т.п.)
// - sensitivity (уровень чувствительности)
// - routineComplexity (минимум / средний / максимум)

import type { StepCategory } from './step-category-rules';
import type { GoalKey } from './concern-taxonomy';
import type { SkinProfile } from './skinprofile-types';

export type RoutineComplexity = 'minimal' | 'medium' | 'maximal';

export type CarePlanTemplate = {
  id: string;
  conditions: {
    skinTypes?: Array<NonNullable<SkinProfile["skinType"]>>;
    mainGoals?: GoalKey[]; // ИСПРАВЛЕНО: Используем GoalKey вместо string[]
    sensitivityLevels?: Array<NonNullable<SkinProfile["sensitivity"]>>;
    routineComplexity?: RoutineComplexity[];
  };
  morning: StepCategory[];
  evening: StepCategory[];
  weekly?: StepCategory[];
};

export type CarePlanProfileInput = {
  skinType: SkinProfile["skinType"]; // ИСПРАВЛЕНО: Используем union тип
  mainGoals: GoalKey[]; // ИСПРАВЛЕНО: Используем GoalKey вместо string[]
  sensitivityLevel: SkinProfile["sensitivity"]; // ИСПРАВЛЕНО: Используем union тип
  routineComplexity: RoutineComplexity;
};

export const CARE_PLAN_TEMPLATES: CarePlanTemplate[] = [
  {
    id: 'acne_oily_basic',
    conditions: {
      skinTypes: ['oily', 'combination_oily'],
      mainGoals: ['acne'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_balancing', 'serum_niacinamide', 'moisturizer_balancing', 'spf_50_oily'],
    evening: ['cleanser_balancing', 'treatment_acne_azelaic', 'moisturizer_balancing'],
    weekly: ['mask_clay'],
  },
  {
    id: 'dry_sensitive_barrier',
    conditions: {
      skinTypes: ['dry', 'combination_dry', 'normal'],
      mainGoals: ['barrier', 'dehydration'],
      sensitivityLevels: ['medium', 'high', 'very_high'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'serum_hydrating', 'moisturizer_barrier', 'spf_50_sensitive'],
    evening: ['cleanser_gentle', 'moisturizer_barrier'],
    weekly: ['mask_soothing'],
  },
  {
    id: 'pigmentation_focus',
    conditions: {
      mainGoals: ['pigmentation'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'serum_vitc', 'spf_50_face'],
    evening: ['cleanser_gentle', 'treatment_pigmentation', 'moisturizer_light'],
    weekly: ['mask_hydrating'],
  },
  {
    id: 'minimalist_any_skin',
    conditions: {
      routineComplexity: ['minimal'],
    },
    morning: ['cleanser_gentle', 'spf_50_face'],
    evening: ['cleanser_gentle', 'moisturizer_light'],
  },
  {
    id: 'default_balanced',
    conditions: {},
    morning: ['cleanser_gentle', 'serum_hydrating', 'moisturizer_light', 'spf_50_face'],
    evening: ['cleanser_gentle', 'treatment_antiage', 'moisturizer_light'], // treatment_antiage будет заменено на подходящее лечение в зависимости от mainGoals
  },
];

export function selectCarePlanTemplate(
  profile: CarePlanProfileInput
): CarePlanTemplate {
  const { skinType, mainGoals, sensitivityLevel, routineComplexity } = profile;

  // ИСПРАВЛЕНО: Нормализуем тип кожи для сравнения с шаблонами
  // Шаблоны могут использовать "combo", "combination_dry", "combination_oily"
  // Нужно проверить все варианты
  const normalizeForTemplateMatch = (dbSkinType: NonNullable<SkinProfile["skinType"]>): string[] => {
    if (dbSkinType === 'combination_dry' || dbSkinType === 'combination_oily') {
      return [dbSkinType];
    }
    return [dbSkinType];
  };

  const matchesTemplate = (tpl: CarePlanTemplate): boolean => {
    const cond = tpl.conditions;

    if (cond.skinTypes && cond.skinTypes.length > 0) {
      // ИСПРАВЛЕНО: Проверяем все нормализованные варианты типа кожи
      if (!skinType) return false; // Если тип кожи не указан, не подходит
      const normalizedVariants = normalizeForTemplateMatch(skinType);
      const hasMatch = normalizedVariants.some(variant => cond.skinTypes!.includes(variant as NonNullable<SkinProfile["skinType"]>));
      if (!hasMatch) return false;
    }

    if (cond.mainGoals && cond.mainGoals.length > 0) {
      const hasAnyGoal = cond.mainGoals.some((g) => mainGoals.includes(g));
      if (!hasAnyGoal) return false;
    }

    if (cond.sensitivityLevels && cond.sensitivityLevels.length > 0) {
      // ИСПРАВЛЕНО: Проверяем соответствие уровня чувствительности
      // В БД может быть "high", но в шаблонах может быть "very_high"
      // Если в шаблоне есть "very_high", а в БД "high", это не совпадает
      // Но если в шаблоне есть "high", а в БД "high", это совпадает
      if (!sensitivityLevel || !cond.sensitivityLevels.includes(sensitivityLevel)) return false;
    }

    if (cond.routineComplexity && cond.routineComplexity.length > 0) {
      if (!cond.routineComplexity.includes(routineComplexity)) return false;
    }

    return true;
  };

  const matched =
    CARE_PLAN_TEMPLATES.find((tpl) => matchesTemplate(tpl)) ||
    CARE_PLAN_TEMPLATES.find((tpl) => tpl.id === 'default_balanced')!;

  return matched;
}


