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
      // Считаем количество уникальных пользователей с активными планами
      prisma.skinProfile.groupBy({
        by: ['userId'],
      }).then(groups => groups.length).catch(err => {
        console.error('❌ Error counting active plans:', err);
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

    // Получаем параметр периода из query string
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // day, week, month
    
    // Получаем данные роста пользователей за выбранный период
    const now = new Date();
    let startDate: Date;
    let dateFormat: 'day' | 'week' | 'month' = 'month';
    
    if (period === 'day') {
      // Для дня: последние 24 часа
      startDate = new Date(now);
      startDate.setHours(startDate.getHours() - 24);
      dateFormat = 'day';
    } else if (period === 'week') {
      // Для недели: последние 7 дней
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      dateFormat = 'week';
    } else {
      // Для месяца: последние 30 дней
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      dateFormat = 'month';
    }
    
    // Получаем всех пользователей за период
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
    
    // Группируем по датам/часам и считаем накопительный итог
    const userGrowthData = [];
    const usersByKey = new Map<string, number>();
    
    // Считаем новых пользователей по периодам
    usersInPeriod.forEach(user => {
      let key: string;
      if (dateFormat === 'day') {
        // Группируем по часам: "YYYY-MM-DD HH:00"
        const date = new Date(user.createdAt);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        key = `${year}-${month}-${day} ${hour}:00`;
      } else {
        // Группируем по дням: "YYYY-MM-DD"
        const date = new Date(user.createdAt);
        date.setHours(0, 0, 0, 0);
        key = date.toISOString().split('T')[0];
      }
      usersByKey.set(key, (usersByKey.get(key) || 0) + 1);
    });
    
    // Формируем данные для графика
    let cumulativeUsers = usersBeforePeriod;
    
    if (dateFormat === 'day') {
      // Для дня показываем последние 24 часа по часам
      for (let i = 23; i >= 0; i--) {
        const date = new Date(now);
        date.setHours(date.getHours() - i, 0, 0, 0);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const key = `${year}-${month}-${day} ${hour}:00`;
        
        const newUsersInHour = usersByKey.get(key) || 0;
        cumulativeUsers += newUsersInHour;
        
        userGrowthData.push({
          date: `${hour}:00`,
          users: cumulativeUsers,
        });
      }
    } else if (dateFormat === 'week') {
      // Для недели показываем по дням (7 дней)
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const key = date.toISOString().split('T')[0];
        
        const newUsersToday = usersByKey.get(key) || 0;
        cumulativeUsers += newUsersToday;
        
        userGrowthData.push({
          date: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
          users: cumulativeUsers,
        });
      }
    } else {
      // Для месяца показываем по дням (30 дней)
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const key = date.toISOString().split('T')[0];
        
        const newUsersToday = usersByKey.get(key) || 0;
        cumulativeUsers += newUsersToday;
        
        userGrowthData.push({
          date: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
          users: cumulativeUsers,
        });
      }
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

