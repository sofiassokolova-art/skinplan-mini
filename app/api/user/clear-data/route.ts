// app/api/user/clear-data/route.ts
// API endpoint для очистки всех данных пользователя (БД + кэш)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { invalidateAllUserCache } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/lib/api-response';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { logDbFingerprint } from '@/lib/db-fingerprint';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // DEBUG: Логируем DB fingerprint для диагностики разных БД
    await logDbFingerprint('/api/user/clear-data');
    
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;

    logger.info('Starting user data cleanup', { userId });

    // 1. Получаем информацию о профиле для очистки кэша
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });

    // 2. Очищаем кэш
    try {
      if (profile) {
        await invalidateAllUserCache(userId);
        logger.info('Cache cleared', { userId, profileVersion: profile.version });
      }
    } catch (cacheError: any) {
      logger.warn('Failed to clear cache (non-critical)', cacheError, { userId });
    }

    // 3. Удаляем данные из БД ОДНОЙ транзакцией (всё-или-ничего).
    // Раньше это были последовательные deleteMany с проглатыванием ошибок —
    // сбой посередине оставлял аккаунт в полу-удалённом состоянии. Порядок
    // сохранён (дети перед родителями), все модели определены в schema.prisma.
    const [
      recommendationSessions,
      planProgress,
      userAnswers,
      skinProfiles,
      planFeedback,
      wishlist,
      cart,
      plan28,
      clientLogs,
    ] = await prisma.$transaction([
      prisma.recommendationSession.deleteMany({ where: { userId } }),
      prisma.planProgress.deleteMany({ where: { userId } }),
      prisma.userAnswer.deleteMany({ where: { userId } }),
      prisma.skinProfile.deleteMany({ where: { userId } }),
      prisma.planFeedback.deleteMany({ where: { userId } }),
      prisma.wishlist.deleteMany({ where: { userId } }),
      prisma.cart.deleteMany({ where: { userId } }),
      prisma.plan28.deleteMany({ where: { userId } }),
      prisma.clientLog.deleteMany({ where: { userId } }),
    ]);

    const results = {
      recommendationSessions: recommendationSessions.count,
      planProgress: planProgress.count,
      userAnswers: userAnswers.count,
      skinProfiles: skinProfiles.count,
      planFeedback: planFeedback.count,
      wishlist: wishlist.count,
      cart: cart.count,
      plan28: plan28.count,
      clientLogs: clientLogs.count,
    };

    // 4. Очищаем теги пользователя (включая флаг оплаты)
    // Это делает пользователя полностью "новым" с точки зрения статусов и сегментов.
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          // Полностью очищаем массив tags, чтобы убрать 'payment_completed' и любые связанные флаги
          tags: {
            set: [],
          },
        },
        // ВАЖНО: не возвращаем все поля User (может упасть при рассинхроне схемы БД)
        select: { id: true },
      });
      logger.info('User tags cleared (including payment status)', { userId });
    } catch (tagError: any) {
      logger.warn('Failed to clear user tags during cleanup (non-critical)', tagError, { userId });
    }

    logger.info('User data cleanup completed', { userId, results });

    return ApiResponse.success({
      success: true,
      message: 'All user data cleared successfully',
      results,
    });
  } catch (error: unknown) {
    logger.error('Error clearing user data', error);
    return ApiResponse.internalError(error);
  }
}




