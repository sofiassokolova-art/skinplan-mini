// Вход в админку по email + коду. Код пользователь задаёт сам при первом входе.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signAdminToken } from '@/lib/jwt';
import { rateLimit, getIdentifier } from '@/lib/rate-limit';

// Edge-compatible password hashing via PBKDF2 (Web Crypto API)
async function hashCode(code: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
    keyMaterial, 256
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${hashHex}`;
}

async function verifyCode(code: string, stored: string): Promise<boolean> {
  // Support legacy bcrypt hashes (stored in DB, starts with $2)
  if (stored.startsWith('$2')) {
    // bcrypt not available in edge — treat as mismatch, user must reset code
    return false;
  }
  const [, saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 },
    keyMaterial, 256
  );
  const candidateHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('');
  // Сравнение за постоянное время — не сливаем timing о коде доступа админа.
  if (candidateHex.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < candidateHex.length; i++) diff |= candidateHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

function issueSessionResponse(token: string, id: string) {
  const res = NextResponse.json({ valid: true, admin: { id, role: 'admin' }, token });
  res.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
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
      return NextResponse.json({ error: 'Слишком много попыток. Попробуйте позже.', code: 'RATE_LIMIT' }, { status: 429 });
    }

    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ error: 'Ошибка конфигурации сервера (JWT_SECRET).', code: 'CONFIG_ERROR' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code : '';
    const newCode = typeof body.newCode === 'string' ? body.newCode : '';
    const confirmCode = typeof body.confirmCode === 'string' ? body.confirmCode : '';

    if (!email) {
      return NextResponse.json({ error: 'Введите email', code: 'MISSING_EMAIL' }, { status: 400 });
    }

    const row = await prisma.adminEmailWhitelist.findUnique({ where: { email } });
    if (!row) {
      return NextResponse.json({ error: 'Этот email не допущен к админке.', code: 'EMAIL_NOT_ALLOWED' }, { status: 401 });
    }

    // Первый вход или сброс: задаём новый код
    if (!row.passwordHash || row.passwordHash.startsWith('$2')) {
      if (!newCode || newCode.length < 6) {
        return NextResponse.json({ error: 'Придумайте код не менее 6 символов.', code: 'SET_CODE_REQUIRED', needSetCode: true }, { status: 400 });
      }
      if (newCode !== confirmCode) {
        return NextResponse.json({ error: 'Коды не совпадают.', code: 'CONFIRM_MISMATCH', needSetCode: true }, { status: 400 });
      }
      const passwordHash = await hashCode(newCode);
      await prisma.adminEmailWhitelist.update({ where: { id: row.id }, data: { passwordHash, updatedAt: new Date() } });
      const token = await signAdminToken({ adminId: String(row.id), role: 'admin', source: 'email' });
      return issueSessionResponse(token, String(row.id));
    }

    if (!code) {
      return NextResponse.json({ error: 'Введите ваш код доступа.', code: 'MISSING_CODE' }, { status: 400 });
    }

    const match = await verifyCode(code, row.passwordHash);
    if (!match) {
      return NextResponse.json({ error: 'Неверный код.', code: 'INVALID_CODE' }, { status: 401 });
    }

    const token = await signAdminToken({ adminId: String(row.id), role: 'admin', source: 'email' });
    return issueSessionResponse(token, String(row.id));
  } catch (e) {
    console.error('Admin login-email error:', e);
    return NextResponse.json({ error: 'Ошибка сервера.', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
