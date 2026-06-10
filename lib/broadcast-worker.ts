// lib/broadcast-worker.ts
// Логика обработки рассылок, вынесенная из app/api/admin/broadcasts/worker/route.ts,
// чтобы её можно было вызывать НАПРЯМУЮ (без HTTP self-subrequest).
// На Cloudflare Workers запрос воркера на собственный публичный хост падает с
// "error code: 522", поэтому /api/cron/broadcasts вызывает runBroadcastWorker()
// напрямую, а не через fetch на /api/admin/broadcasts/worker.

import { prisma } from '@/lib/db';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Подстановка плейсхолдеров в текст рассылки
function renderMessage(template: string, user: any, profile: any): string {
  let message = template;

  const userName = (user.firstName || user.username ? `@${user.username}` : 'друг').trim();
  const safeName = userName.length > 50 ? userName.substring(0, 50) : userName;
  message = message.replace(/{name}/g, safeName);

  if (profile?.skinType) {
    const skinTypeMap: Record<string, string> = {
      oily: 'жирная',
      dry: 'сухая',
      combo: 'комбинированная',
      sensitive: 'чувствительная',
      normal: 'нормальная',
    };
    const skinType = skinTypeMap[profile.skinType] || profile.skinType || 'не указан';
    message = message.replace(/{skinType}/g, skinType);
  } else {
    message = message.replace(/{skinType}/g, 'не указан');
  }

  if (profile?.medicalMarkers?.concerns && Array.isArray(profile.medicalMarkers.concerns)) {
    const concerns = profile.medicalMarkers.concerns;
    if (concerns.length > 0) {
      const concernMap: Record<string, string> = {
        acne: 'акне',
        pigmentation: 'пигментация',
        barrier: 'барьер',
        dehydration: 'обезвоженность',
        wrinkles: 'морщины',
        pores: 'поры',
        redness: 'покраснения',
      };
      const concern = concernMap[concerns[0]] || concerns[0] || 'не указано';
      message = message.replace(/{concern}/g, concern);
    } else {
      message = message.replace(/{concern}/g, 'не указано');
    }
  } else {
    message = message.replace(/{concern}/g, 'не указано');
  }

  message = message.replace(/{link}/g, 'https://t.me/skiniq_bot');

  return message;
}

// Отправка сообщения через Telegram Bot API
async function sendTelegramMessage(
  telegramId: string,
  text: string,
  imageBuffer?: Buffer,
  imageUrl?: string,
  buttons?: Array<{ text: string; url: string }>
): Promise<{ success: boolean; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  try {
    const replyMarkup = buttons && buttons.length > 0 ? {
      inline_keyboard: [buttons.map(btn => ({
        text: btn.text,
        url: btn.url
      }))]
    } : undefined;

    if (imageBuffer) {
      const form = new FormData();
      form.append('chat_id', telegramId);
      const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
      form.append('photo', blob, 'image.jpg');
      form.append('caption', text);
      form.append('parse_mode', 'HTML');
      if (replyMarkup) {
        form.append('reply_markup', JSON.stringify(replyMarkup));
      }

      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: form,
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        return { success: false, error: data.description || 'Unknown error' };
      }
      return { success: true };
    } else if (imageUrl) {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId,
          photo: imageUrl,
          caption: text,
          parse_mode: 'HTML',
          ...(replyMarkup && { reply_markup: replyMarkup }),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        return { success: false, error: data.description || 'Unknown error' };
      }
      return { success: true };
    } else {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId,
          text,
          parse_mode: 'HTML',
          ...(replyMarkup && { reply_markup: replyMarkup }),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        return { success: false, error: data.description || 'Unknown error' };
      }
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

