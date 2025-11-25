// lib/rate-limit.ts
// Простой rate limiter для защиты API

import type { NextRequest } from 'next/server';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

// In-memory store (для serverless это будет работать на уровне одного инстанса)
// Для продакшна лучше использовать Redis (Upstash) или Vercel KV
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
 * Простой rate limiter
 * Для продакшна рекомендуется использовать @upstash/ratelimit с Redis
 */
export function rateLimit(
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

