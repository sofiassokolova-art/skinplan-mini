// tests/p1-seasonality-diversity.test.ts
// P1.1 brand diversity + P1.2 сезонная адаптация + P1.3 фототип Фитцпатрика.
// Тесты максимально изолированные: бьём отдельные функции, не дёргая всю генерацию плана,
// чтобы не зависеть от Prisma/wasm-окружения (см. тесты api/plan-generate, которые
// падают в node-vitest по той же причине).

import { describe, it, expect } from 'vitest';
import { enforceBrandDiversity } from '@/lib/plan-helpers';
import { applySeasonalAdjustment, normalizeSeasonalProfile, currentSeason } from '@/lib/seasonality';
import { filterProducts } from '@/lib/unified-product-filter';
import type { ProductWithBrand } from '@/lib/product-fallback';
import type { ProfileClassification } from '@/lib/plan-generation-helpers';
import type { StepCategory } from '@/lib/step-category-rules';

function product(overrides: Partial<ProductWithBrand> & { id: number; name: string; brandName?: string }): ProductWithBrand {
  return {
    id: overrides.id,
    name: overrides.name,
    brand: { id: overrides.brand?.id ?? Math.floor(Math.random() * 1000), name: overrides.brandName ?? overrides.brand?.name ?? 'Brand', isActive: true },
    step: overrides.step ?? null,
    category: overrides.category ?? null,
    skinTypes: overrides.skinTypes ?? [],
    activeIngredients: overrides.activeIngredients ?? [],
    price: overrides.price ?? null,
    imageUrl: overrides.imageUrl ?? null,
    isHero: overrides.isHero ?? false,
    priority: overrides.priority ?? 0,
    published: overrides.published ?? true,
    ...overrides,
  } as ProductWithBrand;
}

