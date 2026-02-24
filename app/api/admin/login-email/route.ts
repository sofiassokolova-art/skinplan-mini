// app/api/admin/login-email/route.ts
// Вход в админку по email + коду. Код пользователь задаёт сам при первом входе.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { rateLimit, getIdentifier } from '@/lib/rate-limit';

const JWT_SECRET = process.env.JWT_SECRET;

function getJwtSecret(): { valid: boolean; secret?: string } {
  if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
    return { valid: false };
  }
  return { valid: true, secret: JWT_SECRET };
}

export async function POST(request: NextRequest) {
  try {
    const identifier = getIdentifier(request);
    const rateLimitResult = await rateLimit(
      `admin-login-email:${identifier}`,
      { interval: 60 * 1000, maxRequests: 10 },
      'admin-login-email'
    );
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Слишком много попыток. Попробуйте позже.', code: 'RATE_LIMIT' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code : '';
    const newCode = typeof body.newCode === 'string' ? body.newCode : '';
    const confirmCode = typeof body.confirmCode === 'string' ? body.confirmCode : '';

    if (!email) {
      return NextResponse.json(
        { error: 'Введите email', code: 'MISSING_EMAIL' },
        { status: 400 }
      );
    }

    const jwtSecretResult = getJwtSecret();
    if (!jwtSecretResult.valid || !jwtSecretResult.secret) {
      return NextResponse.json(
        { error: 'Ошибка конфигурации сервера (JWT_SECRET).', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    const row = await prisma.adminEmailWhitelist.findUnique({
      where: { email },
    });

    if (!row) {
      return NextResponse.json(
        { error: 'Этот email не допущен к админке.', code: 'EMAIL_NOT_ALLOWED' },
        { status: 401 }
      );
    }

    // Первый вход: код ещё не задан — принимаем newCode и confirmCode
    if (!row.passwordHash) {
      if (!newCode || newCode.length < 6) {
        return NextResponse.json(
          { error: 'Придумайте код не менее 6 символов.', code: 'SET_CODE_REQUIRED', needSetCode: true },
          { status: 400 }
        );
      }
      if (newCode !== confirmCode) {
        return NextResponse.json(
          { error: 'Коды не совпадают.', code: 'CONFIRM_MISMATCH', needSetCode: true },
          { status: 400 }
        );
      }
      const passwordHash = await bcrypt.hash(newCode, 10);
      await prisma.adminEmailWhitelist.update({
        where: { id: row.id },
        data: { passwordHash, updatedAt: new Date() },
      });
      // Выдаём сессию после установки кода
      const token = jwt.sign(
        { adminId: String(row.id), role: 'admin', source: 'email' },
        jwtSecretResult.secret,
        { expiresIn: '7d', issuer: 'skiniq-admin', audience: 'skiniq-admin-ui' }
      );
      // Токен в теле — для WebView (Telegram), где куки могут не сохраняться
      const res = NextResponse.json({ valid: true, admin: { id: String(row.id), role: 'admin' }, token });
      res.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      return res;
    }

    // Обычный вход: проверяем код
    if (!code) {
      return NextResponse.json(
        { error: 'Введите ваш код доступа.', code: 'MISSING_CODE' },
        { status: 400 }
      );
    }

    const match = await bcrypt.compare(code, row.passwordHash);
    if (!match) {
      return NextResponse.json(
        { error: 'Неверный код.', code: 'INVALID_CODE' },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      { adminId: String(row.id), role: 'admin', source: 'email' },
      jwtSecretResult.secret,
      { expiresIn: '7d', issuer: 'skiniq-admin', audience: 'skiniq-admin-ui' }
    );
    const res = NextResponse.json({ valid: true, admin: { id: String(row.id), role: 'admin' }, token });
    res.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return res;
  } catch (e) {
    console.error('Admin login-email error:', e);
    return NextResponse.json(
      { error: 'Ошибка сервера.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
