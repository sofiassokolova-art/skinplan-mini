// Авторизация админа по секретному слову

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signAdminToken } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import { rateLimit, getIdentifier } from '@/lib/rate-limit';
import { timingSafeEqual } from '@/lib/timing-safe';

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

// Edge-compatible SHA-256 hash comparison
async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest) {
  try {
    const identifier = getIdentifier(request);
    const rateLimitResult = await rateLimit(
      `admin-login:${identifier}`,
      { interval: 60 * 1000, maxRequests: 5 },
      'admin-login'
    );

    if (!rateLimitResult.success) {
      logger.warn('Admin login rate limit exceeded', { identifier });
      return NextResponse.json(
        { error: 'Слишком много попыток входа. Попробуйте позже.', code: 'RATE_LIMIT_EXCEEDED', resetAt: rateLimitResult.resetAt },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } }
      );
    }

    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ error: 'Server configuration error. JWT_SECRET must be set.' }, { status: 500 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Неверный формат запроса' }, { status: 400 });
    }

    const { secretWord } = body;
    if (!secretWord) {
      return NextResponse.json({ error: 'Требуется секретное слово' }, { status: 400 });
    }

    if (!ADMIN_SECRET) {
      return NextResponse.json({ error: 'Секретное слово не настроено на сервере.' }, { status: 500 });
    }

    const secretHash = await sha256Hex(secretWord.trim());
    const expectedHash = await sha256Hex(ADMIN_SECRET.trim());

    if (!timingSafeEqual(secretHash, expectedHash)) {
      logger.warn('Invalid admin login attempt');
      return NextResponse.json({ error: 'Неверное секретное слово.' }, { status: 401 });
    }

    let admin = await prisma.admin.findFirst({ where: { role: 'admin' } });
    if (!admin) {
      admin = await prisma.admin.create({ data: { role: 'admin' } });
    }

    const token = await signAdminToken({ adminId: admin.id, role: admin.role || 'admin' });

    logger.info('Admin logged in via secret word', { adminId: admin.id });

    const response = NextResponse.json({ valid: true, admin: { id: admin.id, role: admin.role } });
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    logger.error('Admin login error', error as Error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
