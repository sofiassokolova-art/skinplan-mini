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

    // В production нельзя отдавать "test" paymentUrl и симулировать провайдера.
    // Если реальная интеграция не настроена — возвращаем понятную ошибку, чтобы пользователь не застревал в pending.
    if (isProductionDeployment) {
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 501, duration);
      return ApiResponse.error('Payments are not configured in production yet', 501);
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
        // ИСПРАВЛЕНО: в preview/dev мы используем тестовый checkout (/payments/test).
        // Возвращаем его и для идемпотентных платежей, иначе PaymentGate не сможет симулировать вебхук.
        paymentUrl: existingPayment.providerPaymentId
          ? `${origin}/payments/test?payment_id=${existingPayment.providerPaymentId}`
          : null,
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

    // ИМИТАЦИЯ ЮKassa для тестовой среды
    // В реальной среде здесь будет вызов API ЮKassa:
    // const yooKassaResponse = await fetch('https://api.yookassa.ru/v3/payments', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`,
    //     'Idempotence-Key': finalIdempotencyKey,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     amount: { value: (product.amount / 100).toFixed(2), currency: product.currency },
    //     confirmation: { type: 'redirect', return_url: `${process.env.NEXT_PUBLIC_APP_URL}/plan` },
    //     description: `Оплата ${productCode}`,
    //   }),
    // });

    // Генерируем тестовый providerPaymentId в формате ЮKassa (UUID)
    const crypto = await import('crypto');
    const providerPaymentId = crypto.randomUUID();
    
    // Тестовая ссылка на оплату (в реальности это будет confirmation.confirmation_url от ЮKassa)
    // ИСПРАВЛЕНО: используем origin текущего deployment (preview тоже будет корректным)
    const paymentUrl = `${origin}/payments/test?payment_id=${providerPaymentId}`;

    // Обновляем платеж с providerPaymentId и данными от ЮKassa
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId,
        providerPayload: {
          // Имитация структуры ответа от ЮKassa
          id: providerPaymentId,
          status: 'pending',
          amount: {
            value: (product.amount / 100).toFixed(2),
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
          },
        },
      },
      select: { id: true },
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return ApiResponse.success({
      paymentId: payment.id,
      paymentUrl,
      status: 'pending',
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}

