// middleware.ts
// Middleware для проверки JWT токена

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Публичные маршруты, которые не требуют авторизации
const publicRoutes = ['/api/auth', '/admin/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Пропускаем публичные маршруты
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Для API маршрутов (кроме auth) проверяем токен
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
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
