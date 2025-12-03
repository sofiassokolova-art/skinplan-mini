// app/api/feedback/route.ts
// Сохранение отзывов о плане

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

// POST - сохранение отзыва
export async function POST(request: NextRequest) {
  try {
    // Пробуем оба варианта заголовка (регистронезависимо)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

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

    const body = await request.json();
    
    // Поддержка нового формата (isRelevant, reasons, comment) и старого (rating, feedback)
    let rating: number;
    let feedbackText: string | null = null;
    const feedbackType = body.type || 'plan_recommendations'; // 'plan_recommendations' | 'plan_general' | 'service'
    
    if (body.isRelevant !== undefined) {
      // Новый формат из анализа
      rating = body.isRelevant ? 5 : 1; // Да = 5, Нет = 1
      // Формируем текст обратной связи из reasons и comment
      if (!body.isRelevant) {
        const reasons = Array.isArray(body.reasons) ? body.reasons : [];
        const comment = body.comment || '';
        const parts: string[] = [];
        if (reasons.length > 0) {
          parts.push(`Причины: ${reasons.join(', ')}`);
        }
        if (comment.trim()) {
          parts.push(`Комментарий: ${comment.trim()}`);
        }
        feedbackText = parts.length > 0 ? parts.join('\n') : null;
      }
    } else if (body.rating) {
      // Старый формат (для совместимости)
      rating = body.rating;
      feedbackText = body.feedback || null;
      
      if (rating < 1 || rating > 5) {
        return NextResponse.json(
          { error: 'Rating must be between 1 and 5' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Missing required field: either isRelevant or rating' },
        { status: 400 }
      );
    }

    // Сохраняем отзыв
    const planFeedback = await prisma.planFeedback.create({
      data: {
        userId,
        rating,
        feedback: feedbackText,
        type: feedbackType,
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
    // Пробуем оба варианта заголовка (регистронезависимо)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

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

    // Получаем последний отзыв пользователя (по умолчанию plan_recommendations)
    const feedbackType = searchParams.get('type') || 'plan_recommendations';
    const lastFeedback = await prisma.planFeedback.findFirst({
      where: { 
        userId,
        type: feedbackType,
      },
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

