// app/api/admin/login/route.ts
// Авторизация админа по секретному слову

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// ИСПРАВЛЕНО: Убрали хардкод JWT секрета - теперь обязательная переменная
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    // ИСПРАВЛЕНО: Проверяем JWT_SECRET перед использованием
    if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
      logger.error('JWT_SECRET not configured or using default value', {
        hasJwtSecret: !!JWT_SECRET,
        isDefault: JWT_SECRET === 'your-secret-key-change-in-production',
      });
      return NextResponse.json(
        { error: 'Server configuration error. JWT_SECRET must be set in environment variables.' },
        { status: 500 }
      );
    }

    // Логируем входящий запрос (для отладки)
    logger.info('Admin login request received', {
      timestamp: new Date().toISOString(),
      hasBody: !!request.body,
      adminSecretSet: !!ADMIN_SECRET && ADMIN_SECRET !== '',
      adminSecretLength: ADMIN_SECRET ? ADMIN_SECRET.length : 0,
    });

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      logger.error('Failed to parse request body', parseError as Error);
      return NextResponse.json(
        { error: 'Неверный формат запроса' },
        { status: 400 }
      );
    }

    const { secretWord } = body;

    if (!secretWord) {
      logger.warn('Secret word not provided in request');
      return NextResponse.json(
        { error: 'Требуется секретное слово' },
        { status: 400 }
      );
    }

    if (!ADMIN_SECRET || ADMIN_SECRET === '') {
      logger.error('ADMIN_SECRET not configured in environment variables');
      return NextResponse.json(
        { error: 'Секретное слово не настроено на сервере. Проверьте переменные окружения на Vercel.' },
        { status: 500 }
      );
    }

    // Проверяем секретное слово (сравниваем в виде хэша для безопасности)
    const secretHash = crypto
      .createHash('sha256')
      .update(secretWord.trim())
      .digest('hex');
    
    const expectedHash = crypto
      .createHash('sha256')
      .update(ADMIN_SECRET.trim())
      .digest('hex');

    // Логирование для отладки
    logger.info('Admin login attempt', {
      secretWordLength: secretWord.trim().length,
      adminSecretLength: ADMIN_SECRET.trim().length,
      hashesMatch: secretHash === expectedHash,
      environment: process.env.NODE_ENV || 'unknown',
    });

    if (secretHash !== expectedHash) {
      logger.warn('Invalid admin login attempt', {
        timestamp: new Date().toISOString(),
        providedLength: secretWord.trim().length,
      });
      return NextResponse.json(
        { error: 'Неверное секретное слово. Проверьте правильность ввода.' },
        { status: 401 }
      );
    }

    // Получаем или создаём админа по умолчанию
    let admin = await prisma.admin.findFirst({
      where: {
        role: 'admin',
      },
    });

    if (!admin) {
      // Создаём админа по умолчанию, если его нет
      admin = await prisma.admin.create({
        data: {
          role: 'admin',
        },
      });
      logger.info('Default admin created', { adminId: admin.id });
    }

    // ИСПРАВЛЕНО (P2): Генерируем JWT токен с issuer/audience для безопасности
    const token = jwt.sign(
      {
        adminId: admin.id,
        role: admin.role || 'admin',
      },
      JWT_SECRET!, // Теперь мы уверены, что JWT_SECRET не null
      {
        expiresIn: '7d',
        issuer: 'skiniq-admin',
        audience: 'skiniq-admin-ui',
      }
    );

    logger.info('Admin logged in via secret word', { 
      adminId: admin.id, 
      role: admin.role,
      timestamp: new Date().toISOString(),
    });

    // ИСПРАВЛЕНО (P1): Убрали token из JSON ответа - cookie-only подход
    const response = NextResponse.json({
      valid: true,
      admin: {
        id: admin.id,
        role: admin.role,
      },
    });

    // ИСПРАВЛЕНО (P0): httpOnly: true для защиты от XSS
    response.cookies.set('admin_token', token, {
      httpOnly: true, // ИСПРАВЛЕНО (P0): Защита от XSS
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      path: '/',
    });

    return response;
  } catch (error) {
    logger.error('Admin login error', error as Error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
