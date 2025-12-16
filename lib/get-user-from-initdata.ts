// lib/get-user-from-initdata.ts
// Утилита для получения userId из Telegram initData
// ИСПРАВЛЕНО: Использует единый слой валидации validateTelegramInitDataUnified

import { validateTelegramInitDataUnified } from './telegram-validation';
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

  // ИСПРАВЛЕНО: Используем единый слой валидации
  const validation = await validateTelegramInitDataUnified(initData);
  
  if (!validation.valid || !validation.telegramId || !validation.payload?.user) {
    return null;
  }

  const { user } = validation.payload;
  const telegramIdStr = user.id.toString();

  // ВАЖНО: auth-слой не должен писать в БД.
  // Здесь только маппинг telegramId -> userId (если уже создан).
  try {
    const existing = await prisma.user.findUnique({
      where: { telegramId: telegramIdStr },
      select: { id: true },
    });
    return existing?.id || null;
  } catch (dbError: any) {
    console.error('❌ getUserIdFromInitData: Database error (should not be treated as auth error):', {
      error: dbError?.message,
      code: dbError?.code,
      meta: dbError?.meta,
      telegramId: telegramIdStr,
    });
    return null;
  }
}

