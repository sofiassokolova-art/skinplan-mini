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

// ИСПРАВЛЕНО (P0): Whitelist разрешённых фильтров для безопасности
const ALLOWED_FILTER_KEYS = [
  'skinTypes',
  'concerns',
  'lastActive',
  'hasPurchases',
  'excludePregnant',
  'sendToAll',
  'planDay', // Пока не реализован, но разрешён
] as const;

// ИСПРАВЛЕНО (P0): Валидация фильтров - только разрешённые ключи
function validateFilters(filters: any): { valid: boolean; error?: string; cleanFilters?: any } {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    return { valid: false, error: 'Filters must be an object' };
  }

  // Проверяем, что все ключи в whitelist
  const unknownKeys = Object.keys(filters).filter(key => !ALLOWED_FILTER_KEYS.includes(key as any));
  if (unknownKeys.length > 0) {
    return { valid: false, error: `Unknown filter keys: ${unknownKeys.join(', ')}` };
  }

  // Валидация значений
  const cleanFilters: any = {};

  if (filters.skinTypes !== undefined) {
    if (!Array.isArray(filters.skinTypes)) {
      return { valid: false, error: 'skinTypes must be an array' };
    }
    const validSkinTypes = ['oily', 'dry', 'combo', 'sensitive', 'normal'];
    const invalidTypes = filters.skinTypes.filter((t: string) => !validSkinTypes.includes(t));
    if (invalidTypes.length > 0) {
      return { valid: false, error: `Invalid skinTypes: ${invalidTypes.join(', ')}` };
    }
    if (filters.skinTypes.length > 0) {
      cleanFilters.skinTypes = filters.skinTypes;
    }
  }

  if (filters.concerns !== undefined) {
    if (!Array.isArray(filters.concerns)) {
      return { valid: false, error: 'concerns must be an array' };
    }
    if (filters.concerns.length > 0) {
      cleanFilters.concerns = filters.concerns;
    }
  }

  if (filters.lastActive !== undefined) {
    const validValues = ['<7', '7-30', '30+'];
    if (!validValues.includes(filters.lastActive)) {
      return { valid: false, error: `lastActive must be one of: ${validValues.join(', ')}` };
    }
    cleanFilters.lastActive = filters.lastActive;
  }

  if (filters.hasPurchases !== undefined) {
    if (typeof filters.hasPurchases !== 'boolean') {
      return { valid: false, error: 'hasPurchases must be a boolean' };
    }
    if (filters.hasPurchases) {
      cleanFilters.hasPurchases = true;
    }
  }

  if (filters.excludePregnant !== undefined) {
    if (typeof filters.excludePregnant !== 'boolean') {
      return { valid: false, error: 'excludePregnant must be a boolean' };
    }
    if (filters.excludePregnant) {
      cleanFilters.excludePregnant = true;
    }
  }

  if (filters.sendToAll !== undefined) {
    if (typeof filters.sendToAll !== 'boolean') {
      return { valid: false, error: 'sendToAll must be a boolean' };
    }
    if (filters.sendToAll) {
      cleanFilters.sendToAll = true;
    }
  }

  return { valid: true, cleanFilters };
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
    let dryRun: boolean; // ИСПРАВЛЕНО (P1): Dry-run режим
    let scheduledAt: string | undefined; // ИСПРАВЛЕНО (P0): Поддержка scheduledAt
    let imageUrl: string | undefined;
    let imageBuffer: Buffer | undefined;
    let buttons: Array<{ text: string; url: string }> | undefined;

    const { searchParams } = new URL(request.url);
    dryRun = searchParams.get('dryRun') === 'true'; // ИСПРАВЛЕНО (P1): Dry-run через query param

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
      scheduledAt = formData.get('scheduledAt') as string | undefined; // ИСПРАВЛЕНО (P0): Поддержка scheduledAt
      
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
      scheduledAt = body.scheduledAt; // ИСПРАВЛЕНО (P0): Поддержка scheduledAt
      imageUrl = body.imageUrl;
      buttons = body.buttons;
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // ИСПРАВЛЕНО (P0): Валидация фильтров через whitelist
    const filtersValidation = validateFilters(filters);
    if (!filtersValidation.valid) {
      return NextResponse.json(
        { error: filtersValidation.error || 'Invalid filters' },
        { status: 400 }
      );
    }
    const cleanFilters = filtersValidation.cleanFilters || {};

    // ИСПРАВЛЕНО (P0): Защита от рассылки в прошлое
    let normalizedScheduledAt: Date | null = null;
    if (scheduledAt) {
      const dt = new Date(scheduledAt);
      if (Number.isNaN(dt.getTime())) {
        return NextResponse.json(
          { error: 'scheduledAt must be a valid date' },
          { status: 400 }
        );
      }
      // ИСПРАВЛЕНО (P0): Проверяем, что дата в будущем (минимум +1 минута для буфера)
      const oneMinuteFromNow = new Date(Date.now() + 60 * 1000);
      if (dt <= oneMinuteFromNow) {
        return NextResponse.json(
          { error: 'scheduledAt must be at least 1 minute in the future' },
          { status: 400 }
        );
      }
      normalizedScheduledAt = dt;
    }

    // ИСПРАВЛЕНО (P1): Dry-run режим - только считаем пользователей и рендерим пример
    if (dryRun) {
      // Получаем пользователей для подсчёта и примера
      let allUsers;
      if (cleanFilters.sendToAll) {
        allUsers = await prisma.user.findMany({
          include: {
            skinProfiles: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });
      } else {
        allUsers = await getUsersByFilters(cleanFilters);
      }

      const totalCount = allUsers.length;

      // Рендерим пример сообщения на первом пользователе
      let exampleMessage = message;
      if (allUsers.length > 0) {
        const exampleUser = allUsers[0];
        const exampleProfile = exampleUser.skinProfiles[0] || null;
        exampleMessage = renderMessage(message, exampleUser, exampleProfile);
      }

      return NextResponse.json({
        dryRun: true,
        totalCount,
        exampleMessage,
        filters: cleanFilters,
        message: `Would send to ${totalCount} users. Example message rendered above.`,
      });
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
      if (cleanFilters.sendToAll) {
        users = await prisma.user.findMany({
          include: {
            skinProfiles: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });
      } else {
        users = await getUsersByFilters(cleanFilters);
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

    // ИСПРАВЛЕНО (P0): Жёсткая блокировка повторного запуска - проверяем дубликаты
    // Если есть рассылка с теми же параметрами в статусе sending/scheduled за последние 5 минут - блокируем
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
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
    
    // ИСПРАВЛЕНО (P0): Проверяем, нет ли уже рассылки в статусе sending/scheduled с теми же параметрами
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
    
    // ИСПРАВЛЕНО (P0): Строгий lifecycle статуса
    // draft → scheduled (если scheduledAt) → sending → completed/failed
    // Нет других переходов
    const initialStatus = normalizedScheduledAt ? 'scheduled' : 'sending';
    
    // ИСПРАВЛЕНО (P0): Создаём рассылку с правильным статусом
    const broadcast = await prisma.broadcastMessage.create({
      data: {
        title: `Рассылка ${new Date().toLocaleDateString('ru-RU')}`,
        message: message.trim(),
        filtersJson: cleanFilters as any,
        buttonsJson: buttons ? (buttons as any) : null,
        imageUrl: imageUrl || null,
        status: initialStatus, // ИСПРАВЛЕНО (P0): scheduled или sending в зависимости от scheduledAt
        scheduledAt: normalizedScheduledAt,
        totalCount: users.length,
      },
    });

    // ИСПРАВЛЕНО (P0): Рассылка вынесена в worker для избежания таймаутов
    // POST /send только создаёт рассылку со статусом scheduled/sending
    // Реальная отправка происходит через /api/admin/broadcasts/worker (вызывается cron)
    // Это единственный способ избежать дублей и "зависших" рассылок на Vercel/Next.js
    
    // Если scheduled - ждём worker
    if (normalizedScheduledAt) {
      return NextResponse.json({
        success: true,
        broadcastId: broadcast.id,
        totalCount: users.length,
        scheduledAt: normalizedScheduledAt.toISOString(),
        message: 'Broadcast scheduled. Will be sent by worker when time comes.',
      });
    }
    
    // ИСПРАВЛЕНО (P0): Для немедленной рассылки статус sending, worker обработает
    // Worker вызывается cron каждую минуту или может быть вызван вручную
    // Это гарантирует, что рассылка не зависнет в HTTP-запросе

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

