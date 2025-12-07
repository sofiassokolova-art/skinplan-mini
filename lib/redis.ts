// lib/redis.ts
// Singleton для Upstash Redis

import { Redis } from '@upstash/redis';

let redisInstance: Redis | null = null;

/**
 * Получить экземпляр Redis (singleton)
 * Создается только один раз при первом вызове
 */
export function getRedis(): Redis | null {
  // Если экземпляр уже создан, возвращаем его
  if (redisInstance) {
    return redisInstance;
  }

  // Проверяем наличие переменных окружения
  // Поддерживаем оба варианта: UPSTASH_REDIS_* и KV_* (Vercel создает KV_* для Upstash Redis)
  // ВАЖНО: Используем токен для записи (KV_REST_API_TOKEN), а не read-only токен (KV_REST_API_READ_ONLY_TOKEN)
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  // Если используется read-only токен, предупреждаем, но не блокируем
  if (process.env.KV_REST_API_READ_ONLY_TOKEN && !token) {
    console.warn('⚠️ Using read-only token for Redis - write operations will fail. Please use KV_REST_API_TOKEN instead of KV_REST_API_READ_ONLY_TOKEN');
  }

  if (!url || !token) {
    // Redis не настроен, возвращаем null
    // Это нормально для разработки или если Redis не используется
    return null;
  }

  // Создаем новый экземпляр
  try {
    redisInstance = new Redis({
      url,
      token,
    });
    return redisInstance;
  } catch (error) {
    console.error('❌ Failed to create Redis instance:', error);
    return null;
  }
}

/**
 * Экспортируем функцию для получения Redis экземпляра
 * Для удобства также экспортируем прямое свойство
 */
export const redis = getRedis();

