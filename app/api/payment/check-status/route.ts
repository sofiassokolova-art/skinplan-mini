// app/api/payment/check-status/route.ts
// API endpoint для проверки статуса оплаты

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { ApiResponse } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
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
