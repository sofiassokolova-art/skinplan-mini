// lib/step-category-rules.ts
// Правила для stepCategory: какие поля SkinProfile учитывать при фильтре

import { SkinProfile } from './skinprofile-types';

export type StepCategory =
  // Очищение
  | "cleanser_oil" // Гидрофильное масло (первое очищение для снятия макияжа)
  | "cleanser_gentle"
  | "cleanser_balancing"
  | "cleanser_deep"
  // Тоник / эссенция
  | "toner_hydrating"
  | "toner_soothing"
  | "toner_exfoliant" // Тонеры с AHA/BHA/PHA, в т.ч. PHA
  | "toner_acid" // Тонеры с кислотами
  | "toner_aha" // Тонеры с AHA
  | "toner_bha" // Тонеры с BHA
  // Сыворотки / активы (базовые)
  | "serum_hydrating"
  | "serum_niacinamide"
  | "serum_vitc"
  | "serum_anti_redness"
  | "serum_brightening_soft"
  | "serum_peptide" // Пептиды / в т.ч. copper peptide
  | "serum_antiage" // Anti-age без кислот
  | "serum_exfoliant" // Сыворотки-эксфолианты (lactic / mandelic)
  // Лечебные/таргетированные средства
  | "treatment_acne_bpo"
  | "treatment_acne_azelaic"
  | "treatment_acne_local"
  | "treatment_exfoliant_mild"
  | "treatment_exfoliant_strong"
  | "treatment_pigmentation"
  | "treatment_antiage"
  | "treatment_acid" // Средства с кислотами
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
  | "mask_enzyme" // Энзимные маски (enzyme / papain / bromelain)
  | "mask_acid" // Маски с кислотами (AHA/BHA/PHA + lactic/mandelic)
  | "mask_peel" // Пилинговые маски
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
  cleanser_oil: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: [],
    preferGoals: ["maintenance", "dryness"],
    avoidDiagnoses: []
  },
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
  // ИСПРАВЛЕНО: Разрешаем мягкие увлажняющие/успокаивающие тонеры и для жирной кожи,
  // особенно при высокой чувствительности — раньше oily полностью отсеивалась
  toner_hydrating: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: [],
    preferGoals: ["dryness", "maintenance", "wrinkles"],
    avoidDiagnoses: []
  },
  toner_soothing: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: [],
    preferGoals: ["sensitivity", "redness"],
    avoidDiagnoses: []
  },
  toner_exfoliant: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["no_strong_acids", "very_high_sensitivity"],
    preferGoals: ["texture", "pores", "acne", "pigmentation"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  toner_acid: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["no_strong_acids", "very_high_sensitivity"],
    preferGoals: ["texture", "pores", "acne", "pigmentation"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  toner_aha: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["no_strong_acids", "very_high_sensitivity"],
    preferGoals: ["texture", "pores", "pigmentation"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  toner_bha: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["no_strong_acids", "very_high_sensitivity"],
    preferGoals: ["pores", "acne", "texture"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
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
  serum_peptide: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily"],
    avoidIfContra: [],
    preferGoals: ["wrinkles", "maintenance", "barrier_damage"],
    avoidDiagnoses: []
  },
  serum_antiage: {
    skinTypesAllowed: ["dry", "normal", "combination_dry"],
    avoidIfContra: [],
    preferGoals: ["wrinkles", "maintenance"],
    avoidDiagnoses: []
  },
  serum_exfoliant: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["no_strong_acids", "very_high_sensitivity"],
    preferGoals: ["texture", "pores", "pigmentation"],
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
  treatment_acid: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["no_strong_acids", "very_high_sensitivity"],
    preferGoals: ["texture", "pores", "acne", "pigmentation"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  // --- Увлажняющие кремы ---
  // ИСПРАВЛЕНО: Лёгкий крем теперь доступен и для жирной кожи
  // (раньше oily не попадала в список и крем выфильтровывался полностью)
  moisturizer_light: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
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
    // ИСПРАВЛЕНО: Барьерный крем теперь доступен и для комбинированной с жирной Т‑зоной кожи,
    // чтобы при профиле combination_oily + высокая чувствительность мы не выкидывали шаг крема.
    skinTypesAllowed: ["dry", "combination_dry", "normal", "combination_oily"],
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
  // ИСПРАВЛЕНО: Универсальный SPF 50 подходит и для жирной кожи,
  // поэтому добавляем "oily", чтобы шаг не вырезался из плана
  spf_50_face: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
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
  mask_enzyme: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["very_high_sensitivity"],
    preferGoals: ["texture", "pores", "dullness"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  mask_acid: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["no_strong_acids", "very_high_sensitivity"],
    preferGoals: ["texture", "pores", "acne", "pigmentation"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  mask_peel: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContra: ["no_strong_acids", "very_high_sensitivity"],
    preferGoals: ["texture", "pores", "acne", "pigmentation"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
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
 * ИСПРАВЛЕНО: Добавлена нормализация значений и проверка чувствительности
 */
/**
 * ИСПРАВЛЕНО (P1): Результат проверки шага с причиной
 * Позволяет логировать почему шаг не разрешён
 */
export interface StepAllowanceResult {
  allowed: boolean;
  reason?: string; // Причина отказа (если allowed = false)
}

/**
 * ИСПРАВЛЕНО (P1): Проверяет, можно ли применить шаг для профиля
 * Жёсткий гейт - если возвращает false, шаг НЕ должен использоваться
 */
export async function canApplyStep(step: StepCategory, profile: SkinProfile): Promise<StepAllowanceResult> {
  const rule = STEP_CATEGORY_RULES[step];
  if (!rule) {
    return { allowed: true }; // Если правила нет, разрешаем по умолчанию
  }

  // ИСПРАВЛЕНО: Нормализуем тип кожи перед проверкой
  const { normalizeSkinTypeForRules, normalizeSensitivityForRules } = await import('./skin-type-normalizer');
  const normalizedSkinType = normalizeSkinTypeForRules(profile.skinType);

  // Проверка типа кожи
  if (rule.skinTypesAllowed && normalizedSkinType) {
    if (!rule.skinTypesAllowed.includes(normalizedSkinType)) {
      return {
        allowed: false,
        reason: `Skin type ${normalizedSkinType} not allowed for step ${step}. Allowed: ${rule.skinTypesAllowed.join(', ')}`,
      };
    }
  }

  // Проверка диагнозов
  if (rule.avoidDiagnoses && profile.diagnoses && profile.diagnoses.length > 0) {
    const conflictingDiagnoses = profile.diagnoses.filter(d => rule.avoidDiagnoses!.includes(d));
    if (conflictingDiagnoses.length > 0) {
      return {
        allowed: false,
        reason: `Step ${step} avoided due to diagnoses: ${conflictingDiagnoses.join(', ')}`,
      };
    }
  }

  // ИСПРАВЛЕНО: Проверка противопоказаний с учетом чувствительности
  if (rule.avoidIfContra && rule.avoidIfContra.length > 0) {
    // Проверяем противопоказания из профиля
    if (profile.contraindications && profile.contraindications.length > 0) {
      const conflictingContra = profile.contraindications.filter(c => rule.avoidIfContra!.includes(c));
      if (conflictingContra.length > 0) {
        return {
          allowed: false,
          reason: `Step ${step} avoided due to contraindications: ${conflictingContra.join(', ')}`,
        };
      }
    }
    
    // ИСПРАВЛЕНО: Проверяем "very_high_sensitivity" на основе уровня чувствительности
    if (rule.avoidIfContra.includes('very_high_sensitivity')) {
      const normalizedSensitivity = normalizeSensitivityForRules(profile.sensitivity);
      if (normalizedSensitivity === 'very_high') {
        return {
          allowed: false,
          reason: `Step ${step} avoided due to very high sensitivity`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Обратная совместимость: старый интерфейс
 * @deprecated Используйте canApplyStep для получения причины отказа
 */
export async function isStepAllowedForProfile(step: StepCategory, profile: SkinProfile): Promise<boolean> {
  const result = await canApplyStep(step, profile);
  return result.allowed;
}

