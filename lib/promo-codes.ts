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

export const PROMO_DISCOUNT_TYPES: PromoDiscountType[] = ['percent', 'fixed', 'override_price'];

export function normalizePromoCode(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/\s+/g, '').toUpperCase().slice(0, 64);
}

/** Нормализованный ввод промокода для админ-CRUD (create/update). */
export type PromoCodeInput = {
  code: string;
  description: string | null;
  active: boolean;
  discountType: PromoDiscountType;
  discountValue: number;
  appliesToProductCodes: string[];
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  startsAt: Date | null;
  expiresAt: Date | null;
};

export type PromoCodeInputResult =
  | { ok: true; data: PromoCodeInput }
  | { ok: false; error: string };

type Parsed<T> = { ok: true; value: T } | { ok: false };

function toOptionalInt(value: unknown): Parsed<number | null> {
  if (value == null || value === '') return { ok: true, value: null };
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed)) return { ok: false };
  return { ok: true, value: parsed };
}

function toOptionalDate(value: unknown): Parsed<Date | null> {
  if (value == null || value === '') return { ok: true, value: null };
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? { ok: false } : { ok: true, value };
  }
  if (typeof value !== 'string' && typeof value !== 'number') return { ok: false };
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? { ok: false } : { ok: true, value: parsed };
}

/**
 * Проверяет и нормализует «сырой» ввод промокода из админки.
 * knownProductCodes — множество допустимых productCode (пустой список = «для всех продуктов»).
 */
export function parsePromoCodeInput(
  raw: unknown,
  knownProductCodes: Iterable<string>,
): PromoCodeInputResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Некорректные данные' };
  }
  const body = raw as Record<string, unknown>;

  const code = normalizePromoCode(body.code);
  if (!code) {
    return { ok: false, error: 'Укажите код промокода' };
  }

  const discountType = body.discountType;
  if (
    discountType !== 'percent' &&
    discountType !== 'fixed' &&
    discountType !== 'override_price'
  ) {
    return { ok: false, error: 'Тип скидки должен быть percent, fixed или override_price' };
  }

  const discountValueParsed = toOptionalInt(body.discountValue);
  if (!discountValueParsed.ok || discountValueParsed.value == null || discountValueParsed.value < 0) {
    return { ok: false, error: 'Значение скидки должно быть целым неотрицательным числом' };
  }
  const discountValue = discountValueParsed.value;
  if (discountType === 'percent' && (discountValue < 1 || discountValue > 100)) {
    return { ok: false, error: 'Для процентной скидки значение должно быть от 1 до 100' };
  }
  if ((discountType === 'fixed' || discountType === 'override_price') && discountValue > 100_000_000) {
    return { ok: false, error: 'Слишком большое значение скидки' };
  }

  const known = knownProductCodes instanceof Set ? knownProductCodes : new Set(knownProductCodes);
  const rawProducts = Array.isArray(body.appliesToProductCodes) ? body.appliesToProductCodes : [];
  const appliesToProductCodes: string[] = [];
  for (const item of rawProducts) {
    if (typeof item !== 'string' || !item.trim()) continue;
    const value = item.trim();
    if (!known.has(value)) {
      return { ok: false, error: `Неизвестный продукт: ${value}` };
    }
    if (!appliesToProductCodes.includes(value)) appliesToProductCodes.push(value);
  }

  const maxRedemptionsParsed = toOptionalInt(body.maxRedemptions);
  if (!maxRedemptionsParsed.ok || (maxRedemptionsParsed.value != null && maxRedemptionsParsed.value < 1)) {
    return { ok: false, error: 'Лимит использований должен быть положительным числом или пустым' };
  }
  const maxRedemptions = maxRedemptionsParsed.value;

  const perUserParsed = toOptionalInt(body.maxRedemptionsPerUser);
  const maxRedemptionsPerUser = perUserParsed.ok && perUserParsed.value != null ? perUserParsed.value : 1;
  if (!perUserParsed.ok || maxRedemptionsPerUser < 1) {
    return { ok: false, error: 'Лимит на пользователя должен быть положительным числом' };
  }

  const startsAtParsed = toOptionalDate(body.startsAt);
  if (!startsAtParsed.ok) {
    return { ok: false, error: 'Некорректная дата начала' };
  }
  const startsAt = startsAtParsed.value;
  const expiresAtParsed = toOptionalDate(body.expiresAt);
  if (!expiresAtParsed.ok) {
    return { ok: false, error: 'Некорректная дата окончания' };
  }
  const expiresAt = expiresAtParsed.value;
  if (startsAt && expiresAt && startsAt.getTime() >= expiresAt.getTime()) {
    return { ok: false, error: 'Дата окончания должна быть позже даты начала' };
  }

  const active = body.active == null ? true : body.active !== false;
  const description =
    typeof body.description === 'string' && body.description.trim()
      ? body.description.trim().slice(0, 500)
      : null;

  return {
    ok: true,
    data: {
      code,
      description,
      active,
      discountType,
      discountValue,
      appliesToProductCodes,
      maxRedemptions,
      maxRedemptionsPerUser,
      startsAt,
      expiresAt,
    },
  };
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
