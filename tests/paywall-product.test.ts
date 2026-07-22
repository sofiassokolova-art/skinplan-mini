import { describe, expect, it } from 'vitest';
import { resolvePlanPaywall, resolvePlanRetakeHref } from '@/lib/paywall-product';

describe('plan paywall product selection', () => {
  it('uses first-purchase product for users without paid_access history', () => {
    expect(resolvePlanPaywall({ hasPaidBefore: false, winbackOffer: false })).toEqual({
      productCode: 'plan_access',
      price: 199,
    });
  });

  it('uses renewal product when paid_access existed even if plan is not age-expired', () => {
    expect(resolvePlanPaywall({ expired: false, hasPaidBefore: true, winbackOffer: false })).toEqual({
      productCode: 'subscription_month',
      price: 499,
    });
  });

  it('honors win-back only for users with paid_access history', () => {
    expect(resolvePlanPaywall({ hasPaidBefore: true, winbackOffer: true })).toEqual({
      productCode: 'plan_renewal_discount',
      price: 99,
      originalPrice: 499,
    });
    expect(resolvePlanPaywall({ hasPaidBefore: false, winbackOffer: true })).toEqual({
      productCode: 'plan_access',
      price: 199,
    });
  });

  it('routes expired users to a free full questionnaire before renewal', () => {
    expect(resolvePlanRetakeHref(false)).toBe('/quiz?restart=1');
    expect(resolvePlanRetakeHref(true, false)).toBe('/quiz?restart=1');
    expect(resolvePlanRetakeHref(true, true)).toBe('/quiz?retakeFromHome=1');
  });
});
