// app/api/cron/winback/route.ts
// Win-back продления: через WINBACK_DELAY_DAYS дней после истечения доступа к плану
// (и если пользователь не продлил за 499₽) шлём в чат предложение продлить со
// скидкой — 99₽ за ещё 28 дней. Помечаем пользователя тегом WINBACK_OFFER_TAG,
// чтобы (а) не слать повторно и (б) разрешить покупку продукта plan_renewal_discount
// (см. guard в /api/payments/create).
//
// Дёргается внешним планировщиком (GitHub Actions) с Bearer CRON_SECRET — раз в день.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { timingSafeEqual } from '@/lib/timing-safe';
import { WINBACK_OFFER_TAG, WINBACK_DELAY_DAYS } from '@/lib/payment-helpers';

export const dynamic = 'force-dynamic';

// Не предлагаем скидку тем, кто истёк слишком давно (давно ушедшие) — чтобы при
// первом запуске крона не разослать оффер всей исторической базе разом.
const WINBACK_MAX_AGE_DAYS = 30;
const BATCH_SIZE = 200;

function verifyCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const provided = searchParams.get('secret') || authHeader?.replace('Bearer ', '') || '';
  return Boolean(provided) && timingSafeEqual(provided, cronSecret);
}

async function sendWinbackMessage(telegramId: string, planUrl: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text:
          '🌿 Ваш план ухода завершился, но прогресс кожи лучше не прерывать.\n\n' +
          'Специально для вас — продление со скидкой: <b>99₽ вместо 499₽</b> за ещё 28 дней ' +
          'персонального ухода. Предложение ограничено.',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: 'Продлить за 99 ₽', web_app: { url: planUrl } }]],
        },
      }),
    });
    return res.ok;
  } catch (e) {
    logger.warn('Win-back message send failed', { telegramId, error: e });
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyCron(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    const expiredBefore = new Date(now - WINBACK_DELAY_DAYS * 24 * 60 * 60 * 1000);
    const expiredAfter = new Date(now - WINBACK_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

    // Кандидаты: paid_access истёк в окне [3..30] дней назад, доступ не продлён,
    // и оффер ещё не отправлялся (у пользователя нет тега WINBACK_OFFER_TAG).
    const candidates = await prisma.entitlement.findMany({
      where: {
        code: 'paid_access',
        validUntil: { lt: expiredBefore, gt: expiredAfter },
        NOT: { user: { tags: { has: WINBACK_OFFER_TAG } } },
      },
      select: { userId: true, user: { select: { telegramId: true } } },
      take: BATCH_SIZE,
    });

    const miniAppUrl = process.env.NEXT_PUBLIC_MINI_APP_URL || 'https://www.proskiniq.ru';
    const planUrl = `${miniAppUrl}/plan?offer=winback`;

    let sent = 0;
    let failed = 0;

    for (const c of candidates) {
      const telegramId = c.user?.telegramId;
      if (!telegramId) continue;

      const ok = await sendWinbackMessage(telegramId, planUrl);
      if (!ok) {
        failed += 1;
        continue;
      }

      // Помечаем тегом ТОЛЬКО после успешной отправки — иначе при сбое Telegram
      // пользователь и оффер не получит, и под скидку (guard по тегу) не попадёт.
      try {
        const u = await prisma.user.findUnique({
          where: { id: c.userId },
          select: { tags: true },
        });
        const tags = u?.tags ?? [];
        if (!tags.includes(WINBACK_OFFER_TAG)) {
          await prisma.user.update({
            where: { id: c.userId },
            data: { tags: { push: WINBACK_OFFER_TAG } },
          });
        }
        sent += 1;
      } catch (e) {
        logger.warn('Win-back: failed to tag user after send', { userId: c.userId, error: e });
      }
    }

    logger.info('Win-back cron finished', { candidates: candidates.length, sent, failed });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      candidates: candidates.length,
      sent,
      failed,
    });
  } catch (error: any) {
    logger.error('Win-back cron error', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
