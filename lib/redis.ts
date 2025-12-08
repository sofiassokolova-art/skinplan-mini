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
  
  // ИСПРАВЛЕНО: Приоритет токенов - сначала проверяем write token, потом read-only (но не используем read-only для записи)
  let token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  // ВАЖНО: Если установлен только read-only токен, но нет write token - это проблема
  const readOnlyToken = process.env.KV_REST_API_READ_ONLY_TOKEN;
  if (!token && readOnlyToken) {
    console.error('❌ ERROR: Only KV_REST_API_READ_ONLY_TOKEN is set, but KV_REST_API_TOKEN is missing!');
    console.error('   Write operations will fail. Please set KV_REST_API_TOKEN in Vercel environment variables.');
    console.error('   Current token value is read-only and cannot be used for SET operations.');
    // НЕ используем read-only токен для записи - возвращаем null
    return null;
  }
  
  // ИСПРАВЛЕНО: Проверяем, не используется ли read-only токен вместо write token (случайная ошибка)
  if (readOnlyToken && token === readOnlyToken) {
    console.error('❌ ERROR: KV_REST_API_TOKEN и KV_REST_API_READ_ONLY_TOKEN совпадают!');
    console.error('   KV_REST_API_TOKEN должен быть токеном для записи, а не read-only токеном.');
    console.error('   Please check your Vercel environment variables.');
    return null;
  }
  
  if (!url || !token) {
    // Redis не настроен, возвращаем null
    // Это нормально для разработки или если Redis не используется
    if (process.env.NODE_ENV === 'development') {
      console.log('ℹ️ Redis not configured (UPSTASH_REDIS_REST_URL/KV_REST_API_URL or UPSTASH_REDIS_REST_TOKEN/KV_REST_API_TOKEN not set)');
    }
    return null;
  }

  // ИСПРАВЛЕНО: Проверяем формат URL (должен быть https://, а не rediss://)
  if (url.startsWith('rediss://')) {
    console.error('❌ ERROR: Redis URL should use https:// protocol, not rediss://');
    console.error('   REST API requires: https://super-bat-14283.upstash.io');
    console.error('   Not: rediss://default:TOKEN@super-bat-14283.upstash.io:6379');
    return null;
  }

  // Создаем новый экземпляр
  try {
    redisInstance = new Redis({
      url,
      token,
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Upstash Redis initialized successfully', {
        url: url.substring(0, 30) + '...',
        hasToken: !!token,
      });
    }
    
    return redisInstance;
  } catch (error: any) {
    console.error('❌ Failed to create Redis instance:', {
      error: error?.message,
      url: url?.substring(0, 30),
      hasToken: !!token,
    });
    return null;
  }
}

/**
 * Экспортируем функцию для получения Redis экземпляра
 * Для удобства также экспортируем прямое свойство
 */
export const redis = getRedis();

