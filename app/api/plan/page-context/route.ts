// app/api/plan/page-context/route.ts
// Возвращает весь персонализированный контекст для страницы плана.
// Один запрос = вся начинка: hero, скор, профиль-карусель, фазы, продукты, советы.

import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api-response';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { buildPlanPageContext } from '@/lib/plan-page';
import { stripPrices } from '@/lib/strip-prices';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/plan/page-context';
  let userId: string | undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) {
      logApiRequest(method, path, 401, Date.now() - startTime);
      return auth.response;
    }
    userId = auth.ctx.userId;

    const context = await buildPlanPageContext(userId);
    const duration = Date.now() - startTime;

    if (!context) {
      logApiRequest(method, path, 200, duration, userId);
      return ApiResponse.success({ state: 'no_plan' });
    }

    logger.info('Plan page context built', {
      userId,
      duration,
      productsCount: context.products.length,
      profileCardsCount: context.profileCards.length,
      currentDay: context.hero.currentDay,
    });

    logApiRequest(method, path, 200, duration, userId);
    // Политика: цена продукта не должна уходить на клиент (см. lib/strip-prices).
    return ApiResponse.success(stripPrices({ state: 'ok', context }));
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}
