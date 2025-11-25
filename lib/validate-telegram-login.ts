// lib/validate-telegram-login.ts
// Валидация данных от Telegram Login Widget

import crypto from 'crypto';

interface TelegramLoginData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Валидирует данные от Telegram Login Widget
 * @param data - Объект с данными от виджета
 * @param botToken - Токен Telegram бота
 */
export function validateTelegramLoginWidget(
  data: TelegramLoginData,
  botToken: string
): { valid: boolean; user?: TelegramLoginData['id'] | null; error?: string } {
  try {
    // Проверяем время (не старше 24 часов)
    const now = Math.floor(Date.now() / 1000);
    if (now - data.auth_date > 86400) {
      return { valid: false, error: 'Data expired' };
    }

    // Создаем строку для проверки
    const dataCheckString = Object.keys(data)
      .filter(key => key !== 'hash')
      .sort()
      .map(key => `${key}=${data[key as keyof TelegramLoginData]}`)
      .join('\n');

    // Создаем секретный ключ
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Вычисляем hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Проверяем подпись
    if (calculatedHash !== data.hash) {
      return { valid: false, error: 'Invalid hash' };
    }

    return { valid: true, user: data.id };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

