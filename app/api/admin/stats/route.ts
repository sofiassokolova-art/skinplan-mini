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
    
    // Получаем параметр периода из query string
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // day, week, month
    
    // ИСПРАВЛЕНО (P0): Кэш учитывает period
    const cacheKey = `admin_stats:${period}`;
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
      // ИСПРАВЛЕНО (P0): Считаем количество активных планов по таблице Plan28
      // План считается активным, если у пользователя есть хотя бы один план
      prisma.plan28.groupBy({
        by: ['userId'],
      }).then(groups => groups.length).catch(err => {
        console.error('❌ Error counting active plans:', err);
        // Fallback: считаем по профилям, если Plan28 недоступен
        return prisma.skinProfile.groupBy({
          by: ['userId'],
        }).then(groups => groups.length).catch(() => 0);
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
      // Считаем пользователей, которые действительно перепрошли анкету:
      // у пользователя должно быть больше одного профиля (несколько версий).
      // Это не зависит от номера версии анкеты (questionnaire.version).
      prisma.skinProfile.groupBy({
        by: ['userId'],
        _count: {
          _all: true,
        },
        having: {
          _count: {
            _all: {
              gt: 1,
            },
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

    // ИСПРАВЛЕНО (P1): Вычисляем доход партнёрки через оптимизированный запрос
    // Берём только необходимые поля (productId и price) для минимизации памяти
    const revenue = await prisma.wishlistFeedback
      .findMany({
        where: {
          feedback: {
            in: ['bought_love', 'bought_ok', 'bought_bad'],
          },
        },
        select: {
          product: {
            select: {
              price: true,
            },
          },
        },
      })
      .then((feedbacks) => {
        return feedbacks.reduce((sum, f) => sum + (f.product?.price || 0), 0);
      })
      .catch((err) => {
        console.error('❌ Error calculating revenue:', err);
        return 0;
      });

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
    
    // ИСПРАВЛЕНО (P2): Единый подход к timezone - используем UTC для всех периодов
    // Считаем новых пользователей по периодам
    usersInPeriod.forEach(user => {
      let key: string;
      const date = new Date(user.createdAt);
      
      if (dateFormat === 'day') {
        // Группируем по часам: "YYYY-MM-DD HH:00" (UTC)
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hour = String(date.getUTCHours()).padStart(2, '0');
        key = `${year}-${month}-${day} ${hour}:00`;
      } else {
        // Группируем по дням: "YYYY-MM-DD" (UTC)
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        key = `${year}-${month}-${day}`;
      }
      usersByKey.set(key, (usersByKey.get(key) || 0) + 1);
    });
    
    // Формируем данные для графика
    let cumulativeUsers = usersBeforePeriod;
    
    // ИСПРАВЛЕНО (P2): Единый подход к timezone - используем UTC для всех периодов
    if (dateFormat === 'day') {
      // Для дня показываем последние 24 часа по часам (UTC)
      for (let i = 23; i >= 0; i--) {
        const date = new Date(now);
        date.setUTCHours(date.getUTCHours() - i, 0, 0, 0);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hour = String(date.getUTCHours()).padStart(2, '0');
        const key = `${year}-${month}-${day} ${hour}:00`;
        
        const newUsersInHour = usersByKey.get(key) || 0;
        cumulativeUsers += newUsersInHour;
        
        userGrowthData.push({
          date: `${hour}:00`,
          users: cumulativeUsers,
        });
      }
    } else if (dateFormat === 'week') {
      // Для недели показываем по дням (7 дней) (UTC)
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - i);
        date.setUTCHours(0, 0, 0, 0);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const key = `${year}-${month}-${day}`;
        
        const newUsersToday = usersByKey.get(key) || 0;
        cumulativeUsers += newUsersToday;
        
        userGrowthData.push({
          date: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
          users: cumulativeUsers,
        });
      }
    } else {
      // Для месяца показываем по дням (30 дней) (UTC)
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - i);
        date.setUTCHours(0, 0, 0, 0);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const key = `${year}-${month}-${day}`;
        
        const newUsersToday = usersByKey.get(key) || 0;
        cumulativeUsers += newUsersToday;
        
        userGrowthData.push({
          date: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
          users: cumulativeUsers,
        });
      }
    }

    const responseData = {
      period, // ИСПРАВЛЕНО (P0): Добавляем period в ответ для дебага
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
      recentFeedback: (() => {
        // ИСПРАВЛЕНО (P1): Логируем количество отфильтрованных записей
        const totalCount = recentFeedback.length;
        const filtered = recentFeedback.filter((f) => f.user && f.product && f.product.brand);
        const filteredCount = filtered.length;
        
        if (totalCount !== filteredCount) {
          console.warn(`⚠️ Filtered ${totalCount - filteredCount} feedback entries without user/product/brand`);
        }
        
        return filtered.map((f) => ({
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
      }));
      })(),
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

