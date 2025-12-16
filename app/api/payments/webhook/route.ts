// app/api/payments/webhook/route.ts
// Обработка вебхуков от платежного провайдера

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// TODO: Реализовать проверку подписи вебхука для вашего провайдера
// Для ЮKassa: проверка через X-Idempotence-Key и подпись
// Для CloudPayments: проверка через Content-HMAC
// Для Stripe: проверка через stripe.webhooks.constructEvent

async function verifyWebhookSignature(request: NextRequest): Promise<boolean> {
  // TODO: Реализовать проверку подписи в зависимости от провайдера
  // Это критично для безопасности!
  
  // Пример для ЮKassa:
  // const signature = request.headers.get('X-Idempotence-Key');
  // const body = await request.text();
  // return verifyYooKassaSignature(body, signature);
  
  // Для разработки можно временно возвращать true
  // В продакшене ОБЯЗАТЕЛЬНО проверять подпись!
  if (process.env.NODE_ENV === 'development') {
    logger.warn('Webhook signature verification skipped in development');
    return true;
  }
  
  // В продакшене всегда проверяем
  logger.error('Webhook signature verification not implemented');
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

    // Находим Payment по providerPaymentId
    const payment = await prisma.payment.findUnique({
      where: { providerPaymentId },
      include: { user: { select: { id: true } } },
    });

    if (!payment) {
      logger.warn('Payment not found for webhook', {
        providerPaymentId,
        provider,
      });
      // Возвращаем 200, чтобы провайдер не повторял запрос
      return NextResponse.json({ ok: true, processed: false });
    }

    // Идемпотентность: если статус уже succeeded, не обрабатываем повторно
    // Это важно, так как провайдер может отправить вебхук несколько раз
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
        // Определяем срок действия доступа в зависимости от типа продукта
        const validUntil = new Date();
        if (payment.productCode === 'subscription_month') {
          // Подписка на месяц - доступ на 1 месяц
          validUntil.setMonth(validUntil.getMonth() + 1);
        } else if (payment.productCode === 'plan_access') {
          // Доступ к плану - можно установить срок (например, 1 год) или сделать постоянным
          // Сейчас устанавливаем 1 год для безопасности
          validUntil.setFullYear(validUntil.getFullYear() + 1);
        } else {
          // Для других продуктов - по умолчанию 1 год
          validUntil.setFullYear(validUntil.getFullYear() + 1);
        }

        // Создаем или обновляем Entitlement
        await tx.entitlement.upsert({
          where: {
            userId_code: {
              userId: payment.userId,
              code: 'paid_access',
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
            code: 'paid_access',
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

