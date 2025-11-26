// app/api/admin/products/[id]/route.ts
// API для обновления и удаления конкретного продукта

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

// GET - получение продукта
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        brand: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ product });
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - обновление продукта
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
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

    // Проверяем существование продукта
    const existingProduct = await prisma.product.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Проверяем бренд, если изменяется
    if (brandId && parseInt(brandId) !== existingProduct.brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: parseInt(brandId) },
      });

      if (!brand) {
        return NextResponse.json(
          { error: 'Brand not found' },
          { status: 404 }
        );
      }
    }

    const product = await prisma.product.update({
      where: { id: parseInt(params.id) },
      data: {
        ...(brandId && { brandId: parseInt(brandId) }),
        ...(name && { name }),
        ...(slug !== undefined && { slug }),
        ...(price !== undefined && { price: price ? parseInt(price) : null }),
        ...(volume !== undefined && { volume }),
        ...(description !== undefined && { description }),
        ...(descriptionUser !== undefined && { descriptionUser }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(step && { step }),
        ...(category && { category }),
        ...(skinTypes !== undefined && { skinTypes }),
        ...(concerns !== undefined && { concerns }),
        ...(activeIngredients !== undefined && { activeIngredients }),
        ...(avoidIf !== undefined && { avoidIf }),
        ...(isHero !== undefined && { isHero }),
        ...(priority !== undefined && { priority: parseInt(priority) }),
        ...(published !== undefined && { 
          published,
          status: published ? 'published' : 'draft',
        }),
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

    return NextResponse.json({ product });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - удаление продукта
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id: parseInt(params.id) },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    await prisma.product.delete({
      where: { id: parseInt(params.id) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
