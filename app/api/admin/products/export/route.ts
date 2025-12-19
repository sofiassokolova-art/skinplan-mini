// app/api/admin/products/export/route.ts
// API для экспорта списка продуктов в CSV/JSON

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { verifyAdminBoolean } from '@/lib/admin-auth';

// POST - отправка экспорта в Telegram чат админа
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return ApiResponse.unauthorized('Unauthorized');
    }

    // Получаем telegramId админа из токена
    const cookieToken = request.cookies.get('admin_token')?.value;
    const headerToken = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;
    
    if (!token) {
      return ApiResponse.unauthorized('Token not found');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
    } catch (error) {
      return ApiResponse.unauthorized('Invalid token');
    }

    const adminTelegramId = decoded.telegramId;
    if (!adminTelegramId) {
      return ApiResponse.error('Admin telegramId not found in token', 404);
    }

    const body = await request.json();
    const format = body.format || 'csv'; // csv или json
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    if (!TELEGRAM_BOT_TOKEN) {
      return ApiResponse.error('TELEGRAM_BOT_TOKEN not configured', 500);
    }

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

    let fileContent: string;
    let filename: string;
    let mimeType: string;

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

      fileContent = JSON.stringify(exportData, null, 2);
      filename = `products-export-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
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
      fileContent = BOM + csvContent;
      filename = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
    }

    // Конвертируем в Buffer
    const buffer = Buffer.from(fileContent, 'utf-8');

    // Отправляем файл через Telegram Bot API используя sendDocument
    const form = new FormData();
    form.append('chat_id', adminTelegramId);
    form.append('document', new Blob([buffer], { type: mimeType }), filename);
    form.append('caption', `📊 Экспорт продуктов\n\nВсего продуктов: ${products.length}\nФормат: ${format.toUpperCase()}\nДата: ${new Date().toLocaleString('ru-RU')}`);

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
      {
        method: 'POST',
        body: form,
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramData.ok) {
      return ApiResponse.error(
        telegramData.description || 'Failed to send file to Telegram',
        500
      );
    }

    return ApiResponse.success({
      success: true,
      message: 'Файл успешно отправлен в Telegram',
      filename,
    });
  } catch (error: unknown) {
    return ApiResponse.internalError(error, {});
  }
}

// GET - экспорт продуктов в CSV или JSON (оставляем для обратной совместимости)
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
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

      const filename = `products-export-${new Date().toISOString().split('T')[0]}.json`;
      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
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
      const filename = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
      return new Response(BOM + csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }
  } catch (error: unknown) {
    return ApiResponse.internalError(error, {});
  }
}

