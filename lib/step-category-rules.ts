// lib/step-category-rules.ts
// Правила для stepCategory: какие поля SkinProfile учитывать при фильтре
// ИСПРАВЛЕНО: Используем канонические типы GoalKey, ConcernKey, SkinTypeKey

import { SkinProfile } from './skinprofile-types';
import type { GoalKey, ConcernKey } from './concern-taxonomy';
import type { SkinTypeKey } from './skin-type-normalizer';
import { normalizeSkinTypeForRules, normalizeSensitivityForRules } from './skin-type-normalizer';

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

/**
 * ИСПРАВЛЕНО (P0): Константы уровней чувствительности по классам шагов
 * Используется для определения, при каком уровне чувствительности запрещать шаг
 * 
 * Бизнес-логика:
 * - Кислоты и эксфолианты: запрещать при high и very_high (чтобы избежать жжения/раздражения)
 * - Глубокое очищение и глиняные маски: запрещать при very_high (менее агрессивно)
 * - Остальные агрессивные шаги: по умолчанию только very_high
 */
export const SENSITIVITY_RESTRICTIONS = {
  // Кислоты и эксфолианты - запрещать при high и very_high
  ACIDS_EXFOLIANTS: ['high', 'very_high'] as const,
  // Глубокое очищение и глиняные маски - запрещать при very_high, иногда при high
  DEEP_CLEANSING: ['very_high'] as const,
  // Остальные агрессивные шаги - по умолчанию только very_high
  DEFAULT_AGGRESSIVE: ['very_high'] as const,
} as const;

/**
 * ИСПРАВЛЕНО (P0): preferGoals не используется в canApplyStep (это метаданные для скоринга/ранжирования)
 * Если нужна логика "почему это лучше" - использовать в отдельной функции getStepScore()
 * 
 * ПРИМЕЧАНИЕ: normalizeLegacyGoal и LEGACY_GOAL_TO_CANONICAL удалены, так как не используются
 * Если в будущем понадобится нормализация goals - добавить в concern-taxonomy.ts
 */

/**
 * Тип для диагнозов (можно расширить при необходимости)
 */
export type DiagnosisKey = 
  | "rosacea"
  | "atopic_dermatitis"
  | "eczema"
  | "psoriasis";

/**
 * Тип для противопоказаний из профиля
 */
export type ContraindicationKey = 
  | "no_strong_acids"
  | "no_retinol"
  | "no_niacinamide"
  | "no_vitc"
  | "no_hyaluronic";

/**
 * ИСПРАВЛЕНО (P0, P1): Типизированные правила для шагов
 * - preferGoals использует канонические GoalKey/ConcernKey
 * - skinTypesAllowed использует SkinTypeKey[]
 * - avoidIfContra разделен на avoidIfContraFromProfile и avoidIfSensitivity
 * - avoidDiagnoses использует DiagnosisKey[]
 */
