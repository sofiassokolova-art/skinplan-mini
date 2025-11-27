// app/api/admin/brands/route.ts
// API для получения списка брендов (для формы продукта)

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
      return false;
    }

    try {
      jwt.verify(token, JWT_SECRET);
      return true;
    } catch (verifyError) {
      return false;
    }
  } catch (err) {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Получаем все бренды
    const allBrands = await prisma.brand.findMany({
      orderBy: { name: 'asc' },
    });

    // Форматируем ответ
    const brands = allBrands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      isActive: brand.isActive,
    }));

    return NextResponse.json({ brands });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - создание нового бренда
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
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Создаем slug из названия
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Проверяем, не существует ли уже такой бренд
    const existing = await prisma.brand.findFirst({
      where: {
        OR: [
          { name: name.trim() },
          { slug },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Brand already exists' },
        { status: 400 }
      );
    }

    const brand = await prisma.brand.create({
      data: {
        name: name.trim(),
        slug,
        isActive: true,
      },
    });

    return NextResponse.json({ brand });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - обновление бренда (активность)
export async function PUT(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, isActive } = body;

    if (!id || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'id and isActive are required' },
        { status: 400 }
      );
    }

    const brand = await prisma.brand.update({
      where: { id: parseInt(id) },
      data: { isActive },
    });

    return NextResponse.json({ brand });
  } catch (error) {
    console.error('Error updating brand:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - удаление бренда (soft delete через isActive = false)
export async function DELETE(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    // Soft delete - делаем неактивным
    const brand = await prisma.brand.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    });

    return NextResponse.json({ brand });
  } catch (error) {
    console.error('Error deleting brand:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

