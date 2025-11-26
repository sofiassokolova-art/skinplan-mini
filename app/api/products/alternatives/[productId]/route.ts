// app/api/products/alternatives/[productId]/route.ts
// API для поиска альтернативных продуктов

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

function generateWhyBetter(
  oldProduct: any,
  altProduct: any,
  profile: any
): string {
  const reasons: string[] = [];

  // Цена
  if (altProduct.price && oldProduct.price && altProduct.price < oldProduct.price * 0.9) {
    const diff = Math.round(((oldProduct.price - altProduct.price) / oldProduct.price) * 100);
    reasons.push(`дешевле на ${diff}%`);
  }

  // Бренд
  if (altProduct.brand.name === 'La Roche-Posay' || altProduct.brand.name === 'Bioderma') {
    reasons.push('гипоаллергенный хит');
  }

  // Ингредиенты для проблем кожи
  if (profile?.concerns?.includes('barrier') && 
      altProduct.activeIngredients?.some((ing: string) => 
        ing.toLowerCase().includes('центелла') || 
        ing.toLowerCase().includes('керамид')
      )) {
    reasons.push('лучше восстанавливает барьер');
  }

  if (profile?.concerns?.includes('acne') && 
      altProduct.activeIngredients?.some((ing: string) => 
        ing.toLowerCase().includes('ниацинамид') || 
        ing.toLowerCase().includes('салициловая')
      )) {
    reasons.push('эффективен против акне');
  }

  if (profile?.concerns?.includes('pigmentation') && 
      altProduct.activeIngredients?.some((ing: string) => 
        ing.toLowerCase().includes('азелаиновая') || 
        ing.toLowerCase().includes('ниацинамид')
      )) {
    reasons.push('улучшает пигментацию');
  }

  return reasons.length > 0 ? reasons.join(' • ') : 'подходит вашему типу кожи';
}

export async function GET(
  request: NextRequest,
  { params }: { params: { productId: string } }
) {
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

    const productId = parseInt(params.productId);
    
    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid productId' },
        { status: 400 }
      );
    }

    // Получаем продукт, который нужно заменить
    const rejectedProduct = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        brand: true,
      },
    });

    if (!rejectedProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Получаем профиль пользователя
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Строим условия для поиска альтернатив
    const whereConditions: any = {
      published: true,
      step: rejectedProduct.step, // тот же шаг ухода
      id: { not: rejectedProduct.id }, // не тот же продукт
    };

    // Фильтр по типу кожи, если есть
    if (profile?.skinType && rejectedProduct.skinTypes && rejectedProduct.skinTypes.length > 0) {
      whereConditions.skinTypes = {
        hasSome: rejectedProduct.skinTypes,
      };
    }

    // Исключаем проблемные ингредиенты, если они есть в старом продукте
    // (упрощенная логика - можно улучшить)
    const problematicIngredients = rejectedProduct.activeIngredients?.filter((ing: string) => {
      // Можно добавить логику исключения определенных ингредиентов
      return false;
    });

    // Ищем альтернативы
    const alternatives = await prisma.product.findMany({
      where: whereConditions,
      include: {
        brand: true,
      },
      orderBy: [
        { isHero: 'desc' },
        { priority: 'desc' },
      ],
      take: 3,
    });

    // Добавляем "почему лучше"
    const withReason = alternatives.map((alt) => ({
      id: alt.id,
      name: alt.name,
      brand: {
        id: alt.brand.id,
        name: alt.brand.name,
      },
      price: alt.price,
      imageUrl: alt.imageUrl,
      description: alt.descriptionUser || alt.description,
      whyBetter: generateWhyBetter(rejectedProduct, alt, profile),
    }));

    return NextResponse.json({ alternatives: withReason });
  } catch (error) {
    console.error('Error finding alternatives:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

