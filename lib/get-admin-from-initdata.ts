// lib/get-admin-from-initdata.ts
// Утилита для проверки, является ли пользователь админом по Telegram данным

import { validateTelegramInitData } from './telegram';
import { prisma } from './db';

/**
 * Проверяет, является ли пользователь админом по Telegram initData
 * Возвращает данные админа или null
 */
export async function getAdminFromInitData(initData: string | null): Promise<{
  id: number;
  telegramId: string;
  telegramUsername?: string | null;
  role: string;
} | null> {
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
  
  // Ищем админа по telegramId или telegramUsername
  const admin = await prisma.admin.findFirst({
    where: {
      OR: [
        { telegramId: user.id.toString() },
        { telegramUsername: user.username || undefined },
      ],
    },
  });

  if (!admin) {
    console.log(`User ${user.id} (${user.username}) is not in admin whitelist`);
    return null;
  }

  // Обновляем данные админа из Telegram (если изменились)
  if (admin.telegramId !== user.id.toString() || admin.telegramUsername !== user.username) {
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        telegramId: user.id.toString(),
        telegramUsername: user.username || null,
      },
    });
  }

  return {
    id: admin.id,
    telegramId: admin.telegramId || user.id.toString(),
    telegramUsername: admin.telegramUsername,
    role: admin.role,
  };
}

