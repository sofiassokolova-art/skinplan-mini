// tests/isotretinoin-product-filter.test.ts
// P0.1: новый слой защиты на уровне product-фильтра.
// canApplyStep уже блокирует step-categories для пациента на изотретиноине
// (см. medical-contraindications.test.ts). Этот тест прикрывает второй контур —
// продуктовый фильтр: если профиль помечен onIsotretinoin, ни один продукт
// с ретинолом / AHA / BHA / витамином C / BPO / азелаиновой кислотой не должен пройти.

import { describe, it, expect } from 'vitest';
import { filterProducts, filterProductsWithReasons } from '@/lib/unified-product-filter';
import { determineProtocol, DERMATOLOGY_PROTOCOLS } from '@/lib/dermatology-protocols';
import type { ProductWithBrand } from '@/lib/product-fallback';
import type { ProfileClassification } from '@/lib/plan-generation-helpers';

function product(overrides: Partial<ProductWithBrand> & { id: number; name: string }): ProductWithBrand {
  return {
    id: overrides.id,
    name: overrides.name,
    brand: { id: 1, name: 'Brand', isActive: true },
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

const baseProfile: ProfileClassification = {
  skinType: 'normal',
  concerns: [],
  diagnoses: [],
  pregnant: false,
  sensitivityLevel: 'medium',
};

describe('P0.1: пациент на изотретиноине — продуктовый фильтр', () => {
  it('determineProtocol возвращает on_isotretinoin при onIsotretinoin=true (приоритет выше других)', () => {
    const protocol = determineProtocol({
      diagnoses: ['Розацеа'],
      concerns: ['Акне'],
      onIsotretinoin: true,
    });
    expect(protocol.condition).toBe('on_isotretinoin');
  });

  it('determineProtocol распознаёт изотретиноин из currentOralMeds (даже если onIsotretinoin не передан)', () => {
    const protocol = determineProtocol({
      diagnoses: [],
      concerns: [],
      currentOralMeds: ['isotretinoin'],
    });
    expect(protocol.condition).toBe('on_isotretinoin');
  });

  it('on_isotretinoin протокол явно запрещает ретинол / AHA / BHA / витамин C / BPO / азелаиновую кислоту', () => {
    const p = DERMATOLOGY_PROTOCOLS.on_isotretinoin;
    for (const forbidden of ['retinol', 'retinoid', 'tretinoin', 'adapalene', 'aha', 'bha', 'vitamin_c', 'ascorbic_acid', 'benzoyl_peroxide', 'azelaic_acid']) {
      expect(p.forbiddenIngredients).toContain(forbidden);
    }
  });

  it('filterProducts отбрасывает продукты с ретинолом, кислотами, витамином C, BPO при onIsotretinoin', async () => {
    const products = [
      product({ id: 1, name: 'Retinol Serum', activeIngredients: ['retinol'] }),
      product({ id: 2, name: 'AHA Toner', activeIngredients: ['glycolic acid'] }),
      product({ id: 3, name: 'BHA Cleanser', activeIngredients: ['salicylic acid'] }),
      product({ id: 4, name: 'Vitamin C Serum', activeIngredients: ['ascorbic acid'] }),
      product({ id: 5, name: 'BPO Spot', activeIngredients: ['benzoyl peroxide'] }),
      product({ id: 6, name: 'Azelaic Cream', activeIngredients: ['azelaic acid'] }),
      product({ id: 7, name: 'Gentle Cleanser', activeIngredients: ['glycerin'] }),
      product({ id: 8, name: 'Ceramide Moisturizer', activeIngredients: ['ceramides', 'hyaluronic acid'] }),
    ];

    const results = await filterProducts(products, {
      profileClassification: { ...baseProfile, onIsotretinoin: true },
      strictness: 'soft',
    });

    const ids = results.map(r => r.product.id);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(4);
    expect(ids).not.toContain(5);
    expect(ids).not.toContain(6);
    expect(ids).toContain(7);
    expect(ids).toContain(8);
  });

  it('filterProducts при onIsotretinoin=false НЕ блокирует ретинол (sanity-check, чтобы не зарезать обычный кейс)', async () => {
    const products = [product({ id: 1, name: 'Retinol Serum', activeIngredients: ['retinol'] })];
    const results = await filterProducts(products, {
      profileClassification: { ...baseProfile, onIsotretinoin: false },
      strictness: 'soft',
    });
    expect(results.map(r => r.product.id)).toContain(1);
  });

  it('filterProductsWithReasons возвращает explicit reason для заблокированных продуктов', async () => {
    const products = [
      product({ id: 1, name: 'Retinol Serum', activeIngredients: ['retinol'] }),
      product({ id: 2, name: 'Ceramide Cream', activeIngredients: ['ceramides'] }),
    ];
    // soft strictness — продукты остаются в результатах, но с allowed:false и reason
    const results = await filterProductsWithReasons(products, {
      profileClassification: { ...baseProfile, onIsotretinoin: true },
      strictness: 'soft',
    });
    const retinol = results.find(r => r.product.id === 1);
    expect(retinol?.allowed).toBe(false);
    expect(retinol?.reason).toMatch(/изотретинои/i);
  });

  it('блок работает и по step/category (на случай если activeIngredients не заполнен)', async () => {
    const products = [
      product({ id: 1, name: 'No-actives serum', activeIngredients: [], step: 'serum_vitc', category: 'serum_vitc' }),
      product({ id: 2, name: 'Gentle moisturizer', activeIngredients: [], step: 'moisturizer_barrier', category: 'moisturizer_barrier' }),
    ];
    const results = await filterProducts(products, {
      profileClassification: { ...baseProfile, onIsotretinoin: true },
      strictness: 'soft',
    });
    const ids = results.map(r => r.product.id);
    expect(ids).not.toContain(1);
    expect(ids).toContain(2);
  });
});
