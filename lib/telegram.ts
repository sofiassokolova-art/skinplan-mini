// lib/telegram.ts
// Утилиты для валидации Telegram WebApp initData

import crypto from 'crypto';

interface TelegramInitData {
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  auth_date: number;
  hash: string;
}

/**
 * Валидирует подпись Telegram WebApp initData
 * @param initDataRaw - Сырые данные из window.Telegram.WebApp.initData
 * @param botToken - Токен Telegram бота
 */
export function validateTelegramInitData(
  initDataRaw: string,
  botToken: string
): { valid: boolean; data?: TelegramInitData; error?: string } {
  try {
    // Проверяем, что initData не пустой
    if (!initDataRaw || !initDataRaw.trim()) {
      return { valid: false, error: 'Empty initData' };
    }

    // Парсим initData (может быть уже URL-encoded или нет)
    let urlParams: URLSearchParams;
    try {
      // Пробуем парсить как есть
      urlParams = new URLSearchParams(initDataRaw);
    } catch (e) {
      // Если не получается, пробуем декодировать
      try {
        urlParams = new URLSearchParams(decodeURIComponent(initDataRaw));
      } catch (e2) {
        return { valid: false, error: 'Invalid initData format' };
      }
    }

    const hash = urlParams.get('hash');
    if (!hash) {
      return { valid: false, error: 'Missing hash' };
    }

    // Сортируем параметры и создаем строку для проверки
    // Важно: для проверки hash нужно использовать оригинальные значения из initDataRaw
    // (как они пришли от Telegram, без декодирования)
    // Парсим initDataRaw вручную, чтобы сохранить оригинальные URL-encoded значения
    const pairs: Array<[string, string]> = [];
    const parts = initDataRaw.split('&');
    for (const part of parts) {
      const equalIndex = part.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = part.substring(0, equalIndex);
      const value = part.substring(equalIndex + 1);
      
      if (key && key !== 'hash') {
        pairs.push([key, value]);
      }
    }

    // Сортируем по ключу и создаем строку для проверки
    // Используем оригинальные значения (URL-encoded)
    pairs.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = pairs
      .map(([key, value]) => `${key}=${value}`)
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
    if (calculatedHash !== hash) {
      console.error('Hash validation failed:', {
        calculatedHash,
        receivedHash: hash,
        dataCheckStringLength: dataCheckString.length,
        botTokenLength: botToken.length,
        hasBotToken: !!botToken,
      });
      return { valid: false, error: 'Invalid hash' };
    }

    // Проверяем время (не старше 24 часов)
    const authDate = parseInt(urlParams.get('auth_date') || '0');
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      return { valid: false, error: 'Data expired' };
    }

    // Парсим данные пользователя
    const userStr = urlParams.get('user');
    const data: TelegramInitData = {
      auth_date: authDate,
      hash: hash,
    };

    if (userStr) {
      data.user = JSON.parse(decodeURIComponent(userStr));
    }

    return { valid: true, data };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
