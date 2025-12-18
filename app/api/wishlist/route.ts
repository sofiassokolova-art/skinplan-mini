// app/api/wishlist/route.ts
// API для работы с избранным (wishlist)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { ApiResponse } from '@/lib/api-response';
import { requireTelegramAuth, tryGetTelegramIdentityFromRequest } from '@/lib/auth/telegram-auth';

// GET - получение списка избранного
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/wishlist';
  let userId: string | undefined;

  try {
    const identity = tryGetTelegramIdentityFromRequest(request);

    // Если нет initData — возвращаем пустой список (без ошибки)
    if (!identity.ok && identity.code === 'AUTH_MISSING_INITDATA') {
      logger.debug('No initData provided for wishlist - returning empty list');
      return NextResponse.json({ items: [] });
    }

    // Невалидный initData — считаем, что пользователь не авторизован (как и раньше)
    if (!identity.ok) {
      logger.debug('Invalid initData for wishlist - returning empty list', { code: identity.code });
      return NextResponse.json({ items: [] });
    }

    // Маппим telegramId -> userId (без создания пользователя)
    try {
      const existing = await prisma.user.findUnique({
        where: { telegramId: identity.telegramId },
        select: { id: true },
      });
      userId = existing?.id || undefined;
    } catch (err: any) {
      // DB ошибка ≠ auth ошибка
      return ApiResponse.failure({
        status: 503,
        code: 'DB_ERROR',
        message: 'Database error while loading wishlist',
      });
    }

    // Если пользователя нет в БД — возвращаем пустой список
    if (!userId) {
      logger.debug('User not found for wishlist - returning empty list');
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
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

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

    logger.info('Product added to wishlist', {
      userId,
      productId: productIdNum,
      productName: wishlistItem.product.name,
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
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

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

    logger.info('Product removed from wishlist', {
      userId,
      productId: productIdNum,
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

