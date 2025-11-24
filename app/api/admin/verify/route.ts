// app/api/admin/verify/route.ts
// Проверка токена админа

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        adminId: string;
        role?: string;
      };

      if (decoded.role !== 'admin' && decoded.role !== 'editor') {
        return NextResponse.json(
          { error: 'Invalid role' },
          { status: 403 }
        );
      }

      return NextResponse.json({ valid: true, adminId: decoded.adminId });
    } catch (error) {
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

