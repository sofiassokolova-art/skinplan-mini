// app/api/admin/stats/route.ts
// API для статистики админки

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMetricsStats } from '@/lib/admin-stats';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Проверка авторизации админа
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
    console.error('Error in verifyAdmin:', err);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Проверяем подключение к БД перед запросами
    try {
      await prisma.$connect();
    } catch (connectError) {
      console.error('Database connection error:', connectError);
      throw connectError;
    }
    
    // Выполняем запросы последовательно
    let usersCount = 0;
    try {
      usersCount = await prisma.user.count();
    } catch (userError) {
      console.error('Error counting users:', userError);
      throw userError;
    }
    
    const [
      productsCount,
      plansCount,
      badFeedbackCount,
      replacementsCount,
      recentFeedback,
    ] = await Promise.all([
      prisma.product.count({ where: { published: true } }).catch(err => {
        console.error('❌ Error counting products:', err);
        return 0;
      }),
      prisma.skinProfile.count().catch(err => {
        console.error('❌ Error counting skin profiles:', err);
        return 0;
      }),
      prisma.wishlistFeedback.count({ where: { feedback: 'bought_bad' } }).catch(err => {
        console.error('❌ Error counting bad feedback:', err);
        return 0;
      }),
      prisma.productReplacement.count().catch(err => {
        console.error('❌ Error counting replacements:', err);
        return 0;
      }),
      prisma.wishlistFeedback.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              telegramId: true,
            },
          },
          product: {
            include: {
              brand: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }).catch(err => {
        console.error('❌ Error fetching recent feedback:', err);
        return [];
      }),
    ]);


    // Получаем расширенные метрики
    const metrics = await getMetricsStats().catch(err => {
      console.error('❌ Error fetching metrics:', err);
      return null;
    });

    // Вычисляем примерный доход (сумма цен всех продуктов в вишлистах)
    const revenue = await prisma.wishlist
      .findMany({
        include: {
          product: {
            select: {
              price: true,
            },
          },
        },
      })
      .then((wishlists) => {
        return wishlists.reduce((sum, w) => sum + (w.product.price || 0), 0);
      })
      .catch(() => 0);

    // Получаем данные роста пользователей за последние 30 дней (оптимизированно - один запрос)
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    
    // Получаем всех пользователей за последние 30 дней
    const usersInPeriod = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    }).catch(() => []);
    
    // Получаем общее количество пользователей до периода
    const usersBeforePeriod = await prisma.user.count({
      where: {
        createdAt: {
          lt: startDate,
        },
      },
    }).catch(() => 0);
    
    // Группируем по датам и считаем накопительный итог
    const userGrowthData = [];
    const usersByDate = new Map<string, number>();
    
    // Считаем новых пользователей по дням
    usersInPeriod.forEach(user => {
      const dateKey = user.createdAt.toISOString().split('T')[0];
      usersByDate.set(dateKey, (usersByDate.get(dateKey) || 0) + 1);
    });
    
    // Формируем данные для графика (30 дней)
    let cumulativeUsers = usersBeforePeriod;
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0];
      
      // Добавляем пользователей, созданных в этот день
      const newUsersToday = usersByDate.get(dateKey) || 0;
      cumulativeUsers += newUsersToday;
      
      userGrowthData.push({
        date: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
        users: cumulativeUsers,
      });
    }

    return NextResponse.json({
      stats: {
        users: usersCount,
        products: productsCount,
        plans: plansCount,
        badFeedback: badFeedbackCount,
        replacements: replacementsCount,
        revenue,
        // Расширенные метрики (если доступны)
        ...(metrics && {
          churnRate: metrics.churnRate,
          avgLTV: metrics.avgLTV,
          newUsersLast7Days: metrics.newUsersLast7Days,
          newUsersLast30Days: metrics.newUsersLast30Days,
          activeUsersLast7Days: metrics.activeUsersLast7Days,
          activeUsersLast30Days: metrics.activeUsersLast30Days,
          totalWishlistItems: metrics.totalWishlistItems,
          totalProductFeedback: metrics.totalProductFeedback,
          avgFeedbackRating: metrics.avgFeedbackRating,
        }),
      },
      userGrowth: userGrowthData,
      topProducts: metrics?.topProducts || [],
      recentFeedback: recentFeedback.map((f) => ({
        id: f.id,
        user: {
          firstName: f.user.firstName,
          lastName: f.user.lastName,
        },
        product: {
          name: f.product.name,
          brand: f.product.brand.name,
        },
        feedback: f.feedback,
        createdAt: f.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

