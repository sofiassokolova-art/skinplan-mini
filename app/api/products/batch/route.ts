// app/api/products/batch/route.ts
// API для загрузки нескольких продуктов по ID

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const initData =
      request.headers.get('x-telegram-init-data') ||
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
    const { productIds } = body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds array is required' },
        { status: 400 }
      );
    }

    // Ограничиваем количество продуктов для безопасности
    const limitedIds = productIds.slice(0, 200).map(id => Number(id)).filter(id => !isNaN(id));

    const products = await prisma.product.findMany({
      where: {
        id: { in: limitedIds },
        published: true,
        brand: {
          isActive: true,
        },
      },
      include: {
        brand: true,
      },
    });

    // Форматируем продукты для клиента
    const formattedProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      brand: {
        id: p.brand.id,
        name: p.brand.name,
      },
      price: p.price,
      volume: p.volume,
      imageUrl: p.imageUrl,
      description: p.description || p.descriptionUser,
      step: p.step,
      category: p.category,
      skinTypes: p.skinTypes,
      concerns: p.concerns,
      activeIngredients: p.activeIngredients,
    }));

    return NextResponse.json({
      products: formattedProducts,
      count: formattedProducts.length,
    });
  } catch (error: any) {
    console.error('Error loading products batch:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

