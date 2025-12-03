// app/api/plan/route.ts
// API endpoint для получения плана БЕЗ генерации (только из кэша/БД)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCachedPlan } from '@/lib/cache';
import { ApiResponse } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/plan';
  let userId: string | undefined;
  
  try {
    // Получаем initData из заголовков
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');
    
    if (!initData) {
      logger.error('Missing initData in headers for plan retrieval', {
        availableHeaders: Array.from(request.headers.keys()),
      });
      return ApiResponse.unauthorized('Missing Telegram initData. Please open the app through Telegram Mini App.');
    }

    // Получаем userId из initData
    const userIdResult = await getUserIdFromInitData(initData);
    userId = userIdResult || undefined;
    
    if (!userId) {
      logger.error('Invalid or expired initData');
      return ApiResponse.unauthorized('Invalid or expired Telegram initData');
    }

    logger.info('User identified from initData', { userId });
    
    // Получаем профиль для версии
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { version: true },
    });

    if (!profile) {
      logger.error('No skin profile found for user', { userId });
      return ApiResponse.notFound('No skin profile found', { userId });
    }

    // Проверяем кэш - только кэш, без генерации
    logger.debug('Checking cache for plan (no generation)', { userId, profileVersion: profile.version });
    const cachedPlan = await getCachedPlan(userId, profile.version);
    
    if (cachedPlan && cachedPlan.plan28) {
      logger.info('Plan retrieved from cache', { userId, profileVersion: profile.version });
      return ApiResponse.success(cachedPlan);
    }

    // Если план не найден в кэше, проверяем старые версии профиля (план мог быть сохранен под другой версией)
    // Это может произойти, если профиль был обновлен, но план еще не регенерирован
    logger.debug('Plan not found in cache for current version, checking previous versions', { 
      userId, 
      currentVersion: profile.version 
    });
    
    // Проверяем предыдущие версии профиля (максимум последние 5 версий)
    const previousProfiles = await prisma.skinProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { version: true },
    });

    for (const prevProfile of previousProfiles) {
      if (prevProfile.version === profile.version) continue; // Уже проверили
      
      const prevCachedPlan = await getCachedPlan(userId, prevProfile.version);
      if (prevCachedPlan && prevCachedPlan.plan28) {
        logger.info('Plan found in cache for previous profile version', { 
          userId, 
          profileVersion: prevProfile.version,
          currentVersion: profile.version
        });
        // Возвращаем план из старой версии - он все еще валиден
        return ApiResponse.success(prevCachedPlan);
      }
    }

    // План не найден ни в текущем, ни в предыдущих версиях - возвращаем 404
    logger.info('Plan not found in cache for any version', { userId, profileVersion: profile.version });
    return ApiResponse.notFound('Plan not found. Please generate a plan first.', { userId });
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.error('Error retrieving plan', { error, userId, duration });
    
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}

