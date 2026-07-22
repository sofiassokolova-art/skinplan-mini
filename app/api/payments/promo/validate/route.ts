import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { logger, logApiError, logApiRequest } from '@/lib/logger';
import { PAYMENT_PRODUCTS } from '@/lib/payment-products';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { rateLimit } from '@/lib/rate-limit';
import { validatePromoCodeForPayment } from '@/lib/promo-codes';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/payments/promo/validate';
  let userId: string | undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    const rl = await rateLimit(`promo:validate:${userId}`, {
      maxRequests: 10,
      interval: 60_000,
    }, 'promo_validate');
    if (!rl.success) {
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 429, duration, userId);
      return ApiResponse.error('Слишком много попыток. Попробуйте через минуту.', 429);
    }

    const body = await request.json();
    const productCode = typeof body?.productCode === 'string' ? body.productCode : '';
    const promoCode = typeof body?.promoCode === 'string' ? body.promoCode : '';

    const product = PAYMENT_PRODUCTS[productCode];
    if (!product) {
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 400, duration, userId);
      return ApiResponse.error('Unknown productCode', 400);
    }

    const promoResult = await validatePromoCodeForPayment(prisma, {
      userId,
      productCode,
      amount: product.amount,
      code: promoCode,
    });

    if (!promoResult.ok) {
      const duration = Date.now() - startTime;
      logApiRequest(method, path, promoResult.status, duration, userId);
      return ApiResponse.error(promoResult.error, promoResult.status);
    }

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return ApiResponse.success({
      promoCode: promoResult.promo.code,
      amount: promoResult.promo.amount,
      originalAmount: promoResult.promo.originalAmount,
      discountAmount: promoResult.promo.discountAmount,
      discountType: promoResult.promo.discountType,
      discountValue: promoResult.promo.discountValue,
    });
  } catch (error: unknown) {
    logger.error('Promo validation failed', error);
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}

