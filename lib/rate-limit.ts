// lib/rate-limit.ts
// Rate limiter для защиты API (с поддержкой Redis через Upstash)

import type { NextRequest } from 'next/server';

// Пробуем использовать Upstash Redis для production
let ratelimit: any = null;
let useRedis = false;

try {
  // Проверяем, есть ли переменные окружения для Upstash
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    // Динамический импорт, чтобы не падать, если пакеты не установлены
    const { Ratelimit } = require('@upstash/ratelimit');
    const { Redis } = require('@upstash/redis');

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Создаем разные лимитеры для разных endpoints
    ratelimit = {
      // Для генерации плана - 10 запросов в минуту
      plan: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        analytics: true,
      }),
      // Для ответов анкеты - 5 запросов в минуту
      answers: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        analytics: true,
      }),
      // Для рекомендаций - 20 запросов в минуту
      recommendations: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        analytics: true,
      }),
      // Для админки - 3 попытки за 15 минут
      admin: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, '15 m'),
        analytics: true,
      }),
    };

    useRedis = true;
    console.log('✅ Using Upstash Redis for rate limiting');
  }
} catch (error) {
  console.warn('⚠️ Upstash Redis not available, using in-memory fallback:', error);
  useRedis = false;
}

// Fallback: In-memory store (только для разработки)
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

export interface RateLimitOptions {
  interval: number; // Интервал в миллисекундах
  maxRequests: number; // Максимум запросов за интервал
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Простой in-memory rate limiter (fallback)
 */
function rateLimitInMemory(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const key = identifier;

  // Очищаем старые записи
  if (store[key] && store[key].resetAt < now) {
    delete store[key];
  }

  // Инициализируем или получаем существующий лимит
  if (!store[key]) {
    store[key] = {
      count: 0,
      resetAt: now + options.interval,
    };
  }

  const limit = store[key];

  // Проверяем лимит
  if (limit.count >= options.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: limit.resetAt,
    };
  }

  // Увеличиваем счётчик
  limit.count++;

  return {
    success: true,
    remaining: options.maxRequests - limit.count,
    resetAt: limit.resetAt,
  };
}

/**
 * Rate limiter с поддержкой Redis (Upstash) и fallback
 */
export async function rateLimit(
  identifier: string,
  options: RateLimitOptions,
  limiterType: 'plan' | 'answers' | 'recommendations' | 'admin' = 'plan'
): Promise<RateLimitResult> {
  // Используем Redis, если доступен
  if (useRedis && ratelimit && ratelimit[limiterType]) {
    try {
      const result = await ratelimit[limiterType].limit(identifier);
      
      return {
        success: result.success,
        remaining: result.remaining,
        resetAt: result.reset ? new Date(result.reset).getTime() : Date.now() + options.interval,
      };
    } catch (error) {
      console.error('Redis rate limit error, falling back to in-memory:', error);
      // Fallback на in-memory при ошибке Redis
      return rateLimitInMemory(identifier, options);
    }
  }

  // Fallback на in-memory для разработки
  return rateLimitInMemory(identifier, options);
}

/**
 * Получить IP адрес из запроса
 */
export function getIdentifier(request: NextRequest): string {
  // Пробуем получить IP из заголовков (Vercel проксирует через x-forwarded-for)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback на user agent (менее надежно, но лучше чем ничего)
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return userAgent.substring(0, 50);
}

