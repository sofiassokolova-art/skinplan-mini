// app/api/admin/brands/[id]/route.ts
// API для управления конкретным брендом

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

// PUT - обновление бренда
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
    const { isActive, name, slug, logoUrl, country } = body;

    const updateData: any = {};
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (name) updateData.name = name;
    if (slug) updateData.slug = slug;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (country) updateData.country = country;

    const brand = await prisma.brand.update({
      where: { id: parseInt(params.id) },
      data: updateData,
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

// DELETE - удаление бренда (soft delete)
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

    // Soft delete - делаем неактивным
    const brand = await prisma.brand.update({
      where: { id: parseInt(params.id) },
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

