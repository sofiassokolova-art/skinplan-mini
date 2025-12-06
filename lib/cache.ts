// lib/cache.ts
// Кэширование для плана и рекомендаций

import { getRedis } from './redis';

let kv: any = null;
let kvAvailable = false;
let isUpstashRedis = false;

// Пытаемся инициализировать кэш: сначала Upstash Redis, потом Vercel KV
try {
  // Приоритет 1: Upstash Redis (если настроен)
  const upstashRedis = getRedis();
  if (upstashRedis) {
    kv = upstashRedis;
    kvAvailable = true;
    isUpstashRedis = true;
    console.log('✅ Using Upstash Redis for cache');
  } 
  // Приоритет 2: Vercel KV (если Upstash не настроен, но есть Vercel KV)
  else if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const kvModule = require('@vercel/kv');
    kv = kvModule.kv;
    kvAvailable = true;
    isUpstashRedis = false;
    console.log('✅ Using Vercel KV for cache');
  } else {
    console.warn('⚠️ Cache not available: missing environment variables (UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN)');
  }
} catch (error) {
  console.warn('⚠️ Cache not available:', error);
  kvAvailable = false;
}

const CACHE_TTL = {
  plan: 7 * 24 * 60 * 60, // 7 дней для плана (план не должен часто меняться)
  recommendations: 30 * 60, // 30 минут для рекомендаций
};

/**
 * Helper функция для установки значения с TTL
 * Работает как с Upstash Redis, так и с Vercel KV
 */
async function setWithTTL(key: string, value: string, ttl: number): Promise<void> {
  if (isUpstashRedis) {
    // Upstash Redis использует set(key, value, { ex: seconds })
    await kv.set(key, value, { ex: ttl });
  } else {
    // Vercel KV использует setex(key, seconds, value)
    await kv.setex(key, ttl, value);
  }
}

/**
 * Получить кэшированный план
 */
export async function getCachedPlan(
  userId: string,
  profileVersion: number
): Promise<any | null> {
  if (!kvAvailable || !kv) {
    return null; // Кеш недоступен, возвращаем null
  }
  
  try {
    const key = `plan:${userId}:${profileVersion}`;
    const cached = await kv.get(key);
    if (!cached) {
      return null;
    }
    
    // Если это уже объект (не строка), возвращаем как есть
    if (typeof cached === 'object' && cached !== null) {
      return cached;
    }
    
    // Если это строка, пытаемся парсить JSON
    if (typeof cached === 'string') {
      // Проверяем, не является ли это строкой "[object Object]" (невалидный JSON)
      if (cached === '[object Object]' || cached.trim() === '[object Object]') {
        console.warn('Invalid cached plan data (object stringified incorrectly), removing from cache', { userId, profileVersion });
        // Удаляем невалидные данные из кэша
        try {
          await kv.del(key);
        } catch (delError) {
          // Игнорируем ошибки удаления
        }
        return null;
      }
      
      try {
        return JSON.parse(cached);
      } catch (parseError) {
        console.error('Error parsing cached plan JSON:', parseError, 'Raw value type:', typeof cached, 'Raw value length:', cached?.length);
        // Удаляем невалидные данные из кэша
        try {
          await kv.del(key);
        } catch (delError) {
          // Игнорируем ошибки удаления
        }
        return null;
      }
    }
    
    // Неожиданный тип - возвращаем null
    console.warn('Unexpected cached plan type:', typeof cached, { userId, profileVersion });
    return null;
  } catch (error) {
    // Логируем только если это не ошибка отсутствия переменных окружения
    if (!(error as any)?.message?.includes('Missing required environment variables')) {
      console.error('Error getting cached plan:', error);
    }
    return null;
  }
}

/**
 * Сохранить план в кэш
 */
export async function setCachedPlan(
  userId: string,
  profileVersion: number,
  plan: any
): Promise<void> {
  if (!kvAvailable || !kv) {
    return; // Кеш недоступен, просто выходим
  }
  
  try {
    const key = `plan:${userId}:${profileVersion}`;
    await setWithTTL(key, JSON.stringify(plan), CACHE_TTL.plan);
  } catch (error) {
    // Логируем только если это не ошибка отсутствия переменных окружения
    if (!(error as any)?.message?.includes('Missing required environment variables')) {
    console.error('Error caching plan:', error);
    }
    // Не прерываем выполнение, если кэш не работает
  }
}

/**
 * Получить кэшированные рекомендации
 */
