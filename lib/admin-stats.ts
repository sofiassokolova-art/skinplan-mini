// lib/admin-stats.ts
// Расширенная статистика для админ-дашборда

import { prisma } from './db';

interface MetricsStats {
  // Базовые метрики
  users: number;
  products: number;
  plans: number;
  badFeedback: number;
  replacements: number;
  
  // Новые метрики
  churnRate: number; // Процент оттока
  avgLTV: number; // Средний LTV (Lifetime Value)
  topProducts: Array<{
    id: number;
    name: string;
    brand: string;
    wishlistCount: number;
    feedbackCount: number;
    avgRating: number;
  }>;
  
  // Временные метрики
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;
  
  // Продуктовые метрики
  totalWishlistItems: number;
  totalProductFeedback: number;
  avgFeedbackRating: number;
}

/**
 * Вычисляет churn rate (процент оттока)
 * Churn = пользователи, которые не были активны >30 дней / общее количество пользователей
 */
async function calculateChurnRate(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Пользователи, которые не были активны более 30 дней
  const inactiveUsers = await prisma.user.count({
    where: {
      updatedAt: {
        lt: thirtyDaysAgo,
      },
      // Исключаем пользователей, созданных менее 30 дней назад (они еще новички)
      createdAt: {
        lt: thirtyDaysAgo,
      },
    },
  });

  // Общее количество пользователей (старше 30 дней)
  const totalUsers = await prisma.user.count({
    where: {
      createdAt: {
        lt: thirtyDaysAgo,
      },
    },
  });

  if (totalUsers === 0) return 0;
  return Math.round((inactiveUsers / totalUsers) * 100 * 100) / 100; // Округление до 2 знаков
}

/**
 * Вычисляет средний LTV (Lifetime Value)
 * LTV = средняя стоимость плана * средняя длительность использования (в месяцах)
 * Упрощенная формула: считаем на основе количества активных планов и дней активности
 */
async function calculateAvgLTV(): Promise<number> {
  // Получаем пользователей с активными планами
  const usersWithPlans = await prisma.skinProfile.groupBy({
    by: ['userId'],
    _count: {
      id: true,
    },
  });

  if (usersWithPlans.length === 0) return 0;

  // Средняя стоимость месячного ухода (упрощенная оценка)
  const avgMonthlyPlanCost = 3000; // Примерная стоимость ухода в месяц

  // Вычисляем среднюю длительность активности (в месяцах)
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: usersWithPlans.map(u => u.userId),
      },
    },
    select: {
      createdAt: true,
      updatedAt: true,
    },
  });

  const totalMonths = users.reduce((sum, user) => {
    const daysDiff = (user.updatedAt.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return sum + daysDiff / 30; // Переводим дни в месяцы
  }, 0);

  const avgMonths = totalMonths / users.length;
  const avgLTV = avgMonthlyPlanCost * Math.max(1, avgMonths); // Минимум 1 месяц

  return Math.round(avgLTV);
}

/**
 * Получает топ продуктов по популярности
 */
async function getTopProducts(limit: number = 10) {
  // Получаем продукты с количеством добавлений в wishlist
  const productsWithWishlist = await prisma.wishlist.groupBy({
    by: ['productId'],
    _count: {
      id: true,
    },
  });
  
  // Сортируем вручную и берем топ
  productsWithWishlist.sort((a, b) => b._count.id - a._count.id);
  const topWishlist = productsWithWishlist.slice(0, limit);

  // Получаем продукты с обратной связью
  const productsWithFeedback = await prisma.wishlistFeedback.groupBy({
    by: ['productId'],
    _count: {
      id: true,
    },
  });

  // Получаем детали продуктов
  const productIds = topWishlist.map(p => p.productId);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
    },
    include: {
      brand: true,
    },
  });

  // Получаем детали продуктов (только топ)
  const productIds = topWishlist.map(p => p.productId);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
    },
    include: {
      brand: true,
    },
  });

  // Формируем мапу для быстрого доступа к количеству отзывов
  const feedbackMap = new Map(
    productsWithFeedback.map(f => [f.productId, f._count.id])
  );

  // Получаем все feedback для вычисления рейтингов
  const allFeedback = await prisma.wishlistFeedback.findMany({
    where: {
      productId: { in: productIds },
    },
    select: {
      productId: true,
      feedback: true,
    },
  });

  // Группируем feedback по продуктам
  const feedbackByProduct = new Map<number, number[]>();
  allFeedback.forEach(f => {
    const rating = f.feedback === 'bought_love' ? 5 :
                   f.feedback === 'bought_ok' ? 3 :
                   f.feedback === 'bought_bad' ? 1 : 0;
    if (rating > 0) {
      if (!feedbackByProduct.has(f.productId)) {
        feedbackByProduct.set(f.productId, []);
      }
      feedbackByProduct.get(f.productId)!.push(rating);
    }
  });

  return topWishlist.map(w => {
    const product = products.find(p => p.id === w.productId);
    if (!product) return null;

    const wishlistCount = w._count.id;
    const feedbackCount = feedbackMap.get(product.id) || 0;
    const ratings = feedbackByProduct.get(product.id) || [];
    const avgRating = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

    return {
      id: product.id,
      name: product.name,
      brand: product.brand.name,
      wishlistCount,
      feedbackCount,
      avgRating,
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null);
}

/**
 * Получает расширенную статистику для админ-дашборда
 */
export async function getMetricsStats(): Promise<MetricsStats> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Базовые метрики
  const users = await prisma.user.count();
  const products = await prisma.product.count({ where: { published: true } });
  const plans = await prisma.skinProfile.count();
  const badFeedback = await prisma.wishlistFeedback.count({
    where: { feedback: 'bought_bad' },
  });
  const replacements = await prisma.productReplacement.count();

  // Новые метрики
  const churnRate = await calculateChurnRate();
  const avgLTV = await calculateAvgLTV();
  const topProducts = await getTopProducts(10);

  // Временные метрики
  const newUsersLast7Days = await prisma.user.count({
    where: { createdAt: { gte: sevenDaysAgo } },
  });
  const newUsersLast30Days = await prisma.user.count({
    where: { createdAt: { gte: thirtyDaysAgo } },
  });

  // Активные пользователи (с обновленным профилем за период)
  const activeUsersLast7Days = await prisma.user.count({
    where: { updatedAt: { gte: sevenDaysAgo } },
  });
  const activeUsersLast30Days = await prisma.user.count({
    where: { updatedAt: { gte: thirtyDaysAgo } },
  });

  // Продуктовые метрики
  const totalWishlistItems = await prisma.wishlist.count();
  const totalProductFeedback = await prisma.wishlistFeedback.count();

  // Средний рейтинг обратной связи
  const feedbackEntries = await prisma.wishlistFeedback.findMany({
    select: { feedback: true },
  });
  const ratings = feedbackEntries.map(f => {
    if (f.feedback === 'bought_love') return 5;
    if (f.feedback === 'bought_ok') return 3;
    if (f.feedback === 'bought_bad') return 1;
    return 0;
  }).filter(r => r > 0);
  
  const avgFeedbackRating = ratings.length > 0
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : 0;

  return {
    users,
    products,
    plans,
    badFeedback,
    replacements,
    churnRate,
    avgLTV,
    topProducts,
    newUsersLast7Days,
    newUsersLast30Days,
    activeUsersLast7Days,
    activeUsersLast30Days,
    totalWishlistItems,
    totalProductFeedback,
    avgFeedbackRating,
  };
}

