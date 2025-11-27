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
    console.log('🔐 validateTelegramInitData - начало');
    console.log('   initDataRaw длина:', initDataRaw?.length || 0);
    console.log('   botToken присутствует:', !!botToken);
    
    // Парсим initData
    const urlParams = new URLSearchParams(initDataRaw);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    console.log('   hash присутствует:', !!hash);
    console.log('   параметры:', Array.from(urlParams.keys()));

    if (!hash) {
      console.log('❌ Missing hash');
      return { valid: false, error: 'Missing hash' };
    }

    // Сортируем параметры и создаем строку для проверки
    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    console.log('   dataCheckString длина:', dataCheckString.length);
    console.log('   dataCheckString первые 100 символов:', dataCheckString.substring(0, 100));

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

    console.log('   calculatedHash:', calculatedHash.substring(0, 20) + '...');
    console.log('   receivedHash:', hash.substring(0, 20) + '...');
    console.log('   hash совпадает:', calculatedHash === hash);

    // Проверяем подпись
    if (calculatedHash !== hash) {
      console.log('❌ Invalid hash - не совпадает');
      return { valid: false, error: 'Invalid hash' };
    }
    
    console.log('✅ Hash валиден');

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
