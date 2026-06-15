// app/api/payments/webhook/route.ts
// Обработка вебхуков от платежного провайдера

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

const YOOKASSA_API = 'https://api.yookassa.ru/v3/payments';

/**
 * Независимая ре-верификация платежа напрямую в ЮKassa API.
 * Защита от подделки вебхука: ЮKassa не шлёт кастомные заголовки, поэтому
 * verifyWebhookSignature без секрета принимает любой «похожий» body. Перед
 * выдачей доступа мы сами запрашиваем статус платежа у ЮKassa по его id.
 *
 * retryable=true → временная ошибка (сеть/5xx), стоит вернуть 5xx чтобы ЮKassa
 * повторила вебхук. retryable=false → платёж не найден у провайдера (подделка).
 */
async function fetchYooKassaPaymentStatus(
  paymentId: string,
  shopId: string,
  secretKey: string,
): Promise<{ status: string; amountKopecks: number | null } | { error: string; retryable: boolean }> {
  const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
  try {
    const res = await fetch(`${YOOKASSA_API}/${encodeURIComponent(paymentId)}`, {
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      return { error: `HTTP ${res.status}`, retryable: res.status >= 500 };
    }
    const data = (await res.json()) as { status?: string; amount?: { value?: string } };
    const status = typeof data.status === 'string' ? data.status : '';
    const amountKopecks =
      data.amount?.value != null ? Math.round(parseFloat(String(data.amount.value)) * 100) : null;
    return { status, amountKopecks };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'request_failed', retryable: true };
  }
}

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

