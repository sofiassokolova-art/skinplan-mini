import { describe, expect, it } from 'vitest';
import {
  calculateDiscountedAmount,
  normalizePromoCode,
  parsePromoCodeInput,
} from '@/lib/promo-codes';

const PRODUCTS = ['plan_access', 'subscription_month'];

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

describe('parsePromoCodeInput', () => {
  it('accepts a valid percent promo and normalizes the code', () => {
    const result = parsePromoCodeInput(
      { code: ' skin 50 ', discountType: 'percent', discountValue: '50', appliesToProductCodes: ['plan_access'] },
      PRODUCTS,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.code).toBe('SKIN50');
      expect(result.data.discountValue).toBe(50);
      expect(result.data.appliesToProductCodes).toEqual(['plan_access']);
      expect(result.data.maxRedemptionsPerUser).toBe(1);
    }
  });

  it('rejects a percent value out of range', () => {
    const result = parsePromoCodeInput({ code: 'X', discountType: 'percent', discountValue: 150 }, PRODUCTS);
    expect(result.ok).toBe(false);
  });

  it('rejects unknown products', () => {
    const result = parsePromoCodeInput(
      { code: 'X', discountType: 'fixed', discountValue: 100, appliesToProductCodes: ['nope'] },
      PRODUCTS,
    );
    expect(result).toEqual({ ok: false, error: 'Неизвестный продукт: nope' });
  });

  it('rejects an end date before the start date', () => {
    const result = parsePromoCodeInput(
      {
        code: 'X',
        discountType: 'override_price',
        discountValue: 0,
        startsAt: '2026-09-01T00:00',
        expiresAt: '2026-08-01T00:00',
      },
      PRODUCTS,
    );
    expect(result.ok).toBe(false);
  });

  it('missing code fails', () => {
    const result = parsePromoCodeInput({ discountType: 'percent', discountValue: 10 }, PRODUCTS);
    expect(result).toEqual({ ok: false, error: 'Укажите код промокода' });
  });
});

