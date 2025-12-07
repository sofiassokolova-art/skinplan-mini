// lib/get-user-from-initdata.ts
// Утилита для получения userId из Telegram initData

import { validateTelegramInitData } from './telegram';
import { prisma } from './db';

/**
 * Извлекает userId из initData и создает/обновляет пользователя
 * Возвращает userId для использования в запросах
 */
export async function getUserIdFromInitData(initData: string | null): Promise<string | null> {
  if (!initData) {
    console.warn('⚠️ getUserIdFromInitData: initData is null or empty');
    return null;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('❌ getUserIdFromInitData: Bot token not configured');
    return null;
  }

  // Валидируем данные Telegram
  let validation;
  try {
    validation = validateTelegramInitData(initData, botToken);
  } catch (validationError: any) {
    console.error('❌ getUserIdFromInitData: Error validating initData:', {
      error: validationError?.message,
      stack: validationError?.stack,
      initDataLength: initData.length,
      initDataPrefix: initData.substring(0, 50),
    });
    return null;
  }
  
  if (!validation.valid || !validation.data?.user) {
    console.error('❌ getUserIdFromInitData: Invalid initData:', {
      validationError: validation.error,
      hasData: !!validation.data,
      hasUser: !!validation.data?.user,
      initDataLength: initData.length,
    });
    return null;
  }

  const { user } = validation.data;
  
  // Создаем или обновляем пользователя
  try {
    const now = new Date();
    const dbUser = await prisma.user.upsert({
      where: { telegramId: user.id.toString() },
      update: {
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        language: user.language_code || 'ru',
        lastActive: now, // Обновляем lastActive при каждом запросе
        updatedAt: now,
      },
      create: {
        telegramId: user.id.toString(),
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        language: user.language_code || 'ru',
        lastActive: now, // Устанавливаем lastActive при создании
      },
    });

    return dbUser.id;
  } catch (dbError: any) {
    // Детальное логирование ошибок БД
    console.error('❌ getUserIdFromInitData: Database error:', {
      error: dbError?.message,
      code: dbError?.code,
      meta: dbError?.meta,
      stack: dbError?.stack,
      telegramId: user.id.toString(),
      hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
    });
    // Возвращаем null вместо выброса ошибки, чтобы API мог обработать это корректно
    return null;
  }
}

