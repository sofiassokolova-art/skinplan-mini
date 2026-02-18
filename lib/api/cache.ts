// lib/api/cache.ts
// Кэширование запросов для предотвращения дублирования

const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 2000; // 2 секунды кэш для одинаковых запросов
const QUESTIONNAIRE_CACHE_TTL = 600000; // 10 минут для /questionnaire/active

/**
 * Получает данные из кэша, если они еще актуальны
 */
export function getCachedData<T>(requestKey: string, endpoint: string): T | null {
  if (!requestCache.has(requestKey)) {
    return null;
  }

  const cached = requestCache.get(requestKey)!;
  const isQuestionnaireEndpoint = endpoint.includes('/questionnaire/active');
  const cacheTTL = isQuestionnaireEndpoint ? QUESTIONNAIRE_CACHE_TTL : CACHE_TTL;
  const age = Date.now() - cached.timestamp;
  
  if (age < cacheTTL) {
    if (process.env.NODE_ENV === 'development' && isQuestionnaireEndpoint) {
      console.log('💾 Using cached questionnaire data, age:', age, 'ms, TTL:', cacheTTL, 'ms');
    }
    return cached.data as T;
  }
  
  // Кэш устарел - удаляем его
  requestCache.delete(requestKey);
  return null;
}

/**
 * Сохраняет данные в кэш
 */
export function setCachedData<T>(requestKey: string, data: T, endpoint: string): void {
  requestCache.set(requestKey, { data, timestamp: Date.now() });
  
  if (process.env.NODE_ENV === 'development' && endpoint.includes('/questionnaire/active')) {
    console.log('✅ Questionnaire cached for:', endpoint);
  }
}

/**
 * Очищает кэш для конкретного ключа
 */
export function clearCache(requestKey: string): void {
  requestCache.delete(requestKey);
}

/**
 * Очищает весь кэш
 */
export function clearAllCache(): void {
  requestCache.clear();
}
