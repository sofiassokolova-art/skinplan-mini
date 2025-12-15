// lib/plan-helpers.ts
// Вспомогательные функции для работы с планом ухода

import type { StepCategory } from './step-category-rules';
// ИСПРАВЛЕНО: Используем StepType для базовых шагов
import { StepType, getStepTypeFromCategory } from './step-type';

/**
 * Получает базовый шаг из StepCategory
 * ИСПРАВЛЕНО: Использует StepType enum для согласованности
 * Например: 'toner_hydrating' -> 'toner', 'serum_niacinamide' -> 'serum'
 */

export function getBaseStepFromStepCategory(stepCategory: StepCategory): string {
  // ИСПРАВЛЕНО: Используем StepType для согласованности
  const stepType = getStepTypeFromCategory(stepCategory);
  return stepType; // StepType enum value is already a string
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

