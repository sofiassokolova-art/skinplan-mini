// lib/step-type.ts
// ИСПРАВЛЕНО: Enum StepType для базовых типов шагов
// Разделение: StepType = базовый тип (cleanser, serum), StepCategory = конкретный вариант (serum_hydrating, serum_niacinamide)

import type { StepCategory } from './step-category-rules';

/**
 * Базовые типы шагов ухода за кожей
 * ИСПРАВЛЕНО: Единый контракт для базовых типов
 * Конкретные варианты (serum_hydrating) - это StepCategory, не StepType
 */
export enum StepType {
  CLEANSER = 'cleanser',
  TONER = 'toner',
  SERUM = 'serum',
  TREATMENT = 'treatment',
  MOISTURIZER = 'moisturizer',
  SPF = 'spf',
  MASK = 'mask',
  EYE_CREAM = 'eye_cream',
  SPOT_TREATMENT = 'spot_treatment',
  LIP_CARE = 'lip_care',
}

/**
 * Маппинг StepCategory к StepType
 * ИСПРАВЛЕНО: Единая точка маппинга для согласованности
 */
export function getStepTypeFromCategory(stepCategory: StepCategory): StepType {
  const categoryStr = stepCategory.toLowerCase();
  
  if (categoryStr.startsWith('cleanser')) {
    return StepType.CLEANSER;
  }
  if (categoryStr.startsWith('toner')) {
    return StepType.TONER;
  }
  if (categoryStr.startsWith('serum')) {
    return StepType.SERUM;
  }
  if (categoryStr.startsWith('treatment')) {
    return StepType.TREATMENT;
  }
  if (categoryStr.startsWith('moisturizer')) {
    return StepType.MOISTURIZER;
  }
  if (categoryStr.startsWith('spf')) {
    return StepType.SPF;
  }
  if (categoryStr.startsWith('mask')) {
    return StepType.MASK;
  }
  if (categoryStr.startsWith('eye_cream')) {
    return StepType.EYE_CREAM;
  }
  if (categoryStr.startsWith('spot_treatment')) {
    return StepType.SPOT_TREATMENT;
  }
  if (categoryStr.startsWith('lip_care')) {
    return StepType.LIP_CARE;
  }
  
  // Fallback: пытаемся определить по базовому шагу
  if (categoryStr.includes('cleanser')) return StepType.CLEANSER;
  if (categoryStr.includes('toner')) return StepType.TONER;
  if (categoryStr.includes('serum')) return StepType.SERUM;
  if (categoryStr.includes('treatment')) return StepType.TREATMENT;
  if (categoryStr.includes('moisturizer') || categoryStr.includes('cream')) return StepType.MOISTURIZER;
  if (categoryStr.includes('spf') || categoryStr.includes('sunscreen')) return StepType.SPF;
  if (categoryStr.includes('mask')) return StepType.MASK;
  
  // Если не удалось определить, возвращаем SERUM как наиболее общий тип
  return StepType.SERUM;
}

/**
 * Маппинг строки (из БД или правил) к StepType
 * ИСПРАВЛЕНО: Нормализует строки из БД/правил к StepType
 */
export function normalizeStepToStepType(step: string | null | undefined): StepType | null {
  if (!step) return null;
  
  const stepStr = step.toLowerCase().trim();
  
  // Прямые соответствия
  if (stepStr === 'cleanser' || stepStr.startsWith('cleanser')) {
    return StepType.CLEANSER;
  }
  if (stepStr === 'toner' || stepStr.startsWith('toner')) {
    return StepType.TONER;
  }
  if (stepStr === 'serum' || stepStr.startsWith('serum')) {
    return StepType.SERUM;
  }
  if (stepStr === 'treatment' || stepStr.startsWith('treatment')) {
    return StepType.TREATMENT;
  }
  if (stepStr === 'moisturizer' || stepStr === 'cream' || stepStr.startsWith('moisturizer')) {
    return StepType.MOISTURIZER;
  }
  if (stepStr === 'spf' || stepStr === 'sunscreen' || stepStr.startsWith('spf')) {
    return StepType.SPF;
  }
  if (stepStr === 'mask' || stepStr.startsWith('mask')) {
    return StepType.MASK;
  }
  if (stepStr === 'eye_cream' || stepStr.startsWith('eye')) {
    return StepType.EYE_CREAM;
  }
  if (stepStr === 'spot_treatment' || stepStr.includes('spot')) {
    return StepType.SPOT_TREATMENT;
  }
  if (stepStr === 'lip_care' || stepStr.includes('lip')) {
    return StepType.LIP_CARE;
  }
  
  return null;
}

/**
 * Проверяет, соответствует ли StepCategory базовому StepType
 * ИСПРАВЛЕНО: Единая проверка соответствия
 */
export function stepCategoryMatchesStepType(
  stepCategory: StepCategory,
  stepType: StepType
): boolean {
  return getStepTypeFromCategory(stepCategory) === stepType;
}

/**
 * Получает все StepCategory для заданного StepType
 * ИСПРАВЛЕНО: Единая точка получения вариантов
 */
export function getStepCategoriesForType(stepType: StepType): StepCategory[] {
  const allCategories: StepCategory[] = [
    'cleanser_oil', 'cleanser_gentle', 'cleanser_balancing', 'cleanser_deep',
    'toner_hydrating', 'toner_soothing', 'toner_exfoliant', 'toner_acid', 'toner_aha', 'toner_bha',
    'serum_hydrating', 'serum_niacinamide', 'serum_vitc', 'serum_anti_redness', 'serum_brightening_soft',
    'serum_peptide', 'serum_antiage', 'serum_exfoliant',
    'treatment_acne_bpo', 'treatment_acne_azelaic', 'treatment_acne_local',
    'treatment_exfoliant_mild', 'treatment_exfoliant_strong', 'treatment_pigmentation', 'treatment_antiage', 'treatment_acid',
    'moisturizer_light', 'moisturizer_balancing', 'moisturizer_barrier', 'moisturizer_soothing',
    'eye_cream_basic', 'eye_cream_dark_circles', 'eye_cream_puffiness',
    'spf_50_face', 'spf_50_oily', 'spf_50_sensitive',
    'mask_clay', 'mask_hydrating', 'mask_soothing', 'mask_sleeping', 'mask_enzyme', 'mask_acid', 'mask_peel',
    'spot_treatment', 'lip_care', 'balm_barrier_repair',
  ];
  
  return allCategories.filter(category => 
    getStepTypeFromCategory(category) === stepType
  );
}

