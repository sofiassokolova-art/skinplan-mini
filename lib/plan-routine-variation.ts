// lib/plan-routine-variation.ts
// Фазовая вариативность 28-дневного плана: расписание должно ощущаться как
// адаптация -> активная работа -> поддержка, а не как один и тот же день 28 раз.

import type { StepCategory } from './step-category-rules';
import type { PlanPhases } from './plan-types';
import type { RoutineComplexity } from './care-plan-templates';

export interface PhaseRoutineVariationInput {
  morningSteps: StepCategory[];
  eveningSteps: StepCategory[];
  dayIndex: number;
  phase: PlanPhases;
  routineComplexity: RoutineComplexity | 'any';
  isWeeklyFocusDay: boolean;
}

export interface PhaseRoutineVariationResult {
  morningSteps: StepCategory[];
  eveningSteps: StepCategory[];
  appliedRules: string[];
}

function withoutFirstMatching(
  steps: StepCategory[],
  predicate: (step: StepCategory) => boolean
): StepCategory[] {
  const index = steps.findIndex(predicate);
  if (index === -1) return steps;
  return steps.filter((_, i) => i !== index);
}

function isTonerStep(step: StepCategory): boolean {
  return step.startsWith('toner');
}

function isSerumStep(step: StepCategory): boolean {
  return step.startsWith('serum');
}

function isMoisturizerStep(step: StepCategory): boolean {
  return step.startsWith('moisturizer') || step.startsWith('balm');
}

function isFrequencySensitiveEveningActive(step: StepCategory): boolean {
  return (
    step.startsWith('treatment') ||
    step === 'serum_vitc' ||
    step === 'serum_exfoliant' ||
    step === 'toner_exfoliant' ||
    step === 'toner_acid' ||
    step === 'toner_aha' ||
    step === 'toner_bha'
  );
}

/**
 * Возвращает облегчённую версию шагов для отдельных дней.
 *
 * Правила консервативные:
 * - не удаляем cleanser / moisturizer / SPF;
 * - не добавляем новые активы;
 * - minimal-рутины не трогаем;
 * - weekly focus day сам по себе уже даёт вариативность, его не облегчаем.
 */
export function applyPhaseRoutineVariation(
  input: PhaseRoutineVariationInput
): PhaseRoutineVariationResult {
  let morningSteps = [...input.morningSteps];
  let eveningSteps = [...input.eveningSteps];
  const appliedRules: string[] = [];

  if (input.routineComplexity === 'minimal') {
    return { morningSteps, eveningSteps, appliedRules };
  }

  const hasMorningSerum = morningSteps.some(isSerumStep);
  const hasEveningMoisturizer = eveningSteps.some(isMoisturizerStep);
  const isEarlyAdaptation = input.phase === 'adaptation' && input.dayIndex <= 2;
  const isRecoveryNight = [6, 13, 20, 27].includes(input.dayIndex);
  const isSupportStreamlineMorning = input.phase === 'support' && input.dayIndex % 2 === 0;

  if (isEarlyAdaptation) {
    if (hasMorningSerum && morningSteps.some(isTonerStep)) {
      morningSteps = withoutFirstMatching(morningSteps, isTonerStep);
      appliedRules.push('early_adaptation_short_morning');
    }

    if (hasEveningMoisturizer && eveningSteps.some(isTonerStep)) {
      eveningSteps = withoutFirstMatching(eveningSteps, isTonerStep);
      appliedRules.push('early_adaptation_short_evening');
    }
  }

  if (isRecoveryNight && !input.isWeeklyFocusDay) {
    const before = eveningSteps.length;
    eveningSteps = eveningSteps.filter((step) => !isFrequencySensitiveEveningActive(step));
    if (eveningSteps.length !== before) {
      appliedRules.push('weekly_recovery_without_frequency_sensitive_actives');
    } else if (hasEveningMoisturizer && eveningSteps.some(isTonerStep)) {
      eveningSteps = withoutFirstMatching(eveningSteps, isTonerStep);
      appliedRules.push('weekly_recovery_short_evening');
    }
  }

  if (isSupportStreamlineMorning && hasMorningSerum && morningSteps.some(isTonerStep)) {
    morningSteps = withoutFirstMatching(morningSteps, isTonerStep);
    appliedRules.push('support_streamlined_morning');
  }

  return { morningSteps, eveningSteps, appliedRules };
}
