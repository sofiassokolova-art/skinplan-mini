// app/api/admin/products/route.ts
// API для управления продуктами (CRUD)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function verifyAdminToken(request: NextRequest): { valid: boolean; adminId?: string } {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                request.cookies.get('admin_token')?.value;

  if (!token) {
    return { valid: false };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { adminId: string; role?: string };
    if (decoded.role !== 'admin') {
      return { valid: false };
    }
    return { valid: true, adminId: decoded.adminId };
  } catch {
    return { valid: false };
  }
}

// GET - список всех продуктов
export async function GET(request: NextRequest) {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const products = await prisma.product.findMany({
      include: {
        brand: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - создание продукта
export async function POST(request: NextRequest) {
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const {
      name,
      brandId,
      line,
      category,
      step,
      descriptionUser,
      imageUrl,
      marketLinks,
      skinTypes,
      concerns,
      isNonComedogenic,
      isFragranceFree,
      status,
    } = data;

    // Проверяем существование бренда
    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        brandId,
        line,
        category,
        step,
        descriptionUser,
        imageUrl,
        marketLinks: marketLinks || {},
        skinTypes: skinTypes || [],
        concerns: concerns || [],
        isNonComedogenic: isNonComedogenic || false,
        isFragranceFree: isFragranceFree || false,
        status: status || 'draft',
      },
      include: {
        brand: true,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

