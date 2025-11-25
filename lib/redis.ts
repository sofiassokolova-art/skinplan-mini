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
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

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

