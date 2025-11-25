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
    const body = await request.json();
    const { secretWord } = body;

    if (!secretWord) {
      return NextResponse.json(
        { error: 'Требуется секретное слово' },
        { status: 400 }
      );
    }

    if (!ADMIN_SECRET) {
      console.error('❌ ADMIN_SECRET не настроен в переменных окружения');
      return NextResponse.json(
        { error: 'Секретное слово не настроено на сервере' },
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

    if (secretHash !== expectedHash) {
      console.warn('⚠️ Неверная попытка входа в админ-панель');
      return NextResponse.json(
        { error: 'Неверное секретное слово' },
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
