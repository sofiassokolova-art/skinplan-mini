// app/api/admin/cleanup-logs/route.ts
// API для ручной очистки логов старше 7 дней

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';
import { logger } from '@/lib/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const cookieToken = request.cookies.get('admin_token')?.value;
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;
    
    if (!token) {
      return false;
    }

    try {
      jwt.verify(token, JWT_SECRET);
      return true;
    } catch (verifyError) {
      return false;
    }
  } catch (err) {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Удаляем логи старше 7 дней
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const deleted = await prisma.clientLog.deleteMany({
      where: {
        createdAt: {
          lt: weekAgo,
        },
      },
    });

    logger.info(`Manually cleaned up ${deleted.count} old client logs`, {
      olderThan: weekAgo.toISOString(),
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleted.count,
      olderThan: weekAgo.toISOString(),
    });
  } catch (error: any) {
    logger.error('Error cleaning up logs', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

