import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductWithBrand } from '@/lib/product-fallback';
import type { ProfileClassification } from '@/lib/plan-generation-helpers';

const mockFindMany = vi.hoisted(() => vi.fn());
const mockFilterProductsBasic = vi.hoisted(() => vi.fn(async (products: ProductWithBrand[]) => products));

vi.mock('@/lib/db', () => ({
  prisma: {
    product: {
      findMany: mockFindMany,
    },
  },
}));

vi.mock('@/lib/unified-product-filter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/unified-product-filter')>('@/lib/unified-product-filter');
  return {
    ...actual,
    filterProductsBasic: mockFilterProductsBasic,
  };
});

import { getAllowedPriceSegmentsForBudget, getProductsForStep } from '@/lib/product-selection';

function product(overrides: Partial<ProductWithBrand> & { id: number; name: string }): ProductWithBrand & { createdAt: Date } {
  return {
    id: overrides.id,
    name: overrides.name,
    brand: overrides.brand ?? { id: 1, name: 'Brand', isActive: true },
    step: overrides.step ?? 'serum',
    category: overrides.category ?? 'serum',
    price: overrides.price ?? null,
    priceSegment: overrides.priceSegment ?? null,
    imageUrl: overrides.imageUrl ?? null,
    isHero: overrides.isHero ?? false,
    priority: overrides.priority ?? 0,
    skinTypes: overrides.skinTypes ?? [],
    published: overrides.published ?? true,
    activeIngredients: overrides.activeIngredients ?? [],
    concerns: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as ProductWithBrand & { createdAt: Date };
}

const profile: ProfileClassification = {
  skinType: 'normal',
  concerns: [],
  diagnoses: [],
  sensitivityLevel: 'low',
  budget: 'бюджетный',
};

describe('getProductsForStep: budget corridor for recommendation generation', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFilterProductsBasic.mockReset();
    mockFilterProductsBasic.mockImplementation(async (products: ProductWithBrand[]) => products);
  });

  it('treats user budget as the exact selected corridor', () => {
    expect(getAllowedPriceSegmentsForBudget(undefined, 'mass')).toEqual(['mass']);
    expect(getAllowedPriceSegmentsForBudget(undefined, 'mid')).toEqual(['mid']);
    expect(getAllowedPriceSegmentsForBudget(undefined, 'premium')).toEqual(['premium']);
    expect(getAllowedPriceSegmentsForBudget('премиум', 'mass')).toEqual(['mass']);
    expect(getAllowedPriceSegmentsForBudget('средний', undefined)).toEqual(['mid']);
    expect(getAllowedPriceSegmentsForBudget(undefined, 'any')).toBeNull();
  });

  it('keeps budget corridor in fallback query when strict category lookup is empty', async () => {
    const massProduct = product({ id: 1, name: 'Mass serum', priceSegment: 'mass', price: 1200 });
    const premiumProduct = product({ id: 2, name: 'Premium serum', priceSegment: 'premium', price: 7000 });

    mockFindMany.mockImplementation(async (args: any) => {
      const callIndex = mockFindMany.mock.calls.length;
      const whereJson = JSON.stringify(args.where);
      if (callIndex === 1) return [];
      return whereJson.includes('"mass"') && !whereJson.includes('"premium"')
        ? [massProduct]
        : [premiumProduct];
    });

    const result = await getProductsForStep(
      { category: ['serum'], max_items: 2 },
      'mass',
      profile
    );

    expect(result.map(p => p.id)).toEqual([1]);
    expect(mockFindMany).toHaveBeenCalledTimes(2);

    const strictWhere = JSON.stringify(mockFindMany.mock.calls[0][0].where);
    const fallbackWhere = JSON.stringify(mockFindMany.mock.calls[1][0].where);

    expect(strictWhere).toContain('"mass"');
    expect(strictWhere).toContain('"lt":2000');
    expect(fallbackWhere).toContain('"mass"');
    expect(fallbackWhere).toContain('"lt":2000');
    expect(fallbackWhere).not.toContain('"premium"');
  });

  it('uses user mass corridor even if the matched rule step is marked premium', async () => {
    const massProduct = product({ id: 10, name: 'Mass treatment', priceSegment: 'mass', price: 900 });
    mockFindMany.mockResolvedValueOnce([massProduct]);

    const result = await getProductsForStep(
      { category: ['treatment'], budget: 'премиум', max_items: 1 },
      'mass',
      profile
    );

    expect(result.map(p => p.id)).toEqual([10]);
    const whereJson = JSON.stringify(mockFindMany.mock.calls[0][0].where);
    expect(whereJson).toContain('"mass"');
    expect(whereJson).not.toContain('"premium"');
  });

  it('uses exact medium corridor instead of cheaper mass products', async () => {
    const midProduct = product({ id: 20, name: 'Mid serum', priceSegment: 'mid', price: 3200 });
    mockFindMany.mockResolvedValueOnce([midProduct]);

    const result = await getProductsForStep(
      { category: ['serum'], max_items: 1 },
      'mid',
      { ...profile, budget: 'средний' }
    );

    expect(result.map(p => p.id)).toEqual([20]);
    const whereJson = JSON.stringify(mockFindMany.mock.calls[0][0].where);
    expect(whereJson).toContain('"mid"');
    expect(whereJson).toContain('"gte":2000');
    expect(whereJson).toContain('"lt":5000');
    expect(whereJson).not.toContain('"mass"');
    expect(whereJson).not.toContain('"premium"');
  });
});
