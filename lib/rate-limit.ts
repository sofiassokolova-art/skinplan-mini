// lib/rate-limit.ts
// Rate limiter для защиты API (с поддержкой Redis через Upstash)

import type { NextRequest } from 'next/server';
import { getRedis } from './redis';

// Пробуем использовать Upstash Redis для production
let useRedis = false;
let redisDisabled = false; // Флаг для отслеживания, был ли Redis отключен из-за ошибок
let redisClient: any = null;
let RatelimitCtor: any = null;
const redisLimiterCache = new Map<string, any>();

// Функция для инициализации Redis rate limiting
function initializeRedisRateLimit() {
  // Если Redis уже был отключен из-за ошибок, не пытаемся снова
  if (redisDisabled) {
    return;
  }

  try {
    // Получаем Redis экземпляр через singleton
    const redis = getRedis();

    // Проверяем, есть ли Redis и переменные окружения для Upstash
    // Поддерживаем оба варианта: UPSTASH_REDIS_* и KV_* (Vercel создает KV_* для Upstash Redis)
    const hasUpstashVars = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
                           (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
    
    if (redis && hasUpstashVars) {
      // Динамический импорт, чтобы не падать, если пакеты не установлены
      const { Ratelimit } = require('@upstash/ratelimit');
      RatelimitCtor = Ratelimit;
      redisClient = redis;
      useRedis = true;
      console.log('✅ Using Upstash Redis for rate limiting');
    } else {
      console.log('ℹ️ Redis not configured, using in-memory fallback for rate limiting');
    }
  } catch (error) {
    console.warn('⚠️ Upstash Redis not available, using in-memory fallback:', error);
    useRedis = false;
    redisDisabled = true;
    redisClient = null;
    RatelimitCtor = null;
  }
}

// Инициализируем при загрузке модуля
initializeRedisRateLimit();

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

function intervalToWindowString(intervalMs: number): string {
  if (intervalMs <= 0) return '60 s';
  if (intervalMs % (60 * 1000) === 0) {
    return `${Math.max(1, Math.round(intervalMs / (60 * 1000)))} m`;
  }
  const seconds = Math.max(1, Math.ceil(intervalMs / 1000));
  return `${seconds} s`;
}

/**
 * Rate limiter с поддержкой Redis (Upstash) и fallback
 */
export async function rateLimit(
  identifier: string,
  options: RateLimitOptions,
  limiterKey = 'default'
): Promise<RateLimitResult> {
  // Используем Redis, если доступен
  if (useRedis && redisClient && RatelimitCtor) {
    try {
      const cacheKey = `${limiterKey}:${options.maxRequests}:${options.interval}`;
      let limiter = redisLimiterCache.get(cacheKey);
      if (!limiter) {
        limiter = new RatelimitCtor({
          redis: redisClient,
          limiter: RatelimitCtor.slidingWindow(options.maxRequests, intervalToWindowString(options.interval)),
          analytics: true,
        });
        redisLimiterCache.set(cacheKey, limiter);
      }

      const result = await limiter.limit(identifier);
      
      return {
        success: result.success,
        remaining: result.remaining,
        resetAt: result.reset ? new Date(result.reset).getTime() : Date.now() + options.interval,
      };
    } catch (error: any) {
      // Проверяем, является ли это ошибкой прав доступа (NOPERM)
      const isPermissionError = error?.message?.includes('NOPERM') || 
                                error?.message?.includes('evalsha') ||
                                error?.code === 'NOPERM';
      
      if (isPermissionError && !redisDisabled) {
        // Ошибка прав доступа - отключаем Redis и используем только in-memory
        // Логируем только один раз на уровне debug (не критично, система работает с fallback)
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Redis permission error (NOPERM), disabling Redis for rate limiting. Using in-memory fallback.');
        }
        useRedis = false;
        redisDisabled = true; // Помечаем, что Redis отключен
        redisClient = null;
        RatelimitCtor = null;
        redisLimiterCache.clear();
      } else if (!redisDisabled) {
        // Другие ошибки Redis - логируем только если Redis еще не отключен
        console.error('Redis rate limit error, falling back to in-memory:', error);
      }
      // Fallback на in-memory при ошибке Redis
      return rateLimitInMemory(`${limiterKey}:${identifier}`, options);
    }
  }

  // Fallback на in-memory для разработки
  return rateLimitInMemory(`${limiterKey}:${identifier}`, options);
}

/**
 * Извлекает Telegram ID из initData (быстрый regex, без криптопроверки —
 * это только для rate-limit ключа, не для авторизации).
 */
function extractTelegramIdFromInitData(initData: string | null): string | null {
  if (!initData) return null;
  const match = initData.match(/user=%7B%22id%22%3A(\d+)/) ||
                decodeURIComponent(initData).match(/"id"\s*:\s*(\d+)/);
  return match ? `tg:${match[1]}` : null;
}

/**
 * Возвращает идентификатор для rate limiting.
 * Приоритет: Telegram ID > IP > user-agent.
 */
export function getIdentifier(request: NextRequest): string {
  // Telegram ID — самый точный идентификатор (в WebView все IP могут совпадать)
  const initData = request.headers.get('x-telegram-init-data') ||
                   request.headers.get('X-Telegram-Init-Data');
  const tgId = extractTelegramIdFromInitData(initData);
  if (tgId) return tgId;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  const userAgent = request.headers.get('user-agent') || 'unknown';
  return userAgent.substring(0, 50);
}

