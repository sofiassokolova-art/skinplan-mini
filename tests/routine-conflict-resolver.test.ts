import { describe, expect, it } from 'vitest';
import {
  resolveIntraRoutineConflicts,
  findIntraRoutineConflicts,
} from '@/lib/routine-conflict-resolver';
import { checkProductCompatibility } from '@/lib/ingredient-compatibility';
import type { PlanInvariantProduct } from '@/lib/plan-invariants';
import type { DayStep, Plan28 } from '@/lib/plan-types';
import type { StepCategory } from '@/lib/step-category-rules';

function step(
  stepCategory: StepCategory,
  productId: number | null,
  alternatives: string[] = []
): DayStep {
  return { stepCategory, productId: productId === null ? null : String(productId), alternatives };
}

function planWith(makeDay: (dayIndex: number) => { morning: DayStep[]; evening: DayStep[] }, days = 3): Plan28 {
  return {
    userId: 'test-user',
    skinProfileId: 'test-profile',
    mainGoals: ['antiage'],
    days: Array.from({ length: days }, (_, i) => {
      const dayIndex = i + 1;
      const routines = makeDay(dayIndex);
      return {
        dayIndex,
        phase: 'active',
        isWeeklyFocusDay: false,
        weekly: [],
        ...routines,
      };
    }),
  } as unknown as Plan28;
}

const PRODUCTS: PlanInvariantProduct[] = [
  { id: 1, name: 'Мягкий гель для умывания', step: 'cleanser', activeIngredients: [] },
  { id: 641, name: 'Glycolic Acid 7% Toning Solution', step: 'toner_exfoliant', activeIngredients: ['glycolic acid'] },
  { id: 900, name: 'Retinol 0.3% Serum', step: 'serum', activeIngredients: ['retinol'] },
  { id: 901, name: 'Увлажняющий крем', step: 'moisturizer', activeIngredients: ['hyaluronic acid'] },
  { id: 902, name: 'SPF 50', step: 'spf', activeIngredients: [] },
  { id: 903, name: 'Успокаивающий тонер', step: 'toner_hydrating', activeIngredients: ['niacinamide'] },
];

const productsMap = new Map<string, PlanInvariantProduct>(
  PRODUCTS.map(p => [String(p.id), p])
);

describe('resolveIntraRoutineConflicts: конфликт внутри одного приема', () => {
  it('разводит гликолевый тонер и ретинол-сыворотку, стоящие в одном вечере', () => {
    const plan = planWith(() => ({
      morning: [step('cleanser_gentle', 1), step('spf_50_face', 902)],
      evening: [
        step('cleanser_gentle', 1),
        step('toner_exfoliant', 641),
        step('treatment_antiage', 900),
        step('moisturizer_light', 901),
      ],
    }));

    const result = resolveIntraRoutineConflicts(plan, productsMap);

    expect(result.resolutions.length).toBeGreaterThan(0);
    expect(result.resolutions.every(r => r.action !== 'unresolved')).toBe(true);

    for (const day of plan.days) {
      const eveningIds = day.evening.filter(s => s.productId).map(s => s.productId);
      expect(eveningIds).toContain('900');
      expect(eveningIds).not.toContain('641');
      expect(eveningIds).toContain('1');
      expect(eveningIds).toContain('901');
      expect(day.evening.some(s => !s.productId)).toBe(false);
    }

    expect(findIntraRoutineConflicts(plan, productsMap)).toHaveLength(0);
  });

  it('подставляет неконфликтную альтернативу, если она есть в шаге', () => {
    const plan = planWith(() => ({
      morning: [step('cleanser_gentle', 1), step('spf_50_face', 902)],
      evening: [
        step('toner_exfoliant', 641, ['903']),
        step('treatment_antiage', 900),
        step('moisturizer_light', 901),
      ],
    }));

    const result = resolveIntraRoutineConflicts(plan, productsMap);

    expect(result.resolutions.every(r => r.action === 'replaced')).toBe(true);
    for (const day of plan.days) {
      const toner = day.evening.find(s => s.stepCategory === 'toner_exfoliant');
      expect(toner?.productId).toBe('903');
      expect(day.evening.map(s => s.productId)).toContain('900');
    }
    expect(findIntraRoutineConflicts(plan, productsMap)).toHaveLength(0);
  });

  it('оставляет актив в днях, где второго участника конфликта нет', () => {
    const plan = planWith(dayIndex => ({
      morning: [step('cleanser_gentle', 1), step('spf_50_face', 902)],
      evening:
        dayIndex % 2 === 0
          ? [step('toner_exfoliant', 641), step('treatment_antiage', 900), step('moisturizer_light', 901)]
          : [step('toner_exfoliant', 641), step('moisturizer_light', 901)],
    }), 4);

    resolveIntraRoutineConflicts(plan, productsMap);

    const acidDays = plan.days
      .filter(d => d.evening.some(s => s.productId === '641'))
      .map(d => d.dayIndex);
    const retinolDays = plan.days
      .filter(d => d.evening.some(s => s.productId === '900'))
      .map(d => d.dayIndex);

    expect(acidDays).toEqual([1, 3]);
    expect(retinolDays).toEqual([2, 4]);
    expect(acidDays.some(d => retinolDays.includes(d))).toBe(false);
  });
});

describe('resolveIntraRoutineConflicts: отсутствие ложных срабатываний', () => {
  it('не трогает корректную раскладку кислота утром, ретинол вечером', () => {
    const plan = planWith(() => ({
      morning: [step('cleanser_gentle', 1), step('toner_exfoliant', 641), step('spf_50_face', 902)],
      evening: [step('cleanser_gentle', 1), step('treatment_antiage', 900), step('moisturizer_light', 901)],
    }));
    const before = JSON.stringify(plan);

    const result = resolveIntraRoutineConflicts(plan, productsMap);

    expect(result.resolutions).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(JSON.stringify(plan)).toBe(before);
  });

  it('раскладка separate_time помечена как решаемая разнесением по времени', () => {
    const conflict = checkProductCompatibility(
      { activeIngredients: ['glycolic acid'] },
      { activeIngredients: ['retinol'] }
    );
    expect(conflict?.severity).toBe('high');
    expect(conflict?.solution).toBe('separate_time');
  });

  it('не падает на шагах без продукта и на неизвестных продуктах', () => {
    const plan = planWith(() => ({
      morning: [step('cleanser_gentle', null), step('spf_50_face', 99999)],
      evening: [step('treatment_antiage', 900), step('toner_exfoliant', 641)],
    }));

    expect(() => resolveIntraRoutineConflicts(plan, productsMap)).not.toThrow();
    expect(plan.days[0].evening.map(s => s.productId)).toEqual(['900']);
  });
});

describe('findIntraRoutineConflicts: регресс-маяк', () => {
  it('ловит high-severity стек активов в одном приеме', () => {
    const plan = planWith(() => ({
      morning: [step('cleanser_gentle', 1)],
      evening: [step('toner_exfoliant', 641), step('treatment_antiage', 900)],
    }), 1);

    const found = findIntraRoutineConflicts(plan, productsMap);
    expect(found).toHaveLength(1);
    expect(found[0].routine).toBe('evening');
    expect(found[0].message).toContain('same routine');
  });
});
