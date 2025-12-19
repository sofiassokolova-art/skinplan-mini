// app/api/admin/logs/route.ts
// API для просмотра логов клиентов техподдержкой

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { verifyAdminBoolean } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  try {
    // Проверяем авторизацию админа
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Парсим query параметры
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const level = searchParams.get('level');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Строим фильтры
    const where: any = {};
    
    if (userId) {
      where.userId = userId;
    }
    
    if (level && ['debug', 'info', 'warn', 'error'].includes(level)) {
      where.level = level;
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Получаем логи
    const [logs, total] = await Promise.all([
      prisma.clientLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 1000), // Максимум 1000 записей за раз
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
      }),
      prisma.clientLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error fetching client logs', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE endpoint для ручной очистки старых логов
export async function DELETE(request: NextRequest) {
  try {
    // Проверяем авторизацию админа
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Парсим query параметры
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7');
    const userId = searchParams.get('userId');

    if (days < 1 || days > 30) {
      return NextResponse.json(
        { error: 'Days must be between 1 and 30' },
        { status: 400 }
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const where: any = {
      createdAt: {
        lt: cutoffDate,
      },
    };

    if (userId) {
      where.userId = userId;
    }

    const deleted = await prisma.clientLog.deleteMany({ where });

    logger.info(`Admin deleted ${deleted.count} client logs`, {
      days,
      userId,
      cutoffDate: cutoffDate.toISOString(),
    });

    return NextResponse.json({
      success: true,
      deleted: deleted.count,
    });
  } catch (error) {
    logger.error('Error deleting client logs', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

