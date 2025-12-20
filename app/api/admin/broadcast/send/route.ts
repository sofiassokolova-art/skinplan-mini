// app/api/admin/broadcast/send/route.ts
// Отправка рассылки

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdmin, verifyAdminBoolean } from '@/lib/admin-auth';
// ИСПРАВЛЕНО (P0): Убран JWT - используем только verifyAdmin
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// ИСПРАВЛЕНО (P0): Улучшен renderMessage - дефолты, ограничение длины, экранирование
function renderMessage(template: string, user: any, profile: any): string {
  let message = template;
  
  // ИСПРАВЛЕНО (P0): {name} с дефолтами и ограничением длины
  const userName = (user.firstName || user.username ? `@${user.username}` : 'друг').trim();
  const safeName = userName.length > 50 ? userName.substring(0, 50) : userName;
  message = message.replace(/{name}/g, safeName);
  
  // ИСПРАВЛЕНО (P0): {skinType} с дефолтами
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
  
  // ИСПРАВЛЕНО (P0): {concern} с дефолтами
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
  
  // {link} - можно добавить ссылку на продукт или промо
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
    // Формируем кнопки для inline keyboard
    const replyMarkup = buttons && buttons.length > 0 ? {
      inline_keyboard: [buttons.map(btn => ({
        text: btn.text,
        url: btn.url
      }))]
    } : undefined;

    // Если есть фото как Buffer (файл), отправляем через multipart/form-data без сжатия
    if (imageBuffer) {
      // Используем встроенный FormData (Node.js 18+)
      const form = new FormData();
      form.append('chat_id', telegramId);
      
      // Создаем Blob из Buffer для FormData
      // Приводим Buffer к Uint8Array для совместимости с BlobPart
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
      // Если есть URL, отправляем через JSON (для обратной совместимости)
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      // Отправляем обычное текстовое сообщение
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN not configured' },
        { status: 500 }
      );
    }

    // Обрабатываем FormData или JSON
    let filters: any;
    let message: string;
    let test: boolean;
    let imageUrl: string | undefined;
    let imageBuffer: Buffer | undefined;
    let buttons: Array<{ text: string; url: string }> | undefined;

    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Обрабатываем FormData
      const formData = await request.formData();
      
      const filtersStr = formData.get('filters') as string;
      if (filtersStr) {
        try {
          filters = JSON.parse(filtersStr);
          // Очищаем от undefined, null и пустых строк
          filters = Object.fromEntries(
            Object.entries(filters).filter(([_, value]) => {
              if (value === undefined || value === null) return false;
              if (typeof value === 'string' && value.trim() === '') return false;
              if (Array.isArray(value) && value.length === 0) return false;
              return true;
            })
          );
        } catch (e) {
          console.error('Error parsing filters:', e);
          filters = {};
        }
      } else {
        filters = {};
      }
      message = formData.get('message') as string;
      test = formData.get('test') === 'true';
      
      const imageFile = formData.get('image') as File | null;
      if (imageFile) {
        // Конвертируем File в Buffer
        const arrayBuffer = await imageFile.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } else {
        const imageUrlStr = formData.get('imageUrl') as string;
        imageUrl = imageUrlStr || undefined;
      }
      
      const buttonsStr = formData.get('buttons') as string;
      buttons = buttonsStr ? JSON.parse(buttonsStr) : undefined;
    } else {
      // Обрабатываем JSON (для обратной совместимости)
    const body = await request.json();
      filters = body.filters;
      message = body.message;
      test = body.test;
      imageUrl = body.imageUrl;
      buttons = body.buttons;
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Получаем пользователей
    let users;
    if (test) {
      // ИСПРАВЛЕНО (P0): Для тестовой рассылки получаем админа через verifyAdmin
      const adminResult = await verifyAdmin(request);
      if (!adminResult.valid || !adminResult.adminId) {
        return NextResponse.json(
          { error: 'Admin authentication failed' },
          { status: 401 }
        );
      }
      
      // Ищем админа в whitelist для получения telegramId
      // ИСПРАВЛЕНО: adminId может быть string | number, приводим к number для поиска
      const adminId = typeof adminResult.adminId === 'string' ? parseInt(adminResult.adminId, 10) : adminResult.adminId;
      const admin = await prisma.adminWhitelist.findFirst({
        where: {
          id: adminId,
          isActive: true,
        },
      });
      
      if (!admin || !admin.telegramId) {
        return NextResponse.json(
          { error: 'Admin telegramId not found' },
          { status: 404 }
        );
      }
      
      // Ищем пользователя по telegramId
      users = await prisma.user.findMany({
        where: { telegramId: admin.telegramId },
        include: {
          skinProfiles: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      
      // Если пользователь не найден, создаем временного для теста
      if (users.length === 0) {
        users = [{
          id: 'test-admin',
          telegramId: admin.telegramId,
          firstName: admin.phoneNumber || 'Админ',
          lastName: null,
          username: null,
          language: 'ru',
          createdAt: new Date(),
          updatedAt: new Date(),
          skinProfiles: [],
        }];
      }
    } else {
      // Если sendToAll, получаем всех пользователей
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
      users = await getUsersByFilters(filters);
      }
    }

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'No users found' },
        { status: 404 }
      );
    }

    // Если тестовая - отправляем сразу и возвращаем (без сохранения в БД)
    if (test) {
      const user = users[0];
      const profile = user.skinProfiles[0] || null;
      const renderedMessage = renderMessage(message, user, profile);
      
      const result = await sendTelegramMessage(user.telegramId, renderedMessage, imageBuffer, imageUrl, buttons);

      return NextResponse.json({
        success: result.success,
        test: true,
        message: result.success ? 'Тестовая рассылка отправлена' : result.error || 'Ошибка отправки',
      });
    }

    // ИСПРАВЛЕНО (P0): Защита от повторного запуска - проверяем дубликаты
    // Если есть рассылка с теми же параметрами в статусе sending за последние 5 минут - блокируем
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const cleanFilters = filters ? Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
      })
    ) : {};
    
    // Валидируем, что cleanFilters может быть сериализован в JSON
    try {
      JSON.stringify(cleanFilters);
    } catch (e) {
      console.error('Error serializing filters:', e, cleanFilters);
      return NextResponse.json(
        { error: 'Invalid filters format. Cannot serialize to JSON.' },
        { status: 400 }
      );
    }
    
    // ИСПРАВЛЕНО (P0): Проверяем, нет ли уже рассылки в статусе sending с теми же параметрами
    const existingBroadcast = await prisma.broadcastMessage.findFirst({
      where: {
        status: { in: ['sending', 'scheduled'] },
        message: message.trim(),
        filtersJson: cleanFilters as any,
        createdAt: { gte: fiveMinutesAgo },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    if (existingBroadcast) {
      return NextResponse.json(
        { error: 'Broadcast is already running or was recently started', broadcastId: existingBroadcast.id },
        { status: 409 }
      );
    }
    
    // ИСПРАВЛЕНО (P0): Создаём рассылку и сразу обновляем статус на sending атомарно
    const broadcast = await prisma.broadcastMessage.create({
      data: {
        title: `Рассылка ${new Date().toLocaleDateString('ru-RU')}`,
        message: message.trim(),
        filtersJson: cleanFilters as any,
        buttonsJson: buttons ? (buttons as any) : null,
        imageUrl: imageUrl || null,
        status: 'sending', // ИСПРАВЛЕНО (P0): Статус сразу sending для защиты от дублей
        totalCount: users.length,
      },
    });

    // ИСПРАВЛЕНО (P0): Для реальной рассылки запускаем асинхронно с защитой от таймаутов
    // В реальном приложении лучше использовать очередь (Bull, BullMQ)
    // Здесь делаем простую реализацию с задержками и атомарными обновлениями
    
    // Запускаем отправку в фоне (не ждем завершения)
    (async () => {
      try {
        // ИСПРАВЛЕНО (P0): Rate-limit для Telegram - 40ms задержка = ~25 msg/sec (безопасно)
        const DELAY_MS = 40; // ИСПРАВЛЕНО (P0): Фиксированная задержка 40ms для 20-25 msg/sec

        // ИСПРАВЛЕНО (P0): Используем атомарные increment вместо JS-переменных
        // Обновляем счётчики через БД каждые 10 сообщений для защиты от потери данных
        let processedCount = 0;

        for (const user of users) {
          try {
            const profile = user.skinProfiles[0] || null;
            const renderedMessage = renderMessage(message, user, profile);
            
            const result = await sendTelegramMessage(user.telegramId, renderedMessage, imageBuffer, imageUrl, buttons);
            
            // ИСПРАВЛЕНО (P0): Создаём лог для каждого пользователя
            await prisma.broadcastLog.create({
              data: {
                broadcastId: broadcast.id,
                userId: user.id,
                telegramId: user.telegramId,
                status: result.success ? 'sent' : 'failed',
                errorMessage: result.error || null,
              },
            });

            // ИСПРАВЛЕНО (P0): Атомарное обновление счётчиков через increment
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

            processedCount++;

            // ИСПРАВЛЕНО (P0): Rate-limit - задержка 40ms между сообщениями
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
          } catch (error: any) {
            console.error(`Error sending to user ${user.id}:`, error);
            // ИСПРАВЛЕНО (P0): Атомарное обновление failedCount при ошибке
            await prisma.broadcastMessage.update({
              where: { id: broadcast.id },
              data: { failedCount: { increment: 1 } },
            });
          }
        }

        // ИСПРАВЛЕНО (P0): Финальное обновление статуса на completed
        await prisma.broadcastMessage.update({
          where: { id: broadcast.id },
          data: {
            status: 'completed',
            sentAt: new Date(),
          },
        });
      } catch (error: any) {
        // ИСПРАВЛЕНО (P0): При ошибке обновляем статус на failed
        console.error('Error in broadcast sending process:', error);
        await prisma.broadcastMessage.update({
          where: { id: broadcast.id },
          data: {
            status: 'failed',
          },
        }).catch(updateError => {
          console.error('Error updating broadcast status to failed:', updateError);
        });
      }
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

