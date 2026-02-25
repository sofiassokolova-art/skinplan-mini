// app/api/payments/create/route.ts
// Создание платежа через ЮKassa (реальная оплата) или тестовый flow в dev

import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

const YOOKASSA_API = 'https://api.yookassa.ru/v3/payments';

/** Названия товаров для чека (54-ФЗ) */
const PRODUCT_LABELS: Record<string, string> = {
  plan_access: 'Доступ к плану ухода',
  retake_topic: 'Перепрохождение темы',
  retake_full: 'Полное перепрохождение анкеты',
  subscription_month: 'Подписка на 1 месяц',
};

/** Формирует объект receipt для ЮKassa по 54-ФЗ. Нужен email или phone покупателя. */
function buildYooKassaReceipt(params: {
  amountKopecks: number;
  currency: string;
  productCode: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
}): Record<string, unknown> {
  const { amountKopecks, currency, productCode, customerEmail, customerPhone } = params;
  const customer: Record<string, string> = {};
  if (customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    customer.email = customerEmail;
  }
  if (customerPhone && customerPhone.trim()) {
    customer.phone = customerPhone.trim().replace(/^\+?7/, '7'); // нормализуем для РФ
  }
  if (!customer.email && !customer.phone) {
    const fallbackEmail = process.env.YOOKASSA_RECEIPT_EMAIL?.trim();
    if (fallbackEmail) customer.email = fallbackEmail;
    else customer.email = 'noreply@proskiniq.ru'; // обязательное поле чека, fallback
  }
  const value = (amountKopecks / 100).toFixed(2);
  return {
    customer,
    items: [
      {
        description: PRODUCT_LABELS[productCode] || productCode,
        quantity: '1.00',
        amount: { value, currency },
        vat_code: 1, // без НДС
        payment_subject: 'service',
        payment_mode: 'full_payment',
      },
    ],
    tax_system_code: parseInt(process.env.YOOKASSA_TAX_SYSTEM_CODE || '1', 10), // 1 = OSN
  };
}

/** Создание платежа в ЮKassa, возвращает { id, confirmationUrl } или ошибку */
async function createYooKassaPayment(params: {
  shopId: string;
  secretKey: string;
  amountKopecks: number;
  currency: string;
  description: string;
  idempotencyKey: string;
  returnUrl: string;
  metadata?: Record<string, string>;
  receipt: Record<string, unknown>;
}): Promise<{ id: string; confirmationUrl: string | null; status: string; raw: unknown } | { error: string }> {
  const auth = Buffer.from(`${params.shopId}:${params.secretKey}`).toString('base64');
  const body = {
    amount: {
      value: (params.amountKopecks / 100).toFixed(2),
      currency: params.currency,
    },
    capture: true, // автоматическое подтверждение: после оплаты платёж сразу succeeded, без ручного capture
    confirmation: {
      type: 'redirect' as const,
      return_url: params.returnUrl,
    },
    description: params.description,
    metadata: params.metadata ?? {},
    receipt: params.receipt,
  };
  try {
    const res = await fetch(YOOKASSA_API, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Idempotence-Key': params.idempotencyKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      id?: string;
      status?: string;
      confirmation?: { confirmation_url?: string };
      code?: string;
      description?: string;
    };
    if (!res.ok) {
      logger.warn('YooKassa API error', { status: res.status, data });
      return { error: data?.description || data?.code || `HTTP ${res.status}` };
    }
    const id = typeof data.id === 'string' ? data.id : '';
    const confirmationUrl = data.confirmation?.confirmation_url ?? null;
    const status = typeof data.status === 'string' ? data.status : 'pending';
    return { id, confirmationUrl, status, raw: data };
  } catch (e) {
    logger.error('YooKassa request failed', { error: e });
    return { error: e instanceof Error ? e.message : 'YooKassa request failed' };
  }
}

