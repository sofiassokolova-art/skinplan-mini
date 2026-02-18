// app/api/admin/broadcasts/route.ts
// API для управления рассылками

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminBoolean } from '@/lib/admin-auth';

// ИСПРАВЛЕНО (P0): Убран неиспользуемый TELEGRAM_BOT_TOKEN
// Токен используется в /api/admin/broadcast/send, а не здесь

// Получить все рассылки
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ИСПРАВЛЕНО (P1): Пагинация для производительности
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100); // Максимум 100
    const skip = (page - 1) * limit;

    // ИСПРАВЛЕНО (P1): Оптимизированный select - только нужные поля
    // filtersJson и message не загружаются (можно загрузить через detail endpoint)
    const [broadcasts, total] = await Promise.all([
      prisma.broadcastMessage.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          scheduledAt: true,
          sentAt: true,
          totalCount: true,
          sentCount: true,
          failedCount: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.broadcastMessage.count(),
    ]);

    return NextResponse.json({
      broadcasts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Создать новую рассылку
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await verifyAdminBoolean(request);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, message, filtersJson, scheduledAt } = body;

    // ИСПРАВЛЕНО (P0): Валидация обязательных полей
    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      );
    }

    // ИСПРАВЛЕНО (P0): Ограничения по длине title и message
    if (typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be a string between 1 and 200 characters' },
        { status: 400 }
      );
    }

    if (typeof message !== 'string' || message.trim().length === 0 || message.length > 4096) {
      return NextResponse.json(
        { error: 'Message must be a string between 1 and 4096 characters (Telegram limit)' },
        { status: 400 }
      );
    }

    // ИСПРАВЛЕНО (P0): Валидация и нормализация filtersJson
    let normalizedFilters: any = {};
    if (filtersJson !== undefined && filtersJson !== null) {
      if (typeof filtersJson !== 'object' || Array.isArray(filtersJson)) {
        return NextResponse.json(
          { error: 'filtersJson must be an object' },
          { status: 400 }
        );
      }

      // ИСПРАВЛЕНО (P0): Ограничение размера filtersJson
      const filtersString = JSON.stringify(filtersJson);
      if (filtersString.length > 50000) {
        return NextResponse.json(
          { error: 'filtersJson is too large (max 50KB)' },
          { status: 400 }
        );
      }

      // Проверяем, что можно сериализовать
      try {
        JSON.parse(filtersString);
        normalizedFilters = filtersJson;
      } catch (e) {
        return NextResponse.json(
          { error: 'filtersJson is not valid JSON' },
          { status: 400 }
        );
      }
    }

    // ИСПРАВЛЕНО (P0): Валидация scheduledAt
    let normalizedScheduledAt: Date | null = null;
    if (scheduledAt) {
      const dt = new Date(scheduledAt);
      if (Number.isNaN(dt.getTime())) {
        return NextResponse.json(
          { error: 'scheduledAt must be a valid date' },
          { status: 400 }
        );
      }
      // Проверяем, что дата в будущем
      if (dt <= new Date()) {
        return NextResponse.json(
          { error: 'scheduledAt must be in the future' },
          { status: 400 }
        );
      }
      normalizedScheduledAt = dt;
    }

    const broadcast = await prisma.broadcastMessage.create({
      data: {
        title: title.trim(),
        message: message.trim(),
        filtersJson: normalizedFilters,
        status: normalizedScheduledAt ? 'scheduled' : 'draft',
        scheduledAt: normalizedScheduledAt,
        totalCount: 0,
        sentCount: 0,
        failedCount: 0,
      },
    });

    return NextResponse.json({ broadcast });
  } catch (error: any) {
    console.error('Error creating broadcast:', error);
    
    // ИСПРАВЛЕНО (P0): Более информативные ошибки
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Broadcast with this data already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

