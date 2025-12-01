// lib/step-category-rules.ts
// Правила для stepCategory: какие поля SkinProfile учитывать при фильтре

import { SkinProfile } from './skinprofile-types';

export type StepCategory =
  // Очищение
  | "cleanser_gentle"
  | "cleanser_balancing"
  | "cleanser_deep"
  // Тоник / эссенция
  | "toner_hydrating"
  | "toner_soothing"
  // Сыворотки / активы (базовые)
  | "serum_hydrating"
  | "serum_niacinamide"
  | "serum_vitc"
  | "serum_anti_redness"
  | "serum_brightening_soft"
  // Лечебные/таргетированные средства
  | "treatment_acne_bpo"
  | "treatment_acne_azelaic"
  | "treatment_acne_local"
  | "treatment_exfoliant_mild"
  | "treatment_exfoliant_strong"
  | "treatment_pigmentation"
  | "treatment_antiage"
  // Увлажняющие кремы
  | "moisturizer_light"
  | "moisturizer_balancing"
  | "moisturizer_barrier"
  | "moisturizer_soothing"
  // Кремы/средства вокруг глаз
  | "eye_cream_basic"
  | "eye_cream_dark_circles"
  | "eye_cream_puffiness"
  // SPF
  | "spf_50_face"
  | "spf_50_oily"
  | "spf_50_sensitive"
  // Маски/доп.уход
  | "mask_clay"
  | "mask_hydrating"
  | "mask_soothing"
  | "mask_sleeping"
  // Доп. продукты
  | "spot_treatment"
  | "lip_care"
  | "balm_barrier_repair";

export type StepCategoryRule = {
  skinTypesAllowed?: string[];
  avoidIfContra?: string[];
  preferGoals?: string[];
  avoidDiagnoses?: string[];
};

