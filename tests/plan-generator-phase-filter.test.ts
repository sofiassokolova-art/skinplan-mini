import { describe, expect, it } from 'vitest';
import { isProductAllowedInPlanPhase } from '@/lib/plan-generator';
import type { StepCategory } from '@/lib/step-category-rules';

const product = (activeIngredients: string[]) => ({ activeIngredients });

describe('plan generator phase product filter', () => {
  it('does not write strong active toners into adaptation/support days', () => {
    const glycolicToner = product(['glycolic_acid']);
    const step = 'toner_hydrating' as StepCategory;

    expect(isProductAllowedInPlanPhase(glycolicToner, 'adaptation', step)).toBe(false);
    expect(isProductAllowedInPlanPhase(glycolicToner, 'active', step)).toBe(true);
    expect(isProductAllowedInPlanPhase(glycolicToner, 'support', step)).toBe(false);
  });

  it('keeps genuinely phase-safe basics available across phases', () => {
    const hydratingToner = product(['глицерин', 'гиалуроновая кислота']);
    const step = 'toner_hydrating' as StepCategory;

    expect(isProductAllowedInPlanPhase(hydratingToner, 'adaptation', step)).toBe(true);
    expect(isProductAllowedInPlanPhase(hydratingToner, 'active', step)).toBe(true);
    expect(isProductAllowedInPlanPhase(hydratingToner, 'support', step)).toBe(true);
  });

  it('allows niacinamide as a gentle all-phase serum', () => {
    const niacinamideSerum = product(['ниацинамид', 'цинк']);
    const step = 'serum_niacinamide' as StepCategory;

    expect(isProductAllowedInPlanPhase(niacinamideSerum, 'adaptation', step)).toBe(true);
    expect(isProductAllowedInPlanPhase(niacinamideSerum, 'active', step)).toBe(true);
    expect(isProductAllowedInPlanPhase(niacinamideSerum, 'support', step)).toBe(true);
  });

  it('rejects phase-restricted active steps outside the active phase even with empty ingredients', () => {
    const unknownActive = product([]);
    const step = 'treatment_acne_bpo' as StepCategory;

    expect(isProductAllowedInPlanPhase(unknownActive, 'adaptation', step)).toBe(false);
    expect(isProductAllowedInPlanPhase(unknownActive, 'active', step)).toBe(true);
    expect(isProductAllowedInPlanPhase(unknownActive, 'support', step)).toBe(false);
  });
});
