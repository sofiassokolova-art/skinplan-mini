// app/api/admin/clear-cache/route.ts
// Очистка кэша плана и рекомендаций для текущего пользователя

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { invalidateAllUserCache } from '@/lib/cache';
import { ApiResponse } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;

    logger.info('Clearing cache and sessions for user', { userId });

    // 1. Очищаем весь кэш пользователя
    try {
      await invalidateAllUserCache(userId);
      logger.info('✅ Cache cleared', { userId });
    } catch (cacheError: any) {
      logger.warn('⚠️ Cache clearing failed (may be read-only token)', { 
        userId, 
        error: cacheError?.message 
      });
    }

    // 2. Удаляем все RecommendationSession для пользователя
    const sessionsDeleted = await prisma.recommendationSession.deleteMany({
      where: { userId },
    });
    logger.info('✅ RecommendationSessions deleted', { 
      userId, 
      count: sessionsDeleted.count 
    });

    // 3. Удаляем прогресс плана (опционально, раскомментируйте если нужно)
    // const progressDeleted = await prisma.planProgress.deleteMany({
    //   where: { userId },
    // });
    // logger.info('✅ Plan progress deleted', { 
    //   userId, 
    //   count: progressDeleted.count 
    // });

    return ApiResponse.success({
      success: true,
      message: 'Cache and sessions cleared',
      userId,
      sessionsDeleted: sessionsDeleted.count,
    });
  } catch (error: unknown) {
    logger.error('Error clearing cache', error);
    return ApiResponse.internalError(error);
  }
}
