// lib/plan-helpers.ts
// Вспомогательные функции для работы с планом ухода

import type { StepCategory } from './step-category-rules';

/**
 * Получает базовый шаг из StepCategory
 * Например: 'toner_hydrating' -> 'toner', 'serum_niacinamide' -> 'serum'
 */
export function getBaseStepFromStepCategory(stepCategory: StepCategory): string {
  if (stepCategory === 'cleanser_oil') return 'cleanser_oil';
  if (stepCategory.startsWith('cleanser_')) return 'cleanser';
  if (stepCategory.startsWith('toner_')) return 'toner';
  if (stepCategory.startsWith('serum_')) return 'serum';
  if (stepCategory.startsWith('treatment_')) return 'treatment';
  if (stepCategory.startsWith('moisturizer_')) return 'moisturizer';
  if (stepCategory.startsWith('eye_cream_')) return 'eye_cream';
  if (stepCategory.startsWith('spf_')) return 'spf';
  if (stepCategory.startsWith('mask_')) return 'mask';
  if (stepCategory.startsWith('spot_treatment')) return 'treatment';
  if (stepCategory.startsWith('lip_care')) return 'lip_care';
  if (stepCategory.startsWith('balm_')) return 'moisturizer';
  
  // Если не начинается с известного префикса, возвращаем как есть
  return stepCategory;
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

