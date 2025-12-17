// app/api/payments/create/route.ts
// Создание платежа через платежный провайдер

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

// Конфигурация продуктов
const PRODUCTS: Record<string, { amount: number; currency: string }> = {
  plan_access: {
    amount: 19900, // 199 рублей в копейках
    currency: 'RUB',
  },
  retake_topic: {
    amount: 9900, // 99 рублей в копейках
    currency: 'RUB',
  },
  subscription_month: {
    amount: 49900, // 499 рублей в копейках
    currency: 'RUB',
  },
};

function entitlementCodeForProduct(productCode: string): string {
  if (productCode === 'plan_access') return 'paid_access';
  if (productCode === 'retake_topic') return 'retake_topic_access';
  // По умолчанию — доступ к плану (обратная совместимость)
  return 'paid_access';
}

function formatAmountForProvider(amountMinor: number): string {
  // YooKassa ожидает строку с 2 знаками после запятой (в рублях)
  const value = Math.max(0, Math.round(amountMinor)) / 100;
  return value.toFixed(2);
}

function hasYooKassaConfig(): boolean {
  return Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/payments/create';
  let userId: string | undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    const body = await request.json();
    const { productCode, idempotencyKey } = body;

    if (!productCode) {
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 400, duration, userId);
      return ApiResponse.error('productCode is required', 400);
    }

    const product = PRODUCTS[productCode];
    if (!product) {
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 400, duration, userId);
      return ApiResponse.error(`Unknown productCode: ${productCode}`, 400);
    }

    // Генерируем idempotencyKey если не передан
    const finalIdempotencyKey = idempotencyKey || randomBytes(16).toString('hex');

    // Проверяем, не создан ли уже платеж с таким ключом
    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey: finalIdempotencyKey },
      select: { id: true, status: true, providerPaymentId: true },
    });

    if (existingPayment) {
      // Идемпотентность: возвращаем существующий платеж
      logger.info('Payment already exists with idempotencyKey', {
        userId,
        paymentId: existingPayment.id,
        idempotencyKey: finalIdempotencyKey,
      });

      const duration = Date.now() - startTime;
      logApiRequest(method, path, 200, duration, userId);

      // Если платеж уже успешен - возвращаем информацию о доступе
      if (existingPayment.status === 'succeeded') {
        const entitlementCode = entitlementCodeForProduct(productCode);
        const entitlement = await prisma.entitlement.findUnique({
          where: { userId_code: { userId, code: entitlementCode } },
          select: { active: true, validUntil: true },
        });

        return ApiResponse.success({
          paymentId: existingPayment.id,
          status: 'succeeded',
          hasAccess: entitlement?.active || false,
        });
      }

      return ApiResponse.success({
        paymentId: existingPayment.id,
        status: existingPayment.status,
        paymentUrl: null,
      });
    }

    // Создаем запись Payment со статусом pending
    const payment = await prisma.payment.create({
      data: {
        userId,
        productCode,
        amount: product.amount,
        currency: product.currency,
        provider: 'yookassa', // ЮKassa
        status: 'pending',
        idempotencyKey: finalIdempotencyKey,
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        productCode: true,
        status: true,
      },
    });

    logger.info('Payment created', {
      userId,
      paymentId: payment.id,
      productCode,
      amount: payment.amount,
      idempotencyKey: finalIdempotencyKey,
      provider: 'yookassa',
    });

    const isProduction = process.env.NODE_ENV === 'production';

    // В production создаём реальный платёж через YooKassa, если настроены креды.
    // Если не настроены — возвращаем 501 (как и раньше), чтобы пользователь не застревал в pending.
    let providerPaymentId: string | null = null;
    let paymentUrl: string | null = null;
    let providerPayload: any = null;

    if (isProduction) {
      if (!hasYooKassaConfig()) {
        const duration = Date.now() - startTime;
        logApiRequest(method, path, 501, duration, userId);
        return ApiResponse.error(
          'Payments are not configured in production (missing YOOKASSA_SHOP_ID/YOOKASSA_SECRET_KEY)',
          501
        );
      }

      const shopId = process.env.YOOKASSA_SHOP_ID!;
      const secretKey = process.env.YOOKASSA_SECRET_KEY!;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL_FALLBACK || '';
      const returnUrl = appUrl ? `${appUrl}/plan` : undefined;

      const authHeader = `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`;

      const yooBody: any = {
        amount: { value: formatAmountForProvider(product.amount), currency: product.currency },
        capture: true,
        description: `Оплата ${productCode}`,
        metadata: {
          paymentId: payment.id,
          userId,
          productCode,
        },
        confirmation: {
          type: 'redirect',
          ...(returnUrl ? { return_url: returnUrl } : {}),
        },
      };

      const yooResp = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Idempotence-Key': finalIdempotencyKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(yooBody),
      });

      const yooText = await yooResp.text();
      if (!yooResp.ok) {
        logger.error('YooKassa payment creation failed', {
          userId,
          paymentId: payment.id,
          status: yooResp.status,
          body: yooText?.slice?.(0, 2000),
        });

        // оставляем payment pending (можно будет ретраить) и возвращаем ошибку
        const duration = Date.now() - startTime;
        logApiRequest(method, path, 502, duration, userId);
        return ApiResponse.error('Payment provider error', 502);
      }

      providerPayload = yooText ? JSON.parse(yooText) : null;
      providerPaymentId = providerPayload?.id || null;
      paymentUrl = providerPayload?.confirmation?.confirmation_url || null;
    } else {
      // DEV: имитация YooKassa как раньше
      const crypto = await import('crypto');
      providerPaymentId = crypto.randomUUID();
      paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payments/test?payment_id=${providerPaymentId}`;
      providerPayload = {
        id: providerPaymentId,
        status: 'pending',
        amount: {
          value: formatAmountForProvider(product.amount),
          currency: product.currency,
        },
        confirmation: {
          type: 'redirect',
          confirmation_url: paymentUrl,
        },
        created_at: new Date().toISOString(),
        description: `Оплата ${productCode}`,
        metadata: {
          paymentId: payment.id,
          userId,
          productCode,
        },
      };
    }

    // Обновляем платеж данными провайдера (или тестовой имитации)
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: providerPaymentId || null,
        providerPayload: providerPayload || null,
      },
      select: { id: true },
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return ApiResponse.success({
      paymentId: payment.id,
      paymentUrl: paymentUrl || null,
      status: 'pending',
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}

