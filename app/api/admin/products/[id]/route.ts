// app/api/admin/products/[id]/route.ts
// API для обновления и удаления конкретного продукта

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

// GET - получение продукта
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const productId = parseInt(params.id, 10);
    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
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

    const productId = parseInt(params.id, 10);
    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

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
      where: { id: productId },
      data: {
        ...(brandId && { brandId: parseInt(brandId) }),
        ...(name && { name }),
        ...(slug !== undefined && { slug }),
        ...(price !== undefined && { price: price ? parseInt(price) : null }),
        ...(volume !== undefined && { volume }),
        ...(description !== undefined && { description }),
        ...(descriptionUser !== undefined && { descriptionUser }),
        ...(composition !== undefined && { composition }),
        ...(link !== undefined && { link }),
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
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const productId = parseInt(params.id, 10);
    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    await prisma.product.delete({
      where: { id: productId },
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
