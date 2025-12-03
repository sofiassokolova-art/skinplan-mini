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
    return null;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('Bot token not configured');
    return null;
  }

  // Валидируем данные Telegram
  const validation = validateTelegramInitData(initData, botToken);
  
  if (!validation.valid || !validation.data?.user) {
    console.error('Invalid initData:', validation.error);
    return null;
  }

  const { user } = validation.data;
  
  // Создаем или обновляем пользователя
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
}

