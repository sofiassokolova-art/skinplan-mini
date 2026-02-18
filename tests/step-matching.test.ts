import { describe, it, expect } from 'vitest';
import { mapStepToStepCategory } from '@/lib/step-matching';

describe('step matching: product.step/category -> StepCategory', () => {
  it('maps common base steps (serum/moisturizer/spf/cleanser/toner/treatment/mask) to non-empty categories', () => {
    const cases: Array<{ step?: string | null; category?: string | null; skinType?: string | null }> = [
      { step: 'serum', category: 'serum' },
      { step: 'moisturizer', category: 'moisturizer', skinType: 'dry' },
      { step: 'spf', category: 'spf' },
      { step: 'cleanser', category: 'cleanser' },
      { step: 'toner', category: 'toner' },
      { step: 'treatment', category: 'treatment' },
      { step: 'mask', category: 'mask' },
    ];

    for (const c of cases) {
      const mapped = mapStepToStepCategory(c.step, c.category, c.skinType);
      expect(mapped.length, `expected non-empty mapping for step=${c.step} category=${c.category}`).toBeGreaterThan(0);
    }
  });

  it('supports legacy stepCategory strings used in imports (moisturizer_rich)', () => {
    const mapped = mapStepToStepCategory('moisturizer_rich', null, 'dry');
    expect(mapped).toContain('moisturizer_barrier');
  });

  it('does not map vitamin C serum to serum_hydrating', () => {
    const mapped = mapStepToStepCategory('serum_vitc', 'serum');
    expect(mapped).toContain('serum_vitc');
    expect(mapped).not.toContain('serum_hydrating');
  });

  it('maps SPF variants correctly', () => {
    expect(mapStepToStepCategory('spf_50_sensitive', 'spf')).toContain('spf_50_sensitive');
    expect(mapStepToStepCategory('spf_50_oily', 'spf')).toContain('spf_50_oily');
    expect(mapStepToStepCategory('spf_50_face', 'spf')).toContain('spf_50_face');
  });
});

