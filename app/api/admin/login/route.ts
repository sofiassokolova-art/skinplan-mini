// app/api/admin/login/route.ts
// Авторизация админа по секретному слову

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    // Логируем входящий запрос (для отладки)
    console.log('🔐 Admin login request received', {
      timestamp: new Date().toISOString(),
      hasBody: !!request.body,
      adminSecretSet: !!ADMIN_SECRET && ADMIN_SECRET !== '',
      adminSecretLength: ADMIN_SECRET ? ADMIN_SECRET.length : 0,
    });

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Неверный формат запроса' },
        { status: 400 }
      );
    }

    const { secretWord } = body;

    if (!secretWord) {
      console.warn('⚠️ Secret word not provided in request');
      return NextResponse.json(
        { error: 'Требуется секретное слово' },
        { status: 400 }
      );
    }

    if (!ADMIN_SECRET || ADMIN_SECRET === '') {
      console.error('❌ ADMIN_SECRET не настроен в переменных окружения');
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
    console.log('🔍 Admin login attempt:', {
      secretWordLength: secretWord.trim().length,
      adminSecretLength: ADMIN_SECRET.trim().length,
      hashesMatch: secretHash === expectedHash,
      environment: process.env.NODE_ENV || 'unknown',
    });

    if (secretHash !== expectedHash) {
      console.warn('⚠️ Неверная попытка входа в админ-панель', {
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
      console.log('✅ Создан админ по умолчанию:', admin.id);
    }

    // Генерируем JWT токен
    const token = jwt.sign(
      {
        adminId: admin.id,
        role: admin.role || 'admin',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Admin logged in via secret word:', { 
      adminId: admin.id, 
      role: admin.role,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      token,
      admin: {
        id: admin.id,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