// Конфигурация продуктов
const PRODUCTS: Record<string, { amount: number; currency: string }> = {
  plan_access: {
    amount: 19900, // 199 рублей в копейках
    currency: 'RUB',
  },
  retake_topic: {
    amount: 4900, // 49 рублей в копейках (ИСПРАВЛЕНО: цена за перепрохождение одной темы)
    currency: 'RUB',
  },
  retake_full: {
    amount: 9900, // 99 рублей в копейках (цена за полное перепрохождение анкеты)
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/payments/create';
  let userId: string | undefined;

  try {
    const origin = request.nextUrl.origin;

    // ВАЖНО: На Vercel `NODE_ENV=production` может быть и в preview окружениях.
    // Для разделения "боевой прод" vs "тест/preview" используем `VERCEL_ENV`.
    // - production: запрещаем симуляцию (нужна реальная интеграция)
    // - preview/development/локально: разрешаем симуляцию
    const vercelEnv = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development' | undefined
    const isProductionDeployment =
      vercelEnv === 'production' || (!vercelEnv && process.env.NODE_ENV === 'production');

    const shopId = process.env.YOOKASSA_SHOP_ID?.trim() || '';
    const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim() || '';
    const useRealYooKassa = Boolean(shopId && secretKey);

    // В production обязательна реальная ЮKassa (env переменные).
    if (isProductionDeployment && !useRealYooKassa) {
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 501, duration);
      return ApiResponse.error('Payments are not configured in production (set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY)', 501);
    }

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
      select: { id: true, status: true, providerPaymentId: true, providerPayload: true },
    });

    if (existingPayment) {
      logger.info('Payment already exists with idempotencyKey', {
        userId,
        paymentId: existingPayment.id,
        idempotencyKey: finalIdempotencyKey,
      });

      const duration = Date.now() - startTime;
      logApiRequest(method, path, 200, duration, userId);

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

      let existingPaymentUrl: string | null = null;
      if (useRealYooKassa && existingPayment.providerPayload && typeof existingPayment.providerPayload === 'object') {
        const conf = (existingPayment.providerPayload as { confirmation?: { confirmation_url?: string } }).confirmation;
        existingPaymentUrl = conf?.confirmation_url ?? null;
      } else if (existingPayment.providerPaymentId) {
        existingPaymentUrl = `${origin}/payments/test?payment_id=${existingPayment.providerPaymentId}`;
      }
      return ApiResponse.success({
        paymentId: existingPayment.id,
        status: existingPayment.status,
        paymentUrl: existingPaymentUrl,
      });
    }

    // Создаем запись Payment со статусом pending
    const payment = await prisma.payment.create({
      data: {
        userId,
        productCode,
        amount: product.amount,
        currency: product.currency,
        provider: 'yookassa',
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

    // После оплаты ЮKassa редиректит сюда (в браузере). На странице — «Вернитесь в приложение» + уведомление в боте.
    const returnUrl = `${origin}/payments/return?success=1`;
    let providerPaymentId: string;
    let paymentUrl: string | null;
    let providerPayload: Record<string, unknown>;

    if (useRealYooKassa) {
      const userForReceipt = await prisma.user.findUnique({
        where: { id: userId },
        select: { phoneNumber: true },
      });
      const receipt = buildYooKassaReceipt({
        amountKopecks: product.amount,
        currency: product.currency,
        productCode,
        customerEmail: null,
        customerPhone: userForReceipt?.phoneNumber ?? null,
      });
      const yoo = await createYooKassaPayment({
        shopId,
        secretKey,
        amountKopecks: product.amount,
        currency: product.currency,
        description: `Оплата ${productCode}`,
        idempotencyKey: finalIdempotencyKey,
        returnUrl,
        metadata: { paymentId: payment.id, userId: userId ?? '' },
        receipt,
      });

      if ('error' in yoo) {
        logger.error('YooKassa create failed', { paymentId: payment.id, error: yoo.error });
        const duration = Date.now() - startTime;
        logApiRequest(method, path, 502, duration, userId);
        return ApiResponse.error('Не удалось создать платёж. Попробуйте позже.', 502);
      }

      providerPaymentId = yoo.id;
      paymentUrl = yoo.confirmationUrl;
      providerPayload = (yoo.raw as Record<string, unknown>) ?? {};
    } else {
      const crypto = await import('crypto');
      providerPaymentId = crypto.randomUUID();
      paymentUrl = `${origin}/payments/test?payment_id=${providerPaymentId}`;
      providerPayload = {
        id: providerPaymentId,
        status: 'pending',
        amount: { value: (product.amount / 100).toFixed(2), currency: product.currency },
        confirmation: { type: 'redirect', confirmation_url: paymentUrl },
        created_at: new Date().toISOString(),
        description: `Оплата ${productCode}`,
        metadata: { paymentId: payment.id, userId: userId ?? '' },
      };
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId,
        providerPayload: providerPayload as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    logger.info('Payment created', {
      userId,
      paymentId: payment.id,
      productCode,
      provider: 'yookassa',
      useRealYooKassa,
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return ApiResponse.success({
      paymentId: payment.id,
      providerPaymentId: providerPaymentId ?? undefined,
      paymentUrl,
      status: 'pending',
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}

