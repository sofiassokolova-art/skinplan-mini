// tests/toner-fallback-slot-aware.test.ts
// Регрессия прод-бага (юзер cmrp6kr01000004jui674wjgk / Olga, oily 25-34):
// generic fallback по базовому шагу 'toner' псевдослучайно (simpleHash) выбрал
// Glycolic Acid 7% Toning Solution и зарегистрировал его в слот toner_soothing.
// Кислотный эксфолиант в «успокаивающем» слоте недопустим.
//
// Фикс: findFallbackProductForSlot — сначала точный step-подтип слота, затем
// базовый шаг, но только среди продуктов, совместимых с подтипом слота
// (isProductCompatibleWithSlot).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductWithBrand } from '@/lib/product-fallback';
import type { ProfileClassification } from '@/lib/plan-generation-helpers';

const mockFindMany = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({
  prisma: {
    product: {
      findMany: mockFindMany,
    },
  },
}));

import {
  findFallbackProductForSlot,
  isExfoliatingProduct,
  isProductCompatibleWithSlot,
} from '@/lib/product-fallback';

function product(overrides: Partial<ProductWithBrand> & { id: number; name: string }): ProductWithBrand {
  return {
    id: overrides.id,
    name: overrides.name,
    brand: overrides.brand ?? { id: 1, name: 'Brand', isActive: true },
    step: overrides.step ?? 'toner',
    category: overrides.category ?? 'toner',
    price: overrides.price ?? null,
    imageUrl: overrides.imageUrl ?? null,
    isHero: overrides.isHero ?? false,
    priority: overrides.priority ?? 0,
    skinTypes: overrides.skinTypes ?? [],
    published: overrides.published ?? true,
    activeIngredients: overrides.activeIngredients ?? [],
    ...overrides,
  } as ProductWithBrand;
}

// Кейс Olga: кислотный тонер стоит выше по приоритету, чем нейтральный
const glycolicToner = product({
  id: 641,
  name: 'Glycolic Acid 7% Toning Solution',
  step: 'toner',
  activeIngredients: ['glycolic acid'],
  isHero: true,
  priority: 100,
});
const centellaToner = product({
  id: 496,
  name: 'Centella Toner',
  step: 'toner',
  activeIngredients: ['centella asiatica'],
});
const soothingToner = product({
  id: 700,
  name: 'Soothing Cica Toner',
  step: 'toner_soothing',
  activeIngredients: ['madecassoside'],
});
const bhaToner = product({
  id: 800,
  name: 'BHA Blackhead Power Liquid',
  step: 'toner_bha',
  activeIngredients: ['bha'],
});

const profile: ProfileClassification = {
  skinType: 'oily',
  concerns: [],
  diagnoses: [],
  sensitivityLevel: 'medium',
} as ProfileClassification;

/** Мок каталога: подтип-запросы матчим по вхождению подтипа в where, иначе отдаём базовый список */
function mockCatalog(catalog: ProductWithBrand[]) {
  mockFindMany.mockImplementation(async (args: any) => {
    const whereJson = JSON.stringify(args.where);
    for (const subtype of ['toner_soothing', 'toner_hydrating', 'toner_bha', 'serum_vitc']) {
      if (whereJson.includes(subtype)) {
        return catalog.filter(
          (p) => (p.step || '').startsWith(subtype) || (p.category || '') === subtype
        );
      }
    }
    return catalog;
  });
}

describe('isExfoliatingProduct / isProductCompatibleWithSlot', () => {
  it('распознаёт кислотный продукт по активам (generic step=toner)', () => {
    expect(isExfoliatingProduct(glycolicToner)).toBe(true);
  });

  it('распознаёт кислотный продукт по step-подтипу (toner_acid/toner_bha)', () => {
    expect(isExfoliatingProduct(product({ id: 1, name: 'x', step: 'toner_acid' }))).toBe(true);
    expect(isExfoliatingProduct(bhaToner)).toBe(true);
    expect(isExfoliatingProduct(product({ id: 2, name: 'x', step: 'mask_peel', category: 'mask' }))).toBe(true);
  });

  it('не считает кислотными нейтральные тонеры', () => {
    expect(isExfoliatingProduct(centellaToner)).toBe(false);
    expect(isExfoliatingProduct(soothingToner)).toBe(false);
  });

  it('запрещает кислотные продукты только в soothing/hydrating слотах', () => {
    expect(isProductCompatibleWithSlot(glycolicToner, 'toner_soothing')).toBe(false);
    expect(isProductCompatibleWithSlot(glycolicToner, 'toner_hydrating')).toBe(false);
    expect(isProductCompatibleWithSlot(glycolicToner, 'toner_acid')).toBe(true);
    expect(isProductCompatibleWithSlot(centellaToner, 'toner_soothing')).toBe(true);
  });
});

describe('findFallbackProductForSlot: slot-aware подбор тонера', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it('кейс Olga: в toner_soothing не попадает кислотный тонер, даже если хэш выбрал бы его', async () => {
    mockCatalog([glycolicToner, centellaToner]);

    const result = await findFallbackProductForSlot('toner_soothing', profile, {
      userId: 'cmrp6kr01000004jui674wjgk',
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe(centellaToner.id);
  });

  it('предпочитает продукт с точным step-подтипом слота, если он есть', async () => {
    mockCatalog([glycolicToner, centellaToner, soothingToner]);

    const result = await findFallbackProductForSlot('toner_soothing', profile);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(soothingToner.id);
  });

  it('в кислотный слот (toner_bha) кислотный тонер попадает как обычно', async () => {
    mockCatalog([bhaToner, centellaToner]);

    const result = await findFallbackProductForSlot('toner_bha', profile);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(bhaToner.id);
  });

  it('если совместимых тонеров нет вообще — возвращает null, а не кислотный', async () => {
    mockCatalog([glycolicToner]);

    const result = await findFallbackProductForSlot('toner_hydrating', profile, {
      userId: 'cmrp6kr01000004jui674wjgk',
    });

    expect(result).toBeNull();
  });

  it('для serum-подтипов не откатывается к базовому serum (подтипы не взаимозаменяемы)', async () => {
    // В каталоге только generic-сыворотка — для serum_vitc она не подходит
    mockCatalog([product({ id: 900, name: 'Generic Serum', step: 'serum', category: 'serum' })]);

    const result = await findFallbackProductForSlot('serum_vitc', profile);

    expect(result).toBeNull();
  });
});
