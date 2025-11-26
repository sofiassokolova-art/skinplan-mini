// app/api/admin/verify/route.ts
// Проверка токена админа

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function GET(request: NextRequest) {
  try {
    // Получаем токен из заголовка Authorization или из Cookie
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || 
                  request.cookies.get('admin_token')?.value;

    if (!token) {
      console.log('⚠️ No token provided in /api/admin/verify');
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        adminId: string | number;
        role?: string;
      };

      // Проверка роли опциональна - просто проверяем, что токен валидный
      console.log('✅ Token verified successfully:', {
        adminId: decoded.adminId,
        role: decoded.role,
      });

      return NextResponse.json({ 
        valid: true, 
        adminId: decoded.adminId,
        role: decoded.role || 'admin',
      });
    } catch (error) {
      console.warn('⚠️ Token verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

