// app/api/admin/broadcast/process-scheduled/route.ts
// Обработка запланированных рассылок

export const runtime = 'nodejs'; // Required for Buffer and FormData

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const cookieToken = request.cookies.get('admin_token')?.value;
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;
    
    if (!token) return false;
    
    try {
      jwt.verify(token, JWT_SECRET);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

// Функция отправки сообщения (копия из send/route.ts)
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
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
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

// Рендеринг сообщения с переменными
function renderMessage(template: string, user: any, profile: any): string {
  let message = template;
  
  if (user.firstName) {
    message = message.replace(/{name}/g, user.firstName);
  } else if (user.username) {
    message = message.replace(/{name}/g, `@${user.username}`);
  } else {
    message = message.replace(/{name}/g, 'друг');
  }
  
  if (profile?.skinType) {
    const skinTypeMap: Record<string, string> = {
      oily: 'жирная',
      dry: 'сухая',
      combo: 'комбинированная',
      sensitive: 'чувствительная',
      normal: 'нормальная',
    };
    message = message.replace(/{skinType}/g, skinTypeMap[profile.skinType] || profile.skinType);
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
      message = message.replace(/{concern}/g, concernMap[concerns[0]] || concerns[0]);
    }
  }
  
  message = message.replace(/{link}/g, 'https://t.me/skiniq_bot');
  
  return message;
}

export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации (опционально, можно использовать секретный ключ для cron)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Если есть CRON_SECRET, проверяем его
      const isAdmin = await verifyAdmin(request);
      if (!isAdmin && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN not configured' },
        { status: 500 }
      );
    }

    // Находим все запланированные рассылки, которые должны быть отправлены
    const now = new Date();
    const scheduledBroadcasts = await prisma.broadcastMessage.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: {
          lte: now, // Время отправки наступило или прошло
        },
      },
      include: {
        logs: {
          take: 1, // Берем один лог для проверки, отправлялась ли уже
        },
      },
    });

    // Фильтруем только те, которые еще не начали отправляться
    const broadcastsToProcess = scheduledBroadcasts.filter(b => b.logs.length === 0);

    if (broadcastsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'Нет рассылок для обработки',
      });
    }

    let totalProcessed = 0;

    for (const broadcast of broadcastsToProcess) {
      try {
        // Обновляем статус на "sending"
        await prisma.broadcastMessage.update({
          where: { id: broadcast.id },
          data: { status: 'sending' },
        });

        // Получаем фильтры и пользователей (логика из send/route.ts)
        const filters = broadcast.filtersJson as any;
        let users;

        if (filters?.sendToAll) {
          users = await prisma.user.findMany({
            include: {
              skinProfiles: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          });
        } else {
          // Используем ту же логику фильтрации, что и в send/route.ts
          const where: any = {};

          if ((filters?.skinTypes && filters.skinTypes.length > 0) || (filters?.concerns && filters.concerns.length > 0)) {
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

          if (filters?.lastActive) {
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

          if (filters?.hasPurchases) {
            where.tags = { has: 'bought_spf' };
          }

          users = await prisma.user.findMany({
            where,
            include: {
              skinProfiles: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          });
        }

        // Получаем кнопки и изображение из broadcast
        const buttons = broadcast.buttonsJson ? (broadcast.buttonsJson as any) : undefined;
        const imageUrl = broadcast.imageUrl || undefined;

        // Запускаем отправку в фоне
        (async () => {
          const RANDOM_DELAY_MIN = 50;
          const RANDOM_DELAY_MAX = 100;

          let sentCount = 0;
          let failedCount = 0;

          for (const user of users) {
            try {
              const profile = user.skinProfiles[0] || null;
              const renderedMessage = renderMessage(broadcast.message, user, profile);
              
              const result = await sendTelegramMessage(user.telegramId, renderedMessage, undefined, imageUrl, buttons);
              
              await prisma.broadcastLog.create({
                data: {
                  broadcastId: broadcast.id,
                  userId: user.id,
                  telegramId: user.telegramId,
                  status: result.success ? 'sent' : 'failed',
                  errorMessage: result.error || null,
                },
              });

              if (result.success) {
                sentCount++;
              } else {
                failedCount++;
              }

              if ((sentCount + failedCount) % 10 === 0) {
                await prisma.broadcastMessage.update({
                  where: { id: broadcast.id },
                  data: {
                    sentCount,
                    failedCount,
                  },
                });
              }

              const randomDelay = Math.random() * (RANDOM_DELAY_MAX - RANDOM_DELAY_MIN) + RANDOM_DELAY_MIN;
              await new Promise(resolve => setTimeout(resolve, randomDelay));
            } catch (error: any) {
              console.error(`Error sending to user ${user.id}:`, error);
              failedCount++;
            }
          }

          await prisma.broadcastMessage.update({
            where: { id: broadcast.id },
            data: {
              status: 'completed',
              sentCount,
              failedCount,
              sentAt: new Date(),
            },
          });
        })();

        totalProcessed++;
      } catch (error: any) {
        console.error(`Error processing broadcast ${broadcast.id}:`, error);
        await prisma.broadcastMessage.update({
          where: { id: broadcast.id },
          data: {
            status: 'sending',
            failedCount: broadcast.failedCount + 1,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      message: `Обработано рассылок: ${totalProcessed}`,
    });
  } catch (error: any) {
    console.error('Error processing scheduled broadcasts:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

