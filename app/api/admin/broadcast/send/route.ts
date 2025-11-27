// app/api/admin/broadcast/send/route.ts
// Отправка рассылки

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

// Рендеринг сообщения с переменными
function renderMessage(template: string, user: any, profile: any): string {
  let message = template;
  
  // {name}
  if (user.firstName) {
    message = message.replace(/{name}/g, user.firstName);
  } else if (user.username) {
    message = message.replace(/{name}/g, `@${user.username}`);
  } else {
    message = message.replace(/{name}/g, 'друг');
  }
  
  // {skinType}
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
  
  // {concern}
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
  
  // {link} - можно добавить ссылку на продукт или промо
  message = message.replace(/{link}/g, 'https://t.me/skiniq_bot');
  
  return message;
}

// Отправка сообщения через Telegram Bot API
async function sendTelegramMessage(telegramId: string, text: string): Promise<{ success: boolean; error?: string }> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: telegramId,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      return { success: false, error: data.description || 'Unknown error' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

// Получение пользователей по фильтрам (та же логика, что в count)
async function getUsersByFilters(filters: any) {
  const where: any = {};

  // Фильтр по типу кожи и проблемам (из последнего профиля)
  if ((filters.skinTypes && filters.skinTypes.length > 0) || (filters.concerns && filters.concerns.length > 0)) {
    const skinProfileConditions: any[] = [];
    
    if (filters.skinTypes && filters.skinTypes.length > 0) {
      skinProfileConditions.push({
        skinType: { in: filters.skinTypes },
      });
    }
    
    if (filters.concerns && filters.concerns.length > 0) {
      // Фильтруем по notes (упрощенная фильтрация)
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

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { filters, message, test } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Получаем пользователей
    let users;
    if (test) {
      // Для тестовой рассылки получаем админа из токена
      const cookieToken = request.cookies.get('admin_token')?.value;
      const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
      const token = cookieToken || headerToken;
      const decoded = jwt.decode(token) as any;
      
      // Находим админа по telegramId из whitelist
      const adminWhitelist = await prisma.adminWhitelist.findFirst({
        where: { isActive: true },
      });
      
      if (!adminWhitelist?.telegramId) {
        return NextResponse.json(
          { error: 'Admin not found for test' },
          { status: 404 }
        );
      }
      
      const adminTelegramId = adminWhitelist.telegramId;
      if (!adminTelegramId) {
        return NextResponse.json(
          { error: 'Admin telegramId not found' },
          { status: 404 }
        );
      }
      
      users = await prisma.user.findMany({
        where: { telegramId: adminTelegramId },
        include: {
          skinProfiles: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
    } else {
      users = await getUsersByFilters(filters);
    }

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'No users found' },
        { status: 404 }
      );
    }

    // Создаем запись о рассылке
    const broadcast = await prisma.broadcastMessage.create({
      data: {
        title: test ? 'Тестовая рассылка' : `Рассылка ${new Date().toLocaleDateString('ru-RU')}`,
        message,
        filtersJson: filters || {},
        status: test ? 'completed' : 'sending',
        totalCount: users.length,
      },
    });

    // Если тестовая - отправляем сразу и возвращаем
    if (test) {
      const user = users[0];
      const profile = user.skinProfiles[0] || null;
      const renderedMessage = renderMessage(message, user, profile);
      
      const result = await sendTelegramMessage(user.telegramId, renderedMessage);
      
      await prisma.broadcastLog.create({
        data: {
          broadcastId: broadcast.id,
          userId: user.id,
          telegramId: user.telegramId,
          status: result.success ? 'sent' : 'failed',
          errorMessage: result.error || null,
        },
      });

      await prisma.broadcastMessage.update({
        where: { id: broadcast.id },
        data: {
          sentCount: result.success ? 1 : 0,
          failedCount: result.success ? 0 : 1,
        },
      });

      return NextResponse.json({
        success: true,
        broadcastId: broadcast.id,
        test: true,
      });
    }

    // Для реальной рассылки запускаем асинхронно
    // В реальном приложении лучше использовать очередь (Bull, BullMQ)
    // Здесь делаем простую реализацию с задержками
    
    // Запускаем отправку в фоне (не ждем завершения)
    (async () => {
      const MESSAGES_PER_SECOND = 30;
      const DELAY_MS = 1000 / MESSAGES_PER_SECOND; // ~33ms между сообщениями
      const RANDOM_DELAY_MIN = 800;
      const RANDOM_DELAY_MAX = 1500;

      let sentCount = 0;
      let failedCount = 0;

      for (const user of users) {
        try {
          const profile = user.skinProfiles[0] || null;
          const renderedMessage = renderMessage(message, user, profile);
          
          const result = await sendTelegramMessage(user.telegramId, renderedMessage);
          
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

          // Обновляем счетчики каждые 10 сообщений
          if ((sentCount + failedCount) % 10 === 0) {
            await prisma.broadcastMessage.update({
              where: { id: broadcast.id },
              data: {
                sentCount,
                failedCount,
              },
            });
          }

          // Задержка между сообщениями (рандомная для анти-бана)
          const randomDelay = Math.random() * (RANDOM_DELAY_MAX - RANDOM_DELAY_MIN) + RANDOM_DELAY_MIN;
          await new Promise(resolve => setTimeout(resolve, randomDelay));
        } catch (error: any) {
          console.error(`Error sending to user ${user.id}:`, error);
          failedCount++;
        }
      }

      // Финальное обновление
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

    return NextResponse.json({
      success: true,
      broadcastId: broadcast.id,
      totalCount: users.length,
      message: 'Broadcast started',
    });
  } catch (error: any) {
    console.error('Error sending broadcast:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

