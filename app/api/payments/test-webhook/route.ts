// app/api/payments/test-webhook/route.ts
// Тестовый endpoint для симуляции вебхука от ЮKassa
// Используется только в development/test окружении

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

export const runtime = 'nodejs';

function entitlementCodeForProduct(productCode: string): string {
  if (productCode === 'plan_access') return 'paid_access';
  if (productCode === 'retake_topic') return 'retake_topic_access';
  // По умолчанию — доступ к плану (обратная совместимость)
  return 'paid_access';
}

/**
 * Тестовый endpoint для симуляции успешного платежа через вебхук ЮKassa
 * Используется только в development/test окружении
 * 
 * Использование:
 * POST /api/payments/test-webhook
 * Body: { paymentId: "payment_id_from_db" }
 */
export async function POST(request: NextRequest) {
  // В продакшене блокируем этот endpoint.
  // ВАЖНО: На Vercel `NODE_ENV=production` может быть и в preview окружениях,
  // поэтому ориентируемся на `VERCEL_ENV`.
  const vercelEnv = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development' | undefined
  const isProductionDeployment =
    vercelEnv === 'production' || (!vercelEnv && process.env.NODE_ENV === 'production');

  if (isProductionDeployment) {
    // ИСПРАВЛЕНО: не спамим error-логами в проде (часто сканеры/боты дергают /test-* пути)
    // и не раскрываем наличие endpoint'а.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    // Требуем авторизацию для безопасности (даже в тестовой среде)
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId is required' }, { status: 400 });
    }

    // Находим платеж
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: { select: { id: true } } },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Проверяем, что платеж принадлежит авторизованному пользователю
    if (payment.userId !== auth.ctx.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Если платеж уже успешен - возвращаем информацию
    if (payment.status === 'succeeded') {
      logger.info('Payment already succeeded', { paymentId });
      return NextResponse.json({ 
        ok: true, 
        processed: false, 
        reason: 'already_succeeded',
        paymentId: payment.id,
      });
    }

    // Симулируем вебхук от ЮKassa
    // Формат вебхука ЮKassa: { event: 'payment.succeeded', object: { id: '...', status: 'succeeded' } }
    const webhookBody = {
      type: 'notification',
      event: 'payment.succeeded',
      object: {
        id: payment.providerPaymentId || payment.id,
        status: 'succeeded',
        amount: {
          value: (payment.amount / 100).toFixed(2),
          currency: payment.currency,
        },
        created_at: payment.createdAt.toISOString(),
        description: `Оплата ${payment.productCode}`,
        metadata: {
          paymentId: payment.id,
          userId: payment.userId,
        },
      },
    };

    logger.info('Simulating YooKassa webhook', {
      paymentId: payment.id,
      providerPaymentId: payment.providerPaymentId,
      userId: payment.userId,
    });

    // Обрабатываем вебхук (используем ту же логику, что и в основном вебхуке)
    const newStatus = 'succeeded';

    // Транзакция: обновляем Payment и создаем/обновляем Entitlement
    await prisma.$transaction(async (tx) => {
      // Обновляем статус платежа
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          providerPayload: webhookBody, // Сохраняем полные данные от провайдера
          updatedAt: new Date(),
        },
      });

      // Создаем или обновляем Entitlement
      const entitlementCode = entitlementCodeForProduct(payment.productCode);
      const validUntil = new Date();
      if (payment.productCode === 'subscription_month') {
        validUntil.setMonth(validUntil.getMonth() + 1);
      } else if (payment.productCode === 'plan_access') {
        validUntil.setDate(validUntil.getDate() + 28);
      } else if (payment.productCode === 'retake_topic') {
        validUntil.setDate(validUntil.getDate() + 1);
      } else {
        validUntil.setFullYear(validUntil.getFullYear() + 1);
      }

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

      logger.info('Entitlement created/updated via test webhook', {
        userId: payment.userId,
        paymentId: payment.id,
        validUntil: validUntil.toISOString(),
      });
    });

    return NextResponse.json({ 
      ok: true, 
      processed: true,
      paymentId: payment.id,
      status: 'succeeded',
    });
  } catch (error: unknown) {
    logger.error('Test webhook processing error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
