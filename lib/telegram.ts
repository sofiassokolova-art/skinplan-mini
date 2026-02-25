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

    // ИСПРАВЛЕНО: Безопасность - НЕ логируем initData полностью
    // Логируем только hash prefix и длину для отладки
    // SECURITY: initData содержит чувствительные данные (user info, auth_date, hash)
    // Никогда не логируем полный initData - только hash prefix для идентификации
    const hashMatch = initDataRaw.match(/hash=([^&]+)/);
    const hashPrefix = hashMatch ? hashMatch[1].substring(0, 8) : 'no-hash';
    const userIdMatch = initDataRaw.match(/user=%7B%22id%22%3A(\d+)/) || initDataRaw.match(/user=\{"id":(\d+)/);
    const telegramId = userIdMatch ? userIdMatch[1] : 'unknown';
    
    // Логируем только безопасные данные: hash prefix, telegramId, длина
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Validating initData', {
        hashPrefix,
        telegramId,
        length: initDataRaw.length,
        // SECURITY: НЕ логируем полный initData
      });
    }

    // Парсим initDataRaw вручную, чтобы сохранить оригинальные значения
    // initData может прийти как URL-encoded строка или уже декодированная
    const params: Map<string, string> = new Map();
    let hash: string | null = null;
    
    // Разбиваем на пары key=value
    const parts = initDataRaw.split('&');
    for (const part of parts) {
      const equalIndex = part.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = part.substring(0, equalIndex);
      const value = part.substring(equalIndex + 1);
      
      if (key === 'hash') {
        hash = value;
      } else if (key) {
        // Сохраняем значение как есть (может быть URL-encoded)
        params.set(key, value);
      }
    }

    if (!hash) {
      console.error('❌ Missing hash in initData');
      return { valid: false, error: 'Missing hash' };
    }

    // Сортируем параметры по ключу и создаем строку для проверки
    // Важно: используем оригинальные значения (как они пришли)
    const sortedKeys = Array.from(params.keys()).sort();
    
    // Пробуем несколько вариантов:
    // 1. Оригинальные значения (как пришли)
    const dataCheckString = sortedKeys
      .map(key => `${key}=${params.get(key)}`)
      .join('\n');

    // Создаем секретный ключ: HMAC-SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Вычисляем hash: HMAC-SHA256(secretKey, dataCheckString)
    let calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Проверяем подпись: вариант 1 — raw значения (как пришли)
    if (calculatedHash !== hash) {
      // Вариант 2: декодированные значения (initData может прийти URL-encoded)
      const dataCheckStringDecoded = sortedKeys
        .map(key => {
          const value = params.get(key) || '';
          try {
            return `${key}=${decodeURIComponent(value)}`;
          } catch {
            return `${key}=${value}`;
          }
        })
        .join('\n');

      const calculatedHashDecoded = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckStringDecoded)
        .digest('hex');

      if (calculatedHashDecoded === hash) {
        calculatedHash = calculatedHashDecoded;
      } else {
        console.error('❌ Hash validation failed:', {
          receivedHash: hash,
          paramsCount: params.size,
          sortedKeys: sortedKeys.slice(0, 5),
        });
        return { valid: false, error: 'Invalid hash' };
      }
    }

    // Парсим данные для использования (здесь можно декодировать)
    let authDate = 0;
    let userData: any = null;
    
    for (const [key, value] of params.entries()) {
      if (key === 'auth_date') {
        authDate = parseInt(value) || 0;
      } else if (key === 'user') {
        try {
          // Пробуем декодировать и распарсить JSON
          const decoded = decodeURIComponent(value);
          userData = JSON.parse(decoded);
        } catch (e) {
          // Если не получается декодировать, пробуем как есть
          try {
            userData = JSON.parse(value);
          } catch (e2) {
            console.warn('Failed to parse user data:', e2);
          }
        }
      }
    }

    // Проверяем время (не старше 24 часов)
    const now = Math.floor(Date.now() / 1000);
    if (authDate > 0 && now - authDate > 86400) {
      return { valid: false, error: 'Data expired' };
    }

    const data: TelegramInitData = {
      auth_date: authDate,
      hash: hash,
    };

    if (userData) {
      data.user = userData;
    }

    return { valid: true, data };
  } catch (error) {
    console.error('Error validating initData:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
