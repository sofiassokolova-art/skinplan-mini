// app/api/admin/stats/route.ts
// API для статистики админки

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Проверка авторизации (через middleware или здесь)
    // Пока пропускаем для упрощения

    const [
      usersCount,
      productsCount,
      plansCount,
      badFeedbackCount,
      replacementsCount,
      recentFeedback,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.product.count({ where: { published: true } }),
      prisma.recommendationSession.count(),
      prisma.wishlistFeedback.count({ where: { feedback: 'bought_bad' } }),
      prisma.productReplacement.count(),
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
      }),
    ]);

    return NextResponse.json({
      stats: {
        users: usersCount,
        products: productsCount,
        plans: plansCount,
        badFeedback: badFeedbackCount,
        replacements: replacementsCount,
      },
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

