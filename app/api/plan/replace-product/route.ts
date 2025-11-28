// app/api/plan/replace-product/route.ts
// API для замены продукта во всём плане

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

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

    const { oldProductId, newProductId } = await request.json();

    if (!oldProductId || !newProductId) {
      return NextResponse.json(
        { error: 'Missing oldProductId or newProductId' },
        { status: 400 }
      );
    }

    // Проверяем, что продукты существуют
    const oldProduct = await prisma.product.findUnique({
      where: { id: oldProductId },
    });

    const newProduct = await prisma.product.findUnique({
      where: { id: newProductId },
    });

    if (!oldProduct || !newProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Сохраняем запись о замене
    await prisma.productReplacement.create({
      data: {
        userId,
        oldProductId,
        newProductId,
        reason: 'feedback_bad',
      },
    });

    // TODO: Здесь нужно обновить план пользователя
    // Так как план генерируется динамически, нужно либо:
    // 1. Сохранить замены в отдельной таблице и учитывать их при генерации плана
    // 2. Или обновлять кэш рекомендаций

    // Пока просто сохраняем замену - она будет учтена при следующей генерации плана
    // Можно также обновить RecommendationSession, чтобы использовать новый продукт

    // Обновляем активную сессию рекомендаций, если она есть
    const activeSession = await prisma.recommendationSession.findFirst({
      where: {
        userId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (activeSession) {
      const products = activeSession.products as number[];
      const updatedProducts = products.map((pid) => 
        pid === oldProductId ? newProductId : pid
      );
      
      await prisma.recommendationSession.update({
        where: { id: activeSession.id },
        data: {
          products: updatedProducts,
        },
      });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Product replaced successfully. Plan will be updated on next refresh.',
    });
  } catch (error) {
    console.error('Error replacing product:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

