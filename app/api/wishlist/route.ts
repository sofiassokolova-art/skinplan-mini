// app/api/wishlist/route.ts
// API для работы с избранным (wishlist)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { logger, logApiRequest, logApiError } from '@/lib/logger';

// GET - получение списка избранного
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/wishlist';
  let userId: string | undefined;

  try {
    // Проверяем initData в заголовках (регистр не важен)
    const initData = request.headers.get('x-telegram-init-data') || 
                     request.headers.get('X-Telegram-Init-Data');

    // Если нет initData - возвращаем пустой список (без ошибки)
    if (!initData) {
      logger.debug('No initData provided for wishlist - returning empty list');
      return NextResponse.json({ items: [] });
    }

    const userIdResult = await getUserIdFromInitData(initData);
    userId = userIdResult || undefined;
    
    // Если не удалось получить userId - возвращаем пустой список (без ошибки)
    if (!userId) {
      logger.debug('Could not get userId from initData - returning empty list');
      return NextResponse.json({ items: [] });
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

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json({ items });
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - добавление в избранное
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/wishlist';
  let userId: string | undefined;

  try {
    // Проверяем initData в заголовках (регистр не важен)
    const initData = request.headers.get('x-telegram-init-data') || 
                     request.headers.get('X-Telegram-Init-Data');

    // Для добавления в wishlist нужна авторизация
    if (!initData) {
      logger.warn('No initData in wishlist POST request', {
        headers: Object.fromEntries(request.headers.entries()),
      });
      return NextResponse.json(
        { error: 'Missing Telegram initData. Please open the app through Telegram Mini App.' },
        { status: 401 }
      );
    }

    const userIdResult = await getUserIdFromInitData(initData);
    userId = userIdResult || undefined;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const productId = body.productId;

    if (!productId) {
      logger.warn('Missing productId in wishlist POST', { userId, body });
      return NextResponse.json(
        { error: 'Missing productId in request body' },
        { status: 400 }
      );
    }

    // Приводим productId к числу
    const productIdNum = typeof productId === 'string' ? parseInt(productId, 10) : productId;
    
    if (isNaN(productIdNum) || productIdNum <= 0) {
      logger.warn('Invalid productId', { userId, productId });
      return NextResponse.json(
        { error: 'Invalid productId: must be a positive number' },
        { status: 400 }
      );
    }

    // Проверяем, существует ли продукт
    const product = await prisma.product.findUnique({
      where: { id: productIdNum },
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
          productId: productIdNum,
        },
      },
      update: {},
      create: {
        userId,
        productId: productIdNum,
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

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

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
    const duration = Date.now() - startTime;
    
    // Если это ошибка Prisma (например, нарушение уникальности) - это нормально
    if (error.code === 'P2002') {
      logger.debug('Product already in wishlist', { userId, productId: error.meta?.target });
      // Уже есть в wishlist - возвращаем успех
      return NextResponse.json({
        success: true,
        message: 'Product already in wishlist',
      });
    }
    
    logApiError(method, path, error, userId);

    const isDevelopment = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        details: isDevelopment ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// DELETE - удаление из избранного
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  const method = 'DELETE';
  const path = '/api/wishlist';
  let userId: string | undefined;

  try {
    // Проверяем initData в заголовках (регистр не важен)
    const initData = request.headers.get('x-telegram-init-data') || 
                     request.headers.get('X-Telegram-Init-Data');

    // Для удаления из wishlist нужна авторизация
    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
        { status: 401 }
      );
    }

    const userIdResult = await getUserIdFromInitData(initData);
    userId = userIdResult || undefined;
    
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

    const productIdNum = parseInt(productId, 10);
    if (isNaN(productIdNum) || productIdNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid productId: must be a positive number' },
        { status: 400 }
      );
    }

    await prisma.wishlist.deleteMany({
      where: {
        userId,
        productId: productIdNum,
      },
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