describe('P1.1 enforceBrandDiversity', () => {
  it('возвращает исходный список, если бренды уже сбалансированы', () => {
    const selected = [
      product({ id: 1, name: 'A', brand: { id: 1, name: 'A', isActive: true }, step: 'serum_niacinamide' }),
      product({ id: 2, name: 'B', brand: { id: 2, name: 'B', isActive: true }, step: 'moisturizer_light' }),
      product({ id: 3, name: 'C', brand: { id: 3, name: 'C', isActive: true }, step: 'toner_hydrating' }),
    ];
    const result = enforceBrandDiversity(selected, new Map(), 3);
    expect(result.map(p => p.id)).toEqual([1, 2, 3]);
  });

  it('заменяет избыточные продукты одного бренда альтернативой из другого, если есть кандидат', () => {
    const a = (id: number, step: string) => product({ id, name: `A${id}`, brand: { id: 1, name: 'BrandA', isActive: true }, step });
    const b = (id: number, step: string) => product({ id, name: `B${id}`, brand: { id: 2, name: 'BrandB', isActive: true }, step });
    const selected = [
      a(10, 'serum_niacinamide'),
      a(11, 'toner_hydrating'),
      a(12, 'moisturizer_light'),
      a(13, 'serum_vitc'),
    ];
    const candidates = new Map<string, ProductWithBrand[]>([
      ['serum_niacinamide', [a(10, 'serum_niacinamide'), b(20, 'serum_niacinamide')]],
      ['toner_hydrating', [a(11, 'toner_hydrating'), b(21, 'toner_hydrating')]],
      ['moisturizer_light', [a(12, 'moisturizer_light'), b(22, 'moisturizer_light')]],
      ['serum_vitc', [a(13, 'serum_vitc'), b(23, 'serum_vitc')]],
    ]);
    const result = enforceBrandDiversity(selected, candidates, 3);
    const brandCounts = result.reduce<Record<string, number>>((acc, p) => {
      const key = String(p.brand?.id);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    expect(Object.values(brandCounts).every(c => c <= 3)).toBe(true);
  });

  it('НЕ трогает SPF и cleanser (защищённые шаги)', () => {
    const a = (id: number, step: string) => product({ id, name: `A${id}`, brand: { id: 1, name: 'BrandA', isActive: true }, step });
    const b = (id: number, step: string) => product({ id, name: `B${id}`, brand: { id: 2, name: 'BrandB', isActive: true }, step });
    // 4 продукта одного бренда, но 2 из них — SPF/cleanser
    const selected = [
      a(1, 'spf_50_face'),
      a(2, 'cleanser_gentle'),
      a(3, 'serum_niacinamide'),
      a(4, 'moisturizer_light'),
    ];
    const candidates = new Map<string, ProductWithBrand[]>([
      ['spf_50_face', [a(1, 'spf_50_face'), b(10, 'spf_50_face')]],
      ['cleanser_gentle', [a(2, 'cleanser_gentle'), b(11, 'cleanser_gentle')]],
      ['serum_niacinamide', [a(3, 'serum_niacinamide'), b(12, 'serum_niacinamide')]],
      ['moisturizer_light', [a(4, 'moisturizer_light'), b(13, 'moisturizer_light')]],
    ]);
    const result = enforceBrandDiversity(selected, candidates, 3);
    // SPF и cleanser должны остаться от BrandA (id 1 и 2)
    expect(result.find(p => p.step === 'spf_50_face')?.id).toBe(1);
    expect(result.find(p => p.step === 'cleanser_gentle')?.id).toBe(2);
  });

  it('оставляет продукт без изменений, если для шага нет альтернативного бренда', () => {
    const a = (id: number, step: string) => product({ id, name: `A${id}`, brand: { id: 1, name: 'BrandA', isActive: true }, step });
    const selected = [a(1, 's1'), a(2, 's2'), a(3, 's3'), a(4, 's4')];
    const candidates = new Map<string, ProductWithBrand[]>([
      ['s1', [a(1, 's1')]],
      ['s2', [a(2, 's2')]],
      ['s3', [a(3, 's3')]],
      ['s4', [a(4, 's4')]],
    ]);
    const result = enforceBrandDiversity(selected, candidates, 3);
    expect(result.map(p => p.id)).toEqual([1, 2, 3, 4]);
  });
});

describe('P1.2 sezonality', () => {
  it('normalizeSeasonalProfile понимает русские и en-варианты', () => {
    expect(normalizeSeasonalProfile('зимой суше')).toBe('winter_drier');
    expect(normalizeSeasonalProfile('летом жирнее')).toBe('summer_oilier');
    expect(normalizeSeasonalProfile('winter_drier')).toBe('winter_drier');
    expect(normalizeSeasonalProfile('stable')).toBe('stable');
    expect(normalizeSeasonalProfile(undefined)).toBe(null);
  });

  it('зимой и при winter_drier меняет moisturizer_light → moisturizer_barrier', () => {
    const december = new Date('2025-12-15T12:00:00Z');
    const morning: StepCategory[] = ['cleanser_gentle', 'moisturizer_light', 'spf_50_face'];
    const { steps, appliedReasons } = applySeasonalAdjustment(morning, 'winter_drier', december);
    expect(steps).toContain('moisturizer_barrier');
    expect(steps).not.toContain('moisturizer_light');
    expect(appliedReasons.length).toBeGreaterThan(0);
  });

  it('летом и при summer_oilier меняет moisturizer_barrier → moisturizer_light', () => {
    const july = new Date('2025-07-15T12:00:00Z');
    const morning: StepCategory[] = ['cleanser_gentle', 'moisturizer_barrier', 'spf_50_face'];
    const { steps } = applySeasonalAdjustment(morning, 'summer_oilier', july);
    expect(steps).toContain('moisturizer_light');
    expect(steps).not.toContain('moisturizer_barrier');
  });

  it('stable профиль НЕ применяет адаптацию ни зимой, ни летом', () => {
    const december = new Date('2025-12-15T12:00:00Z');
    const july = new Date('2025-07-15T12:00:00Z');
    const morning: StepCategory[] = ['moisturizer_light'];
    expect(applySeasonalAdjustment(morning, 'stable', december).steps).toEqual(morning);
    expect(applySeasonalAdjustment(morning, 'stable', july).steps).toEqual(morning);
  });

  it('весной/осенью не применяет адаптацию (сезон вне триггера)', () => {
    const april = new Date('2025-04-15T12:00:00Z');
    const morning: StepCategory[] = ['moisturizer_light'];
    const { steps, appliedReasons } = applySeasonalAdjustment(morning, 'winter_drier', april);
    expect(steps).toEqual(morning);
    expect(appliedReasons).toHaveLength(0);
  });

  it('currentSeason корректно определяет сезон для крайних месяцев', () => {
    expect(currentSeason(new Date('2025-01-15'))).toBe('winter');
    expect(currentSeason(new Date('2025-04-15'))).toBe('spring');
    expect(currentSeason(new Date('2025-07-15'))).toBe('summer');
    expect(currentSeason(new Date('2025-10-15'))).toBe('autumn');
    expect(currentSeason(new Date('2025-12-15'))).toBe('winter');
  });
});

describe('P1.3 фототип Фитцпатрика — фильтр в filterProducts', () => {
  const baseProfile: ProfileClassification = {
    skinType: 'normal',
    concerns: [],
    diagnoses: [],
    pregnant: false,
    sensitivityLevel: 'medium',
  };

  it('V_VI: отбрасывает сильные эксфолианты (treatment_exfoliant_strong, AHA 30%, mask_acid)', async () => {
    const products = [
      product({ id: 1, name: 'AHA 30 peel', activeIngredients: ['glycolic acid 30%'], step: 'treatment_exfoliant_strong', category: 'treatment_exfoliant_strong' }),
      product({ id: 2, name: 'Acid mask', step: 'mask_acid', category: 'mask_acid' }),
      product({ id: 3, name: 'Gentle BHA', activeIngredients: ['salicylic acid'], step: 'treatment_exfoliant_mild', category: 'treatment_exfoliant_mild' }),
      product({ id: 4, name: 'Niacinamide', activeIngredients: ['niacinamide'], step: 'serum_niacinamide', category: 'serum_niacinamide' }),
    ];
    const results = await filterProducts(products, {
      profileClassification: { ...baseProfile, fitzpatrickType: 'V_VI' },
      strictness: 'soft',
    });
    const ids = results.map(r => r.product.id);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
    expect(ids).toContain(3);
    expect(ids).toContain(4);
  });

  it('I_II/III_IV: НЕ блокирует эксфолианты (sanity-check, чтобы не задеть светлокожих)', async () => {
    const products = [product({ id: 1, name: 'AHA 30 peel', activeIngredients: ['glycolic acid 30%'], step: 'treatment_exfoliant_strong' })];
    const results = await filterProducts(products, {
      profileClassification: { ...baseProfile, fitzpatrickType: 'III_IV' },
      strictness: 'soft',
    });
    expect(results.map(r => r.product.id)).toContain(1);
  });
});
