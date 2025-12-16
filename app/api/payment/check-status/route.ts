// app/api/payment/check-status/route.ts
// API endpoint для проверки статуса оплаты

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;

    // Проверяем флаг оплаты в БД через тег пользователя
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
