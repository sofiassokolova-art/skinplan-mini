// tests/plan-page/why-picked.test.ts
// Юнит-тесты на buildWhyPicked — персональное «почему это средство в плане».

import { describe, it, expect } from 'vitest';
import { buildWhyPicked } from '@/lib/plan-page/why-picked';

const base = {
  activeIngredients: [] as string[],
  category: null as string | null,
  stepCategories: [] as string[],
  mainGoals: [] as any[],
  skinType: null as string | null,
  sensitivityLevel: null as string | null,
};

describe('buildWhyPicked', () => {
  it('азелаиновая кислота + цель acne → причина про воспаления/постакне', () => {
    const why = buildWhyPicked({
      ...base,
      activeIngredients: ['azelaic_acid_10'],
      stepCategories: ['treatment_acne_azelaic'],
      mainGoals: ['acne'],
      skinType: 'combination_oily',
    });
    expect(why).toMatch(/азелаиновая кислота/i);
    expect(why).toMatch(/постакне|воспалени/i);
    expect(why).toMatch(/комбинированную/i);
  });

  it('ниацинамид + цель pores → причина про себум/поры', () => {
    const why = buildWhyPicked({
      ...base,
      activeIngredients: ['niacinamide'],
      stepCategories: ['serum_niacinamide'],
      mainGoals: ['pores'],
    });
    expect(why).toMatch(/ниацинамид/i);
    expect(why).toMatch(/поры|себум/i);
  });

  it('SPF → отдельное объяснение про защиту, при пигментации — про пятна', () => {
    const spf = buildWhyPicked({
      ...base,
      category: 'spf',
      stepCategories: ['spf_50_face'],
      activeIngredients: ['SPF50'],
    });
    expect(spf).toMatch(/SPF/);

    const spfPigment = buildWhyPicked({
      ...base,
      category: 'spf',
      stepCategories: ['spf_50_face'],
      mainGoals: ['pigmentation'],
    });
    expect(spfPigment).toMatch(/пигментаци/i);
  });

  it('высокая чувствительность добавляет хвост про чувствительную кожу', () => {
    const why = buildWhyPicked({
      ...base,
      activeIngredients: ['niacinamide'],
      stepCategories: ['serum_niacinamide'],
      sensitivityLevel: 'high',
    });
    expect(why).toMatch(/чувствительн/i);
  });

  it('очищение без активов → фолбэк по роли шага', () => {
    const why = buildWhyPicked({
      ...base,
      category: 'cleanser',
      stepCategories: ['cleanser_gentle'],
      skinType: 'dry',
    });
    expect(why).toMatch(/очищени/i);
    expect(why).toMatch(/барьер/i);
  });

  it('русские названия активов тоже распознаются', () => {
    const why = buildWhyPicked({
      ...base,
      activeIngredients: ['азелаиновая кислота 15%'],
      stepCategories: ['treatment_acne_azelaic'],
      mainGoals: ['acne'],
    });
    expect(why).toMatch(/азелаиновая/i);
  });

  it('нет данных → null (блок в UI скрывается)', () => {
    const why = buildWhyPicked({ ...base });
    expect(why).toBeNull();
  });

  it('ретиноид + antiage → про морщины; + acne → про высыпания', () => {
    const antiage = buildWhyPicked({
      ...base,
      activeIngredients: ['retinol'],
      stepCategories: ['treatment_antiage'],
      mainGoals: ['antiage'],
    });
    expect(antiage).toMatch(/морщин/i);

    const acne = buildWhyPicked({
      ...base,
      activeIngredients: ['адапален 0.1%'],
      stepCategories: ['treatment_acne_azelaic'],
      mainGoals: ['acne'],
    });
    expect(acne).toMatch(/высыпани/i);
  });
});
