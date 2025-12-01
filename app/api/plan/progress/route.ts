// app/api/plan/progress/route.ts
// API для сохранения и загрузки прогресса плана (день, выполненные дни)
//
// Прогресс жёстко привязан к пользователю через Telegram initData:
// - client → всегда передаёт X-Telegram-Init-Data (см. lib/api.ts)
// - server → через getUserIdFromInitData(initData) получает userId (User.id)
//
// Никакого localStorage для "истинных" данных прогресса — только как UI‑кеш.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

export async function GET(request: NextRequest) {
  try {
    // Пробуем оба варианта заголовка (регистронезависимо)
    const initData =
      request.headers.get('x-telegram-init-data') ||
      request.headers.get('X-Telegram-Init-Data') ||
      null;

    if (!initData) {
      return NextResponse.json(
        { error: 'Unauthorized: initData is required' },
        { status: 401 }
      );
    }

    const userId = await getUserIdFromInitData(initData);

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    const progress = await prisma.planProgress.findUnique({
      where: { userId },
    });

    if (!progress) {
      // Если прогресса нет — возвращаем дефолтное значение
      return NextResponse.json({
        currentDay: 1,
        completedDays: [] as number[],
      });
    }

    return NextResponse.json({
      currentDay: progress.currentDay,
      completedDays: progress.completedDays,
    });
  } catch (error: any) {
    console.error('❌ Error getting plan progress:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to get plan progress' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const initData =
      request.headers.get('x-telegram-init-data') ||
      request.headers.get('X-Telegram-Init-Data') ||
      null;

    if (!initData) {
      return NextResponse.json(
        { error: 'Unauthorized: initData is required' },
        { status: 401 }
      );
    }

    const userId = await getUserIdFromInitData(initData);

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const currentDay = Number(body.currentDay) || 1;
    const completedDaysInput = Array.isArray(body.completedDays)
      ? body.completedDays
      : [];

    // Нормализуем completedDays: числа, без NaN и дубликатов, сортированные по возрастанию
    const completedDaysSet = new Set<number>();
    for (const d of completedDaysInput) {
      const num = Number(d);
      if (Number.isFinite(num) && num >= 1 && num <= 28) {
        completedDaysSet.add(num);
      }
    }
    const completedDays = Array.from(completedDaysSet).sort((a, b) => a - b);

    const safeCurrentDay =
      currentDay < 1 ? 1 : currentDay > 28 ? 28 : currentDay;

    const progress = await prisma.planProgress.upsert({
      where: { userId },
      update: {
        currentDay: safeCurrentDay,
        completedDays,
      },
      create: {
        userId,
        currentDay: safeCurrentDay,
        completedDays,
      },
    });

    return NextResponse.json({
      currentDay: progress.currentDay,
      completedDays: progress.completedDays,
    });
  } catch (error: any) {
    console.error('❌ Error saving plan progress:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save plan progress' },
      { status: 500 }
    );
  }
}


