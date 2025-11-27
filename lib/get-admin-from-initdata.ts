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
  console.log('📥 getAdminFromInitData вызвана');
  console.log('   initData присутствует:', !!initData);
  
  if (!initData) {
    console.log('❌ initData отсутствует');
    return { valid: false, error: 'No initData provided' };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('❌ Bot token not configured');
    return { valid: false, error: 'Bot token not configured' };
  }
  console.log('✅ Bot token найден');

  // Валидируем данные Telegram
  console.log('🔍 Валидация initData...');
  const validation = validateTelegramInitData(initData, botToken);
  console.log('🔍 Результат валидации:', {
    valid: validation.valid,
    hasData: !!validation.data,
    hasUser: !!validation.data?.user,
    error: validation.error,
  });
  
  if (!validation.valid || !validation.data?.user) {
    console.error('❌ Invalid initData:', validation.error);
    return { valid: false, error: validation.error || 'Invalid initData' };
  }
  console.log('✅ initData валиден, user найден');

  const { user } = validation.data;
  const telegramIdStr = user.id.toString();
  
  // Логируем для отладки
  console.log('🔍 Проверка whitelist для:', {
    telegramId: telegramIdStr,
    telegramIdType: typeof user.id,
    telegramIdStr: telegramIdStr,
    username: user.username,
    firstName: user.first_name,
  });

  // Проверяем whitelist по telegramId (как строке)
  // Также пробуем найти все записи для отладки
  const allAdmins = await prisma.adminWhitelist.findMany({
    where: { isActive: true },
  });
  console.log('🔍 Все активные админы в whitelist:', allAdmins.map(a => ({
    id: a.id,
    telegramId: a.telegramId,
    phoneNumber: a.phoneNumber,
    name: a.name,
  })));

  const whitelistEntry = await prisma.adminWhitelist.findFirst({
    where: {
      OR: [
        { telegramId: telegramIdStr },
        // Также проверяем числовое сравнение на всякий случай
        { telegramId: String(user.id) },
      ],
      isActive: true,
    },
  });

  console.log('🔍 Результат поиска в whitelist:', {
    found: !!whitelistEntry,
    searchedFor: telegramIdStr,
    entry: whitelistEntry ? {
      id: whitelistEntry.id,
      telegramId: whitelistEntry.telegramId,
      phoneNumber: whitelistEntry.phoneNumber,
      name: whitelistEntry.name,
      isActive: whitelistEntry.isActive,
    } : null,
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
