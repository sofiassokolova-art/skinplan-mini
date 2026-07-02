import { describe, expect, it } from 'vitest';
import { buildProductCards } from '@/lib/plan-page/product-context';
import type { Plan28, PlanPhases } from '@/lib/plan-types';
import type { StepCategory } from '@/lib/step-category-rules';

describe('buildProductCards', () => {
  it('groups strong actives into active phase and deduplicates phase-swap cleansers', () => {
    const cards = buildProductCards({
      plan: makePlanWithFrontLoadedActives(),
      products: [
        product(101, 'Gentle Cleanser', 'cleanser_balancing', 'cleanser'),
        product(102, 'Active Phase Cleanser', 'cleanser_balancing', 'cleanser'),
        product(201, 'Azelaic Acid 10%', 'treatment_acne_azelaic', 'treatment', ['azelaic_acid']),
        product(301, 'SPF with Salicylic', 'spf_50_oily', 'spf', ['salicylic_acid']),
        product(401, 'Glycolic Acid 7% Toning Solution', 'toner_hydrating', 'toner', ['glycolic_acid']),
      ],
      cartProductIds: new Set(),
      wishlistProductIds: new Set(),
      replacements: new Map(),
    });

    expect(cards.map((card) => card.id)).not.toContain(102);
    expect(cards.find((card) => card.id === 101)?.firstPhase).toBe('adaptation');
    expect(cards.find((card) => card.id === 201)?.firstPhase).toBe('active');
    expect(cards.find((card) => card.id === 401)?.firstPhase).toBe('active');
    expect(cards.find((card) => card.id === 301)?.firstPhase).toBe('adaptation');
  });
});

function makePlanWithFrontLoadedActives(): Plan28 {
  return {
    userId: 'user-1',
    skinProfileId: 'profile-1',
    mainGoals: ['acne'],
    days: Array.from({ length: 28 }, (_, index) => {
      const dayIndex = index + 1;
      return {
        dayIndex,
        phase: phaseForDay(dayIndex),
        isWeeklyFocusDay: false,
        morning: [
          step('spf_50_oily', 301),
        ],
        evening: [
          step('cleanser_balancing', dayIndex <= 7 ? 101 : 102),
          step('treatment_acne_azelaic', 201, true),
          step('toner_hydrating', 401),
        ],
        weekly: [],
      };
    }),
  };
}

function step(stepCategory: StepCategory, productId: number, requiresPatchTest = false) {
  return {
    stepCategory,
    productId: String(productId),
    alternatives: [],
    requiresPatchTest,
  };
}

function product(
  id: number,
  name: string,
  stepName: string,
  category: string,
  activeIngredients: string[] = [],
) {
  return {
    id,
    name,
    category,
    step: stepName,
    activeIngredients,
    brand: { name: 'Brand' },
    price: null,
    imageUrl: null,
    description: null,
    descriptionUser: null,
  };
}

function phaseForDay(dayIndex: number): PlanPhases {
  if (dayIndex <= 7) return 'adaptation';
  if (dayIndex <= 21) return 'active';
  return 'support';
}
