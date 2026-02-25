// middleware.ts
// Middleware для проверки JWT токена и rate limiting
// ВАЖНО: Edge Runtime не поддерживает Node.js crypto, поэтому полная валидация JWT делается в API routes

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimit, getIdentifier } from './lib/rate-limit';

// Настройки rate limiting для разных endpoints
const RATE_LIMITS: Record<string, { maxRequests: number; interval: number }> = {
  '/api/plan/generate': { maxRequests: 10, interval: 60 * 1000 },
  '/api/questionnaire/answers': { maxRequests: 15, interval: 60 * 1000 },
  '/api/questionnaire/partial-update': { maxRequests: 10, interval: 60 * 1000 },
  '/api/products/batch': { maxRequests: 30, interval: 60 * 1000 },
  '/api/recommendations': { maxRequests: 20, interval: 60 * 1000 },
  '/api/admin/login': { maxRequests: 5, interval: 15 * 60 * 1000 },
  '/api/admin/login-email': { maxRequests: 10, interval: 60 * 1000 },
  '/api/wishlist': { maxRequests: 30, interval: 60 * 1000 },
  '/api/cart': { maxRequests: 30, interval: 60 * 1000 },
  '/api/plan/progress': { maxRequests: 30, interval: 60 * 1000 },
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
  '/api/logs', // Публичный endpoint для логирования (использует initData для идентификации, но не требует строгой авторизации)
  '/api/admin/login', // Публичный endpoint для входа в админку (не требует JWT)
  '/api/admin/login-email', // Вход по email + коду
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
    // ИСПРАВЛЕНО: используем точное совпадение ИЛИ prefix + '/' вместо голого startsWith,
    // чтобы /api/admin/login не ловил /api/admin/login-email,
    // а /api/questionnaire/answers не ловил /api/questionnaire/answers/cleanup.
    if (pathname === route || pathname.startsWith(route + '/')) {
      const identifier = getIdentifier(request);
      const result = await rateLimit(identifier, limits, route);
      
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
      break;
    }
  }

  // Клонируем request и добавляем pathname для root layout (чтобы не грузить Telegram script на /admin)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  // Пропускаем публичные маршруты
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Для API маршрутов (кроме публичных) проверяем токен
  if (pathname.startsWith('/api/')) {
    // Пропускаем публичные API маршруты
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
    if (isPublicRoute) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Для админских роутов проверяем наличие admin_token (cookie или Bearer)
    // НО: /api/admin/auth (GET и POST) - публичные, они сами проверяют токен
    // Bearer нужен для WebView (Telegram), где куки могут не отправляться
    if (pathname.startsWith('/api/admin/') && !pathname.startsWith('/api/admin/auth')) {
      const cookieToken = request.cookies.get('admin_token')?.value;
      const authHeader = request.headers.get('authorization');
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const adminToken = cookieToken ?? bearerToken;

      if (!adminToken) {
        // Токен отсутствует - блокируем запрос
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Токен присутствует - пропускаем в API route, где будет полная валидация JWT
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // Для остальных API маршрутов (не публичных, не админских)
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/api/:path*',
    '/admin',
    '/admin/:path*',
    '/',
  ],
};
