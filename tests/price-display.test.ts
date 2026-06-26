import { describe, expect, it } from 'vitest';
import { formatPriceFrom, priceFloor } from '@/lib/price-display';

describe('price display helpers', () => {
  it('priceFloor округляет вниз до сотни', () => {
    expect(priceFloor(1299)).toBe(1200);
    expect(priceFloor(1200)).toBe(1200);
    expect(priceFloor(99)).toBeNull();
    expect(priceFloor(null)).toBeNull();
  });

  it('formatPriceFrom показывает цену как «от X ₽»', () => {
    expect(formatPriceFrom(1299)?.replace(/\s/g, ' ')).toBe('от 1 200 ₽');
    expect(formatPriceFrom(null)).toBeNull();
  });
});
