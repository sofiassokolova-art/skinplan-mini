// app/api/cron/funnel-nudges/route.ts
// Догоняющие сообщения для верха воронки (до первой оплаты):
//   1) начал анкету, но не закончил        → тег nudge_quiz_unfinished_sent
//   2) заполнил анкету, не оплатил ~1 день  → тег nudge_unpaid_d1_sent
//   3) заполнил анкету, не оплатил ~3 дня   → тег nudge_unpaid_d3_sent
// Каждое сообщение шлётся ОДИН раз (отметка тегом после успешной отправки).
//
// Дёргается внешним планировщиком (GitHub Actions) с Bearer CRON_SECRET — раз в
// несколько часов (см. .github/workflows/cron-broadcasts.yml).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { timingSafeEqual } from '@/lib/timing-safe';

export const dynamic = 'force-dynamic';

const HOUR = 60 * 60 * 1000;

// Задержки до отправки (от последнего действия / момента завершения анкеты).
const QUIZ_UNFINISHED_AFTER_HOURS = 6;   // «завис» в анкете
const UNPAID_D1_AFTER_HOURS = 24;        // не оплатил в течение дня
const UNPAID_D3_AFTER_HOURS = 72;        // не оплатил в течение трёх дней

// Не догоняем слишком старые «висяки» (чтобы при первом запуске не разослать всей
// исторической базе разом).
const MAX_AGE_DAYS = 14;
const BATCH_SIZE = 200;

const TAG_QUIZ_UNFINISHED = 'nudge_quiz_unfinished_sent';
const TAG_UNPAID_D1 = 'nudge_unpaid_d1_sent';
const TAG_UNPAID_D3 = 'nudge_unpaid_d3_sent';

function verifyCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const provided = searchParams.get('secret') || authHeader?.replace('Bearer ', '') || '';
  return Boolean(provided) && timingSafeEqual(provided, cronSecret);
}

async function sendBotMessage(
  telegramId: string,
  text: string,
  button: { text: string; url: string },
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
          inline_keyboard: [[{ text: button.text, web_app: { url: button.url } }]],
        },
      }),
    });
    return res.ok;
  } catch (e) {
    logger.warn('Funnel nudge send failed', { telegramId, error: e });
    return false;
  }
}

/** Помечает пользователя тегом (один раз). */
async function tagUser(userId: string, tag: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tags: true } });
  const tags = u?.tags ?? [];
  if (!tags.includes(tag)) {
    await prisma.user.update({ where: { id: userId }, data: { tags: { push: tag } } });
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyCron(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    const maxAgeFloor = new Date(now - MAX_AGE_DAYS * 24 * HOUR);
    const miniAppUrl = process.env.NEXT_PUBLIC_MINI_APP_URL || 'https://www.proskiniq.ru';

    const result = { quizUnfinished: 0, unpaidD1: 0, unpaidD3: 0, failed: 0 };

    // ── 1) Начал анкету, но не закончил ───────────────────────────────────────
    // Есть прогресс по анкете, нет завершённого сабмишена, активности не было
    // QUIZ_UNFINISHED_AFTER_HOURS часов, и ещё не догоняли.
    const unfinished = await prisma.questionnaireProgress.findMany({
      where: {
        updatedAt: { lt: new Date(now - QUIZ_UNFINISHED_AFTER_HOURS * HOUR), gt: maxAgeFloor },
        user: {
          questionnaireSubmissions: { none: { status: 'completed' } },
          NOT: { tags: { has: TAG_QUIZ_UNFINISHED } },
        },
      },
      select: { userId: true, user: { select: { telegramId: true } } },
      take: BATCH_SIZE,
    });

    for (const row of unfinished) {
      const telegramId = row.user?.telegramId;
      if (!telegramId) continue;
      const ok = await sendBotMessage(
        telegramId,
        '✏️ Вы начали подбор ухода, но не закончили анкету.\n\n' +
          'Осталось совсем немного — ответьте на пару вопросов, и мы соберём ваш ' +
          'персональный план ухода за кожей.',
        { text: 'Продолжить анкету', url: `${miniAppUrl}/quiz` },
      );
      if (!ok) { result.failed += 1; continue; }
      await tagUser(row.userId, TAG_QUIZ_UNFINISHED).catch((e) =>
        logger.warn('Funnel: tag quiz_unfinished failed', { userId: row.userId, error: e }),
      );
      result.quizUnfinished += 1;
    }

    // ── 2) и 3) Заполнил анкету, но не оплатил первый план ────────────────────
    // Источник момента завершения — QuestionnaireSubmission(completed).createdAt.
    // «Не оплатил» = у пользователя нет entitlement paid_access (первая покупка
    // ещё не совершалась). Продление/win-back истёкших — отдельный крон.
    const sendUnpaidBatch = async (
      tag: string,
      window: { afterHours: number; beforeHours?: number },
    ): Promise<number> => {
      // createdAt в полосе [now-afterHours .. now-beforeHours] — окна d1 и d3 не
      // пересекаются, поэтому при опоздании крона юзер не получит оба сообщения разом.
      const createdAt: { lt: Date; gt: Date } = {
        lt: new Date(now - window.afterHours * HOUR),
        gt: window.beforeHours ? new Date(now - window.beforeHours * HOUR) : maxAgeFloor,
      };
      const submissions = await prisma.questionnaireSubmission.findMany({
        where: {
          status: 'completed',
          createdAt,
          user: {
            entitlements: { none: { code: 'paid_access' } },
            NOT: { tags: { has: tag } },
          },
        },
        select: { userId: true, user: { select: { telegramId: true } } },
        take: BATCH_SIZE,
      });

      const isD3 = tag === TAG_UNPAID_D3;
      const text = isD3
        ? '🌿 Ваш персональный план ухода всё ещё ждёт вас.\n\n' +
          'Это пошаговые рекомендации на 28 дней, подобранные под вашу кожу. ' +
          'Откройте приложение, чтобы получить полный доступ и начать уже сегодня.'
        : '✨ Ваш персональный план ухода готов!\n\n' +
          '28 дней пошагового ухода, подобранного именно под вашу кожу. ' +
          'Откройте приложение, чтобы посмотреть план и получить доступ.';

      let sent = 0;
      for (const s of submissions) {
        const telegramId = s.user?.telegramId;
        if (!telegramId) continue;
        const ok = await sendBotMessage(telegramId, text, {
          text: 'Открыть план',
          url: `${miniAppUrl}/plan`,
        });
        if (!ok) { result.failed += 1; continue; }
        await tagUser(s.userId, tag).catch((e) =>
          logger.warn('Funnel: tag unpaid failed', { userId: s.userId, tag, error: e }),
        );
        sent += 1;
      }
      return sent;
    };

    // d1 — полоса [24ч..72ч), d3 — [72ч..MAX_AGE]. Окна не пересекаются.
    result.unpaidD1 = await sendUnpaidBatch(TAG_UNPAID_D1, {
      afterHours: UNPAID_D1_AFTER_HOURS,
      beforeHours: UNPAID_D3_AFTER_HOURS,
    });
    result.unpaidD3 = await sendUnpaidBatch(TAG_UNPAID_D3, { afterHours: UNPAID_D3_AFTER_HOURS });

    logger.info('Funnel nudges cron finished', result);

    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...result });
  } catch (error: any) {
    logger.error('Funnel nudges cron error', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 },
    );
  }
}
