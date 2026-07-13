// lib/rx-topicals.ts
// Рецептурная наружная терапия акне (Эффезел/Базирон = benzoyl_peroxide,
// Дифферин = topical_retinoids): вечерний лечебный слот занят препаратом врача,
// план не должен наслаивать сверху дополнительные кислоты/анти-акне активы
// (кейс Галимат: азелаинка поверх Эффезела → раздражение без пользы).
//
// Вынесено из plan-generator.ts, чтобы логика была юнит-тестируемой без prisma.

import type { StepCategory } from '@/lib/step-category-rules';

/** Маркеры currentTopicals (medicalMarkers), означающие сильную Rx-терапию. */
export const STRONG_RX_TOPICALS = ['benzoyl_peroxide', 'topical_retinoids'] as const;

/** true, если пользователь на рецептурной наружной терапии акне. */
export function isOnStrongRxTopicals(currentTopicals: unknown): boolean {
  if (!Array.isArray(currentTopicals)) return false;
  return currentTopicals.some(
    (t) => typeof t === 'string' && (STRONG_RX_TOPICALS as readonly string[]).includes(t)
  );
}

// Шаги с дополнительными лечебными активами, которые нельзя наслаивать поверх
// рецептурной наружной терапии: кожа уже получает сильный актив по назначению врача.
export const RX_TOPICAL_CONFLICT_STEPS: StepCategory[] = [
  'treatment_acne_azelaic',
  'treatment_acne_bpo',
  'treatment_acne_local',
  'treatment_exfoliant_mild',
  'treatment_exfoliant_strong',
  'treatment_acid',
  'serum_exfoliant',
  'toner_exfoliant',
  'toner_acid',
  'toner_aha',
  'toner_bha',
  'mask_acid',
  'mask_peel',
];

export function filterStepsForRxTopicals(
  steps: StepCategory[],
  onStrongRxTopicals: boolean
): StepCategory[] {
  if (!onStrongRxTopicals) return steps;
  return steps.filter((step) => !RX_TOPICAL_CONFLICT_STEPS.includes(step));
}
