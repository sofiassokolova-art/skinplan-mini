// app/api/payments/webhook/route.ts
// Обработка вебхуков от платежного провайдера

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Проверяет, что тело запроса похоже на уведомление ЮKassa (event + object.id) */
async function looksLikeYooKassaBody(request: NextRequest): Promise<boolean> {
  try {
    const clone = request.clone();
    const body = await clone.json();
    return (
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { event?: unknown }).event === 'string' &&
      typeof (body as { object?: { id?: unknown } }).object?.id === 'string'
    );
  } catch {
    return false;
  }
}

async function verifyWebhookSignature(request: NextRequest): Promise<boolean> {
  const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
  const provided =
    request.headers.get('x-webhook-secret') || request.headers.get('X-Webhook-Secret') || '';

  // Если задан PAYMENTS_WEBHOOK_SECRET — проверяем строго
  if (secret && provided) {
    return provided === secret;
  }

  if (secret && !provided) {
    logger.error('Webhook: secret set but header X-Webhook-Secret missing');
    return false;
  }

  // Если PAYMENTS_WEBHOOK_SECRET не задан (типичная конфигурация для ЮKassa,
  // которая не поддерживает кастомные заголовки) — принимаем запрос
  // только если тело похоже на уведомление ЮKassa (event + object.id).
  if (await looksLikeYooKassaBody(request)) {
    return true;
  }

  return false;
}

function mapProviderStatus(provider: string, providerStatus: string): string {
  // Маппинг статусов от провайдера к нашему формату
  const statusMap: Record<string, Record<string, string>> = {
    yookassa: {
      pending: 'pending',
      waiting_for_capture: 'pending', // Ожидает подтверждения
      succeeded: 'succeeded',
      canceled: 'canceled',
      cancelled: 'canceled', // Альтернативное написание
      failed: 'failed',
    },
    cloudpayments: {
      AwaitingAuthentication: 'pending',
      Completed: 'succeeded',
      Cancelled: 'canceled',
      Declined: 'failed',
    },
    stripe: {
      'payment_intent.pending': 'pending',
      'payment_intent.succeeded': 'succeeded',
      'payment_intent.canceled': 'canceled',
      'payment_intent.payment_failed': 'failed',
    },
    telegram: {
      pending: 'pending',
      paid: 'succeeded',
      cancelled: 'canceled',
      failed: 'failed',
    },
  };

  return statusMap[provider]?.[providerStatus] || 'pending';
}

import { entitlementCodeForProduct, calculateValidUntil } from '@/lib/payment-helpers';

