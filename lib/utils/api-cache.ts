// lib/utils/api-cache.ts
// Утилиты для кэширования API ответов через HTTP заголовки

import { NextResponse } from 'next/server';

export interface CacheOptions {
  /** Время кэширования в секундах */
  maxAge?: number;
  /** Время кэширования в shared cache (CDN) в секундах */
  sMaxAge?: number;
  /** Должен ли ответ быть кэширован публично (true) или только приватно (false) */
  public?: boolean;
  /** Нужно ли валидировать кэш перед использованием */
  mustRevalidate?: boolean;
  /** Нужно ли кэшировать только если ответ не изменился (stale-while-revalidate) */
  staleWhileRevalidate?: number;
}

/**
 * Добавляет Cache-Control заголовки к ответу
 */
export function addCacheHeaders(
  response: NextResponse,
  options: CacheOptions = {}
): NextResponse {
  const {
    maxAge = 0,
    sMaxAge,
    public: isPublic = false,
    mustRevalidate = false,
    staleWhileRevalidate,
  } = options;

  const directives: string[] = [];

  if (maxAge > 0) {
    directives.push(`max-age=${maxAge}`);
  }

  if (sMaxAge !== undefined && sMaxAge > 0) {
    directives.push(`s-maxage=${sMaxAge}`);
  }

  if (isPublic) {
    directives.push('public');
  } else {
    directives.push('private');
  }

  if (mustRevalidate) {
    directives.push('must-revalidate');
  }

  if (staleWhileRevalidate !== undefined && staleWhileRevalidate > 0) {
    directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  if (directives.length > 0) {
    response.headers.set('Cache-Control', directives.join(', '));
  } else {
    // Если нет директив, запрещаем кэширование
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  return response;
}

/**
 * Предустановленные конфигурации кэширования для разных типов данных
 */
export const CachePresets = {
  /** Не кэшировать (для персональных данных) */
  noCache: (): CacheOptions => ({
    maxAge: 0,
    public: false,
    mustRevalidate: true,
  }),

  /** Кэш на 1 минуту (для часто меняющихся данных) */
  shortCache: (): CacheOptions => ({
    maxAge: 60,
    sMaxAge: 30,
    public: false,
    mustRevalidate: true,
  }),

  /** Кэш на 5 минут (для относительно стабильных данных) */
  mediumCache: (): CacheOptions => ({
    maxAge: 300,
    sMaxAge: 180,
    public: false,
    mustRevalidate: true,
    staleWhileRevalidate: 60,
  }),

  /** Кэш на 1 час (для стабильных данных) */
  longCache: (): CacheOptions => ({
    maxAge: 3600,
    sMaxAge: 1800,
    public: true,
    mustRevalidate: false,
    staleWhileRevalidate: 300,
  }),

  /** Кэш на 1 день (для очень стабильных данных) */
  veryLongCache: (): CacheOptions => ({
    maxAge: 86400,
    sMaxAge: 43200,
    public: true,
    mustRevalidate: false,
    staleWhileRevalidate: 3600,
  }),
};

/**
 * Создает ответ с кэшированием для статических данных
 */
export function createCachedResponse<T>(
  data: T,
  cacheOptions: CacheOptions = CachePresets.noCache(),
  status: number = 200
): NextResponse {
  const response = NextResponse.json(data, { status });
  return addCacheHeaders(response, cacheOptions);
}
