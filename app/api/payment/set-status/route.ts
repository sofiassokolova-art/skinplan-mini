// app/api/payment/set-status/route.ts
// DEPRECATED: НЕ ИСПОЛЬЗУЙТЕ ЭТОТ ENDPOINT В ПРОДАКШЕНЕ!
// Оплата должна обрабатываться через вебхук от платежного провайдера
// Этот endpoint позволяет подделать оплату с клиента - это НЕБЕЗОПАСНО!

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

export const runtime = 'nodejs';

/**
 * @deprecated НЕ ИСПОЛЬЗУЙТЕ В ПРОДАКШЕНЕ!
 * 
 * ПРАВИЛЬНАЯ СХЕМА ОПЛАТЫ:
 * 1. Клиент создает платеж через POST /api/payments/create
 * 2. Провайдер отправляет вебхук на POST /api/payments/webhook
 * 3. Вебхук обновляет Payment.status и создает/обновляет Entitlement
 * 4. Клиент проверяет доступ через GET /api/me/entitlements
 * 
 * Этот endpoint позволяет подделать оплату - используйте только для тестирования!
 */
export async function POST(request: NextRequest) {
  try {
    // В продакшене блокируем этот endpoint
    if (process.env.NODE_ENV === 'production') {
      logger.error('DEPRECATED endpoint /api/payment/set-status called in production! This is a security risk!');
      return ApiResponse.error('This endpoint is disabled in production for security reasons', 403);
    }

    logger.warn('DEPRECATED: /api/payment/set-status is deprecated. Use /api/payments/create + webhook instead.');
    
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;

    // DEPRECATED: Устанавливаем флаг оплаты в БД через тег пользователя
    // Это неправильная схема - используйте Payment + Entitlement через вебхук
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
      logger.info('Payment status set via DEPRECATED API (testing only)', { userId });
    }

    return ApiResponse.success({ 
      success: true, 
      message: 'Payment status set successfully (DEPRECATED - testing only)',
      alreadySet: hasPaymentTag,
    });
  } catch (error: unknown) {
    logger.error('Error setting payment status', error);
    return ApiResponse.internalError(error);
  }
}
