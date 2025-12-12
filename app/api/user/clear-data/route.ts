// app/api/user/clear-data/route.ts
// API endpoint для очистки всех данных пользователя (БД + кэш)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { invalidateAllUserCache } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { ApiResponse } from '@/lib/api-response';

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
      return ApiResponse.unauthorized('Invalid or expired Telegram initData');
    }

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

    // 3. Удаляем данные из БД
    const results = {
      recommendationSessions: 0,
      planProgress: 0,
      userAnswers: 0,
      skinProfiles: 0,
      planFeedback: 0,
      wishlist: 0,
      cart: 0,
      plan28: 0,
      clientLogs: 0,
    };

    // Удаляем RecommendationSession
    results.recommendationSessions = (await prisma.recommendationSession.deleteMany({
      where: { userId },
    })).count;

    // Удаляем PlanProgress
    try {
      results.planProgress = (await prisma.planProgress.deleteMany({
        where: { userId },
      })).count;
    } catch (error: any) {
      // Игнорируем ошибки схемы
    }

    // Удаляем UserAnswer
    results.userAnswers = (await prisma.userAnswer.deleteMany({
      where: { userId },
    })).count;

    // Удаляем SkinProfile
    results.skinProfiles = (await prisma.skinProfile.deleteMany({
      where: { userId },
    })).count;

    // Удаляем PlanFeedback
    try {
      results.planFeedback = (await prisma.planFeedback.deleteMany({
        where: { userId },
      })).count;
    } catch (error: any) {
      // Игнорируем ошибки
    }

    // Удаляем Wishlist
    try {
      results.wishlist = (await prisma.wishlist.deleteMany({
        where: { userId },
      })).count;
    } catch (error: any) {
      // Игнорируем ошибки
    }

    // Удаляем Cart
    try {
      results.cart = (await prisma.cart.deleteMany({
        where: { userId },
      })).count;
    } catch (error: any) {
      // Игнорируем ошибки
    }

    // Удаляем Plan28
    try {
      results.plan28 = (await prisma.plan28.deleteMany({
        where: { userId },
      })).count;
    } catch (error: any) {
      // Игнорируем ошибки
    }

    // Удаляем ClientLog
    try {
      results.clientLogs = (await prisma.clientLog.deleteMany({
        where: { userId },
      })).count;
    } catch (error: any) {
      // Игнорируем ошибки
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

