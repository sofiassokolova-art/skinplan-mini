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
import { logger, logApiRequest, logApiError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/plan/progress';
  let userId: string | undefined;

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

    let progress;
    try {
      progress = await prisma.planProgress.findUnique({
        where: { userId },
      });
    } catch (dbError: any) {
      // Если ошибка связана с отсутствием колонки - возвращаем дефолтное значение
      if (dbError?.message?.includes('does not exist') || dbError?.message?.includes('column')) {
        logger.warn('PlanProgress table schema mismatch, returning default values', { userId, error: dbError.message });
        return NextResponse.json({
          currentDay: 1,
          completedDays: [] as number[],
          currentStreak: 0,
          longestStreak: 0,
          totalCompletedDays: 0,
        });
      }
      throw dbError;
    }

    if (!progress) {
      // Если прогресса нет — возвращаем дефолтное значение
      return NextResponse.json({
        currentDay: 1,
        completedDays: [] as number[],
        currentStreak: 0,
        longestStreak: 0,
        totalCompletedDays: 0,
      });
    }

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    // Безопасно получаем completedDays - может быть массивом или нужно преобразовать
    const completedDays = Array.isArray(progress.completedDays) 
      ? progress.completedDays 
      : (progress as any).completed_days || [];

    return NextResponse.json({
      currentDay: progress.currentDay,
      completedDays: completedDays,
      currentStreak: (progress as any).currentStreak || 0,
      longestStreak: (progress as any).longestStreak || 0,
      totalCompletedDays: (progress as any).totalCompletedDays || completedDays.length,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);

    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment 
      ? error?.message || 'Failed to get plan progress'
      : 'Failed to get plan progress';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/plan/progress';
  let userId: string | undefined;

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

    // Функция для подсчета стриков (последовательных дней)
    const calculateStreaks = (days: number[]): { currentStreak: number; longestStreak: number } => {
      if (days.length === 0) {
        return { currentStreak: 0, longestStreak: 0 };
      }

      // Сортируем дни по возрастанию
      const sortedDays = [...days].sort((a, b) => a - b);
      
      let currentStreak = 1; // Текущий стрик (последняя последовательность)
      let longestStreak = 1; // Максимальный стрик за все время
      let tempStreak = 1;

      // Находим текущий стрик (последняя последовательность, идем с конца)
      for (let i = sortedDays.length - 1; i > 0; i--) {
        if (sortedDays[i] === sortedDays[i - 1] + 1) {
          currentStreak++;
        } else {
          break; // Прерывание последовательности - это и есть текущий стрик
        }
      }

      // Находим максимальный стрик (проходим весь массив)
      tempStreak = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        if (sortedDays[i] === sortedDays[i - 1] + 1) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 1;
        }
      }

      return { currentStreak, longestStreak };
    };

    // Получаем существующий прогресс для обновления стриков
    const existingProgress = await prisma.planProgress.findUnique({
      where: { userId },
    });

    const { currentStreak, longestStreak } = calculateStreaks(completedDays);
    const totalCompletedDays = completedDays.length;

    // Обновляем longestStreak только если новый стрик больше предыдущего
    const finalLongestStreak = existingProgress
      ? Math.max((existingProgress as any).longestStreak || 0, longestStreak)
      : longestStreak;

    const progress = await prisma.planProgress.upsert({
      where: { userId },
      update: {
        currentDay: safeCurrentDay,
        completedDays,
        currentStreak: currentStreak as any,
        longestStreak: finalLongestStreak as any,
        totalCompletedDays: totalCompletedDays as any,
      },
      create: {
        userId,
        currentDay: safeCurrentDay,
        completedDays,
        currentStreak: currentStreak as any,
        longestStreak: finalLongestStreak as any,
        totalCompletedDays: totalCompletedDays as any,
      },
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json({
      currentDay: progress.currentDay,
      completedDays: progress.completedDays,
      currentStreak: (progress as any).currentStreak || 0,
      longestStreak: (progress as any).longestStreak || 0,
      totalCompletedDays: (progress as any).totalCompletedDays || progress.completedDays.length,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);

    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment 
      ? error?.message || 'Failed to save plan progress'
      : 'Failed to save plan progress';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


