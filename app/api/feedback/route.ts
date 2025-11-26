// app/api/feedback/route.ts
// Сохранение отзывов о плане

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

// POST - сохранение отзыва
export async function POST(request: NextRequest) {
  try {
    const initData = request.headers.get('x-telegram-init-data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
        { status: 401 }
      );
    }

    const userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    const { rating, feedback } = await request.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Сохраняем отзыв
    const planFeedback = await prisma.planFeedback.create({
      data: {
        userId,
        rating,
        feedback: feedback || null,
      },
    });

    return NextResponse.json({
      success: true,
      feedback: {
        id: planFeedback.id,
        rating: planFeedback.rating,
        feedback: planFeedback.feedback,
        createdAt: planFeedback.createdAt,
      },
    });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - получение последнего отзыва (для проверки, показывать ли поп-ап)
export async function GET(request: NextRequest) {
  try {
    const initData = request.headers.get('x-telegram-init-data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
        { status: 401 }
      );
    }

    const userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    // Получаем последний отзыв пользователя
    const lastFeedback = await prisma.planFeedback.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      lastFeedback: lastFeedback ? {
        id: lastFeedback.id,
        rating: lastFeedback.rating,
        feedback: lastFeedback.feedback,
        createdAt: lastFeedback.createdAt,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

