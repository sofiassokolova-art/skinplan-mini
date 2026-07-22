import type { Prisma } from '@prisma/client';
import { invalidateAllUserCache } from '@/lib/cache';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  calculateValidUntil,
  entitlementCodeForProduct,
  isRenewalProduct,
  WINBACK_OFFER_TAG,
} from '@/lib/payment-helpers';

type PaymentForFinalization = {
  id: string;
  userId: string;
  productCode: string;
  promoCodeId?: string | null;
};

export async function grantEntitlementForPayment(
  tx: Prisma.TransactionClient,
  payment: PaymentForFinalization,
): Promise<{ entitlementCode: string; validUntil: Date; renewalProcessed: boolean }> {
  const entitlementCode = entitlementCodeForProduct(payment.productCode);
  const validUntil = calculateValidUntil(payment.productCode);

  await tx.entitlement.upsert({
    where: {
      userId_code: {
        userId: payment.userId,
        code: entitlementCode,
      },
    },
    update: {
      active: true,
      validUntil,
      lastPaymentId: payment.id,
      updatedAt: new Date(),
    },
    create: {
      userId: payment.userId,
      code: entitlementCode,
      active: true,
      validUntil,
      lastPaymentId: payment.id,
    },
  });

  if (payment.promoCodeId) {
    await tx.promoRedemption.upsert({
      where: { paymentId: payment.id },
      update: {},
      create: {
        promoCodeId: payment.promoCodeId,
        userId: payment.userId,
        paymentId: payment.id,
      },
    });
  }

  let renewalProcessed = false;
  if (isRenewalProduct(payment.productCode)) {
    const latestPlan = await tx.plan28.findFirst({
      where: { userId: payment.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (latestPlan) {
      await tx.plan28.update({
        where: { id: latestPlan.id },
        data: { createdAt: new Date() },
      });
    }

    const userTags = await tx.user.findUnique({
      where: { id: payment.userId },
      select: { tags: true },
    });

    if (userTags?.tags?.includes(WINBACK_OFFER_TAG)) {
      await tx.user.update({
        where: { id: payment.userId },
        data: { tags: { set: userTags.tags.filter((tag) => tag !== WINBACK_OFFER_TAG) } },
      });
    }

    renewalProcessed = true;
  }

  return { entitlementCode, validUntil, renewalProcessed };
}

export async function applyPaymentStatusTransition(
  tx: Prisma.TransactionClient,
  params: {
    payment: PaymentForFinalization;
    newStatus: string;
    providerPayload: Prisma.InputJsonValue;
  },
): Promise<boolean> {
  const updated = await tx.payment.updateMany({
    where: { id: params.payment.id, status: { not: 'succeeded' } },
    data: {
      status: params.newStatus,
      providerPayload: params.providerPayload,
      updatedAt: new Date(),
    },
  });

  if (updated.count === 0) {
    return false;
  }

  if (params.newStatus === 'succeeded') {
    const grant = await grantEntitlementForPayment(tx, params.payment);
    logger.info('Entitlement created/updated', {
      userId: params.payment.userId,
      paymentId: params.payment.id,
      validUntil: grant.validUntil.toISOString(),
      promoCodeId: params.payment.promoCodeId ?? null,
    });

    if (grant.renewalProcessed) {
      logger.info('Renewal processed: plan counter reset, win-back tag cleared', {
        userId: params.payment.userId,
        paymentId: params.payment.id,
        productCode: params.payment.productCode,
      });
    }
  }

  return true;
}

export async function afterSuccessfulPayment(payment: PaymentForFinalization): Promise<void> {
  if (isRenewalProduct(payment.productCode)) {
    await invalidateAllUserCache(payment.userId).catch((error) => {
      logger.warn('Failed to invalidate plan cache after renewal (non-critical)', {
        userId: payment.userId,
        error,
      });
    });
  }

  await ensurePlanExists(payment.userId);
}

export async function ensurePlanExists(userId: string): Promise<void> {
  try {
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });
    if (!profile) {
      logger.warn('ensurePlanExists: user paid but has no skin profile', { userId });
      return;
    }

    const existing = await prisma.plan28.findUnique({
      where: { userId_profileVersion: { userId, profileVersion: profile.version } },
      select: { id: true },
    });
    if (existing) return;

    logger.error('ensurePlanExists: PAID USER WITHOUT PLAN — self-healing generation', {
      userId,
      profileVersion: profile.version,
    });

    const { generate28DayPlan } = await import('@/lib/plan-generator');
    const generated = await generate28DayPlan(userId);
    const plan = generated?.plan28;
    if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) {
      logger.error('ensurePlanExists: generation returned empty plan', { userId });
      return;
    }

    await prisma.plan28.upsert({
      where: { userId_profileVersion: { userId, profileVersion: profile.version } },
      update: { planData: plan as unknown as object, updatedAt: new Date() },
      create: {
        userId,
        skinProfileId: profile.id,
        profileVersion: profile.version,
        planData: plan as unknown as object,
      },
    });
    logger.info('ensurePlanExists: plan generated and saved after payment', {
      userId,
      profileVersion: profile.version,
      days: plan.days.length,
    });
  } catch (error) {
    logger.error('ensurePlanExists: self-healing failed (payment still processed)', error as Error, {
      userId,
    });
  }
}

