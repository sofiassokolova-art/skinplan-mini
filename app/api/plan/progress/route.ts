import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

const TOTAL_PLAN_DAYS = 28;

function clampDay(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.min(Math.max(Math.round(value), 1), TOTAL_PLAN_DAYS);
}

function normalizeCompletedDays(days: unknown): number[] {
  if (!Array.isArray(days)) {
    return [];
  }

  const unique = new Set<number>();

  days.forEach((value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      unique.add(clampDay(value));
    }
  });

  return Array.from(unique).sort((a, b) => a - b);
}

async function ensureProfile(userId: string) {
  return prisma.skinProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { version: true },
  });
}

export async function GET(request: NextRequest) {
  try {
    const initData =
      request.headers.get('x-telegram-init-data') ??
      request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
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

    const profile = await ensureProfile(userId);

    if (!profile) {
      return NextResponse.json(
        { error: 'No skin profile found' },
        { status: 404 }
      );
    }

    let progress = await prisma.planProgress.findUnique({
      where: { userId },
    });

    if (!progress) {
      progress = await prisma.planProgress.create({
        data: {
          userId,
          planVersion: profile.version,
          currentDay: 1,
          completedDays: [],
        },
      });
    } else if (progress.planVersion !== profile.version) {
      progress = await prisma.planProgress.update({
        where: { userId },
        data: {
          planVersion: profile.version,
          currentDay: 1,
          completedDays: [],
        },
      });
    }

    const safeCurrentDay = clampDay(progress.currentDay);

    return NextResponse.json({
      progress: {
        currentDay: safeCurrentDay,
        completedDays: normalizeCompletedDays(progress.completedDays),
        planVersion: progress.planVersion ?? profile.version,
        totalDays: TOTAL_PLAN_DAYS,
      },
    });
  } catch (error) {
    console.error('Error fetching plan progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const initData =
      request.headers.get('x-telegram-init-data') ??
      request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
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

    const profile = await ensureProfile(userId);

    if (!profile) {
      return NextResponse.json(
        { error: 'No skin profile found' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { currentDay, completedDays, reset }: {
      currentDay?: number;
      completedDays?: number[];
      reset?: boolean;
    } = body || {};

    let nextCurrentDay: number | undefined;
    let nextCompletedDays: number[] | undefined;

    if (reset) {
      nextCurrentDay = 1;
      nextCompletedDays = [];
    } else {
      if (typeof currentDay === 'number' && Number.isFinite(currentDay)) {
        nextCurrentDay = clampDay(currentDay);
      }

      if (Array.isArray(completedDays)) {
        nextCompletedDays = normalizeCompletedDays(completedDays);
      }
    }

    if (nextCurrentDay === undefined && nextCompletedDays === undefined) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const progress = await prisma.planProgress.upsert({
      where: { userId },
      create: {
        userId,
        planVersion: profile.version,
        currentDay: nextCurrentDay ?? 1,
        completedDays: nextCompletedDays ?? [],
      },
      update: {
        ...(nextCurrentDay !== undefined ? { currentDay: nextCurrentDay } : {}),
        ...(nextCompletedDays !== undefined
          ? { completedDays: nextCompletedDays }
          : {}),
        planVersion: profile.version,
      },
    });

    const safeCurrentDay = clampDay(progress.currentDay);

    return NextResponse.json({
      progress: {
        currentDay: safeCurrentDay,
        completedDays: normalizeCompletedDays(progress.completedDays),
        planVersion: progress.planVersion ?? profile.version,
        totalDays: TOTAL_PLAN_DAYS,
      },
    });
  } catch (error) {
    console.error('Error updating plan progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
