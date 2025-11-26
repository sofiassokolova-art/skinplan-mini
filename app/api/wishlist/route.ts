// app/api/wishlist/route.ts
// API для работы с избранным (wishlist)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

// GET - получение списка избранного
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

    // Получаем все продукты из избранного
    const wishlist = await prisma.wishlist.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            brand: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Получаем обратную связь по каждому продукту
    const feedbacks = await prisma.wishlistFeedback.findMany({
      where: {
        userId,
        productId: { in: wishlist.map((w) => w.productId) },
      },
    });

    const feedbackMap = new Map(
      feedbacks.map((f) => [f.productId, f.feedback])
    );

    const items = wishlist.map((item) => ({
      id: item.id,
      product: {
        id: item.product.id,
        name: item.product.name,
        brand: {
          id: item.product.brand.id,
          name: item.product.brand.name,
        },
        price: item.product.price,
        imageUrl: item.product.imageUrl,
        link: item.product.link,
        marketLinks: item.product.marketLinks,
      },
      feedback: feedbackMap.get(item.productId) || 'not_bought',
      createdAt: item.createdAt,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - добавление в избранное
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

    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { error: 'Missing productId' },
        { status: 400 }
      );
    }

    // Проверяем, существует ли продукт
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Добавляем в избранное (upsert на случай, если уже есть)
    const wishlistItem = await prisma.wishlist.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      update: {},
      create: {
        userId,
        productId,
      },
      include: {
        product: {
          include: {
            brand: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      item: {
        id: wishlistItem.id,
        product: {
          id: wishlistItem.product.id,
          name: wishlistItem.product.name,
          brand: wishlistItem.product.brand.name,
        },
      },
    });
  } catch (error: any) {
    console.error('Error adding to wishlist:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - удаление из избранного
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { error: 'Missing productId' },
        { status: 400 }
      );
    }

    await prisma.wishlist.deleteMany({
      where: {
        userId,
        productId: parseInt(productId),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

