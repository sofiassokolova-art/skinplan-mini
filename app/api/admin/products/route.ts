// app/api/admin/products/route.ts
// API для управления продуктами (список и создание)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Проверка авторизации админа
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const token = request.cookies.get('admin_token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return false;
    }

    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (err) {
    return false;
  }
}

// GET - список продуктов
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const products = await prisma.product.findMany({
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
    });

    return NextResponse.json({
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        volume: p.volume,
        descriptionUser: p.descriptionUser,
        imageUrl: p.imageUrl,
        step: p.step,
        category: p.category,
        skinTypes: p.skinTypes,
        concerns: p.concerns,
        activeIngredients: p.activeIngredients,
        published: p.published,
        isHero: p.isHero,
        priority: p.priority,
        brand: p.brand,
      })),
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
    const isAdmin = await verifyAdmin(request);
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

    if (!brandId || !name || !step || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: brandId, name, step, category' },
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
        slug: finalSlug,
        price: price ? parseInt(price) : null,
        volume: volume || null,
        description: description || null,
        descriptionUser: descriptionUser || null,
        imageUrl: imageUrl || null,
        step,
        category,
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
