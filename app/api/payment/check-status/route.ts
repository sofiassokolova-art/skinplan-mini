// app/api/payment/check-status/route.ts
// DEPRECATED: Используйте /api/me/entitlements вместо этого endpoint
// Этот endpoint использует теги пользователя, что неправильно
// Правильная схема: Payment -> Entitlement через вебхук

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

export const runtime = 'nodejs';

/**
 * @deprecated Используйте GET /api/me/entitlements для проверки доступа
 * Этот endpoint использует теги пользователя, что не является правильной схемой оплаты
 * Правильная схема: Payment создается через POST /api/payments/create,
 * статус обновляется через вебхук POST /api/payments/webhook,
 * доступ проверяется через GET /api/me/entitlements
 */
export async function GET(request: NextRequest) {
  try {
    logger.warn('DEPRECATED: /api/payment/check-status is deprecated. Use /api/me/entitlements instead.');
    
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;

    // DEPRECATED: Проверяем флаг оплаты в БД через тег пользователя
    // Это неправильная схема - используйте Entitlement
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tags: true },
    });

    const hasPaid = user?.tags?.includes('payment_completed') || false;

    return ApiResponse.success({ hasPaid });
  } catch (error: unknown) {
    logger.error('Error checking payment status', error);
    return ApiResponse.internalError(error);
  }
}
