// app/api/admin/cleanup-logs/route.ts
// API для ручной очистки логов старше 7 дней

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { verifyAdminBoolean } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
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

