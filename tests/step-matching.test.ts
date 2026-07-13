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

  it('P3.2: распознаёт мицеллярную воду (не как масло)', () => {
    const byStep = mapStepToStepCategory('cleanser_micellar', 'cleanser');
    expect(byStep).toContain('cleanser_micellar');
    expect(byStep).not.toContain('cleanser_oil');

    const byName = mapStepToStepCategory('Мицеллярная вода', 'cleanser');
    expect(byName).toContain('cleanser_micellar');
  });

  it('P3.2: гидрофильное масло не маппится в мицеллярку', () => {
    const mapped = mapStepToStepCategory('cleanser_oil', 'cleanser');
    expect(mapped).toContain('cleanser_oil');
    expect(mapped).not.toContain('cleanser_micellar');
  });

  describe('регрессия Галимат: _oily не матчится как _oil', () => {
    it('spf_50_oily (Eucerin Oil Control) НЕ регистрируется как cleanser', () => {
      // Раньше includes('_oil') матчил '_oily' → SPF вставал в план
      // на место вечернего умывания.
      const mapped = mapStepToStepCategory('spf_50_oily', 'spf');
      expect(mapped).toContain('spf_50_oily');
      expect(mapped).not.toContain('cleanser_oil');
      expect(mapped).not.toContain('cleanser_gentle');
    });

    it('шаг с токеном oily (не spf) тоже не считается гидрофильным маслом', () => {
      const mapped = mapStepToStepCategory('moisturizer_oily', 'moisturizer', 'oily');
      expect(mapped).not.toContain('cleanser_oil');
    });

    it('настоящий токен oil по границам матчится как гидрофильное масло', () => {
      expect(mapStepToStepCategory('cleansing_oil', 'cleanser')).toContain('cleanser_oil');
      expect(mapStepToStepCategory('oil_cleanser', 'cleanser')).toContain('cleanser_oil');
    });

    it('SPF-контекст исключён из cleanser-веток даже при слове oil в шаге', () => {
      // 'oil control' в названии SPF-продукта не должен уводить его в очищение
      const mapped = mapStepToStepCategory('spf_oil_control', 'spf');
      expect(mapped).not.toContain('cleanser_oil');
      expect(mapped).not.toContain('cleanser_gentle');
    });
  });
});

