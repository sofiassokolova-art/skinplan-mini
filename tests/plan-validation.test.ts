import { describe, expect, it } from 'vitest';
import { validatePlan } from '@/lib/plan-validation';
import type { Plan28, DayStep } from '@/lib/plan-types';
import type { StepCategory } from '@/lib/step-category-rules';

function step(stepCategory: StepCategory, productId: number): DayStep {
  return {
    stepCategory,
    productId: String(productId),
    alternatives: [],
  };
}

function product(id: number, name: string, activeIngredients: string[] = []) {
  return {
    id,
    name,
    brand: { id, name: `Brand ${id}`, isActive: true },
    step: 'test',
    category: 'test',
    skinTypes: [],
    activeIngredients,
    price: null,
    imageUrl: null,
    isHero: false,
    priority: 0,
    published: true,
  } as any;
}

function planWithRoutines(
  morning: DayStep[],
  evening: DayStep[],
  weekly: DayStep[] = []
): Plan28 {
  return {
    userId: 'test-user',
    skinProfileId: 'test-profile',
    mainGoals: ['barrier'],
    days: Array.from({ length: 28 }, (_, index) => ({
      dayIndex: index + 1,
      phase: index < 7 ? 'adaptation' : index < 21 ? 'active' : 'support',
      isWeeklyFocusDay: weekly.length > 0,
      morning,
      evening,
      weekly,
    })),
  };
}

describe('validatePlan: frequency and sequence warnings', () => {
  it('не ругается на ежедневные базовые поддерживающие ингредиенты', async () => {
    const plan = planWithRoutines(
      [
        step('cleanser_gentle', 1),
        step('toner_hydrating', 2),
        step('moisturizer_barrier', 3),
        step('spf_50_face', 4),
      ],
      [
        step('cleanser_gentle', 1),
        step('toner_soothing', 2),
        step('moisturizer_barrier', 3),
      ]
    );

    const result = await validatePlan(
      plan,
      [
        product(1, 'Cleanser'),
        product(2, 'Daily Toner', ['centella', 'panthenol', 'ниацинамид']),
        product(3, 'Barrier Cream', ['glycerin', 'hyaluronic_acid', 'ceramides']),
        product(4, 'SPF', ['SPF50']),
      ],
      { ingredientCompatibility: false, dermatologyProtocols: true }
    );

    expect(result.warnings.filter((w) => w.startsWith('HIGH_FREQUENCY_INGREDIENT'))).toEqual([]);
  });

  it('не путает aha/pha с подстроками в alpha arbutin и sulphate', async () => {
    const plan = planWithRoutines(
      [
        step('cleanser_gentle', 1),
        step('serum_brightening_soft', 2),
        step('moisturizer_light', 3),
        step('spf_50_face', 4),
      ],
      [
        step('cleanser_gentle', 1),
        step('serum_brightening_soft', 2),
        step('toner_exfoliant', 5),
        step('moisturizer_light', 3),
      ]
    );

    const result = await validatePlan(
      plan,
      [
        product(1, 'Cleanser', ['sodium lauryl sulphate']),
        product(2, 'Brightening Serum', ['alpha arbutin']),
        product(3, 'Moisturizer'),
        product(4, 'SPF'),
        product(5, 'Exfoliating Toner', ['AHA']),
      ],
      { ingredientCompatibility: false, dermatologyProtocols: true }
    );

    const frequencyWarnings = result.warnings.filter((w) => w.startsWith('HIGH_FREQUENCY_INGREDIENT'));
    expect(frequencyWarnings).toHaveLength(1);
    expect(frequencyWarnings[0]).toContain('AHA');
  });

  it('считает частоту сильного актива по дням, а не по количеству шагов', async () => {
    const plan = planWithRoutines(
      [
        step('cleanser_gentle', 1),
        step('treatment_exfoliant_mild', 5),
        step('moisturizer_light', 3),
        step('spf_50_face', 4),
      ],
      [
        step('cleanser_gentle', 1),
        step('treatment_exfoliant_mild', 5),
        step('moisturizer_light', 3),
      ]
    );

    const result = await validatePlan(
      plan,
      [
        product(1, 'Cleanser'),
        product(3, 'Moisturizer'),
        product(4, 'SPF'),
        product(5, 'BHA Treatment', ['salicylic_acid']),
      ],
      { ingredientCompatibility: false, dermatologyProtocols: true }
    );

    const frequencyWarnings = result.warnings.filter((w) => w.startsWith('HIGH_FREQUENCY_INGREDIENT'));
    expect(frequencyWarnings).toHaveLength(1);
    expect(frequencyWarnings[0]).toContain('salicylic_acid используется в 100% дней');
    expect(frequencyWarnings[0]).not.toContain('200%');
  });

  it('ловит неправильный вечерний порядок treatment перед toner', async () => {
    const plan = planWithRoutines(
      [
        step('cleanser_gentle', 1),
        step('moisturizer_light', 3),
        step('spf_50_face', 4),
      ],
      [
        step('cleanser_gentle', 1),
        step('treatment_acne_local', 5),
        step('toner_soothing', 2),
        step('moisturizer_light', 3),
      ]
    );

    const result = await validatePlan(
      plan,
      [
        product(1, 'Cleanser'),
        product(2, 'Toner'),
        product(3, 'Moisturizer'),
        product(4, 'SPF'),
        product(5, 'Manual Treatment'),
      ],
      { ingredientCompatibility: false, dermatologyProtocols: true }
    );

    expect(result.warnings.some((w) => w.includes('Day 1 (evening): Неправильная последовательность'))).toBe(true);
  });

  it('не ругается на порядок cleanser → toner → treatment → moisturizer', async () => {
    const plan = planWithRoutines(
      [
        step('cleanser_gentle', 1),
        step('moisturizer_light', 3),
        step('spf_50_face', 4),
      ],
      [
        step('cleanser_gentle', 1),
        step('toner_soothing', 2),
        step('treatment_acne_local', 5),
        step('moisturizer_light', 3),
      ]
    );

    const result = await validatePlan(
      plan,
      [
        product(1, 'Cleanser'),
        product(2, 'Toner'),
        product(3, 'Moisturizer'),
        product(4, 'SPF'),
        product(5, 'Manual Treatment'),
      ],
      { ingredientCompatibility: false, dermatologyProtocols: true }
    );

    expect(result.warnings.some((w) => w.includes('Неправильная последовательность'))).toBe(false);
  });
});

describe('validatePlan: кросс-временные конфликты активов', () => {
  it('не считает несовместимым день с кислотой утром и ретинолом вечером', async () => {
    const plan = planWithRoutines(
      [
        step('cleanser_gentle', 1),
        step('toner_exfoliant', 2),
        step('spf_50_face', 4),
      ],
      [
        step('cleanser_gentle', 1),
        step('treatment_antiage', 5),
        step('moisturizer_light', 3),
      ]
    );

    const result = await validatePlan(
      plan,
      [
        product(1, 'Cleanser'),
        product(2, 'Glycolic Acid 7%', ['glycolic acid']),
        product(3, 'Moisturizer'),
        product(4, 'SPF'),
        product(5, 'Retinol 0.3%', ['retinol']),
      ],
      { ingredientCompatibility: true, dermatologyProtocols: false, strictMode: true }
    );

    expect(result.incompatibleDays).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
