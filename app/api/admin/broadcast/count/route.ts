// app/api/admin/broadcast/count/route.ts
// Подсчет пользователей по фильтрам

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const filters = body.filters || {};

    // Если выбрано "всем пользователям", возвращаем общее количество
    if (filters.sendToAll) {
      const totalCount = await prisma.user.count();
      return NextResponse.json({ count: totalCount });
    }

    const where: any = {};

    // Фильтр по типу кожи и проблемам (из последнего профиля)
    if ((filters.skinTypes && filters.skinTypes.length > 0) || (filters.concerns && filters.concerns.length > 0)) {
      const skinProfileConditions: any[] = [];
      
      if (filters.skinTypes && filters.skinTypes.length > 0) {
        skinProfileConditions.push({
          skinType: { in: filters.skinTypes },
        });
      }
      
      if (filters.concerns && filters.concerns.length > 0) {
        // Фильтруем по notes (упрощенная фильтрация)
        skinProfileConditions.push({
          OR: filters.concerns.map((concern: string) => ({
            notes: {
              contains: concern,
              mode: 'insensitive',
            },
          })),
        });
      }
      
      where.skinProfiles = {
        some: skinProfileConditions.length > 1 ? { AND: skinProfileConditions } : skinProfileConditions[0],
      };
    }

    // Фильтр по дню плана (нужно будет добавить логику для currentPlan)
    if (filters.planDay) {
      // Пока пропускаем, нужно добавить логику для currentPlan
    }

    // Фильтр по последней активности
    if (filters.lastActive) {
      const now = new Date();
      if (filters.lastActive === '<7') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        where.lastActive = { gte: sevenDaysAgo };
      } else if (filters.lastActive === '7-30') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        where.lastActive = { gte: thirtyDaysAgo, lte: sevenDaysAgo };
      } else if (filters.lastActive === '30+') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        where.lastActive = { lte: thirtyDaysAgo };
      }
    }

    // Фильтр по покупкам (по тегам)
    if (filters.hasPurchases) {
      where.tags = { has: 'bought_spf' }; // Или другой тег для покупок
    }

    // Исключить беременных
    if (filters.excludePregnant) {
      where.skinProfiles = {
        some: {
          hasPregnancy: false,
        },
      };
    }

    const count = await prisma.user.count({ where });

    return NextResponse.json({ count });
  } catch (error: any) {
    console.error('Error counting users:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

