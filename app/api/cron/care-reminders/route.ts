// app/api/cron/care-reminders/route.ts
// Ежедневные напоминания об уходе (утро/вечер) в бот — для пользователей с
// активным paid_access. Дёргается внешним планировщиком каждые 30 минут вместе
// с рассылками (см. .github/workflows/cron-broadcasts.yml); сам роут решает,
// чей «час» наступил, и не шлёт дубликаты (отметка в bot_messages).
//
// Настройки: UserPreferences.extra.careReminders = {
//   enabled?: boolean;   // по умолчанию true
//   morning?: number;    // час МСК, по умолчанию 8;  null/-1 = не слать утром
//   evening?: number;    // час МСК, по умолчанию 21; null/-1 = не слать вечером
// }
// Времени в анкете не спрашиваем (воронка и так длинная) — правится в профиле.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { timingSafeEqual } from '@/lib/timing-safe';
import {
  CARE_REMINDER_SETUP_PROMPT_TYPE,
  buildCareReminderSetupKeyboard,
  buildCareReminderSetupText,
  parseCareReminderSettings,
} from '@/lib/care-reminders';

const BATCH_SIZE = 300;
const MSK_OFFSET_HOURS = 3;
const SETUP_PROMPT_DELAY_MINUTES = 10;
const SETUP_PROMPT_LOOKBACK_HOURS = 24;

const MSG_TYPE_MORNING = 'care_reminder_morning';
const MSG_TYPE_EVENING = 'care_reminder_evening';

function verifyCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const provided = searchParams.get('secret') || authHeader?.replace('Bearer ', '') || '';
  return Boolean(provided) && timingSafeEqual(provided, cronSecret);
}

async function sendReminder(
  telegramId: string,
  text: string,
  buttonUrl: string,
): Promise<boolean> {
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
          inline_keyboard: [[{ text: 'Открыть skiniq', web_app: { url: buttonUrl } }]],
        },
      }),
    });
    return res.ok;
  } catch (e) {
    logger.warn('Care reminder send failed', { telegramId, error: e });
    return false;
  }
}

async function sendReminderSetupPrompt(
  telegramId: string,
  firstName: string | null,
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;

  const text = buildCareReminderSetupText(firstName);
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text,
        parse_mode: 'HTML',
        reply_markup: buildCareReminderSetupKeyboard(),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('Care reminder setup prompt failed', {
        telegramId,
        status: res.status,
        body: body.slice(0, 200),
      });
    }
    return res.ok;
  } catch (e) {
    logger.warn('Care reminder setup prompt send failed', { telegramId, error: e });
    return false;
  }
}

async function sendDueSetupPrompts(now: Date): Promise<{ setupPrompts: number; setupSkipped: number; setupFailed: number }> {
  const result = { setupPrompts: 0, setupSkipped: 0, setupFailed: 0 };
  const promptCutoff = new Date(now.getTime() - SETUP_PROMPT_DELAY_MINUTES * 60 * 1000);
  const promptWindowStart = new Date(now.getTime() - SETUP_PROMPT_LOOKBACK_HOURS * 60 * 60 * 1000);

  const payments = await prisma.payment.findMany({
    where: {
      status: 'succeeded',
      updatedAt: { gte: promptWindowStart, lte: promptCutoff },
      user: { telegramId: { not: '' } },
    },
    orderBy: { updatedAt: 'desc' },
    take: BATCH_SIZE,
    select: {
      id: true,
      userId: true,
      updatedAt: true,
      user: { select: { telegramId: true, firstName: true } },
    },
  });

  const byUser = new Map<string, (typeof payments)[number]>();
  for (const payment of payments) {
    if (!byUser.has(payment.userId)) byUser.set(payment.userId, payment);
  }

  if (byUser.size === 0) return result;

  const prompted = await prisma.botMessage.findMany({
    where: {
      userId: { in: [...byUser.keys()] },
      messageType: CARE_REMINDER_SETUP_PROMPT_TYPE,
    },
    select: { userId: true },
  });
  const promptedUsers = new Set(prompted.map((row) => row.userId));

  for (const payment of byUser.values()) {
    const telegramId = payment.user?.telegramId;
    if (!telegramId || promptedUsers.has(payment.userId)) {
      result.setupSkipped += 1;
      continue;
    }

    const text = buildCareReminderSetupText(payment.user?.firstName ?? null);
    const ok = await sendReminderSetupPrompt(telegramId, payment.user?.firstName ?? null);
    if (!ok) {
      result.setupFailed += 1;
      continue;
    }

    await prisma.botMessage.create({
      data: {
        userId: payment.userId,
        telegramId,
        chatId: telegramId,
        direction: 'outbound',
        messageType: CARE_REMINDER_SETUP_PROMPT_TYPE,
        content: text,
        rawData: {
          paymentId: payment.id,
          paymentUpdatedAt: payment.updatedAt.toISOString(),
          promptDelayMinutes: SETUP_PROMPT_DELAY_MINUTES,
        },
      },
    }).catch((e) => logger.warn('Care reminder setup prompt record failed', { userId: payment.userId, error: e }));

    result.setupPrompts += 1;
  }

  return result;
}

