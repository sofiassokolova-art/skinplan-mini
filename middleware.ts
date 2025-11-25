// middleware.ts
// Middleware для проверки JWT токена

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
  '/admin/login',
  '/api/debug', // Отладочные endpoints
  '/debug', // Отладочные страницы
  '/logs', // Страница логов
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
