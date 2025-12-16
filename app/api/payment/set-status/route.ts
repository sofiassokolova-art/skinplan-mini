// app/api/payment/set-status/route.ts
// API endpoint для установки статуса оплаты (для тестирования)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { ApiResponse } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Получаем initData из заголовков
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');
    
    if (!initData) {
      return ApiResponse.unauthorized('Missing Telegram initData');
    }

    // Получаем userId из initData
    const userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      return ApiResponse.unauthorized('Invalid or expired initData');
    }

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
