// app/api/admin/replacements/route.ts
// API для получения замен продуктов

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

// GET - список замен продуктов
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Получаем все замены продуктов
    const [replacements, total] = await Promise.all([
      prisma.productReplacement.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          oldProduct: {
            include: {
              brand: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          newProduct: {
            include: {
              brand: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.productReplacement.count(),
    ]);

    return NextResponse.json({
      replacements: replacements.map((r) => ({
        id: r.id,
        userId: r.userId,
        oldProductId: r.oldProductId,
        newProductId: r.newProductId,
        reason: r.reason,
        createdAt: r.createdAt,
        user: {
          id: r.user.id,
          telegramId: r.user.telegramId,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          username: r.user.username,
        },
        oldProduct: {
          id: r.oldProduct.id,
          name: r.oldProduct.name,
          brand: r.oldProduct.brand.name,
        },
        newProduct: {
          id: r.newProduct.id,
          name: r.newProduct.name,
          brand: r.newProduct.brand.name,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching replacements:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

