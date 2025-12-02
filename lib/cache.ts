// lib/cache.ts
// Кэширование для плана и рекомендаций

let kv: any = null;
let kvAvailable = false;

// Пытаемся инициализировать KV только если переменные окружения настроены
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const kvModule = require('@vercel/kv');
    kv = kvModule.kv;
    kvAvailable = true;
  } else {
    console.warn('⚠️ KV cache not available: missing environment variables');
  }
} catch (error) {
  console.warn('⚠️ KV cache not available:', error);
  kvAvailable = false;
}

const CACHE_TTL = {
  plan: 15 * 60, // 15 минут для плана
  recommendations: 30 * 60, // 30 минут для рекомендаций
};

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
    return cached ? JSON.parse(cached as string) : null;
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
    await kv.setex(key, CACHE_TTL.plan, JSON.stringify(plan));
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
    return cached ? JSON.parse(cached as string) : null;
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
    await kv.setex(key, CACHE_TTL.recommendations, JSON.stringify(recommendations));
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

