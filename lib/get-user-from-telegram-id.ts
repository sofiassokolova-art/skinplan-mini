// lib/get-user-from-telegram-id.ts
// Утилита для получения userId из Telegram ID (из сообщений бота)

import { prisma } from '@/lib/db';

/**
 * Получает userId из telegramId и создает/обновляет пользователя
 * Используется в webhook для сохранения сообщений
 */
export async function getUserIdFromTelegramId(telegramId: number, userData?: {
  firstName?: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
}): Promise<string | null> {
  if (!telegramId) {
    return null;
  }

  try {
    // Создаем или обновляем пользователя
    const now = new Date();
    const dbUser = await prisma.user.upsert({
      where: { telegramId: telegramId.toString() },
      // ВАЖНО: ограничиваем select, чтобы не падать при рассинхроне схемы БД
      select: { id: true },
      update: {
        ...(userData?.firstName && { firstName: userData.firstName }),
        ...(userData?.lastName && { lastName: userData.lastName }),
        ...(userData?.username && { username: userData.username }),
        ...(userData?.languageCode && { language: userData.languageCode }),
        lastActive: now, // Обновляем lastActive при каждом запросе
        updatedAt: now,
      },
      create: {
        telegramId: telegramId.toString(),
        firstName: userData?.firstName || null,
        lastName: userData?.lastName || null,
        username: userData?.username || null,
        language: userData?.languageCode || 'ru',
        lastActive: now, // Устанавливаем lastActive при создании
      },
    });

    return dbUser.id;
  } catch (error) {
    console.error('Error getting userId from telegramId:', error);
    return null;
  }
}