export type StepCategoryRule = {
  // ИСПРАВЛЕНО (P1): Типизированный массив типов кожи
  skinTypesAllowed?: SkinTypeKey[];
  
  // ИСПРАВЛЕНО (P1): Разделение противопоказаний
  // Противопоказания из profile.contraindications
  avoidIfContraFromProfile?: ContraindicationKey[];
  
  // ИСПРАВЛЕНО (P1): Уровни чувствительности, при которых шаг запрещен
  // Может быть "high" или "very_high"
  avoidIfSensitivity?: Array<"high" | "very_high">;
  
  // ИСПРАВЛЕНО (P0): Канонические GoalKey/ConcernKey вместо legacy строк
  preferGoals?: (GoalKey | ConcernKey)[];
  
  // ИСПРАВЛЕНО (P1): Типизированный массив диагнозов
  avoidDiagnoses?: DiagnosisKey[];
  
  // ИСПРАВЛЕНО (P0, P1): Для успокаивающих/барьерных шагов - использовать sensitivity/rosaceaRisk вместо skinType
  // ИСПРАВЛЕНО (P1): Переименовано для ясности - означает "игнорировать skinType при высокой чувствительности или rosaceaRisk"
  // Если true, то при high/very_high sensitivity или наличии rosaceaRisk/diagnosis rosacea - skinTypesAllowed игнорируется
  ignoreSkinTypeWhenSensitiveOrRosacea?: boolean;
  
  // ИСПРАВЛЕНО (P0): Минимальный уровень rosaceaRisk для применения шага
  // ВАЖНО: Если задан, это обязательный гейт - шаг будет запрещен, если rosaceaRisk не соответствует
  // Для soothing/barrier шагов лучше использовать OR логику (sensitivity OR rosaceaRisk OR diagnosis)
  requireRosaceaRisk?: ("low" | "medium" | "high" | "critical")[];
  
  // ИСПРАВЛЕНО (P0): Для soothing/barrier шагов - разрешать при sensitivity OR rosaceaRisk OR diagnosis rosacea
  // Если true, то шаг разрешен если: sensitivity >= medium OR rosaceaRisk >= medium OR diagnosis includes rosacea
  allowForSensitiveOrRosacea?: boolean;
};

