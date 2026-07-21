// app/api/cron/access-expired/route.ts
// Напоминание об оплате в день окончания доступа к плану: как только paid_access
// истёк, шлём в чат сообщение с кнопкой продления за полную цену (499₽,
// subscription_month). Если пользователь не продлит — через WINBACK_DELAY_DAYS
// его догонит win-back оффер за 99₽ (см. /api/cron/winback).
//
// Дедупликация — через bot_messages (messageType = access_expired_reminder):
// повторно не шлём, если после текущего validUntil такое сообщение уже уходило.
// После продления validUntil сдвигается вперёд, поэтому следующее истечение
// снова получит напоминание.
//
// Дёргается внешним планировщиком (GitHub Actions) с Bearer CRON_SECRET — раз в день.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { timingSafeEqual } from '@/lib/timing-safe';

export const dynamic = 'force-dynamic';

// Смотрим только недавно истёкших: окно меньше WINBACK_DELAY_DAYS (3), чтобы при
// сбое крона пользователь не получил напоминание и win-back в один день.
const LOOKBACK_DAYS = 2;
const BATCH_SIZE = 200;

const MSG_TYPE = 'access_expired_reminder';

function verifyCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const provided = searchParams.get('secret') || authHeader?.replace('Bearer ', '') || '';
  return Boolean(provided) && timingSafeEqual(provided, cronSecret);
}

function reminderText(firstName: string | null): string {
  const name = (firstName || '').trim();
  const hello = name ? `${name}, доступ` : 'Доступ';
  return (
    `⏳ ${hello} к вашему плану ухода закончился.\n\n` +
    'Кожа любит постоянство — продлите план, чтобы не терять прогресс: ' +
    '<b>499 ₽</b> за ещё 28 дней персонального ухода.'
  );
}

async function sendReminder(telegramId: string, text: string, planUrl: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: 'Продлить план', web_app: { url: planUrl } }]],
        },
      }),
    });
    return res.ok;
  } catch (e) {
    logger.warn('Access-expired reminder send failed', { telegramId, error: e });
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyCron(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const expiredAfter = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    // Кандидаты: paid_access истёк в последние LOOKBACK_DAYS дней и не продлён
    // (продление upsert'ит ту же строку entitlement, поэтому истёкший validUntil
    // означает «не продлил»).
    const candidates = await prisma.entitlement.findMany({
      where: {
        code: 'paid_access',
        validUntil: { lt: now, gt: expiredAfter },
        user: { telegramId: { not: '' } },
      },
      select: {
        userId: true,
        validUntil: true,
        user: { select: { telegramId: true, firstName: true } },
      },
      take: BATCH_SIZE,
    });

    const result = { candidates: candidates.length, sent: 0, skipped: 0, failed: 0 };
    if (candidates.length === 0) {
      return NextResponse.json({ success: true, timestamp: now.toISOString(), ...result });
    }

    // Уже отправленные напоминания — одним запросом; сравниваем последнюю отправку
    // с validUntil кандидата, чтобы после продления цикл начинался заново.
    const priorReminders = await prisma.botMessage.findMany({
      where: {
        userId: { in: candidates.map((c) => c.userId) },
        messageType: MSG_TYPE,
      },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const lastReminderByUser = new Map<string, Date>();
    for (const row of priorReminders) {
      if (!lastReminderByUser.has(row.userId)) lastReminderByUser.set(row.userId, row.createdAt);
    }

    const miniAppUrl = process.env.NEXT_PUBLIC_MINI_APP_URL || 'https://www.proskiniq.ru';
    const planUrl = `${miniAppUrl}/plan`;

    for (const c of candidates) {
      const telegramId = c.user?.telegramId;
      if (!telegramId || !c.validUntil) continue;

      const lastSent = lastReminderByUser.get(c.userId);
      if (lastSent && lastSent > c.validUntil) {
        result.skipped += 1;
        continue;
      }

      const text = reminderText(c.user?.firstName ?? null);
      const ok = await sendReminder(telegramId, text, planUrl);
      if (!ok) {
        result.failed += 1;
        continue;
      }

      // Отметка «отправлено» (дедуп) — и заодно история сообщений бота.
      await prisma.botMessage.create({
        data: {
          userId: c.userId,
          telegramId,
          chatId: telegramId,
          direction: 'outbound',
          messageType: MSG_TYPE,
          content: text,
          rawData: { validUntil: c.validUntil.toISOString() },
        },
      }).catch((e) =>
        logger.warn('Access-expired: bot_message record failed', { userId: c.userId, error: e })
      );

      result.sent += 1;
    }

    logger.info('Access-expired reminder cron finished', result);
    return NextResponse.json({ success: true, timestamp: now.toISOString(), ...result });
  } catch (error: any) {
    logger.error('Access-expired reminder cron error', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}
