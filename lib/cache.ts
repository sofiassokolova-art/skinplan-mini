// lib/cache.ts
// Кэширование для плана и рекомендаций

import { getRedis } from './redis';

let kv: any = null;
let kvAvailable = false;
let isUpstashRedis = false;
let cacheInitialized = false; // Флаг инициализации

/**
 * Ленивая инициализация кэша
 * Вызывается при первом использовании, а не при импорте модуля
 * Это позволяет загрузить переменные окружения через dotenv до инициализации
 */
function initializeCache(): void {
  // Если уже инициализирован, не делаем ничего
  if (cacheInitialized) {
    return;
  }

  cacheInitialized = true;

  // Пытаемся инициализировать кэш: сначала Upstash Redis, потом Vercel KV
  try {
    // Приоритет 1: Upstash Redis (если настроен)
    const upstashRedis = getRedis();
    if (upstashRedis) {
      kv = upstashRedis;
      kvAvailable = true;
      isUpstashRedis = true;
      console.log('✅ Using Upstash Redis for cache');
      
      // ВАЖНО: Проверяем, что используется токен для записи
      const writeToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
      const readOnlyToken = process.env.KV_REST_API_READ_ONLY_TOKEN;
      const tokensMatch = readOnlyToken && writeToken === readOnlyToken;
      
      if (tokensMatch) {
        console.error('❌ ERROR: Using read-only token for Redis write operations!');
        console.error('   KV_REST_API_TOKEN совпадает с KV_REST_API_READ_ONLY_TOKEN');
        console.error('   Please set KV_REST_API_TOKEN to a write token in Vercel environment variables.');
      }
      
      if (!writeToken && readOnlyToken) {
        console.error('❌ ERROR: Only KV_REST_API_READ_ONLY_TOKEN is set, KV_REST_API_TOKEN is missing!');
        console.error('   Cache write operations will fail. Please set KV_REST_API_TOKEN in Vercel.');
      }
      
      return;
    } 
    
    // Приоритет 2: Vercel KV (если Upstash не настроен, но есть Vercel KV)
    // ВАЖНО: Используем токен для записи (KV_REST_API_TOKEN), а не read-only токен
    if (process.env.KV_REST_API_URL) {
      const kvModule = require('@vercel/kv');
      
      // ИСПРАВЛЕНО: Проверяем наличие write token
      const writeToken = process.env.KV_REST_API_TOKEN;
      const readOnlyToken = process.env.KV_REST_API_READ_ONLY_TOKEN;
      
      // Если установлен только read-only токен - не используем кэш для записи
      if (!writeToken && readOnlyToken) {
        console.error('❌ ERROR: Only KV_REST_API_READ_ONLY_TOKEN is set, but KV_REST_API_TOKEN is missing!');
        console.error('   Cache write operations will fail. Please set KV_REST_API_TOKEN in Vercel.');
        kvAvailable = false;
        return;
      }
      
      if (readOnlyToken && writeToken === readOnlyToken) {
        console.error('❌ ERROR: KV_REST_API_TOKEN и KV_REST_API_READ_ONLY_TOKEN совпадают - используйте токен для записи!');
        kvAvailable = false;
        return;
      }
      
      if (!writeToken || writeToken.length === 0) {
        console.error('❌ ERROR: KV_REST_API_TOKEN пустой или не установлен!');
        console.error('   Cache write operations will fail. Please set KV_REST_API_TOKEN in Vercel.');
        kvAvailable = false;
        return;
      }
      
      // @vercel/kv автоматически использует переменные окружения KV_REST_API_URL и KV_REST_API_TOKEN
      // ВАЖНО: Убедитесь, что в Vercel установлен KV_REST_API_TOKEN (не KV_REST_API_READ_ONLY_TOKEN)
      try {
        kv = kvModule.kv;
        kvAvailable = true;
        isUpstashRedis = false;
        console.log('✅ Using Vercel KV for cache', {
          hasWriteToken: !!writeToken,
          writeTokenLength: writeToken.length,
          hasReadOnlyToken: !!readOnlyToken,
          tokensMatch: readOnlyToken && writeToken === readOnlyToken,
        });
        return;
      } catch (kvError) {
        console.error('❌ Failed to initialize Vercel KV:', kvError);
        // Продолжаем, возможно, Upstash Redis доступен
      }
    }
    
    // Если ни один вариант не доступен
    console.warn('⚠️ Cache not available: missing environment variables (UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN)');
  } catch (error) {
    console.warn('⚠️ Cache not available:', error);
    kvAvailable = false;
  }
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
  // Ленивая инициализация при первом использовании
  initializeCache();
  
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
  // Ленивая инициализация при первом использовании
  initializeCache();
  
  if (!kvAvailable || !kv) {
    console.warn('⚠️ Cache not available for plan caching', { userId, profileVersion });
    throw new Error('Cache not available: kvAvailable=' + kvAvailable + ', kv=' + !!kv);
  }
  
  try {
    const key = `plan:${userId}:${profileVersion}`;
    const planString = JSON.stringify(plan);
    const planSize = planString.length;
    
    console.log('💾 Attempting to cache plan', { 
      userId, 
      profileVersion, 
      key,
      planSize,
      hasPlan28: !!plan.plan28,
      hasWeeks: !!plan.weeks,
    });
    
    await setWithTTL(key, planString, CACHE_TTL.plan);
    
    console.log('✅ Plan cached successfully', { 
      userId, 
      profileVersion, 
      key,
      planSize,
    });
  } catch (error: any) {
    // Логируем только если это не ошибка отсутствия переменных окружения
    if (!error?.message?.includes('Missing required environment variables')) {
      // NOPERM ошибки - это ожидаемо, если используется read-only токен
      // Логируем как предупреждение, а не как ошибку
      const errorMessage = error?.message || String(error || '');
      const errorString = String(error || '');
      const isPermissionError = 
        errorMessage.includes('NOPERM') || 
        errorMessage.includes('no permissions') ||
        errorString.includes('NOPERM') ||
        errorString.includes('no permissions');
      
      if (isPermissionError) {
        // Логируем как предупреждение - это ожидаемое поведение при read-only токене
        console.error('❌ Cache write failed (read-only token):', {
          userId,
          profileVersion,
          error: errorMessage,
          key: `plan:${userId}:${profileVersion}`,
        });
      } else {
        console.error('❌ Error caching plan:', {
          userId,
          profileVersion,
          error: error,
          errorMessage: errorMessage,
          errorStack: error?.stack?.substring(0, 500),
          key: `plan:${userId}:${profileVersion}`,
        });
      }
    }
    // Пробрасываем ошибку дальше, чтобы она была залогирована на сервере
    throw error;
  }
}