export const STEP_CATEGORY_RULES: Record<StepCategory, StepCategoryRule> = {
  // --- Очищение ---
  cleanser_oil: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["general", "dehydration"], // maintenance → general, dryness → dehydration
    avoidDiagnoses: []
  },
  cleanser_gentle: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["barrier", "dehydration", "general"], // sensitivity → barrier, dryness → dehydration, maintenance → general
    avoidDiagnoses: []
  },
  cleanser_balancing: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["acne", "pores"], // oiliness → pores
    avoidDiagnoses: ["atopic_dermatitis"]
  },
  cleanser_deep: {
    skinTypesAllowed: ["combination_oily", "oily", "normal"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: ["very_high"], // ИСПРАВЛЕНО: разделено на avoidIfSensitivity
    preferGoals: ["acne", "pores"], // oiliness → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  // --- Тоники ---
  // ИСПРАВЛЕНО: Разрешаем мягкие увлажняющие/успокаивающие тонеры и для жирной кожи,
  // особенно при высокой чувствительности — раньше oily полностью отсеивалась
  toner_hydrating: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["dehydration", "general", "wrinkles"], // dryness → dehydration, maintenance → general
    avoidDiagnoses: []
  },
  toner_soothing: {
    // ИСПРАВЛЕНО (P0): Успокаивающие тонеры доступны для всех типов кожи при чувствительности/розацеа
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["barrier", "redness"], // sensitivity → barrier
    ignoreSkinTypeWhenSensitiveOrRosacea: true, // ИСПРАВЛЕНО (P1): переименовано
    allowForSensitiveOrRosacea: true, // ИСПРАВЛЕНО (P0): разрешать при sensitivity OR rosaceaRisk OR diagnosis
    avoidDiagnoses: []
  },
  toner_exfoliant: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    // ИСПРАВЛЕНО (P0): Кислоты запрещаем при high и very_high (не только very_high)
    avoidIfSensitivity: [...SENSITIVITY_RESTRICTIONS.ACIDS_EXFOLIANTS],
    preferGoals: ["pores", "acne", "pigmentation"], // texture → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  toner_acid: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    // ИСПРАВЛЕНО (P0): Кислоты запрещаем при high и very_high
    avoidIfSensitivity: [...SENSITIVITY_RESTRICTIONS.ACIDS_EXFOLIANTS],
    preferGoals: ["pores", "acne", "pigmentation"], // texture → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  toner_aha: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    // ИСПРАВЛЕНО (P0): Кислоты запрещаем при high и very_high
    avoidIfSensitivity: [...SENSITIVITY_RESTRICTIONS.ACIDS_EXFOLIANTS],
    preferGoals: ["pores", "pigmentation"], // texture → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  toner_bha: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    // ИСПРАВЛЕНО (P0): Кислоты запрещаем при high и very_high
    avoidIfSensitivity: [...SENSITIVITY_RESTRICTIONS.ACIDS_EXFOLIANTS],
    preferGoals: ["pores", "acne"], // texture → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  // --- Сыворотки/активы базовые ---
  serum_hydrating: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_hyaluronic"],
    avoidIfSensitivity: [],
    preferGoals: ["dehydration", "wrinkles", "general"], // dryness → dehydration, maintenance → general
    avoidDiagnoses: []
  },
  serum_niacinamide: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_niacinamide"],
    avoidIfSensitivity: [],
    preferGoals: ["acne", "pores", "pigmentation"], // oiliness → pores
    avoidDiagnoses: []
  },
  serum_vitc: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_vitc"],
    avoidIfSensitivity: ["very_high"], // ИСПРАВЛЕНО: разделено
    preferGoals: ["pigmentation", "wrinkles"], // uneven_tone → pigmentation
    avoidDiagnoses: ["rosacea"]
  },
  serum_anti_redness: {
    // ИСПРАВЛЕНО (P0): Успокаивающие сыворотки доступны для всех типов кожи при чувствительности/розацеа
    // Раньше oily была исключена, но люди с жирной кожей тоже могут иметь покраснение/чувствительность
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["barrier", "redness"], // sensitivity → barrier
    ignoreSkinTypeWhenSensitiveOrRosacea: true, // ИСПРАВЛЕНО (P1): переименовано
    // ИСПРАВЛЕНО (P0): Используем OR логику вместо requireRosaceaRisk (чтобы не отрезать людей с high sensitivity без rosaceaRisk)
    allowForSensitiveOrRosacea: true, // разрешать при sensitivity >= medium OR rosaceaRisk >= medium OR diagnosis rosacea
    avoidDiagnoses: []
  },
  serum_brightening_soft: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    avoidIfSensitivity: [],
    preferGoals: ["pigmentation"], // uneven_tone → pigmentation
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  serum_peptide: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["wrinkles", "general", "barrier"], // maintenance → general, barrier_damage → barrier
    avoidDiagnoses: []
  },
  serum_antiage: {
    skinTypesAllowed: ["dry", "normal", "combination_dry"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["wrinkles", "general"], // maintenance → general
    avoidDiagnoses: []
  },
  serum_exfoliant: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    // ИСПРАВЛЕНО (P0): Кислоты запрещаем при high и very_high
    avoidIfSensitivity: [...SENSITIVITY_RESTRICTIONS.ACIDS_EXFOLIANTS],
    preferGoals: ["pores", "pigmentation"], // texture → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  // --- Лечебные / таргетированные ---
  treatment_acne_bpo: {
    skinTypesAllowed: ["combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    avoidIfSensitivity: ["very_high"], // ИСПРАВЛЕНО: разделено
    preferGoals: ["acne"],
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  treatment_acne_azelaic: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["acne", "pigmentation", "redness"],
    avoidDiagnoses: []
  },
  treatment_acne_local: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: ["very_high"], // ИСПРАВЛЕНО: разделено
    preferGoals: ["acne"],
    avoidDiagnoses: ["atopic_dermatitis"]
  },
  treatment_exfoliant_mild: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    // ИСПРАВЛЕНО (P0): Кислоты запрещаем при high и very_high (даже mild)
    avoidIfSensitivity: [...SENSITIVITY_RESTRICTIONS.ACIDS_EXFOLIANTS],
    preferGoals: ["pores", "acne", "pigmentation"], // texture → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  treatment_exfoliant_strong: {
    skinTypesAllowed: ["combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    // ИСПРАВЛЕНО (P0): Сильные кислоты запрещаем при high и very_high
    avoidIfSensitivity: [...SENSITIVITY_RESTRICTIONS.ACIDS_EXFOLIANTS],
    preferGoals: ["pores", "acne", "pigmentation"], // texture → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  treatment_pigmentation: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    avoidIfSensitivity: [],
    preferGoals: ["pigmentation"], // uneven_tone → pigmentation
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  treatment_antiage: {
    skinTypesAllowed: ["dry", "normal", "combination_dry"],
    avoidIfContraFromProfile: ["no_retinol"],
    avoidIfSensitivity: [],
    preferGoals: ["wrinkles"],
    avoidDiagnoses: []
  },
  treatment_acid: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    // ИСПРАВЛЕНО (P0): Кислоты запрещаем при high и very_high
    avoidIfSensitivity: [...SENSITIVITY_RESTRICTIONS.ACIDS_EXFOLIANTS],
    preferGoals: ["pores", "acne", "pigmentation"], // texture → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  // --- Увлажняющие кремы ---
  // ИСПРАВЛЕНО: Лёгкий крем теперь доступен и для жирной кожи
  // (раньше oily не попадала в список и крем выфильтровывался полностью)
  moisturizer_light: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["general", "pores"], // maintenance → general, oiliness → pores
    avoidDiagnoses: []
  },
  moisturizer_balancing: {
    skinTypesAllowed: ["combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["pores", "acne"], // oiliness → pores
    avoidDiagnoses: ["atopic_dermatitis"]
  },
  moisturizer_barrier: {
    // ИСПРАВЛЕНО (P0): Барьерный крем доступен для всех типов кожи при чувствительности/повреждении барьера
    // Раньше combination_oily была исключена, но люди с комбинированной кожей тоже могут иметь повреждение барьера
    skinTypesAllowed: ["dry", "combination_dry", "normal", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["dehydration", "barrier", "general"], // dryness → dehydration, sensitivity → barrier, maintenance → general
    ignoreSkinTypeWhenSensitiveOrRosacea: true, // ИСПРАВЛЕНО (P1): переименовано
    allowForSensitiveOrRosacea: true, // ИСПРАВЛЕНО (P0): разрешать при sensitivity OR rosaceaRisk OR diagnosis
    avoidDiagnoses: []
  },
  moisturizer_soothing: {
    // ИСПРАВЛЕНО (P0): Успокаивающий крем доступен для всех типов кожи при чувствительности/розацеа
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["barrier", "redness"], // sensitivity → barrier
    ignoreSkinTypeWhenSensitiveOrRosacea: true, // ИСПРАВЛЕНО (P1): переименовано
    // ИСПРАВЛЕНО (P0): Используем OR логику вместо requireRosaceaRisk
    allowForSensitiveOrRosacea: true, // разрешать при sensitivity >= medium OR rosaceaRisk >= medium OR diagnosis rosacea
    avoidDiagnoses: []
  },
  // --- Глаза ---
  eye_cream_basic: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["general"], // maintenance → general
    avoidDiagnoses: []
  },
  eye_cream_dark_circles: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["dark_circles"],
    avoidDiagnoses: []
  },
  eye_cream_puffiness: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["general"], // puffiness → general (нет прямого соответствия)
    avoidDiagnoses: []
  },
  // --- SPF ---
  // ИСПРАВЛЕНО: Универсальный SPF 50 подходит и для жирной кожи,
  // поэтому добавляем "oily", чтобы шаг не вырезался из плана
  spf_50_face: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["general", "pigmentation", "wrinkles"], // maintenance → general
    avoidDiagnoses: []
  },
  spf_50_oily: {
    skinTypesAllowed: ["combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["acne", "pores"], // oiliness → pores
    avoidDiagnoses: []
  },
  spf_50_sensitive: {
    // ИСПРАВЛЕНО (P0): SPF для чувствительной кожи доступен для всех типов при чувствительности/розацеа
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["barrier", "redness", "pigmentation"], // sensitivity → barrier, melasma → pigmentation
    ignoreSkinTypeWhenSensitiveOrRosacea: true, // ИСПРАВЛЕНО (P1): переименовано
    // ИСПРАВЛЕНО (P0): Используем OR логику вместо requireRosaceaRisk
    allowForSensitiveOrRosacea: true, // разрешать при sensitivity >= medium OR rosaceaRisk >= medium OR diagnosis rosacea
    avoidDiagnoses: []
  },
  // --- Маски / доп. уход ---
  mask_clay: {
    skinTypesAllowed: ["combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: ["very_high"], // ИСПРАВЛЕНО: разделено
    preferGoals: ["pores", "acne"], // oiliness → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  mask_hydrating: {
    skinTypesAllowed: ["dry", "normal", "combination_dry"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["dehydration", "wrinkles"], // dryness → dehydration
    avoidDiagnoses: []
  },
  mask_soothing: {
    // ИСПРАВЛЕНО (P0): Успокаивающие маски доступны для всех типов кожи при чувствительности/розацеа
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["barrier", "redness"], // sensitivity → barrier
    ignoreSkinTypeWhenSensitiveOrRosacea: true, // ИСПРАВЛЕНО (P1): переименовано
    // ИСПРАВЛЕНО (P0): Используем OR логику вместо requireRosaceaRisk
    allowForSensitiveOrRosacea: true, // разрешать при sensitivity >= medium OR rosaceaRisk >= medium OR diagnosis rosacea
    avoidDiagnoses: []
  },
  mask_sleeping: {
    skinTypesAllowed: ["dry", "normal", "combination_dry"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["dehydration", "wrinkles", "barrier"], // dryness → dehydration, barrier_damage → barrier
    avoidDiagnoses: []
  },
  mask_enzyme: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: ["very_high"], // ИСПРАВЛЕНО: разделено
    preferGoals: ["pores"], // texture → pores, dullness → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  mask_acid: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    // ИСПРАВЛЕНО (P0): Кислоты запрещаем при high и very_high
    avoidIfSensitivity: [...SENSITIVITY_RESTRICTIONS.ACIDS_EXFOLIANTS],
    preferGoals: ["pores", "acne", "pigmentation"], // texture → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  mask_peel: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: ["no_strong_acids"],
    // ИСПРАВЛЕНО (P0): Пилинговые маски запрещаем при high и very_high
    avoidIfSensitivity: [...SENSITIVITY_RESTRICTIONS.ACIDS_EXFOLIANTS],
    preferGoals: ["pores", "acne", "pigmentation"], // texture → pores
    avoidDiagnoses: ["rosacea", "atopic_dermatitis"]
  },
  // --- Дополнительно ---
  spot_treatment: {
    skinTypesAllowed: ["normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: ["very_high"], // ИСПРАВЛЕНО: разделено
    preferGoals: ["acne"],
    avoidDiagnoses: ["atopic_dermatitis"]
  },
  lip_care: {
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: [],
    avoidDiagnoses: []
  },
  balm_barrier_repair: {
    // ИСПРАВЛЕНО (P0): Барьерный бальзам доступен для всех типов кожи при повреждении барьера
    skinTypesAllowed: ["dry", "normal", "combination_dry", "combination_oily", "oily"],
    avoidIfContraFromProfile: [],
    avoidIfSensitivity: [],
    preferGoals: ["barrier", "dehydration"], // barrier_damage → barrier, dryness → dehydration
    ignoreSkinTypeWhenSensitiveOrRosacea: true, // ИСПРАВЛЕНО (P1): переименовано
    allowForSensitiveOrRosacea: true, // ИСПРАВЛЕНО (P0): разрешать при sensitivity OR rosaceaRisk OR diagnosis
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
 * ИСПРАВЛЕНО (P0, P1, P2): Проверяет, можно ли применить шаг для профиля
 * Жёсткий гейт - если возвращает false, шаг НЕ должен использоваться
 * 
 * ИСПРАВЛЕНО (P2): Функция синхронная, убран dynamic import
 * ИСПРАВЛЕНО (P0, P1): Использует канонические типы и разделенные противопоказания
 * 
 * @param step - Категория шага
 * @param profile - Профиль кожи
 * @param rosaceaRisk - Опциональный риск розацеа (если не передан, пытается получить из profile или medicalMarkers)
 */
export function canApplyStep(
  step: StepCategory, 
  profile: SkinProfile & { rosaceaRisk?: string | null; medicalMarkers?: { rosaceaRisk?: "low" | "medium" | "high" | "critical" } },
  rosaceaRisk?: "low" | "medium" | "high" | "critical" | null
): StepAllowanceResult {
  const rule = STEP_CATEGORY_RULES[step];
  if (!rule) {
    return { allowed: true }; // Если правила нет, разрешаем по умолчанию
  }

  // ИСПРАВЛЕНО (P2): Статический импорт вместо dynamic import
  const normalizedSkinType = normalizeSkinTypeForRules(profile.skinType);
  const normalizedSensitivity = normalizeSensitivityForRules(profile.sensitivity);

  // ИСПРАВЛЕНО (P0): Вычисляем effectiveRosaceaRisk из параметра или профиля
  // Нормализуем "none" -> null, "low"/"medium"/"high" -> как есть
  let effectiveRosaceaRisk: "low" | "medium" | "high" | "critical" | null = null;
  if (rosaceaRisk) {
    effectiveRosaceaRisk = rosaceaRisk;
  } else if (profile.rosaceaRisk) {
    const risk = profile.rosaceaRisk.toLowerCase();
    if (risk === 'low' || risk === 'medium' || risk === 'high' || risk === 'critical') {
      effectiveRosaceaRisk = risk as "low" | "medium" | "high" | "critical";
    }
  } else if (profile.medicalMarkers?.rosaceaRisk) {
    effectiveRosaceaRisk = profile.medicalMarkers.rosaceaRisk;
  }
  
  // Проверяем диагноз rosacea
  const hasRosaceaDiagnosis = profile.diagnoses?.some(d => 
    d.toLowerCase().includes('розацеа') || d.toLowerCase().includes('rosacea')
  ) || false;

  // ИСПРАВЛЕНО (P0): requireRosaceaRisk - обязательный гейт (если задан, должен быть выполнен)
  if (rule.requireRosaceaRisk && rule.requireRosaceaRisk.length > 0) {
    if (!effectiveRosaceaRisk || !rule.requireRosaceaRisk.includes(effectiveRosaceaRisk)) {
      return {
        allowed: false,
        reason: `Step ${step} requires rosaceaRisk ${rule.requireRosaceaRisk.join(' or ')}, but got ${effectiveRosaceaRisk || 'none'}`,
      };
    }
  }

  // ИСПРАВЛЕНО (P0): allowForSensitiveOrRosacea - OR логика для soothing/barrier шагов
  if (rule.allowForSensitiveOrRosacea) {
    const hasHighSensitivity = normalizedSensitivity === 'high' || normalizedSensitivity === 'very_high';
    const hasMediumPlusSensitivity = normalizedSensitivity === 'medium' || hasHighSensitivity;
    const hasMediumPlusRosaceaRisk = effectiveRosaceaRisk && 
      (effectiveRosaceaRisk === 'medium' || effectiveRosaceaRisk === 'high' || effectiveRosaceaRisk === 'critical');
    
    // Разрешаем если: sensitivity >= medium OR rosaceaRisk >= medium OR diagnosis rosacea
    if (hasMediumPlusSensitivity || hasMediumPlusRosaceaRisk || hasRosaceaDiagnosis) {
      // Разрешаем независимо от skinType - продолжаем проверку других условий
    } else {
      // Если нет ни одного условия - проверяем skinType как обычно
      if (rule.skinTypesAllowed && normalizedSkinType) {
        if (!rule.skinTypesAllowed.includes(normalizedSkinType)) {
          return {
            allowed: false,
            reason: `Skin type ${normalizedSkinType} not allowed for step ${step}. Allowed: ${rule.skinTypesAllowed.join(', ')}`,
          };
        }
      }
    }
  } else if (rule.ignoreSkinTypeWhenSensitiveOrRosacea) {
    // ИСПРАВЛЕНО (P1): Переименованная логика - игнорируем skinType при высокой чувствительности или rosaceaRisk
    const hasHighSensitivity = normalizedSensitivity === 'high' || normalizedSensitivity === 'very_high';
    const hasRosaceaRisk = effectiveRosaceaRisk && 
      (effectiveRosaceaRisk === 'medium' || effectiveRosaceaRisk === 'high' || effectiveRosaceaRisk === 'critical');
    
    if (hasHighSensitivity || hasRosaceaRisk || hasRosaceaDiagnosis) {
      // Игнорируем skinType - продолжаем проверку других условий
    } else {
      // Если нет высокой чувствительности/rosaceaRisk - проверяем skinType как обычно
      if (rule.skinTypesAllowed && normalizedSkinType) {
        if (!rule.skinTypesAllowed.includes(normalizedSkinType)) {
          return {
            allowed: false,
            reason: `Skin type ${normalizedSkinType} not allowed for step ${step}. Allowed: ${rule.skinTypesAllowed.join(', ')}`,
          };
        }
      }
    }
  } else {
    // Обычная проверка типа кожи
    if (rule.skinTypesAllowed && normalizedSkinType) {
      if (!rule.skinTypesAllowed.includes(normalizedSkinType)) {
        return {
          allowed: false,
          reason: `Skin type ${normalizedSkinType} not allowed for step ${step}. Allowed: ${rule.skinTypesAllowed.join(', ')}`,
        };
      }
    }
  }

  // Проверка диагнозов
  if (rule.avoidDiagnoses && profile.diagnoses && profile.diagnoses.length > 0) {
    const conflictingDiagnoses = profile.diagnoses.filter(d => 
      rule.avoidDiagnoses!.includes(d as DiagnosisKey)
    );
    if (conflictingDiagnoses.length > 0) {
      return {
        allowed: false,
        reason: `Step ${step} avoided due to diagnoses: ${conflictingDiagnoses.join(', ')}`,
      };
    }
  }

  // ИСПРАВЛЕНО (P1): Разделение противопоказаний из профиля и чувствительности
  if (rule.avoidIfContraFromProfile && rule.avoidIfContraFromProfile.length > 0) {
    if (profile.contraindications && profile.contraindications.length > 0) {
      const conflictingContra = profile.contraindications.filter(c => 
        rule.avoidIfContraFromProfile!.includes(c as ContraindicationKey)
      );
      if (conflictingContra.length > 0) {
        return {
          allowed: false,
          reason: `Step ${step} avoided due to contraindications: ${conflictingContra.join(', ')}`,
        };
      }
    }
  }

  // ИСПРАВЛЕНО (P1): Проверка чувствительности отдельно
  if (rule.avoidIfSensitivity && rule.avoidIfSensitivity.length > 0 && normalizedSensitivity) {
    // Проверяем, что normalizedSensitivity является одним из запрещенных уровней
    if ((normalizedSensitivity === 'high' || normalizedSensitivity === 'very_high') &&
        rule.avoidIfSensitivity.includes(normalizedSensitivity)) {
      return {
        allowed: false,
        reason: `Step ${step} avoided due to sensitivity level: ${normalizedSensitivity}`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Обратная совместимость: старый интерфейс
 * @deprecated Используйте canApplyStep для получения причины отказа
 */
export function isStepAllowedForProfile(
  step: StepCategory, 
  profile: SkinProfile,
  rosaceaRisk?: "low" | "medium" | "high" | "critical" | null
): boolean {
  const result = canApplyStep(step, profile, rosaceaRisk);
  return result.allowed;
}

