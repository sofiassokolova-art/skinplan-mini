// app/api/admin/stats/route.ts
// API для статистики админки

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Проверка авторизации админа
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const token = request.cookies.get('admin_token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return false;
    }

    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (err) {
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

    // Логируем для отладки
    console.log('📊 Fetching admin stats...');
    
    const [
      usersCount,
      productsCount,
      plansCount,
      badFeedbackCount,
      replacementsCount,
      recentFeedback,
    ] = await Promise.all([
      prisma.user.count().then(count => {
        console.log('👥 Users count:', count);
        return count;
      }),
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

    // Логируем результаты
    console.log('📊 Stats fetched:', {
      users: usersCount,
      products: productsCount,
      plans: plansCount,
      badFeedback: badFeedbackCount,
      replacements: replacementsCount,
    });

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