// Получение пользователей по фильтрам
async function getUsersByFilters(filters: any) {
  const where: any = {};

  if ((filters.skinTypes && filters.skinTypes.length > 0) || (filters.concerns && filters.concerns.length > 0)) {
    const skinProfileConditions: any[] = [];

    if (filters.skinTypes && filters.skinTypes.length > 0) {
      skinProfileConditions.push({
        skinType: { in: filters.skinTypes },
      });
    }

    if (filters.concerns && filters.concerns.length > 0) {
      skinProfileConditions.push({
        OR: filters.concerns.map((concern: string) => ({
          notes: {
            contains: concern,
            mode: 'insensitive',
          },
        })),
      });
    }

    where.skinProfiles = {
      some: skinProfileConditions.length > 1 ? { AND: skinProfileConditions } : skinProfileConditions[0],
    };
  }

  if (filters.lastActive) {
    const now = new Date();
    if (filters.lastActive === '<7') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      where.lastActive = { gte: sevenDaysAgo };
    } else if (filters.lastActive === '7-30') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      where.lastActive = { gte: thirtyDaysAgo, lte: sevenDaysAgo };
    } else if (filters.lastActive === '30+') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      where.lastActive = { lte: thirtyDaysAgo };
    }
  }

  if (filters.hasPurchases) {
    where.tags = { has: 'bought_spf' };
  }

  if (filters.excludePregnant) {
    where.skinProfiles = {
      some: {
        hasPregnancy: false,
      },
    };
  }

  return await prisma.user.findMany({
    where,
    include: {
      skinProfiles: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

// ИСПРАВЛЕНО: Rate-limit для Telegram — 40ms задержка = ~25 msg/sec
const DELAY_MS = 40;
// Бюджет времени на ОДНУ инвокацию воркера. maxDuration функции = 60s, оставляем
// запас на финальные записи в БД. Если не успели — остаёмся в статусе 'sending'
// и продолжаем со следующего тика крона (resume по broadcast_logs).
const TIME_BUDGET_MS = 45_000;
// Как часто сбрасывать накопленные логи/счётчики в БД (меньше походов в БД).
const FLUSH_EVERY = 25;

// Обработка одной рассылки.
// ВОЗОБНОВЛЯЕМАЯ: за один вызов отправляет столько, сколько влезает в бюджет
// времени, помечая каждого получателя в broadcast_logs. Уже помеченные при
// повторном запуске пропускаются — это убирает дубли и «зависание» на больших
// аудиториях (раньше функция убивалась на 60s до перевода в 'completed', а
// следующий тик слал всё заново с первого пользователя).
async function processBroadcast(broadcast: any) {
  const startedAt = Date.now();
  try {
    // Получаем целевых пользователей по фильтрам
    const filters = (broadcast.filtersJson as any) || {};
    let users;

    if (filters.sendToAll) {
      users = await prisma.user.findMany({
        include: {
          skinProfiles: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
    } else {
      users = await getUsersByFilters(filters || {});
    }

    if (users.length === 0) {
      await prisma.broadcastMessage.update({
        where: { id: broadcast.id },
        data: { status: 'failed' },
      });
      return { success: false, error: 'No users found' };
    }

    // Кто уже обработан (resume + защита от дублей): берём userId из broadcast_logs
    const sentLogs = await prisma.broadcastLog.findMany({
      where: { broadcastId: broadcast.id },
      select: { userId: true },
    });
    const alreadyProcessed = new Set(sentLogs.map((l) => l.userId));
    const remaining = users.filter((u) => !alreadyProcessed.has(u.id));

    // Переводим в 'sending' (например, из 'scheduled') один раз
    if (broadcast.status !== 'sending') {
      await prisma.broadcastMessage.update({
        where: { id: broadcast.id },
        data: { status: 'sending' },
      });
    }

    // Всё уже отправлено ранее — просто закрываем
    if (remaining.length === 0) {
      await prisma.broadcastMessage.update({
        where: { id: broadcast.id },
        data: { status: 'completed', sentAt: new Date() },
      });
      return { success: true, processed: 0, completed: true };
    }

    const message = broadcast.message as string;
    const buttons = broadcast.buttonsJson as Array<{ text: string; url: string }> | null;
    const imageUrl = broadcast.imageUrl as string | null;

    // Буферы для батч-записи
    let pendingLogs: Array<{
      broadcastId: string;
      userId: string;
      telegramId: string;
      status: string;
      errorMessage: string | null;
    }> = [];
    let sentDelta = 0;
    let failedDelta = 0;
    let processedNow = 0;
    let timedOut = false;

    const flush = async () => {
      if (pendingLogs.length > 0) {
        await prisma.broadcastLog.createMany({ data: pendingLogs });
        pendingLogs = [];
      }
      if (sentDelta > 0 || failedDelta > 0) {
        await prisma.broadcastMessage.update({
          where: { id: broadcast.id },
          data: {
            sentCount: { increment: sentDelta },
            failedCount: { increment: failedDelta },
          },
        });
        sentDelta = 0;
        failedDelta = 0;
      }
    };

    for (const user of remaining) {
      // Бюджет времени исчерпан — выходим, продолжим со следующего тика крона
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        timedOut = true;
        break;
      }

      const profile = user.skinProfiles[0] || null;
      const renderedMessage = renderMessage(message, user, profile);

      let result: { success: boolean; error?: string };
      try {
        result = await sendTelegramMessage(
          user.telegramId,
          renderedMessage,
          undefined,
          imageUrl || undefined,
          buttons || undefined
        );
      } catch (error: any) {
        console.error(`Error sending to user ${user.id}:`, error);
        result = { success: false, error: error?.message || 'Network error' };
      }

      pendingLogs.push({
        broadcastId: broadcast.id,
        userId: user.id,
        telegramId: user.telegramId,
        status: result.success ? 'sent' : 'failed',
        errorMessage: result.error || null,
      });
      if (result.success) sentDelta++;
      else failedDelta++;
      processedNow++;

      if (pendingLogs.length >= FLUSH_EVERY) {
        await flush();
      }

      // Rate-limit между сообщениями
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }

    // Финальный сброс буферов
    await flush();

    const totalProcessed = alreadyProcessed.size + processedNow;
    const allDone = !timedOut && totalProcessed >= users.length;

    if (allDone) {
      await prisma.broadcastMessage.update({
        where: { id: broadcast.id },
        data: { status: 'completed', sentAt: new Date() },
      });
      return { success: true, processed: processedNow, completed: true };
    }

    // Не успели в окне — остаёмся в 'sending', продолжим со следующего тика
    return {
      success: true,
      processed: processedNow,
      completed: false,
      remaining: users.length - totalProcessed,
    };
  } catch (error: any) {
    console.error('Error processing broadcast:', error);
    await prisma.broadcastMessage
      .update({
        where: { id: broadcast.id },
        data: { status: 'failed' },
      })
      .catch((updateError) => {
        console.error('Error updating broadcast status to failed:', updateError);
      });
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export interface BroadcastWorkerResult {
  success: boolean;
  processed: number;
  results?: Array<{ broadcastId: string; success: boolean; processed?: number; error?: string }>;
  message?: string;
  error?: string;
}

// Находит готовые к отправке рассылки (scheduled с наступившим временем + sending)
// и обрабатывает их. Вызывается и из HTTP-роута воркера, и из cron-роута напрямую.
export async function runBroadcastWorker(): Promise<BroadcastWorkerResult> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, processed: 0, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  const now = new Date();

  // За один тик обрабатываем РОВНО ОДНУ рассылку (бюджет времени внутри
  // processBroadcast не даёт превысить лимит функции). Приоритет — уже идущей
  // 'sending' рассылке (дослать остаток), иначе берём ближайшую назревшую
  // 'scheduled'. Большие рассылки доедут за несколько тиков крона без дублей.
  let broadcast = await prisma.broadcastMessage.findFirst({
    where: { status: 'sending' },
    orderBy: { createdAt: 'asc' },
  });

  if (!broadcast) {
    broadcast = await prisma.broadcastMessage.findFirst({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  if (!broadcast) {
    return { success: true, processed: 0, message: 'No broadcasts to process' };
  }

  const result = await processBroadcast(broadcast);

  return {
    success: true,
    processed: 1,
    results: [{ broadcastId: broadcast.id, ...result }],
  };
}
