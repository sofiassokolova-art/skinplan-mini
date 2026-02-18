// app/api/plan/status/route.ts
// Endpoint для проверки статуса генерации плана (polling)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { getCurrentProfile } from '@/lib/get-current-profile';
import { logger, logApiRequest, logApiError } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/plan/status';
  let userId: string | null = null;
  
  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) {
      logApiRequest(method, path, auth.response.status, Date.now() - startTime, null);
      return auth.response;
    }
    userId = auth.ctx.userId;

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
        const duration = Date.now() - startTime;
        const response = ApiResponse.success({
          status: 'ready',
          ready: true,
          profileVersion: profile.version,
          profileId: profile.id,
        });
        logApiRequest(method, path, 200, duration, userId);
        return response;
      }
    }

    // План еще не готов
    const duration = Date.now() - startTime;
    const response = ApiResponse.success({
      status: 'generating',
      ready: false,
      profileVersion: profile.version,
      profileId: profile.id,
    });
    logApiRequest(method, path, 200, duration, userId);
    return response;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.error('Error checking plan status', error);
    logApiError(method, path, error, userId);
    return ApiResponse.internalError(error);
  }
}
