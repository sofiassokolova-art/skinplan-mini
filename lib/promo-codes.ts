import type { PrismaClient } from '@prisma/client';

const PENDING_PROMO_RESERVATION_MS = 30 * 60 * 1000;

export type PromoDiscountType = 'percent' | 'fixed' | 'override_price';

export type AppliedPromoCode = {
  id: string;
  code: string;
  originalAmount: number;
  amount: number;
  discountAmount: number;
  discountType: PromoDiscountType;
  discountValue: number;
};

export type PromoValidationResult =
  | { ok: true; promo: AppliedPromoCode }
  | { ok: false; status: number; error: string };

type PromoCodeRecord = {
  id: string;
  code: string;
  active: boolean;
  discountType: string;
  discountValue: number;
  appliesToProductCodes: string[];
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  startsAt: Date | null;
  expiresAt: Date | null;
};

export function normalizePromoCode(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/\s+/g, '').toUpperCase().slice(0, 64);
}

export function calculateDiscountedAmount(amount: number, promo: Pick<PromoCodeRecord, 'discountType' | 'discountValue'>): number {
  if (!Number.isInteger(amount) || amount < 0) return amount;

  if (promo.discountType === 'percent') {
    return Math.max(0, amount - Math.round((amount * promo.discountValue) / 100));
  }

  if (promo.discountType === 'fixed') {
    return Math.max(0, amount - promo.discountValue);
  }

  if (promo.discountType === 'override_price') {
    return Math.max(0, promo.discountValue);
  }

  return amount;
}

function isKnownDiscountType(value: string): value is PromoDiscountType {
  return value === 'percent' || value === 'fixed' || value === 'override_price';
}

function validatePromoShape(promo: PromoCodeRecord): string | null {
  if (!isKnownDiscountType(promo.discountType)) {
    return 'Промокод настроен некорректно';
  }

  if (!Number.isInteger(promo.discountValue) || promo.discountValue < 0) {
    return 'Промокод настроен некорректно';
  }

  if (promo.discountType === 'percent' && promo.discountValue > 100) {
    return 'Промокод настроен некорректно';
  }

  return null;
}

export async function validatePromoCodeForPayment(
  prisma: PrismaClient,
  params: {
    userId: string;
    productCode: string;
    amount: number;
    code: unknown;
    now?: Date;
  },
): Promise<PromoValidationResult> {
  const normalizedCode = normalizePromoCode(params.code);
  if (!normalizedCode) {
    return { ok: false, status: 400, error: 'Введите промокод' };
  }

  const now = params.now ?? new Date();
  const promo = await prisma.promoCode.findUnique({
    where: { code: normalizedCode },
    select: {
      id: true,
      code: true,
      active: true,
      discountType: true,
      discountValue: true,
      appliesToProductCodes: true,
      maxRedemptions: true,
      maxRedemptionsPerUser: true,
      startsAt: true,
      expiresAt: true,
    },
  });

  if (!promo || !promo.active) {
    return { ok: false, status: 404, error: 'Промокод не найден или уже не действует' };
  }

  const shapeError = validatePromoShape(promo);
  if (shapeError) {
    return { ok: false, status: 500, error: shapeError };
  }
  const discountType = promo.discountType as PromoDiscountType;

  if (promo.startsAt && promo.startsAt > now) {
    return { ok: false, status: 400, error: 'Промокод пока не действует' };
  }

  if (promo.expiresAt && promo.expiresAt <= now) {
    return { ok: false, status: 400, error: 'Срок действия промокода истёк' };
  }

  if (
    promo.appliesToProductCodes.length > 0 &&
    !promo.appliesToProductCodes.includes(params.productCode)
  ) {
    return { ok: false, status: 400, error: 'Промокод не подходит для этого продукта' };
  }

  const pendingSince = new Date(now.getTime() - PENDING_PROMO_RESERVATION_MS);
  const [totalRedemptions, totalPending, userRedemptions, userPending] = await Promise.all([
    prisma.promoRedemption.count({ where: { promoCodeId: promo.id } }),
    prisma.payment.count({
      where: {
        promoCodeId: promo.id,
        status: 'pending',
        createdAt: { gte: pendingSince },
      },
    }),
    prisma.promoRedemption.count({ where: { promoCodeId: promo.id, userId: params.userId } }),
    prisma.payment.count({
      where: {
        promoCodeId: promo.id,
        userId: params.userId,
        status: 'pending',
        createdAt: { gte: pendingSince },
      },
    }),
  ]);

  if (promo.maxRedemptions != null && totalRedemptions + totalPending >= promo.maxRedemptions) {
    return { ok: false, status: 400, error: 'Лимит промокода уже исчерпан' };
  }

  if (userRedemptions + userPending >= promo.maxRedemptionsPerUser) {
    return { ok: false, status: 400, error: 'Вы уже использовали этот промокод' };
  }

  const discountedAmount = calculateDiscountedAmount(params.amount, {
    discountType,
    discountValue: promo.discountValue,
  });
  const discountAmount = Math.max(0, params.amount - discountedAmount);

  if (discountAmount <= 0) {
    return { ok: false, status: 400, error: 'Промокод не меняет стоимость этого продукта' };
  }

  return {
    ok: true,
    promo: {
      id: promo.id,
      code: promo.code,
      originalAmount: params.amount,
      amount: discountedAmount,
      discountAmount,
      discountType,
      discountValue: promo.discountValue,
    },
  };
}
