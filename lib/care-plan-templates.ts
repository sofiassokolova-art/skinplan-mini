// lib/care-plan-templates.ts
// Слой Care Plan Template: структурированные шаблоны ухода (утро/вечер/неделя)
//
// Шаблоны опираются на:
// - skinType (из SkinProfile)
// - mainGoals (основные цели: acne, pigmentation, barrier, antiage и т.п.)
// - sensitivity (уровень чувствительности)
// - routineComplexity (минимум / средний / максимум)

import type { StepCategory } from './step-category-rules';

export type RoutineComplexity = 'minimal' | 'medium' | 'maximal';

export type CarePlanTemplate = {
  id: string;
  conditions: {
    skinTypes?: string[];
    mainGoals?: string[];
    sensitivityLevels?: string[];
    routineComplexity?: RoutineComplexity[];
  };
  morning: StepCategory[];
  evening: StepCategory[];
  weekly?: StepCategory[];
};

export type CarePlanProfileInput = {
  skinType: string;
  mainGoals: string[]; // ['acne', 'pigmentation', ...]
  sensitivityLevel: string; // low / medium / high / very_high
  routineComplexity: RoutineComplexity;
};

export const CARE_PLAN_TEMPLATES: CarePlanTemplate[] = [
  {
    id: 'acne_oily_basic',
    conditions: {
      skinTypes: ['oily', 'combo', 'combination_oily'],
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
    evening: ['cleanser_gentle', 'treatment_antiage', 'moisturizer_light'],
  },
];

export function selectCarePlanTemplate(
  profile: CarePlanProfileInput
): CarePlanTemplate {
  const { skinType, mainGoals, sensitivityLevel, routineComplexity } = profile;

  const matchesTemplate = (tpl: CarePlanTemplate): boolean => {
    const cond = tpl.conditions;

    if (cond.skinTypes && cond.skinTypes.length > 0) {
      if (!cond.skinTypes.includes(skinType)) return false;
    }

    if (cond.mainGoals && cond.mainGoals.length > 0) {
      const hasAnyGoal = cond.mainGoals.some((g) => mainGoals.includes(g));
      if (!hasAnyGoal) return false;
    }

    if (cond.sensitivityLevels && cond.sensitivityLevels.length > 0) {
      if (!cond.sensitivityLevels.includes(sensitivityLevel)) return false;
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


