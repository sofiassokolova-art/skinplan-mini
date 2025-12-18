// app/api/admin/feedback/route.ts
// API для получения обратной связи

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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
    return false;
  }
}

// GET - список обратной связи
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const feedbackType = searchParams.get('feedback'); // bought_love, bought_ok, bought_bad, not_bought
    const skip = (page - 1) * limit;

    const where: any = {};
    if (feedbackType) {
      where.feedback = feedbackType;
    }

    // Получаем обратную связь по продуктам (wishlist feedback)
    const [feedback, total] = await Promise.all([
      prisma.wishlistFeedback.findMany({
        where,
        skip,
        take: limit,
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
          product: {
            include: {
              brand: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.wishlistFeedback.count({ where }),
    ]);

    // Получаем обратную связь по планам - разделяем по типу
    const planFeedbackType = searchParams.get('planFeedbackType') || null; // 'plan_recommendations' | 'plan_general' | 'service'
    const planFeedbackWhere: any = {};
    if (planFeedbackType) {
      planFeedbackWhere.type = planFeedbackType;
    }
    
    const [planFeedback, planFeedbackTotal, planRecommendationsTotal, planGeneralTotal, serviceTotal] = await Promise.all([
      prisma.planFeedback.findMany({
        where: planFeedbackWhere,
        skip,
        take: limit,
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.planFeedback.count({ where: planFeedbackWhere }),
      prisma.planFeedback.count({ where: { type: 'plan_recommendations' } }),
      prisma.planFeedback.count({ where: { type: 'plan_general' } }),
      prisma.planFeedback.count({ where: { type: 'service' } }),
    ]);

    return NextResponse.json({
      productFeedback: feedback.map((f) => ({
        id: f.id,
        userId: f.userId,
        productId: f.productId,
        feedback: f.feedback,
        createdAt: f.createdAt,
        user: {
          id: f.user.id,
          telegramId: f.user.telegramId,
          firstName: f.user.firstName,
          lastName: f.user.lastName,
          username: f.user.username,
        },
        product: {
          id: f.product.id,
          name: f.product.name,
          brand: f.product.brand.name,
        },
      })),
      planFeedback: planFeedback.map((f) => ({
        id: f.id,
        userId: f.userId,
        rating: f.rating,
        feedback: f.feedback,
        type: (f as any).type || 'plan_recommendations', // Добавляем тип
        createdAt: f.createdAt,
        user: {
          id: f.user.id,
          telegramId: f.user.telegramId,
          firstName: f.user.firstName,
          lastName: f.user.lastName,
          username: f.user.username,
        },
      })),
      planFeedbackStats: {
        planRecommendations: planRecommendationsTotal,
        planGeneral: planGeneralTotal,
        service: serviceTotal,
      },
      pagination: {
        page,
        limit,
        total: total + planFeedbackTotal,
        productFeedbackTotal: total,
        planFeedbackTotal,
      },
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