/**
 * Получить кэшированные рекомендации
 */
export async function getCachedRecommendations(
  userId: string,
  profileVersion: number
): Promise<any | null> {
  // Ленивая инициализация при первом использовании
  initializeCache();
  
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
  // Ленивая инициализация при первом использовании
  initializeCache();
  
  if (!kvAvailable || !kv) {
    return; // Кеш недоступен, просто выходим
  }
  
  try {
    const key = `recommendations:${userId}:${profileVersion}`;
    await setWithTTL(key, JSON.stringify(recommendations), CACHE_TTL.recommendations);
  } catch (error: any) {
    // Логируем только если это не ошибка отсутствия переменных окружения
    if (!error?.message?.includes('Missing required environment variables')) {
      // NOPERM ошибки - это ожидаемо, если используется read-only токен
      // Логируем как предупреждение, а не как ошибку
      const errorMessage = error?.message || String(error || '');
      const errorString = String(error || '');
      const isPermissionError = 
        errorMessage.includes('NOPERM') || 
        errorMessage.includes('no permissions') ||
        errorString.includes('NOPERM') ||
        errorString.includes('no permissions');
      
      if (isPermissionError) {
        // Тихо логируем как предупреждение - это ожидаемое поведение при read-only токене
        console.warn('⚠️ Cache write failed (read-only token, non-critical):', errorMessage);
      } else {
        console.error('Error caching recommendations:', error);
      }
    }
    // Не прерываем выполнение, если кэш не работает
  }
}

/**
 * Инвалидировать кэш (при обновлении профиля)
 */
export async function invalidateCache(userId: string, profileVersion: number): Promise<void> {
  // Ленивая инициализация при первом использовании
  initializeCache();
  
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
  } catch (error: any) {
    // Логируем только если это не ошибка отсутствия переменных окружения
    if (!error?.message?.includes('Missing required environment variables')) {
      // NOPERM ошибки - это ожидаемо, если используется read-only токен
      // Логируем как предупреждение, а не как ошибку
      const errorMessage = error?.message || String(error || '');
      const errorString = String(error || '');
      const isPermissionError = 
        errorMessage.includes('NOPERM') || 
        errorMessage.includes('no permissions') ||
        errorString.includes('NOPERM') ||
        errorString.includes('no permissions');
      
      if (isPermissionError) {
        // Тихо логируем как предупреждение - это ожидаемое поведение при read-only токене
        console.warn('⚠️ Cache invalidation failed (read-only token, non-critical):', errorMessage);
      } else {
        console.error('Error invalidating cache:', error);
      }
    }
  }
}

/**
 * Инвалидировать весь кэш пользователя (все версии профилей)
 * Используется при полной очистке данных пользователя
 */
export async function invalidateAllUserCache(userId: string): Promise<void> {
  // Ленивая инициализация при первом использовании
  initializeCache();
  
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
  } catch (error: any) {
    // Логируем только если это не ошибка отсутствия переменных окружения
    if (!error?.message?.includes('Missing required environment variables')) {
      // NOPERM ошибки - это ожидаемо, если используется read-only токен
      // Логируем как предупреждение, а не как ошибку
      const errorMessage = error?.message || String(error || '');
      const errorString = String(error || '');
      const isPermissionError = 
        errorMessage.includes('NOPERM') || 
        errorMessage.includes('no permissions') ||
        errorString.includes('NOPERM') ||
        errorString.includes('no permissions');
      
      if (isPermissionError) {
        // Тихо логируем как предупреждение - это ожидаемое поведение при read-only токене
        console.warn('⚠️ Cache invalidation failed (read-only token, non-critical):', errorMessage);
      } else {
        console.error('Error invalidating all user cache:', error);
      }
    }
  }
}