export async function getCachedRecommendations(
  userId: string,
  profileVersion: number
): Promise<any | null> {
  if (!kvAvailable || !kv) {
    return null; // Кеш недоступен, возвращаем null
  }
  
  try {
    const key = `recommendations:${userId}:${profileVersion}`;
    const cached = await kv.get(key);
    if (!cached) {
      return null;
    }
    
    // Если это уже объект (не строка), возвращаем как есть
    if (typeof cached === 'object' && cached !== null) {
      return cached;
    }
    
    // Если это строка, пытаемся парсить JSON
    if (typeof cached === 'string') {
      // Проверяем, не является ли это строкой "[object Object]" (невалидный JSON)
      if (cached === '[object Object]' || cached.trim() === '[object Object]') {
        console.warn('Invalid cached recommendations data (object stringified incorrectly), removing from cache', { userId, profileVersion });
        // Удаляем невалидные данные из кэша
        try {
          await kv.del(key);
        } catch (delError) {
          // Игнорируем ошибки удаления
        }
        return null;
      }
      
      try {
        return JSON.parse(cached);
      } catch (parseError) {
        console.error('Error parsing cached recommendations JSON:', parseError, 'Raw value type:', typeof cached, 'Raw value length:', cached?.length);
        // Удаляем невалидные данные из кэша
        try {
          await kv.del(key);
        } catch (delError) {
          // Игнорируем ошибки удаления
        }
        return null;
      }
    }
    
    // Неожиданный тип - возвращаем null
    console.warn('Unexpected cached recommendations type:', typeof cached, { userId, profileVersion });
    return null;
  } catch (error) {
    // Логируем только если это не ошибка отсутствия переменных окружения
    if (!(error as any)?.message?.includes('Missing required environment variables')) {
      console.error('Error getting cached recommendations:', error);
    }
    return null;
  }
}

/**
 * Сохранить рекомендации в кэш
 */
export async function setCachedRecommendations(
  userId: string,
  profileVersion: number,
  recommendations: any
): Promise<void> {
  if (!kvAvailable || !kv) {
    return; // Кеш недоступен, просто выходим
  }
  
  try {
    const key = `recommendations:${userId}:${profileVersion}`;
    await setWithTTL(key, JSON.stringify(recommendations), CACHE_TTL.recommendations);
  } catch (error) {
    // Логируем только если это не ошибка отсутствия переменных окружения
    if (!(error as any)?.message?.includes('Missing required environment variables')) {
    console.error('Error caching recommendations:', error);
    }
    // Не прерываем выполнение, если кэш не работает
  }
}

/**
 * Инвалидировать кэш (при обновлении профиля)
 */
export async function invalidateCache(userId: string, profileVersion: number): Promise<void> {
  if (!kvAvailable || !kv) {
    return; // Кеш недоступен, просто выходим
  }
  
  try {
    const planKey = `plan:${userId}:${profileVersion}`;
    const recommendationsKey = `recommendations:${userId}:${profileVersion}`;
    await Promise.all([
      kv.del(planKey),
      kv.del(recommendationsKey),
    ]);
  } catch (error) {
    // Логируем только если это не ошибка отсутствия переменных окружения
    if (!(error as any)?.message?.includes('Missing required environment variables')) {
    console.error('Error invalidating cache:', error);
    }
  }
}

/**
 * Инвалидировать весь кэш пользователя (все версии профилей)
 * Используется при полной очистке данных пользователя
 */
export async function invalidateAllUserCache(userId: string): Promise<void> {
  if (!kvAvailable || !kv) {
    return; // Кеш недоступен, просто выходим
  }
  
  try {
    // Получаем все ключи, начинающиеся с plan:userId: или recommendations:userId:
    // ВАЖНО: Vercel KV не поддерживает SCAN напрямую, поэтому используем паттерн
    // Для полной очистки удаляем все возможные версии (1-100)
    const keysToDelete: string[] = [];
    
    for (let version = 1; version <= 100; version++) {
      keysToDelete.push(`plan:${userId}:${version}`);
      keysToDelete.push(`recommendations:${userId}:${version}`);
    }
    
    // Удаляем все ключи параллельно
    await Promise.all(keysToDelete.map(key => kv.del(key).catch(() => {
      // Игнорируем ошибки удаления отдельных ключей (они могут не существовать)
    })));
    
    console.log(`✅ Очищен весь кэш для пользователя ${userId} (все версии 1-100)`);
  } catch (error) {
    // Логируем только если это не ошибка отсутствия переменных окружения
    if (!(error as any)?.message?.includes('Missing required environment variables')) {
      console.error('Error invalidating all user cache:', error);
    }
  }
}

