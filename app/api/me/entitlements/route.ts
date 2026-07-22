// app/api/me/entitlements/route.ts
// Проверка доступа пользователя (entitlements)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { getPlanAccessState } from '@/lib/plan-access';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/me/entitlements';
  let userId: string | undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    const now = new Date();

    // Получаем активные entitlements пользователя
    const [entitlements, planAccessState] = await Promise.all([
      prisma.entitlement.findMany({
        where: {
          userId,
          active: true,
          OR: [
            { validUntil: null },
            { validUntil: { gt: now } },
          ],
        },
        select: {
          code: true,
          active: true,
          validUntil: true,
          lastPaymentId: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      getPlanAccessState(userId, now),
    ]);

    // Проверяем наличие доступа к плану
    const paid = planAccessState.hasActivePaidAccess;

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    const payload = {
      paid,
      hasPaidBefore: planAccessState.hasPaidBefore,
      hasActivePaidAccess: planAccessState.hasActivePaidAccess,
      validUntil: planAccessState.paidAccessValidUntil,
      entitlements: entitlements.map((e) => ({
        code: e.code,
        active: e.active,
        validUntil: e.validUntil?.toISOString() || null,
      })),
    };

    return ApiResponse.success(payload);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}




