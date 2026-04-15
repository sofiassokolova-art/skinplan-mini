// Проверка токена админа

export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/jwt';

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

    const result = await verifyAdminToken(token);
    if (!result.valid || !result.payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json({
      valid: true,
      adminId: result.payload.adminId,
      role: result.payload.role || 'admin',
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
