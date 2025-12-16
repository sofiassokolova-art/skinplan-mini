// app/api/wishlist/feedback/route.ts
// API для обратной связи по продуктам в избранном

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;

    const { productId, feedback } = await request.json();

    if (!productId || !feedback) {
      return NextResponse.json(
        { error: 'Missing productId or feedback' },
        { status: 400 }
      );
    }

    const validFeedbacks = ['not_bought', 'bought_love', 'bought_ok', 'bought_bad'];
    if (!validFeedbacks.includes(feedback)) {
      return NextResponse.json(
        { error: 'Invalid feedback value' },
        { status: 400 }
      );
    }

    // Сохраняем или обновляем обратную связь
    await prisma.wishlistFeedback.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      update: {
        feedback,
      },
      create: {
        userId,
        productId,
        feedback,
      },
    });

    // TODO: Здесь можно добавить логику пересчета приоритетов рекомендаций
    // Например, если feedback === 'bought_love', увеличить приоритет продукта
    // Если feedback === 'bought_bad', исключить из будущих рекомендаций

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

