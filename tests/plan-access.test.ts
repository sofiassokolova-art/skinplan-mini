// @vitest-environment node
// tests/plan-access.test.ts
// Юниты на lib/plan-access — источник истины для «платил ли когда-либо» (цена 199 vs 499)
// и «есть ли доступ прямо сейчас». Здесь же ловится баг рассинхрона: hasPaidBefore
// НЕ зависит от validUntil (истёкший paid_access всё равно даёт продление за 499).

import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    entitlement: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

import { isPaidAccessActive, attachPlanAccessState, getPlanAccessState } from '@/lib/plan-access';

const NOW = new Date('2026-07-22T12:00:00.000Z');
const PAST = new Date('2026-06-01T00:00:00.000Z');
const FUTURE = new Date('2026-09-01T00:00:00.000Z');

describe('isPaidAccessActive', () => {
  it('active + no validUntil (бессрочный) → активен', () => {
    expect(isPaidAccessActive({ active: true, validUntil: null }, NOW)).toBe(true);
  });

  it('active + validUntil в будущем → активен', () => {
    expect(isPaidAccessActive({ active: true, validUntil: FUTURE }, NOW)).toBe(true);
  });

  it('active + validUntil в прошлом → НЕ активен (доступ лапснул)', () => {
    expect(isPaidAccessActive({ active: true, validUntil: PAST }, NOW)).toBe(false);
  });

  it('inactive → не активен даже с будущим validUntil', () => {
    expect(isPaidAccessActive({ active: false, validUntil: FUTURE }, NOW)).toBe(false);
  });

  it('null/undefined → не активен', () => {
    expect(isPaidAccessActive(null, NOW)).toBe(false);
    expect(isPaidAccessActive(undefined, NOW)).toBe(false);
  });
});

describe('getPlanAccessState', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it('нет строки paid_access → первая покупка (hasPaidBefore=false)', async () => {
    findUnique.mockResolvedValue(null);
    const state = await getPlanAccessState('u1', NOW);
    expect(state).toEqual({
      hasPaidBefore: false,
      hasActivePaidAccess: false,
      paidAccessValidUntil: null,
    });
  });

  it('истёкший paid_access → hasPaidBefore=true, но доступа нет (баг-кейс 199→499)', async () => {
    findUnique.mockResolvedValue({ active: true, validUntil: PAST });
    const state = await getPlanAccessState('u1', NOW);
    expect(state.hasPaidBefore).toBe(true);
    expect(state.hasActivePaidAccess).toBe(false);
    expect(state.paidAccessValidUntil).toBe(PAST.toISOString());
  });

  it('активный paid_access → hasPaidBefore=true и доступ есть', async () => {
    findUnique.mockResolvedValue({ active: true, validUntil: FUTURE });
    const state = await getPlanAccessState('u1', NOW);
    expect(state.hasPaidBefore).toBe(true);
    expect(state.hasActivePaidAccess).toBe(true);
  });

  it('запрашивает строку по составному ключу userId_code = paid_access', async () => {
    findUnique.mockResolvedValue(null);
    await getPlanAccessState('user-42', NOW);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_code: { userId: 'user-42', code: 'paid_access' } },
      }),
    );
  });
});

describe('attachPlanAccessState', () => {
  it('домешивает поля доступа в payload, свежие значения перекрывают старые', () => {
    const payload = { plan28: null, hasPaidBefore: false as boolean };
    const merged = attachPlanAccessState(payload, {
      hasPaidBefore: true,
      hasActivePaidAccess: false,
      paidAccessValidUntil: null,
    });
    expect(merged.hasPaidBefore).toBe(true);
    expect(merged.hasActivePaidAccess).toBe(false);
    expect(merged.plan28).toBe(null);
  });
});