function morningText(firstName: string | null, currentDay: number | null): string {
  const name = (firstName || '').trim();
  const hello = name ? `Доброе утро, ${name}!` : 'Доброе утро!';
  // День показываем только с 3-го дня (в начале плана «День 1 из 28 — держитесь» звучит странно).
  const dayLine = currentDay && currentDay >= 3 ? `\n\nДень ${currentDay} из 28 — вы отлично держитесь.` : '';
  return (
    `☀️ ${hello}\n\n` +
    'Пара минут на утренний уход: очищение, крем и SPF, и кожа готова к дню.' +
    dayLine
  );
}

function eveningText(firstName: string | null, currentDay: number | null): string {
  const dayLine = currentDay && currentDay >= 3 ? ` Сегодня день ${currentDay} из 28.` : '';
  return (
    '🌙 Время вечернего ухода.\n\n' +
    'Вечер — самое важное окно для кожи: за ночь она восстанавливается активнее всего. ' +
    'Загляните в план — там всё по шагам.' + dayLine
  );
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyCron(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const setupResult = await sendDueSetupPrompts(now);
    const mskHour = (now.getUTCHours() + MSK_OFFSET_HOURS) % 24;
    // Начало текущих суток по МСК (для дедупликации «уже слали сегодня»)
    const mskDayStart = new Date(now);
    mskDayStart.setUTCHours(-MSK_OFFSET_HOURS, 0, 0, 0);
    if (now.getTime() - mskDayStart.getTime() >= 24 * 60 * 60 * 1000) {
      mskDayStart.setUTCDate(mskDayStart.getUTCDate() + 1);
    }

    const miniAppUrl = process.env.NEXT_PUBLIC_MINI_APP_URL || 'https://www.proskiniq.ru';
    // Напоминалки ведут на главную (не на /plan) — оттуда пользователь заходит в уход.
    const homeUrl = `${miniAppUrl}/home`;

    // Кандидаты: активный paid_access (не истёк) + есть telegramId.
    const entitlements = await prisma.entitlement.findMany({
      where: {
        code: 'paid_access',
        active: true,
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        user: { telegramId: { not: '' } },
      },
      select: {
        userId: true,
        user: { select: { telegramId: true, firstName: true } },
      },
      take: BATCH_SIZE,
    });

    const userIds = entitlements.map((e) => e.userId);
    const result = { ...setupResult, morning: 0, evening: 0, skipped: 0, failed: 0 };
    if (userIds.length === 0) {
      return NextResponse.json({ success: true, mskHour, ...result });
    }

    // Настройки, прогресс плана и уже отправленные сегодня напоминания — тремя запросами.
    const [prefsRows, progressRows, sentToday] = await Promise.all([
      prisma.userPreferences.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, extra: true },
      }),
      prisma.planProgress.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, currentDay: true },
      }),
      prisma.botMessage.findMany({
        where: {
          userId: { in: userIds },
          messageType: { in: [MSG_TYPE_MORNING, MSG_TYPE_EVENING] },
          createdAt: { gte: mskDayStart },
        },
        select: { userId: true, messageType: true },
      }),
    ]);

    const prefsByUser = new Map(prefsRows.map((r) => [r.userId, parseCareReminderSettings(r.extra)]));
    const progressByUser = new Map(progressRows.map((r) => [r.userId, r.currentDay]));
    const sentSet = new Set(sentToday.map((r) => `${r.userId}:${r.messageType}`));

    for (const ent of entitlements) {
      const telegramId = ent.user?.telegramId;
      if (!telegramId) continue;

      const settings = prefsByUser.get(ent.userId) ?? parseCareReminderSettings(null);
      if (!settings.enabled) { result.skipped += 1; continue; }

      const slot =
        settings.morning === mskHour ? 'morning' :
        settings.evening === mskHour ? 'evening' : null;
      if (!slot) continue;

      const messageType = slot === 'morning' ? MSG_TYPE_MORNING : MSG_TYPE_EVENING;
      if (sentSet.has(`${ent.userId}:${messageType}`)) continue;

      const currentDay = progressByUser.get(ent.userId) ?? null;
      const clampedDay = currentDay && currentDay >= 1 && currentDay <= 28 ? currentDay : null;
      const text = slot === 'morning'
        ? morningText(ent.user?.firstName ?? null, clampedDay)
        : eveningText(ent.user?.firstName ?? null, clampedDay);

      const ok = await sendReminder(telegramId, text, homeUrl);
      if (!ok) { result.failed += 1; continue; }

      // Отметка «отправлено сегодня» — и заодно история сообщений бота.
      await prisma.botMessage.create({
        data: {
          userId: ent.userId,
          telegramId,
          chatId: telegramId,
          direction: 'outbound',
          messageType,
          content: text,
        },
      }).catch((e) => logger.warn('Care reminder: bot_message record failed', { userId: ent.userId, error: e }));

      result[slot] += 1;
    }

    logger.info('Care reminders cron finished', { mskHour, ...result });
    return NextResponse.json({ success: true, timestamp: now.toISOString(), mskHour, ...result });
  } catch (error: any) {
    logger.error('Care reminders cron error', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 },
    );
  }
}
