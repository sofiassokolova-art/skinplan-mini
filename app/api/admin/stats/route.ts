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
    console.log('🔗 DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('🔗 DATABASE_URL starts with postgresql:', process.env.DATABASE_URL?.startsWith('postgresql'));
    
    // Проверяем подключение к БД перед запросами
    try {
      await prisma.$connect();
      console.log('✅ Prisma connected successfully');
    } catch (connectError) {
      console.error('❌ Prisma connection error:', connectError);
      throw connectError;
    }
    
    // Выполняем запросы последовательно для лучшей диагностики
    let usersCount = 0;
    try {
      usersCount = await prisma.user.count();
      console.log('👥 Users count:', usersCount);
      
      // Дополнительная проверка - получаем первого пользователя
      const firstUser = await prisma.user.findFirst();
      console.log('👤 First user exists:', !!firstUser);
      if (firstUser) {
        console.log('👤 First user telegramId:', firstUser.telegramId);
      }
    } catch (userError) {
      console.error('❌ Error counting users:', userError);
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
      prisma.recommendationSession.count().catch(err => {
        console.error('❌ Error counting sessions:', err);
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

