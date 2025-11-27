// app/api/admin/products/route.ts
// API для управления продуктами (список и создание)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Проверка авторизации админа
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  try {
    const cookieToken = request.cookies.get('admin_token')?.value;
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;
    
    if (!token) {
      console.log('❌ No admin token found in request');
      console.log('   Cookie token:', cookieToken ? 'present' : 'missing');
      console.log('   Header token:', headerToken ? 'present' : 'missing');
      return false;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Admin token verified successfully:', { adminId: (decoded as any).adminId });
      return true;
    } catch (verifyError: any) {
      console.log('❌ Token verification failed:', verifyError.message);
      return false;
    }
  } catch (err) {
    console.error('❌ Error in verifyAdmin:', err);
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

    // Проверяем подключение к БД
    try {
      await prisma.$connect();
      console.log('✅ Database connected for products');
    } catch (dbError: any) {
      console.error('❌ Database connection error:', dbError);
      return NextResponse.json(
        { error: 'Database connection failed', details: dbError.message },
        { status: 500 }
      );
    }

    console.log('📦 Fetching products...');
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

    console.log(`✅ Found ${products.length} products`);

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
