// lib/get-admin-from-initdata.ts
// Утилита для получения админа из Telegram initData с проверкой whitelist

import { validateTelegramInitData } from './telegram';
import { prisma } from './db';

interface AdminUser {
  id: string;
  telegramId: string;
  phoneNumber: string;
  role: string;
}

/**
 * Извлекает данные админа из initData и проверяет whitelist
 * Возвращает данные админа если он в whitelist
 */
export async function getAdminFromInitData(
  initData: string | null
): Promise<{ valid: boolean; admin?: AdminUser; error?: string }> {
  if (!initData) {
    return { valid: false, error: 'No initData provided' };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('Bot token not configured');
    return { valid: false, error: 'Bot token not configured' };
  }

  // Валидируем данные Telegram
  const validation = validateTelegramInitData(initData, botToken);

  if (!validation.valid || !validation.data?.user) {
    console.error('Invalid initData:', validation.error);
    return { valid: false, error: validation.error || 'Invalid initData' };
  }

  const { user } = validation.data;

  // Проверяем whitelist по telegramId
  const whitelistEntry = await prisma.adminWhitelist.findFirst({
    where: {
      OR: [
        { telegramId: user.id.toString() },
        // Также можно проверить по phone_number если он есть в initData
      ],
      isActive: true,
    },
  });

  if (!whitelistEntry) {
    return { valid: false, error: 'Not in admin whitelist' };
  }

  // Возвращаем данные из whitelist
  return {
    valid: true,
    admin: {
      id: whitelistEntry.id.toString(),
      telegramId: whitelistEntry.telegramId || user.id.toString(),
      phoneNumber: whitelistEntry.phoneNumber || '',
      role: whitelistEntry.role || 'admin',
    },
  };
}
