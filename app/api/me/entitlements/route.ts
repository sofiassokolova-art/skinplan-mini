// app/api/me/entitlements/route.ts
// Проверка доступа пользователя (entitlements)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/me/entitlements';
  let userId: string | undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    // Получаем активные entitlements пользователя
    const entitlements = await prisma.entitlement.findMany({
      where: {
        userId,
        active: true,
        OR: [
          { validUntil: null },
          { validUntil: { gt: new Date() } },
        ],
      },
      select: {
        code: true,
        active: true,
        validUntil: true,
        lastPaymentId: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Проверяем наличие доступа к плану
    const paidAccess = entitlements.find((e) => e.code === 'paid_access');
    const paid = paidAccess?.active === true && 
                 (!paidAccess.validUntil || paidAccess.validUntil > new Date());

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    const payload = {
      paid,
      validUntil: paidAccess?.validUntil?.toISOString() || null,
      entitlements: entitlements.map((e) => ({
        code: e.code,
        active: e.active,
        validUntil: e.validUntil?.toISOString() || null,
      })),
    };

    // ИСПРАВЛЕНО: совместимость со старым фронтом, который ожидает обертку { data: ... }.
    // ApiResponse.success() исторически возвращает payload напрямую, поэтому отдаем оба формата.
    return ApiResponse.success({
      ...payload,
      data: payload,
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}









