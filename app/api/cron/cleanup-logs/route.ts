// app/api/cron/cleanup-logs/route.ts
// Cron job для автоматической очистки логов раз в неделю
// Настраивается через Vercel Cron Jobs

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Проверяем, что запрос пришел от Vercel Cron
// Vercel Cron передает специальный заголовок x-vercel-cron
function verifyCronRequest(request: NextRequest): boolean {
  // Проверяем заголовок от Vercel Cron
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  if (vercelCronHeader === '1') {
    return true;
  }
  
  // Fallback: проверяем authorization для ручных вызовов (если CRON_SECRET установлен)
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    return authHeader === `Bearer ${process.env.CRON_SECRET}`;
  }
  
  return false;
}

export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию (только Vercel Cron может вызывать этот endpoint)
    if (!verifyCronRequest(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('Starting weekly log cleanup');

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

    logger.info('Weekly log cleanup completed', {
      deletedCount: deleted.count,
      olderThan: weekAgo.toISOString(),
    });

    return NextResponse.json({
      success: true,
      deletedCount: deleted.count,
      olderThan: weekAgo.toISOString(),
    });
  } catch (error: any) {
    logger.error('Error in weekly log cleanup', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message },
      { status: 500 }
    );
  }
}