/** Сравнение строк за постоянное время — защита от timing-атак на секрет. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// ok    — запрос принят к обработке (не мусор).
// strong — подлинность подтверждена общим секретом, телу можно доверять.
// Без strong любую выдачу доступа ОБЯЗАНЫ независимо подтвердить у ЮKassa (см. POST):
// verifyWebhookSignature без секрета принимает любой «похожий» body — это не аутентификация.
async function verifyWebhookSignature(
  request: NextRequest,
): Promise<{ ok: boolean; strong: boolean }> {
  const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
  const provided =
    request.headers.get('x-webhook-secret') || request.headers.get('X-Webhook-Secret') || '';

  // Если задан PAYMENTS_WEBHOOK_SECRET — проверяем строго (constant-time)
  if (secret && provided) {
    const match = timingSafeEqualStr(provided, secret);
    return { ok: match, strong: match };
  }

  if (secret && !provided) {
    logger.error('Webhook: secret set but header X-Webhook-Secret missing');
    return { ok: false, strong: false };
  }

  // Если PAYMENTS_WEBHOOK_SECRET не задан (типичная конфигурация для ЮKassa,
  // которая не поддерживает кастомные заголовки) — принимаем запрос только если
  // тело похоже на уведомление ЮKassa. Это НЕ аутентификация (strong:false).
  if (await looksLikeYooKassaBody(request)) {
    return { ok: true, strong: false };
  }

  return { ok: false, strong: false };
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

import { entitlementCodeForProduct, calculateValidUntil, isRenewalProduct, WINBACK_OFFER_TAG } from '@/lib/payment-helpers';
import { invalidateAllUserCache } from '@/lib/cache';

export async function POST(request: NextRequest) {
  try {
    // Проверяем подпись вебхука
    const { ok: isValid, strong: strongAuth } = await verifyWebhookSignature(request);
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

    // SECURITY: выдаём доступ только если (а) подлинность подтверждена общим
    // секретом (strongAuth — телу можно доверять), ЛИБО (б) платёж независимо
    // подтверждён у ЮKassa. Ре-верификация НЕ зависит от body.provider — иначе
    // её тривиально обойти, прислав succeeded-вебхук с чужим provider.
    // На staging/симуляторе ключей ЮKassa нет, и успешные платежи идут через
    // отдельный /api/payments/test-webhook, поэтому здесь fail-closed безопасен.
    if (newStatus === 'succeeded' && !strongAuth) {
      const shopId = process.env.YOOKASSA_SHOP_ID?.trim() || '';
      const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim() || '';
      if (!shopId || !secretKey) {
        logger.error('Webhook: cannot verify succeeded payment (no shared secret and no YooKassa keys) — refusing to grant', {
          paymentId: payment.id,
          providerPaymentId,
        });
        return NextResponse.json({ error: 'Cannot verify payment' }, { status: 400 });
      }

      const verified = await fetchYooKassaPaymentStatus(providerPaymentId, shopId, secretKey);
      if ('error' in verified) {
        if (verified.retryable) {
          logger.error('Webhook re-verification: transient error, asking provider to retry', {
            paymentId: payment.id,
            providerPaymentId,
            error: verified.error,
          });
          return NextResponse.json({ error: 'Verification temporarily unavailable' }, { status: 503 });
        }
        logger.error('Webhook re-verification: payment not confirmed by YooKassa (possible forgery)', {
          paymentId: payment.id,
          providerPaymentId,
          error: verified.error,
        });
        return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
      }

      const verifiedStatus = mapProviderStatus('yookassa', verified.status);
      if (verifiedStatus !== 'succeeded') {
        logger.warn('Webhook re-verification: YooKassa status is not succeeded — not granting access', {
          paymentId: payment.id,
          providerPaymentId,
          providerStatus: verified.status,
        });
        // Не выдаём доступ; настоящий succeeded-вебхук придёт отдельно.
        return NextResponse.json({ ok: true, processed: false, reason: 'not_succeeded_on_provider' });
      }

      if (verified.amountKopecks != null && verified.amountKopecks !== payment.amount) {
        logger.error('Webhook re-verification: amount mismatch with YooKassa', {
          paymentId: payment.id,
          providerPaymentId,
          expectedAmount: payment.amount,
          verifiedAmount: verified.amountKopecks,
        });
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
      }

      logger.info('Webhook re-verification passed', { paymentId: payment.id, providerPaymentId });
    }

    // Транзакция: атомарно переводим статус и создаём/обновляем Entitlement.
    // updateMany с guard `status != succeeded` исключает гонку двух параллельных
    // succeeded-вебхуков (повтор от ЮKassa): только один реально совершит переход.
    const transitioned = await prisma.$transaction(async (tx) => {
      const upd = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: 'succeeded' } },
        data: {
          status: newStatus,
          providerPayload: body, // Сохраняем полные данные от провайдера
          updatedAt: new Date(),
        },
      });

      // Уже финализирован другим конкурентным вебхуком — выходим без побочных эффектов.
      if (upd.count === 0) {
        return false;
      }

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

        // Продление (499₽ / 99₽): сбрасываем 28-дневный счётчик последнего плана,
        // чтобы /api/plan перестал отдавать expired=true, и снимаем win-back тег,
        // чтобы скидочный оффер можно было предложить заново в следующем цикле.
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
              data: { tags: { set: userTags.tags.filter((t) => t !== WINBACK_OFFER_TAG) } },
            });
          }
          logger.info('Renewal processed: plan counter reset, win-back tag cleared', {
            userId: payment.userId,
            paymentId: payment.id,
            productCode: payment.productCode,
          });
        }
      }

      return true;
    });

    // Параллельный вебхук уже всё обработал — не дублируем уведомление.
    if (!transitioned) {
      logger.info('Payment already finalized by concurrent webhook (idempotency)', {
        paymentId: payment.id,
        providerPaymentId,
      });
      return NextResponse.json({ ok: true, processed: false, reason: 'already_succeeded' });
    }

    // Продление сбросило plan28.createdAt — выкидываем закэшированный план с
    // устаревшим флагом expired, иначе /api/plan вернёт stale expired=true.
    if (newStatus === 'succeeded' && isRenewalProduct(payment.productCode)) {
      await invalidateAllUserCache(payment.userId).catch((e) => {
        logger.warn('Failed to invalidate plan cache after renewal (non-critical)', {
          userId: payment.userId,
          error: e,
        });
      });
    }

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

