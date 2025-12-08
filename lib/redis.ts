// lib/redis.ts
// Singleton для Upstash Redis
// ИСПРАВЛЕНО: Используем Redis.fromEnv() согласно официальной документации Upstash

import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;

/**
 * Получить экземпляр Redis (singleton)
 * Создается только один раз при первом вызове
 * ИСПРАВЛЕНО: Используем Redis.fromEnv() который автоматически читает переменные окружения
 */
export function getRedis(): Redis | null {
  // Если экземпляр уже создан, возвращаем его
  if (redisInstance) {
    return redisInstance;
  }

  // Проверяем наличие переменных окружения
  // Redis.fromEnv() поддерживает оба варианта:
  // - UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN
  // - KV_REST_API_URL и KV_REST_API_TOKEN (Vercel создает эти переменные)
  
  // ИСПРАВЛЕНО: Проверяем наличие переменных для диагностики
  const hasUpstashUrl = !!(process.env.UPSTASH_REDIS_REST_URL);
  const hasUpstashToken = !!(process.env.UPSTASH_REDIS_REST_TOKEN);
  const hasKVUrl = !!(process.env.KV_REST_API_URL);
  const hasKVToken = !!(process.env.KV_REST_API_TOKEN);
  const readOnlyToken = process.env.KV_REST_API_READ_ONLY_TOKEN;
  const writeToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  const tokensMatch = readOnlyToken && writeToken && writeToken === readOnlyToken;
  
  // Диагностика токенов
  if (process.env.NODE_ENV === 'development' || tokensMatch || (!hasKVToken && !hasUpstashToken && readOnlyToken)) {
    console.log('🔍 Redis token diagnostics:', {
      hasKVUrl,
      hasKVToken,
      hasUpstashUrl,
      hasUpstashToken,
      hasReadOnlyToken: !!readOnlyToken,
      tokensMatch,
      writeTokenLength: writeToken?.length || 0,
      readOnlyTokenLength: readOnlyToken?.length || 0,
    });
  }
  
  // ВАЖНО: Если установлен только read-only токен, но нет write token - это проблема
  if ((!hasKVToken && !hasUpstashToken) && readOnlyToken) {
    console.error('❌ ERROR: Only KV_REST_API_READ_ONLY_TOKEN is set, but KV_REST_API_TOKEN is missing!');
    console.error('   Write operations will fail. Please set KV_REST_API_TOKEN in Vercel environment variables.');
    return null;
  }
  
  // ИСПРАВЛЕНО: Проверяем, не используется ли read-only токен вместо write token
  if (tokensMatch) {
    console.error('❌ ERROR: KV_REST_API_TOKEN и KV_REST_API_READ_ONLY_TOKEN совпадают!');
    console.error('   KV_REST_API_TOKEN должен быть токеном для записи, а не read-only токеном.');
    console.error('   Please check your Vercel environment variables.');
    return null;
  }
  
  if (!hasKVUrl && !hasUpstashUrl) {
    // Redis не настроен, возвращаем null
    if (process.env.NODE_ENV === 'development') {
      console.log('ℹ️ Redis not configured (UPSTASH_REDIS_REST_URL or KV_REST_API_URL not set)');
    }
    return null;
  }

  // ИСПРАВЛЕНО: Используем Redis.fromEnv() согласно официальной документации
  // Этот метод автоматически читает переменные окружения в следующем порядке:
  // 1. UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN
  // 2. KV_REST_API_URL и KV_REST_API_TOKEN (Vercel)
  try {
    redisInstance = Redis.fromEnv();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Upstash Redis initialized successfully using Redis.fromEnv()', {
        hasKVUrl,
        hasKVToken,
        hasUpstashUrl,
        hasUpstashToken,
      });
    }
    
    return redisInstance;
  } catch (error: any) {
    console.error('❌ Failed to create Redis instance using Redis.fromEnv():', {
      error: error?.message,
      stack: error?.stack,
      hasKVUrl,
      hasKVToken,
      hasUpstashUrl,
      hasUpstashToken,
    });
    return null;
  }
}

/**
 * Экспортируем функцию для получения Redis экземпляра
 * Для удобства также экспортируем прямое свойство
 */
export const redis = getRedis();

