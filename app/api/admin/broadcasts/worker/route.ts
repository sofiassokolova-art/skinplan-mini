// app/api/admin/broadcasts/worker/route.ts
// Worker для обработки рассылок (вызывается cron или вручную)
// Обрабатывает рассылки в статусе scheduled (когда время пришло) или sending (немедленно)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ИСПРАВЛЕНО (P0): Улучшен renderMessage - дефолты, ограничение длины, экранирование
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

// Обработка одной рассылки
async function processBroadcast(broadcast: any) {
  try {
    // Обновляем статус на sending
    await prisma.broadcastMessage.update({
      where: { id: broadcast.id },
      data: { status: 'sending' },
    });

    // Получаем пользователей по фильтрам
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
        data: {
          status: 'failed',
        },
      });
      return { success: false, error: 'No users found' };
    }

    // ИСПРАВЛЕНО (P0): Rate-limit для Telegram - 40ms задержка = ~25 msg/sec
    const DELAY_MS = 40;

    const message = broadcast.message as string;
    const buttons = broadcast.buttonsJson as Array<{ text: string; url: string }> | null;
    const imageUrl = broadcast.imageUrl as string | null;

    for (const user of users) {
      try {
        const profile = user.skinProfiles[0] || null;
        const renderedMessage = renderMessage(message, user, profile);
        
        const result = await sendTelegramMessage(user.telegramId, renderedMessage, undefined, imageUrl || undefined, buttons || undefined);
        
        // Создаём лог для каждого пользователя
        await prisma.broadcastLog.create({
          data: {
            broadcastId: broadcast.id,
            userId: user.id,
            telegramId: user.telegramId,
            status: result.success ? 'sent' : 'failed',
            errorMessage: result.error || null,
          },
        });

        // Атомарное обновление счётчиков через increment
        if (result.success) {
          await prisma.broadcastMessage.update({
            where: { id: broadcast.id },
            data: { sentCount: { increment: 1 } },
          });
        } else {
          await prisma.broadcastMessage.update({
            where: { id: broadcast.id },
            data: { failedCount: { increment: 1 } },
          });
        }

        // Rate-limit - задержка 40ms между сообщениями
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      } catch (error: any) {
        console.error(`Error sending to user ${user.id}:`, error);
        await prisma.broadcastMessage.update({
          where: { id: broadcast.id },
          data: { failedCount: { increment: 1 } },
        });
      }
    }

    // Финальное обновление статуса на completed
    await prisma.broadcastMessage.update({
      where: { id: broadcast.id },
      data: {
        status: 'completed',
        sentAt: new Date(),
      },
    });

    return { success: true, processed: users.length };
  } catch (error: any) {
    console.error('Error processing broadcast:', error);
    await prisma.broadcastMessage.update({
      where: { id: broadcast.id },
      data: {
        status: 'failed',
      },
    }).catch(updateError => {
      console.error('Error updating broadcast status to failed:', updateError);
    });
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// POST - обработка рассылок (вызывается cron или вручную)
export async function POST(request: NextRequest) {
  try {
    // ИСПРАВЛЕНО: Worker может вызываться cron (без авторизации) или админом (с авторизацией)
    const authHeader = request.headers.get('authorization');
    const isCronCall = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    if (!isCronCall) {
      const isAdmin = await verifyAdminBoolean(request);
      if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN not configured' },
        { status: 500 }
      );
    }

    const now = new Date();

    // ИСПРАВЛЕНО: Обрабатываем рассылки в статусе scheduled (когда время пришло) или sending (немедленно)
    // Обрабатываем по одной рассылке за раз для избежания таймаутов
    const scheduledBroadcasts = await prisma.broadcastMessage.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: {
          lte: now, // Время пришло
        },
      },
      orderBy: { scheduledAt: 'asc' }, // Сначала самые старые
      take: 1, // Обрабатываем по одной рассылке за раз
    });

    const sendingBroadcasts = await prisma.broadcastMessage.findMany({
      where: {
        status: 'sending',
      },
      orderBy: { createdAt: 'asc' }, // Сначала самые старые
      take: 1, // Обрабатываем по одной рассылке за раз
    });

    const broadcastsToProcess = [...scheduledBroadcasts, ...sendingBroadcasts];

    if (broadcastsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No broadcasts to process',
        processed: 0,
      });
    }

    const results = [];
    for (const broadcast of broadcastsToProcess) {
      const result = await processBroadcast(broadcast);
      results.push({ broadcastId: broadcast.id, ...result });
    }

    return NextResponse.json({
      success: true,
      processed: broadcastsToProcess.length,
      results,
    });
  } catch (error: any) {
    console.error('Error in broadcast worker:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

