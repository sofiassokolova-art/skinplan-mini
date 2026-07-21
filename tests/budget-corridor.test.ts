import { describe, expect, it } from 'vitest';
import {
  getBudgetCorridorSegments,
  getProductPriceSegment,
  normalizeBudgetLabel,
  productMatchesBudgetCorridor,
} from '@/lib/budget-corridor';
import { filterProducts, filterProductsWithReasons } from '@/lib/unified-product-filter';
import type { ProductWithBrand } from '@/lib/product-fallback';
import type { ProfileClassification } from '@/lib/plan-generation-helpers';

function product(overrides: Partial<ProductWithBrand> & { id: number; name: string }): ProductWithBrand {
  return {
    id: overrides.id,
    name: overrides.name,
    brand: overrides.brand ?? { id: 1, name: 'Brand', isActive: true },
    step: overrides.step ?? 'serum',
    category: overrides.category ?? 'serum',
    skinTypes: overrides.skinTypes ?? [],
    activeIngredients: overrides.activeIngredients ?? [],
    price: overrides.price ?? null,
    priceSegment: overrides.priceSegment ?? null,
    imageUrl: overrides.imageUrl ?? null,
    isHero: overrides.isHero ?? false,
    priority: overrides.priority ?? 0,
    published: overrides.published ?? true,
    ...overrides,
  } as ProductWithBrand;
}

const baseProfile: ProfileClassification = {
  skinType: 'normal',
  concerns: [],
  diagnoses: [],
  sensitivityLevel: 'low',
};

describe('budget corridor semantics', () => {
  it('normalizes questionnaire values and labels to exact price corridors', () => {
    expect(normalizeBudgetLabel('budget_1')).toBe('бюджетный');
    expect(normalizeBudgetLabel('Средний сегмент\n2 000–5 000 ₽')).toBe('средний');
    expect(normalizeBudgetLabel('premium')).toBe('премиум');
    expect(normalizeBudgetLabel('Без предпочтений\nЛюбой')).toBe('любой');

    expect(getBudgetCorridorSegments('budget_1')).toEqual(['mass']);
    expect(getBudgetCorridorSegments('budget_2')).toEqual(['mid']);
    expect(getBudgetCorridorSegments('budget_3')).toEqual(['premium']);
    expect(getBudgetCorridorSegments('budget_4')).toBeNull();
  });

  it('infers segment from real price at corridor boundaries', () => {
    expect(getProductPriceSegment({ price: 1999 })).toBe('mass');
    expect(getProductPriceSegment({ price: 2000 })).toBe('mid');
    expect(getProductPriceSegment({ price: 4999 })).toBe('mid');
    expect(getProductPriceSegment({ price: 5000 })).toBe('premium');
    expect(getProductPriceSegment({ price: null, priceSegment: null })).toBeNull();
  });

  it('does not allow cheaper mass products into the medium corridor', () => {
    expect(productMatchesBudgetCorridor({ priceSegment: 'mass', price: 1200 }, 'средний')).toBe(false);
    expect(productMatchesBudgetCorridor({ priceSegment: 'mid', price: 3200 }, 'средний')).toBe(true);
    expect(productMatchesBudgetCorridor({ priceSegment: 'premium', price: 7000 }, 'средний')).toBe(false);
    expect(productMatchesBudgetCorridor({ priceSegment: null, price: null }, 'средний')).toBe(false);
  });

  it('hard product filter keeps only products in the selected corridor', async () => {
    const products = [
      product({ id: 1, name: 'Mass serum', priceSegment: 'mass', price: 1200 }),
      product({ id: 2, name: 'Mid serum', priceSegment: 'mid', price: 3200 }),
      product({ id: 3, name: 'Premium serum', priceSegment: 'premium', price: 7200 }),
      product({ id: 4, name: 'Unknown serum', priceSegment: null, price: null }),
    ];

    const results = await filterProducts(products, {
      profileClassification: { ...baseProfile, budget: 'средний' },
      strictness: 'hard',
    });

    expect(results.map(r => r.product.id)).toEqual([2]);
  });

  it('soft product filter reports corridor mismatch reasons for diagnostics', async () => {
    const products = [
      product({ id: 1, name: 'Mass serum', priceSegment: 'mass', price: 1200 }),
      product({ id: 2, name: 'Mid serum', priceSegment: 'mid', price: 3200 }),
      product({ id: 3, name: 'Unknown serum', priceSegment: null, price: null }),
    ];

    const results = await filterProductsWithReasons(products, {
      profileClassification: { ...baseProfile, budget: 'средний' },
      strictness: 'soft',
    });

    expect(results.find(r => r.product.id === 2)?.reason).toBeUndefined();
    expect(results.find(r => r.product.id === 1)?.reason).toMatch(/коридор/i);
    expect(results.find(r => r.product.id === 3)?.reason).toMatch(/без цены/i);
  });
});
