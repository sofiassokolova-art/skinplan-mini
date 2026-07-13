// tests/contraindication-product-filter.test.ts
// Контра-фильтр ПРОДУКТОВ (кейс Галимат): гейты step-category-rules блокируют шаги,
// но продукт с запрещённым активом в нейтральном слоте (cleanser/spf) проходил мимо.
// Здесь проверяем, что productViolatesContraindications ловит такие продукты
// по active_ingredients и не даёт ложных срабатываний.

import { describe, it, expect } from 'vitest';
import {
  productViolatesContraindications,
  filterProductsByContraindications,
} from '@/lib/contraindication-product-filter';

const product = (activeIngredients: string[] | null | undefined) => ({ activeIngredients });

describe('productViolatesContraindications', () => {
  it('без противопоказаний ничего не блокирует', () => {
    expect(productViolatesContraindications(product(['salicylic acid']), [])).toBe(false);
    expect(productViolatesContraindications(product(['salicylic acid']), null)).toBe(false);
    expect(productViolatesContraindications(product(['salicylic acid']), undefined)).toBe(false);
  });

  it('продукт без размеченных активов не блокируется (нет данных — нет матча)', () => {
    expect(productViolatesContraindications(product([]), ['no_strong_acids'])).toBe(false);
    expect(productViolatesContraindications(product(null), ['no_strong_acids'])).toBe(false);
    expect(productViolatesContraindications(product(undefined), ['no_strong_acids'])).toBe(false);
  });

  it('неизвестный контра-флаг игнорируется', () => {
    expect(productViolatesContraindications(product(['salicylic acid']), ['no_unicorns'])).toBe(false);
  });

  describe('no_strong_acids', () => {
    it.each([
      ['salicylic acid'],
      ['Salicylic Acid 2%'],
      ['glycolic acid'],
      ['lactic acid'],
      ['mandelic acid'],
      ['AHA'],
      ['BHA'],
      ['aha 10'],
      ['bha2'], // числовой суффикс без разделителя
      ['PHA'],
      ['LHA'],
      ['polyhydroxy acid'],
    ])('блокирует продукт с активом «%s»', (ingredient) => {
      expect(productViolatesContraindications(product([ingredient]), ['no_strong_acids'])).toBe(true);
    });

    it.each([
      ['azelaic acid'], // азелаиновая — не AHA/BHA, разрешена дерм-протоколами
      ['hyaluronic acid'], // не эксфолиант
      ['tranexamic acid'],
      ['niacinamide'],
      ['ceramides'],
      ['panthenol'],
      ['alpha arbutin'], // 'alpha' не должен матчиться на 'aha'/'pha'
      ['shea butter'],
    ])('НЕ блокирует безопасный актив «%s»', (ingredient) => {
      expect(productViolatesContraindications(product([ingredient]), ['no_strong_acids'])).toBe(false);
    });

    it('регрессия Галимат: SPF с салицилкой в нейтральном слоте блокируется', () => {
      // Eucerin Oil Control SPF50+ содержит салициловую кислоту —
      // раньше проходил в план пользователю «без кислот» через слот SPF.
      expect(
        productViolatesContraindications(
          product(['salicylic acid', 'licochalcone a']),
          ['no_strong_acids']
        )
      ).toBe(true);
    });
  });

  describe('no_retinol', () => {
    it.each([['retinol'], ['retinal'], ['retinoid'], ['retinyl palmitate'], ['tretinoin'], ['adapalene']])(
      'блокирует «%s»',
      (ingredient) => {
        expect(productViolatesContraindications(product([ingredient]), ['no_retinol'])).toBe(true);
      }
    );

    it('не блокирует бакучиол (растительная альтернатива, не ретиноид)', () => {
      expect(productViolatesContraindications(product(['bakuchiol']), ['no_retinol'])).toBe(false);
    });
  });

  describe('no_vitc (составной токен vitamin_c)', () => {
    it.each([['vitamin c'], ['Vitamin C 10%'], ['vitamin_c10'], ['ascorbic acid'], ['ascorbyl glucoside']])(
      'блокирует «%s»',
      (ingredient) => {
        expect(productViolatesContraindications(product([ingredient]), ['no_vitc'])).toBe(true);
      }
    );

    it('НЕ матчит vitamin complex / vitamin e по префиксу vitamin_c', () => {
      expect(productViolatesContraindications(product(['vitamin complex']), ['no_vitc'])).toBe(false);
      expect(productViolatesContraindications(product(['vitamin e']), ['no_vitc'])).toBe(false);
    });
  });

  it('no_niacinamide и no_hyaluronic работают', () => {
    expect(productViolatesContraindications(product(['niacinamide']), ['no_niacinamide'])).toBe(true);
    expect(productViolatesContraindications(product(['hyaluronic acid']), ['no_hyaluronic'])).toBe(true);
  });

  it('несколько противопоказаний: достаточно нарушить одно', () => {
    expect(
      productViolatesContraindications(product(['retinol']), ['no_strong_acids', 'no_retinol'])
    ).toBe(true);
    expect(
      productViolatesContraindications(product(['ceramides']), ['no_strong_acids', 'no_retinol'])
    ).toBe(false);
  });

  it('нормализация: дефисы, пробелы и регистр не мешают матчу', () => {
    expect(productViolatesContraindications(product(['  Glycolic-Acid  ']), ['no_strong_acids'])).toBe(true);
  });
});

describe('filterProductsByContraindications', () => {
  const products = [
    { id: 1, activeIngredients: ['salicylic acid'] },
    { id: 2, activeIngredients: ['niacinamide'] },
    { id: 3, activeIngredients: [] as string[] },
    { id: 4, activeIngredients: ['retinol'] },
  ];

  it('без противопоказаний возвращает список как есть', () => {
    expect(filterProductsByContraindications(products, [])).toEqual(products);
    expect(filterProductsByContraindications(products, null)).toEqual(products);
  });

  it('отсеивает только нарушающие продукты', () => {
    const filtered = filterProductsByContraindications(products, ['no_strong_acids', 'no_retinol']);
    expect(filtered.map((p) => p.id)).toEqual([2, 3]);
  });
});
