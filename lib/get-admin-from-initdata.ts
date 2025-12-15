// lib/get-admin-from-initdata.ts
// Утилита для получения админа из Telegram initData с проверкой whitelist
// ИСПРАВЛЕНО: Использует единый слой валидации validateTelegramInitDataUnified

import { validateTelegramInitDataUnified, assertAdmin } from './telegram-validation';

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
  // ИСПРАВЛЕНО: Используем единый слой валидации
  const validation = await validateTelegramInitDataUnified(initData);
  
  if (!validation.valid || !validation.telegramId) {
    return { valid: false, error: validation.error || 'Invalid initData' };
  }

  // ИСПРАВЛЕНО: Проверяем, является ли пользователь админом через assertAdmin
  const adminCheck = await assertAdmin(validation.telegramId);
  
  if (!adminCheck.valid || !adminCheck.admin) {
    return { valid: false, error: adminCheck.error || 'Not in admin whitelist' };
  }

  // Возвращаем данные админа
  return {
    valid: true,
    admin: adminCheck.admin as AdminUser,
  };
}
