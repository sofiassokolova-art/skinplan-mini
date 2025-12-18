// app/api/plan/status/route.ts
// Endpoint для проверки статуса генерации плана (polling)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { getCurrentProfile } from '@/lib/get-current-profile';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;

    // Получаем текущий профиль
    const profile = await getCurrentProfile(userId);
    if (!profile) {
      return ApiResponse.success({
        status: 'no_profile',
        ready: false,
      });
    }

    // Проверяем, есть ли план для текущей версии профиля
    const plan = await prisma.plan28.findFirst({
      where: {
        userId,
        profileVersion: profile.version,
      },
      select: {
        id: true,
        planData: true,
        createdAt: true,
      },
    });

    if (plan && plan.planData) {
      const planData = plan.planData as any;
      const hasPlan28 = planData?.days && Array.isArray(planData.days) && planData.days.length > 0;
      
      if (hasPlan28) {
        return ApiResponse.success({
          status: 'ready',
          ready: true,
          profileVersion: profile.version,
          profileId: profile.id,
        });
      }
    }

    // План еще не готов
    return ApiResponse.success({
      status: 'generating',
      ready: false,
      profileVersion: profile.version,
      profileId: profile.id,
    });
  } catch (error: unknown) {
    logger.error('Error checking plan status', error);
    return ApiResponse.internalError(error);
  }
}
