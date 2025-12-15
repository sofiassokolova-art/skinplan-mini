// middleware.ts
// Middleware для проверки JWT токена и rate limiting
// ВАЖНО: Edge Runtime не поддерживает Node.js crypto, поэтому полная валидация JWT делается в API routes

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit, getIdentifier } from './lib/rate-limit';

// Настройки rate limiting для разных endpoints
const RATE_LIMITS: Record<string, { maxRequests: number; interval: number }> = {
  '/api/plan/generate': { maxRequests: 10, interval: 60 * 1000 }, // 10 запросов в минуту
  '/api/questionnaire/answers': { maxRequests: 10, interval: 60 * 1000 }, // 10 запросов в минуту (увеличено для избежания 429)
  '/api/questionnaire/partial-update': { maxRequests: 5, interval: 60 * 1000 }, // 5 запросов в минуту
  '/api/products/batch': { maxRequests: 30, interval: 60 * 1000 }, // 30 запросов в минуту
  '/api/recommendations': { maxRequests: 20, interval: 60 * 1000 }, // 20 запросов в минуту
  '/api/admin/login': { maxRequests: 3, interval: 15 * 60 * 1000 }, // 3 попытки за 15 минут (защита от брутфорса)
  '/api/wishlist': { maxRequests: 30, interval: 60 * 1000 }, // 30 запросов в минуту
  '/api/cart': { maxRequests: 30, interval: 60 * 1000 }, // 30 запросов в минуту
  '/api/plan/progress': { maxRequests: 20, interval: 60 * 1000 }, // 20 запросов в минуту
};

// Публичные маршруты - теперь большинство пользовательских маршрутов публичные
// Они используют initData из заголовков для идентификации
const publicRoutes = [
  '/api/questionnaire/active', // Публичный доступ к анкете
  '/api/questionnaire/answers', // Использует initData напрямую
  '/api/questionnaire/progress', // Использует initData напрямую
  '/api/plan/generate', // Использует initData напрямую
  '/api/recommendations', // Использует initData напрямую
  '/api/profile/current', // Использует initData напрямую
  '/api/cart', // Использует initData напрямую
  '/api/wishlist', // Использует initData напрямую
  '/api/telegram/webhook', // Webhook от Telegram
  '/api/admin/login', // Публичный endpoint для входа в админку (не требует JWT)
  '/api/admin/auth', // Публичный endpoint для авторизации через Telegram initData (не требует JWT)
  '/api/admin/verify', // Проверка токена админа (проверяет токен сам, не требует предварительной авторизации)
  '/admin/login',
  '/admin/set-webhook', // Страница установки webhook
  '/admin/webhook-status', // Страница статуса webhook
  '/api/debug', // Отладочные endpoints
  '/debug', // Отладочные страницы
  '/logs', // Страница логов
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limiting для критичных endpoints
  for (const [route, limits] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(route)) {
      const identifier = getIdentifier(request);
      
      // Определяем тип лимитера
      let limiterType: 'plan' | 'answers' | 'recommendations' | 'admin' = 'plan';
      if (route.includes('plan/generate') || route.includes('plan/progress')) limiterType = 'plan';
      else if (route.includes('questionnaire/answers') || route.includes('questionnaire/partial-update')) limiterType = 'answers';
      else if (route.includes('recommendations') || route.includes('products/batch') || route.includes('wishlist') || route.includes('cart')) limiterType = 'recommendations';
      else if (route.includes('admin/login')) limiterType = 'admin';
      
      const result = await rateLimit(identifier, limits, limiterType);
      
      if (!result.success) {
        const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
        return NextResponse.json(
          { 
            error: 'Too many requests. Please try again later.',
            retryAfter,
          },
          { 
            status: 429,
            headers: {
              'Retry-After': String(retryAfter),
              'X-RateLimit-Limit': String(limits.maxRequests),
              'X-RateLimit-Remaining': String(result.remaining),
              'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
            },
          }
        );
      }
    }
  }

  // Пропускаем публичные маршруты
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Для API маршрутов (кроме публичных) проверяем токен
  if (pathname.startsWith('/api/')) {
    // Пропускаем публичные API маршруты
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
    if (isPublicRoute) {
      return NextResponse.next();
    }

    // Для админских роутов проверяем наличие admin_token
    // НО: /api/admin/auth (GET и POST) - публичные, они сами проверяют токен
    // ВАЖНО: Полная валидация JWT делается в API routes (Node.js runtime), здесь только проверка наличия
    if (pathname.startsWith('/api/admin/') && !pathname.startsWith('/api/admin/auth')) {
      // Проверяем наличие токена из cookies ИЛИ из Authorization header
      const cookieToken = request.cookies.get('admin_token')?.value;
      const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
      const adminToken = cookieToken || headerToken;

      if (!adminToken) {
        // Токен отсутствует - блокируем запрос
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Токен присутствует - пропускаем в API route, где будет полная валидация JWT
      return NextResponse.next();
    }

    // Для остальных API маршрутов (не публичных, не админских)
    // В Edge Runtime не поддерживается Node.js crypto, поэтому полная валидация JWT
    // делается в API routes (Node.js runtime)
    // Здесь просто пропускаем запрос в API route, где будет выполнена валидация
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    // Можно добавить защиту для админ-панели
    // '/admin/:path*',
  ],
};