export const STEP_CATEGORY_RULES: Record<StepCategory, StepCategoryRule> = {
  // --- Очищение ---
  cleanser_gentle: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: [],
    preferGoals: ["sensitivity", "dryness", "maintenance"],
    avoidDiagnoses: []
  },
  cleanser_balancing: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: [],
    preferGoals: ["acne", "pores", "oiliness"],
    avoidDiagnoses: ["atopic_dermatitis"]
  },
  cleanser_deep: {
    skinTypesAllowed: ["combination_oily", "oily", "normal"],
    avoidIfContra: ["very_high_sensitivity"],
    preferGoals: ["acne", "pores", "oiliness"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  // --- Тоники ---
  toner_hydrating: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily"],
    avoidIfContra: [],
    preferGoals: ["dryness", "maintenance", "wrinkles"],
    avoidDiagnoses: []
  },
  toner_soothing: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily"],
    avoidIfContra: [],
    preferGoals: ["sensitivity", "redness"],
    avoidDiagnoses: []
  },
  // --- Сыворотки/активы базовые ---
  serum_hydrating: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["no_hyaluronic"],
    preferGoals: ["dryness", "wrinkles", "maintenance"],
    avoidDiagnoses: []
  },
  serum_niacinamide: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["no_niacinamide"],
    preferGoals: ["acne", "pores", "oiliness", "pigmentation"],
    avoidDiagnoses: []
  },
  serum_vitc: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["no_vitc", "very_high_sensitivity"],
    preferGoals: ["pigmentation", "uneven_tone", "wrinkles"],
    avoidDiagnoses: ["rosacea"]
  },
  serum_anti_redness: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily"],
    avoidIfContra: [],
    preferGoals: ["sensitivity", "redness"],
    avoidDiagnoses: []
  },
  serum_brightening_soft: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily"],
    avoidIfContra: ["no_strong_acids"],
    preferGoals: ["pigmentation", "uneven_tone"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  // --- Лечебные / таргетированные ---
  treatment_acne_bpo: {
    skinTypesAllowed: ["combination_oily", "oily"],
    avoidIfContra: ["no_strong_acids", "very_high_sensitivity"],
    preferGoals: ["acne"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  treatment_acne_azelaic: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: [],
    preferGoals: ["acne", "pigmentation", "redness"],
    avoidDiagnoses: []
  },
  treatment_acne_local: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["very_high_sensitivity"],
    preferGoals: ["acne"],
    avoidDiagnoses: ["atopic_dermatitis"]
  },
  treatment_exfoliant_mild: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["no_strong_acids"],
    preferGoals: ["texture", "pores", "acne", "pigmentation"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  treatment_exfoliant_strong: {
    skinTypesAllowed: ["combination_oily", "oily"],
    avoidIfContra: ["no_strong_acids", "very_high_sensitivity"],
    preferGoals: ["pores", "acne", "texture", "pigmentation"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  treatment_pigmentation: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily"],
    avoidIfContra: ["no_strong_acids"],
    preferGoals: ["pigmentation", "uneven_tone"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  treatment_antiage: {
    skinTypesAllowed: ["dry", "normal", "combination_dry"],
    avoidIfContra: ["no_retinol"],
    preferGoals: ["wrinkles"],
    avoidDiagnoses: []
  },
  // --- Увлажняющие кремы ---
  moisturizer_light: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily"],
    avoidIfContra: [],
    preferGoals: ["maintenance", "oiliness"],
    avoidDiagnoses: []
  },
  moisturizer_balancing: {
    skinTypesAllowed: ["combination_oily", "oily"],
    avoidIfContra: [],
    preferGoals: ["oiliness", "pores", "acne"],
    avoidDiagnoses: ["atopic_dermatitis"]
  },
  moisturizer_barrier: {
    skinTypesAllowed: ["dry", "combination_dry", "normal"],
    avoidIfContra: [],
    preferGoals: ["dryness", "sensitivity", "atopic_dermatitis", "maintenance"],
    avoidDiagnoses: []
  },
  moisturizer_soothing: {
    skinTypesAllowed: ["dry", "normal", "combination_dry"],
    avoidIfContra: [],
    preferGoals: ["sensitivity", "redness"],
    avoidDiagnoses: []
  },
  // --- Глаза ---
  eye_cream_basic: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily"],
    avoidIfContra: [],
    preferGoals: ["maintenance"],
    avoidDiagnoses: []
  },
  eye_cream_dark_circles: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily"],
    avoidIfContra: [],
    preferGoals: ["dark_circles"],
    avoidDiagnoses: []
  },
  eye_cream_puffiness: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily"],
    avoidIfContra: [],
    preferGoals: ["puffiness"],
    avoidDiagnoses: []
  },
  // --- SPF ---
  spf_50_face: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily"],
    avoidIfContra: [],
    preferGoals: ["maintenance", "pigmentation", "wrinkles"],
    avoidDiagnoses: []
  },
  spf_50_oily: {
    skinTypesAllowed: ["combination_oily", "oily"],
    avoidIfContra: [],
    preferGoals: ["acne", "pores", "oiliness"],
    avoidDiagnoses: []
  },
  spf_50_sensitive: {
    skinTypesAllowed: ["dry", "normal", "combination_dry"],
    avoidIfContra: [],
    preferGoals: ["sensitivity", "redness", "melasma"],
    avoidDiagnoses: []
  },
  // --- Маски / доп. уход ---
  mask_clay: {
    skinTypesAllowed: ["combination_oily", "oily"],
    avoidIfContra: ["very_high_sensitivity"],
    preferGoals: ["pores", "acne", "oiliness"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  mask_hydrating: {
    skinTypesAllowed: ["dry", "normal", "combination_dry"],
    avoidIfContra: [],
    preferGoals: ["dryness", "wrinkles"],
    avoidDiagnoses: []
  },
  mask_soothing: {
    skinTypesAllowed: ["dry", "normal", "combination_dry"],
    avoidIfContra: [],
    preferGoals: ["sensitivity", "redness"],
    avoidDiagnoses: []
  },
  mask_sleeping: {
    skinTypesAllowed: ["dry", "normal", "combination_dry"],
    avoidIfContra: [],
    preferGoals: ["dryness", "wrinkles", "barrier_damage"],
    avoidDiagnoses: []
  },
  // --- Дополнительно ---
  spot_treatment: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["very_high_sensitivity"],
    preferGoals: ["acne"],
    avoidDiagnoses: ["atopic_dermatitis"]
  },
  lip_care: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: [],
    preferGoals: [],
    avoidDiagnoses: []
  },
  balm_barrier_repair: {
    skinTypesAllowed: ["dry", "normal", "combination_dry"],
    avoidIfContra: [],
    preferGoals: ["barrier_damage", "dryness", "atopic_dermatitis"],
    avoidDiagnoses: []
  }
};

/**
 * Проверяет, допустим ли шаг для профиля
 */
export function isStepAllowedForProfile(step: StepCategory, profile: SkinProfile): boolean {
  const rule = STEP_CATEGORY_RULES[step];
  if (!rule) return true; // Если правила нет, разрешаем по умолчанию

  // Проверка типа кожи
  if (rule.skinTypesAllowed && profile.skinType) {
    if (!rule.skinTypesAllowed.includes(profile.skinType)) {
      return false;
    }
  }

  // Проверка диагнозов
  if (rule.avoidDiagnoses && profile.diagnoses && profile.diagnoses.length > 0) {
    if (profile.diagnoses.some(d => rule.avoidDiagnoses!.includes(d))) {
      return false;
    }
  }

  // Проверка противопоказаний
  if (rule.avoidIfContra && profile.contraindications && profile.contraindications.length > 0) {
    if (profile.contraindications.some(c => rule.avoidIfContra!.includes(c))) {
      return false;
    }
  }

  return true;
}
