// app/api/ai/daily-tip/route.ts
// API для получения ежедневного совета на основе плана пользователя

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/lib/api-response';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { generateDailyTip } from '@/lib/daily-tips';

interface DailyTipRequest {
  currentDay?: number;
  skinType?: string;
  concerns?: string[];
  currentProducts?: string[];
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    const body = await request.json() as DailyTipRequest;

    // Получаем профиль пользователя
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!profile) {
      return ApiResponse.notFound('Profile not found');
    }

    // Получаем план пользователя
    const planProgress = await prisma.planProgress.findUnique({
      where: { userId },
    });

    const currentDay = body.currentDay || planProgress?.currentDay || 1;
    const skinType = body.skinType || profile.skinType || 'normal';
    const concerns = body.concerns || (profile.medicalMarkers as any)?.concerns || [];

    // ПДн-комплаенс (152-ФЗ): совет формируется ЛОКАЛЬНО, без передачи данных о здоровье
    // (тип кожи, проблемы) во внешние сервисы (ранее отправлялось в OpenAI/США).
    // Подбор учитывает фазу плана, тип кожи и проблемы пользователя.
    const tip = generateDailyTip({ day: currentDay, skinType, concerns });
    logger.info('Daily tip generated', { userId, currentDay, source: 'local' });

    return NextResponse.json({
      tip,
      source: 'local',
      day: currentDay,
    });
  } catch (error: any) {
    logger.error('Error generating daily tip', { error, userId });
    return ApiResponse.internalError(error, { userId });
  }
}

