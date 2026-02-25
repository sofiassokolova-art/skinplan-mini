// app/api/cart/route.ts
// API для работы с корзиной

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

// GET - получить корзину пользователя
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/cart';
  let userId: string | null | undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    const cartItems = await prisma.cart.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            brand: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    logger.info('Cart retrieved', {
      userId,
      itemsCount: cartItems.length,
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId || undefined);

    return NextResponse.json({
      items: cartItems.map(item => ({
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
        quantity: item.quantity,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - добавить товар в корзину
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/cart';
  let userId: string | null | undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    const body = await request.json();
    const productId = body.productId;
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(body.quantity) || 1)));

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

    // Добавляем или обновляем количество
    const cartItem = await prisma.cart.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
      create: {
        userId,
        productId,
        quantity,
      },
      include: {
        product: {
          include: {
            brand: true,
          },
        },
      },
    });

    logger.info('Product added to cart', {
      userId,
      productId,
      quantity: cartItem.quantity,
      productName: cartItem.product.name,
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId || undefined);

    return NextResponse.json({
      success: true,
      item: {
        id: cartItem.id,
        product: {
          id: cartItem.product.id,
          name: cartItem.product.name,
          brand: {
            id: cartItem.product.brand.id,
            name: cartItem.product.brand.name,
          },
          price: cartItem.product.price,
          imageUrl: cartItem.product.imageUrl,
          link: cartItem.product.link,
          marketLinks: cartItem.product.marketLinks,
        },
        quantity: cartItem.quantity,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - удалить товар из корзины
export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  const method = 'DELETE';
  const path = '/api/cart';
  let userId: string | null | undefined;

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
        { error: 'Invalid productId' },
        { status: 400 }
      );
    }

    await prisma.cart.deleteMany({
      where: {
        userId,
        productId: productIdNum,
      },
    });

    logger.info('Product removed from cart', {
      userId,
      productId: productIdNum,
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId || undefined);

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

