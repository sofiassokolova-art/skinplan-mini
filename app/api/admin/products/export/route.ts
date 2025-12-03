// app/api/admin/products/export/route.ts
// API для экспорта списка продуктов в CSV/JSON

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

// GET - экспорт продуктов в CSV или JSON
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return ApiResponse.unauthorized('Unauthorized');
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv'; // csv или json

    // Получаем все продукты
    const products = await prisma.product.findMany({
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (format === 'json') {
      // Экспорт в JSON
      const exportData = products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        brand: p.brand.name,
        brandId: p.brand.id,
        brandIsActive: p.brand.isActive,
        price: p.price,
        volume: p.volume,
        description: p.description,
        descriptionUser: p.descriptionUser,
        composition: p.composition,
        link: p.link,
        step: p.step,
        category: p.category,
        skinTypes: p.skinTypes,
        concerns: p.concerns,
        activeIngredients: p.activeIngredients,
        avoidIf: p.avoidIf,
        isHero: p.isHero,
        priority: p.priority,
        published: p.published,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));

      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="products-export-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    } else {
      // Экспорт в CSV
      const headers = [
        'ID',
        'Название',
        'Slug',
        'Бренд',
        'ID Бренда',
        'Бренд активен',
        'Цена',
        'Объем',
        'Описание',
        'Описание для пользователя',
        'Состав',
        'Ссылка',
        'Шаг',
        'Категория',
        'Типы кожи',
        'Проблемы',
        'Активные ингредиенты',
        'Избегать при',
        'Hero',
        'Приоритет',
        'Опубликован',
        'Дата создания',
        'Дата обновления',
      ];

      const rows = products.map((p) => [
        p.id.toString(),
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.slug || '').replace(/"/g, '""')}"`,
        `"${(p.brand.name || '').replace(/"/g, '""')}"`,
        p.brand.id.toString(),
        p.brand.isActive ? 'Да' : 'Нет',
        p.price?.toString() || '',
        `"${(p.volume || '').replace(/"/g, '""')}"`,
        `"${(p.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(p.descriptionUser || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(p.composition || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(p.link || '').replace(/"/g, '""')}"`,
        `"${(p.step || '').replace(/"/g, '""')}"`,
        `"${(p.category || '').replace(/"/g, '""')}"`,
        `"${(p.skinTypes || []).join(', ')}"`,
        `"${(p.concerns || []).join(', ')}"`,
        `"${(p.activeIngredients || []).join(', ')}"`,
        `"${(p.avoidIf || []).join(', ')}"`,
        p.isHero ? 'Да' : 'Нет',
        p.priority.toString(),
        p.published ? 'Да' : 'Нет',
        p.createdAt.toISOString(),
        p.updatedAt.toISOString(),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      // Добавляем BOM для правильной кодировки в Excel
      const BOM = '\uFEFF';
      return new Response(BOM + csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="products-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }
  } catch (error: unknown) {
    return ApiResponse.internalError(error, {});
  }
}

