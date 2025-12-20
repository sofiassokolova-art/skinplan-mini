// app/api/admin/stats/route.ts
// API для статистики админки

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMetricsStats } from '@/lib/admin-stats';
import { verifyAdminBoolean } from '@/lib/admin-auth';
import { adminCache } from '@/lib/admin-cache';

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Проверяем кеш (TTL 2 минуты для статистики)
    const cacheKey = 'admin_stats';
    const cached = adminCache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
    
    // Получаем количество пользователей
    const usersCount = await prisma.user.count().catch(() => 0);
    
    const [
      productsCount,
      plansCount,
      badFeedbackCount,
      replacementsCount,
      recentFeedback,
      retakingUsersCount,
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
        where: {
          // Показываем только отзывы о купленных продуктах
          feedback: {
            in: ['bought_love', 'bought_ok', 'bought_bad'],
          },
        },
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
      // Считаем пользователей, которые перепрошли анкету (профили с version > 1)
      prisma.skinProfile.groupBy({
        by: ['userId'],
        where: {
          version: {
            gt: 1, // Версия больше 1 означает перепрохождение
          },
        },
      }).then(groups => groups.length).catch(err => {
        console.error('❌ Error counting retaking users:', err);
        return 0;
      }),
    ]);


    // Получаем расширенные метрики
    const metrics = await getMetricsStats().catch(err => {
      console.error('❌ Error fetching metrics:', err);
      return null;
    });

    // Вычисляем доход партнёрки (сумма цен только купленных продуктов)
    // Считаем только продукты с отзывами bought_love, bought_ok, bought_bad
    const revenue = await prisma.wishlistFeedback
      .findMany({
        where: {
          feedback: {
            in: ['bought_love', 'bought_ok', 'bought_bad'],
          },
        },
        include: {
          product: {
            select: {
              price: true,
            },
          },
        },
      })
      .then((feedbacks) => {
        return feedbacks.reduce((sum, f) => sum + (f.product.price || 0), 0);
      })
      .catch((err) => {
        console.error('❌ Error calculating revenue:', err);
        return 0;
      });

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

    const responseData = {
      stats: {
        users: usersCount,
        products: productsCount,
        plans: plansCount,
        badFeedback: badFeedbackCount,
        replacements: replacementsCount,
        revenue,
        retakingUsers: retakingUsersCount, // Пользователи, которые перепрошли анкету
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
      recentFeedback: recentFeedback
        .filter((f) => f.user && f.product && f.product.brand) // Фильтруем некорректные данные
        .map((f) => ({
        id: f.id,
        user: {
            firstName: f.user?.firstName || null,
            lastName: f.user?.lastName || null,
        },
        product: {
            name: f.product?.name || 'Неизвестный продукт',
            brand: f.product?.brand?.name || 'Неизвестный бренд',
        },
        feedback: f.feedback,
          createdAt: f.createdAt.toISOString(),
      })),
    };

    // Сохраняем в кеш на 2 минуты
    adminCache.set(cacheKey, responseData, 120);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('❌ Error fetching admin stats:', error);
    
    // Возвращаем базовую структуру с нулевыми значениями, чтобы фронтенд не сломался
    return NextResponse.json(
      {
        stats: {
          users: 0,
          products: 0,
          plans: 0,
          badFeedback: 0,
          replacements: 0,
          revenue: 0,
          retakingUsers: 0,
        },
        userGrowth: [],
        topProducts: [],
        recentFeedback: [],
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

