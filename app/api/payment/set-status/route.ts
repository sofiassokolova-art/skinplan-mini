// app/api/payment/set-status/route.ts
// API endpoint для установки статуса оплаты (для тестирования)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;

    // Устанавливаем флаг оплаты в БД через тег пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tags: true },
    });

    const tags = user?.tags || [];
    const hasPaymentTag = tags.includes('payment_completed');

    if (!hasPaymentTag) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          tags: { push: 'payment_completed' },
        },
        // ВАЖНО: не возвращаем все поля User (может упасть при рассинхроне схемы БД)
        select: { id: true },
      });
      logger.info('Payment status set via API', { userId });
    }

    return ApiResponse.success({ 
      success: true, 
      message: 'Payment status set successfully',
      alreadySet: hasPaymentTag,
    });
  } catch (error: unknown) {
    logger.error('Error setting payment status', error);
    return ApiResponse.internalError(error);
  }
}
