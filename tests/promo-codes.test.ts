import { describe, expect, it } from 'vitest';
import { calculateDiscountedAmount, normalizePromoCode } from '@/lib/promo-codes';

describe('promo codes', () => {
  it('normalizes user-entered codes', () => {
    expect(normalizePromoCode(' skin  50 ')).toBe('SKIN50');
    expect(normalizePromoCode('welcome-2026')).toBe('WELCOME-2026');
    expect(normalizePromoCode(null)).toBe('');
  });

  it('applies percent discounts in kopecks', () => {
    expect(calculateDiscountedAmount(19900, { discountType: 'percent', discountValue: 50 })).toBe(9950);
    expect(calculateDiscountedAmount(9900, { discountType: 'percent', discountValue: 100 })).toBe(0);
  });

  it('applies fixed discounts without going below zero', () => {
    expect(calculateDiscountedAmount(19900, { discountType: 'fixed', discountValue: 5000 })).toBe(14900);
    expect(calculateDiscountedAmount(4900, { discountType: 'fixed', discountValue: 10000 })).toBe(0);
  });

  it('supports override final prices', () => {
    expect(calculateDiscountedAmount(49900, { discountType: 'override_price', discountValue: 9900 })).toBe(9900);
    expect(calculateDiscountedAmount(19900, { discountType: 'override_price', discountValue: 0 })).toBe(0);
  });
});

