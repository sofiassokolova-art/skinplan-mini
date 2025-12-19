// app/api/admin/products/route.ts
// API для управления продуктами (список и создание)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

// GET - список продуктов с пагинацией
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Максимум 100
    const skip = (page - 1) * limit;

    // Получаем продукты с пагинацией
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        skip,
        take: limit,
        include: {
          brand: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.product.count(),
    ]);

    return NextResponse.json({
      products: products.map((p: any) => ({
        id: p.id,
        name: p.name,
        slug: p.slug || null,
        price: p.price || null,
        volume: p.volume || null,
        description: p.description || null,
        descriptionUser: p.descriptionUser || null,
        composition: p.composition || null,
        link: p.link || null,
        imageUrl: p.imageUrl || null,
        step: p.step,
        category: p.category,
        skinTypes: p.skinTypes || [],
        concerns: p.concerns || [],
        activeIngredients: p.activeIngredients || [],
        avoidIf: p.avoidIf || [],
        published: p.published !== undefined ? p.published : true,
        isHero: p.isHero || false,
        priority: p.priority || 0,
        brand: p.brand,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - создание продукта
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      brandId,
      name,
      slug,
      price,
      volume,
      description,
      descriptionUser,
      composition,
      link,
      imageUrl,
      step,
      category,
      skinTypes,
      concerns,
      activeIngredients,
      avoidIf,
      isHero,
      priority,
      published,
    } = body;

    if (!brandId || !name || !step) {
      return NextResponse.json(
        { error: 'Missing required fields: brandId, name, step' },
        { status: 400 }
      );
    }

    // Проверяем существование бренда
    const brand = await prisma.brand.findUnique({
      where: { id: parseInt(brandId) },
    });

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Генерируем slug, если не указан
    let finalSlug = slug;
    if (!finalSlug) {
      finalSlug = `${brand.name.toLowerCase().replace(/\s+/g, '-')}-${name.toLowerCase().replace(/\s+/g, '-')}`;
    }

    const product = await prisma.product.create({
      data: {
        brandId: parseInt(brandId),
        name,
        ...(finalSlug && { slug: finalSlug }),
        price: price ? parseInt(price) : null,
        volume: volume || null,
        description: description || null,
        descriptionUser: descriptionUser || null,
        composition: composition || null,
        link: link || null,
        imageUrl: imageUrl || null,
        step,
        category: category || step, // Используем step как category если category не указан
        skinTypes: skinTypes || [],
        concerns: concerns || [],
        activeIngredients: activeIngredients || [],
        avoidIf: avoidIf || [],
        isHero: isHero || false,
        priority: priority ? parseInt(priority) : 0,
        published: published !== false,
        status: published !== false ? 'published' : 'draft',
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
