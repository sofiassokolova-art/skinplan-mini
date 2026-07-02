// API для получения обратной связи

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

// GET - список обратной связи
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
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

    // Отзывы о покупке (исключаем not_bought — это не отзыв, а отметка «не куплено»).
    const BOUGHT_FEEDBACKS = ['bought_love', 'bought_ok', 'bought_bad'];
    const where: any = {};
    if (feedbackType) {
      // Конкретная вкладка (Love/OK/Bad) — фильтруем по ней.
      where.feedback = feedbackType;
    } else {
      // По умолчанию (вкладка «Все») — только отзывы о покупке, без not_bought.
      where.feedback = { in: BOUGHT_FEEDBACKS };
    }

    // Получаем обратную связь по продуктам (wishlist feedback).
    // total — для пагинации текущей выборки; love/ok/bad — реальные счётчики по БД
    // (а не по одной странице), чтобы бейджи совпадали с дашбордом.
    const [feedback, total, loveTotal, okTotal, badTotal] = await Promise.all([
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
      prisma.wishlistFeedback.count({ where: { feedback: 'bought_love' } }),
      prisma.wishlistFeedback.count({ where: { feedback: 'bought_ok' } }),
      prisma.wishlistFeedback.count({ where: { feedback: 'bought_bad' } }),
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
      productFeedbackStats: {
        all: loveTotal + okTotal + badTotal,
        love: loveTotal,
        ok: okTotal,
        bad: badTotal,
      },
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

