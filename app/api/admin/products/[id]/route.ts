// app/api/admin/products/[id]/route.ts
// API для редактирования и удаления конкретного продукта

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

// GET - получить продукт
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
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

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - обновить продукт
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const product = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        name: data.name,
        brandId: data.brandId,
        line: data.line,
        category: data.category,
        step: data.step,
        descriptionUser: data.descriptionUser,
        imageUrl: data.imageUrl,
        marketLinks: data.marketLinks,
        skinTypes: data.skinTypes,
        concerns: data.concerns,
        isNonComedogenic: data.isNonComedogenic,
        isFragranceFree: data.isFragranceFree,
        status: data.status,
      },
      include: {
        brand: true,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - удалить продукт
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = verifyAdminToken(request);
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.product.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

