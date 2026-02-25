// lib/telegram-validation.ts
// ИСПРАВЛЕНО: Единый слой валидации Telegram initData
// Возвращает нормализованный результат: {telegramId, isAdmin, payload}
// Hash validation выполняется строго один раз

import { validateTelegramInitData } from './telegram';
import { prisma } from '@/lib/db';
import { logger } from './logger';

export interface TelegramValidationResult {
  valid: boolean;
  telegramId?: string;
  isAdmin?: boolean;
  payload?: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    auth_date: number;
    hash: string;
  };
  error?: string;
}

/**
 * ИСПРАВЛЕНО: Единая валидация Telegram initData
 * Выполняет hash validation строго один раз
 * Возвращает нормализованный результат с telegramId и isAdmin флагом
 * 
 * SECURITY: initData НЕ логируется полностью, только hashPrefix и telegramId
 */
export async function validateTelegramInitDataUnified(
  initData: string | null
): Promise<TelegramValidationResult> {
  if (!initData || !initData.trim()) {
    return { valid: false, error: 'No initData provided' };
  }

  // ИСПРАВЛЕНО: В development режиме обходим валидацию hash для тестового initData
  // Проверяем ДО проверки botToken, чтобы не требовать токен для тестового initData
  if (process.env.NODE_ENV === 'development' && initData.includes('test_hash_for_development_only')) {
    // Извлекаем telegramId из тестового initData
    // Пробуем несколько вариантов парсинга
    const userIdMatch = initData.match(/user=%7B%22id%22%3A(\d+)/) || 
                        initData.match(/user=\{"id":(\d+)/) ||
                        initData.match(/user=%7B%22id%22%3A(\d+)/) ||
                        decodeURIComponent(initData).match(/user=\{"id":(\d+)/);
    const telegramId = userIdMatch ? userIdMatch[1] : null;
    
    if (telegramId) {
      logger.info('Using test Telegram initData in development mode', { telegramId, initDataLength: initData.length });
      return {
        valid: true,
        telegramId,
        payload: {
          user: {
            id: parseInt(telegramId, 10),
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser',
            language_code: 'ru',
          },
          auth_date: Math.floor(Date.now() / 1000),
        } as any,
      };
    } else {
      logger.warn('Test initData detected but telegramId not found', { 
        initDataLength: initData.length,
        initDataPreview: initData.substring(0, 100) 
      });
    }
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { valid: false, error: 'Bot token not configured' };
  }

  // ИСПРАВЛЕНО: Hash validation выполняется строго один раз в validateTelegramInitData
  const validation = validateTelegramInitData(initData, botToken);

  if (!validation.valid || !validation.data?.user) {
    // SECURITY: Логируем только безопасные данные
    const hashMatch = initData.match(/hash=([^&]+)/);
    const hashPrefix = hashMatch ? hashMatch[1].substring(0, 8) : 'no-hash';
    logger.warn('Invalid Telegram initData', {
      error: validation.error,
      hashPrefix,
      // SECURITY: НЕ логируем полный initData
    });
    return { valid: false, error: validation.error || 'Invalid initData' };
  }

  const { user } = validation.data;
  const telegramId = user.id.toString();

  // ВАЖНО: validateTelegramInitDataUnified — это слой AUTH (HMAC), без обращения к БД.
  // Проверка админа/whitelist делается отдельно через assertAdmin().

  // SECURITY: Логируем только безопасные данные
  const hashMatch = initData.match(/hash=([^&]+)/);
  const hashPrefix = hashMatch ? hashMatch[1].substring(0, 8) : 'no-hash';
  logger.info('Telegram initData validated successfully', {
    telegramId,
    hashPrefix,
    // SECURITY: НЕ логируем полный initData
  });

  return {
    valid: true,
    telegramId,
    payload: validation.data,
  };
}

/**
 * Получает userId из telegramId (для обычных пользователей)
 * ИСПРАВЛЕНО: Использует единый слой валидации
 */
export async function getUserFromTelegramId(telegramId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });
    return user?.id || null;
  } catch (error: any) {
    logger.error('Error getting user from telegramId', error, { telegramId });
    return null;
  }
}

/**
 * Проверяет, является ли пользователь админом
 * ИСПРАВЛЕНО: Использует единый слой валидации
 */
export async function assertAdmin(telegramId: string): Promise<{ valid: boolean; admin?: any; error?: string }> {
  try {
    const whitelistEntry = await prisma.adminWhitelist.findFirst({
      where: {
        OR: [
          { telegramId },
          { telegramId: String(telegramId) },
        ],
        isActive: true,
      },
    });

    if (!whitelistEntry) {
      return { valid: false, error: 'Not in admin whitelist' };
    }

    return {
      valid: true,
      admin: {
        id: whitelistEntry.id.toString(),
        telegramId: whitelistEntry.telegramId || telegramId,
        phoneNumber: whitelistEntry.phoneNumber || '',
        role: whitelistEntry.role || 'admin',
      },
    };
  } catch (error: any) {
    logger.error('Error asserting admin', error, { telegramId });
    return { valid: false, error: error?.message || 'Error checking admin status' };
  }
}

