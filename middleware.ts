// middleware.ts
// Middleware для проверки JWT токена и rate limiting

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { rateLimit, getIdentifier } from './lib/rate-limit';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Настройки rate limiting для разных endpoints
const RATE_LIMITS: Record<string, { maxRequests: number; interval: number }> = {
  '/api/plan/generate': { maxRequests: 10, interval: 60 * 1000 }, // 10 запросов в минуту
  '/api/questionnaire/answers': { maxRequests: 5, interval: 60 * 1000 }, // 5 запросов в минуту
  '/api/recommendations': { maxRequests: 20, interval: 60 * 1000 }, // 20 запросов в минуту
  '/api/admin/login': { maxRequests: 3, interval: 15 * 60 * 1000 }, // 3 попытки за 15 минут (защита от брутфорса)
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
      if (route.includes('plan/generate')) limiterType = 'plan';
      else if (route.includes('questionnaire/answers')) limiterType = 'answers';
      else if (route.includes('recommendations')) limiterType = 'recommendations';
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

    // Для админских роутов проверяем admin_token
    // НО: /api/admin/auth (GET и POST) - публичные, они сами проверяют токен
    if (pathname.startsWith('/api/admin/') && !pathname.startsWith('/api/admin/auth')) {
      // Проверяем токен из cookies ИЛИ из Authorization header
      const cookieToken = request.cookies.get('admin_token')?.value;
      const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
      const adminToken = cookieToken || headerToken;

      console.log('🔐 Middleware check for', pathname);
      console.log('   Cookie token exists:', !!cookieToken);
      console.log('   Header token exists:', !!headerToken);
      console.log('   Final token exists:', !!adminToken);

      if (!adminToken) {
        console.log('❌ No admin token found');
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      try {
        jwt.verify(adminToken, JWT_SECRET);
        console.log('✅ Admin token verified in middleware');
        return NextResponse.next();
      } catch (error) {
        console.log('❌ Admin token verification failed:', error);
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 401 }
        );
      }
    }

    // Для остальных API маршрутов проверяем auth_token
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    try {
      jwt.verify(token, JWT_SECRET);
      return NextResponse.next();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
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
