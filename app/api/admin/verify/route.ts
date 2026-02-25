// app/api/admin/verify/route.ts
// Проверка токена админа

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    const cookieToken = request.cookies.get('admin_token')?.value;
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = cookieToken ?? bearerToken;

    if (!token) {
      return NextResponse.json(
        { error: 'No token provided' },
        { status: 401 }
      );
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    try {
      const decoded = jwt.verify(token, secret, {
        issuer: 'skiniq-admin',
        audience: 'skiniq-admin-ui',
      }) as {
        adminId: string | number;
        role?: string;
      };

      return NextResponse.json({
        valid: true,
        adminId: decoded.adminId,
        role: decoded.role || 'admin',
      });
    } catch {
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