export async function POST(request: NextRequest) {
  try {
    // Проверяем подпись вебхука
    const isValid = await verifyWebhookSignature(request);
    if (!isValid) {
      logger.error('Invalid webhook signature', {
        headers: Object.fromEntries(request.headers.entries()),
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = await request.json();
    
    // Определяем провайдера из headers или body
    // Для ЮKassa: можно определить по заголовку или структуре body
    // ЮKassa отправляет вебхуки в формате: { event: 'payment.succeeded', object: { id: '...', status: '...' } }
    const provider = body.provider || 
                     request.headers.get('x-payment-provider') || 
                     (body.object?.id ? 'yookassa' : null) || // Если есть object.id - это ЮKassa
                     'yookassa'; // По умолчанию ЮKassa
    
    // Для ЮKassa: payment ID находится в body.object.id
    // Формат вебхука ЮKassa: { event: 'payment.succeeded', object: { id: '...', status: 'succeeded' } }
    const providerPaymentId = body.object?.id || // ЮKassa формат
                              body.paymentId || 
                              body.id || 
                              body.providerPaymentId;

    if (!providerPaymentId) {
      logger.error('Webhook missing providerPaymentId', { 
        body, 
        headers: Object.fromEntries(request.headers.entries()),
        provider 
      });
      return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 });
    }

    // Находим Payment по providerPaymentId (нужен telegramId для уведомления после оплаты)
    const payment = await prisma.payment.findUnique({
      where: { providerPaymentId },
      include: { user: { select: { id: true, telegramId: true } } },
    });

    if (!payment) {
      logger.warn('Payment not found for webhook', {
        providerPaymentId,
        provider,
      });
      // Возвращаем 200, чтобы провайдер не повторял запрос
      return NextResponse.json({ ok: true, processed: false });
    }

    // Валидация суммы: проверяем, что сумма в вебхуке совпадает с суммой в БД
    const webhookAmountRaw = body.object?.amount?.value;
    if (webhookAmountRaw != null) {
      const webhookAmountKopecks = Math.round(parseFloat(String(webhookAmountRaw)) * 100);
      if (webhookAmountKopecks !== payment.amount) {
        logger.error('Webhook amount mismatch', {
          paymentId: payment.id,
          providerPaymentId,
          expectedAmount: payment.amount,
          receivedAmount: webhookAmountKopecks,
          rawValue: webhookAmountRaw,
        });
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
      }
    }

    // Идемпотентность: если статус уже succeeded, не обрабатываем повторно
    if (payment.status === 'succeeded') {
      logger.info('Payment already succeeded, skipping webhook processing (idempotency)', {
        paymentId: payment.id,
        providerPaymentId,
        provider,
      });
      return NextResponse.json({ ok: true, processed: false, reason: 'already_succeeded' });
    }

    // Маппим статус от провайдера
    // Для ЮKassa: статус находится в body.object.status
    // Формат: { event: 'payment.succeeded', object: { status: 'succeeded' } }
    const providerStatus = body.object?.status || // ЮKassa формат
                          body.status || 
                          body.state || 
                          'pending';
    const newStatus = mapProviderStatus(provider, providerStatus);

    logger.info('Processing webhook', {
      paymentId: payment.id,
      providerPaymentId,
      oldStatus: payment.status,
      newStatus,
      providerStatus,
    });

    // Транзакция: обновляем Payment и создаем/обновляем Entitlement
    await prisma.$transaction(async (tx) => {
      // Обновляем статус платежа
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          providerPayload: body, // Сохраняем полные данные от провайдера
          updatedAt: new Date(),
        },
      });

      // Если платеж успешен - создаем/обновляем Entitlement
      if (newStatus === 'succeeded') {
        const entitlementCode = entitlementCodeForProduct(payment.productCode);

        const validUntil = calculateValidUntil(payment.productCode);

        // Создаем или обновляем Entitlement
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

        logger.info('Entitlement created/updated', {
          userId: payment.userId,
          paymentId: payment.id,
          validUntil: validUntil.toISOString(),
        });
      }
    });

    // Уведомление в Telegram: оплата прошла — открой приложение и посмотри план
    if (newStatus === 'succeeded') {
      const telegramId = payment.user?.telegramId;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const miniAppUrl = process.env.NEXT_PUBLIC_MINI_APP_URL || 'https://www.proskiniq.ru';
      const planUrl = `${miniAppUrl}/plan`;
      if (botToken && telegramId) {
        try {
          const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramId,
              text: '✅ Оплата прошла! Откройте приложение и посмотрите свой план ухода.',
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[{ text: 'Открыть план', web_app: { url: planUrl } }]],
              },
            }),
          });
          if (!tgRes.ok) {
            const tgBody = await tgRes.text().catch(() => '');
            logger.warn('Telegram notification failed', {
              userId: payment.userId,
              telegramId,
              status: tgRes.status,
              body: tgBody.slice(0, 200),
            });
          }
        } catch (e) {
          logger.warn('Failed to send payment success notification to Telegram', { userId: payment.userId, error: e });
        }
      }
    }

    return NextResponse.json({ ok: true, processed: true });
  } catch (error: unknown) {
    logger.error('Webhook processing error', error);
    // Возвращаем 500, чтобы провайдер повторил запрос
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

