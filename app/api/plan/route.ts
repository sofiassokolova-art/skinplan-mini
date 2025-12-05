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
    // ОПТИМИЗАЦИЯ: проверяем только последние 2 версии, чтобы не делать много запросов
    logger.debug('Plan not found in cache for current version, checking previous versions', { 
      userId, 
      currentVersion: profile.version 
    });
    
    // Проверяем только последние 2 версии профиля (вместо 5)
    // userId гарантированно string здесь (проверено выше на строке 33-36)
    const previousProfiles = await prisma.skinProfile.findMany({
      where: { userId: userId as string }, // TypeScript не видит проверку выше, поэтому используем type assertion
      orderBy: { createdAt: 'desc' },
      take: 2, // Уменьшено с 5 до 2 для ускорения
      select: { version: true },
    });

    // Параллельно проверяем кэш для всех предыдущих версий
    const previousVersions = previousProfiles.filter(p => p.version !== profile.version);
    const cacheChecks = previousVersions.map(prevProfile => getCachedPlan(userId as string, prevProfile.version));

    const cachedPlans = await Promise.all(cacheChecks);
    
    for (let i = 0; i < cachedPlans.length; i++) {
      const prevCachedPlan = cachedPlans[i];
      if (prevCachedPlan && prevCachedPlan.plan28) {
        const prevVersion = previousVersions[i]?.version;
        logger.info('Plan found in cache for previous profile version', { 
          userId, 
          profileVersion: prevVersion,
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
    // Правильно сериализуем ошибку для логирования
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name }
      : { error: String(error) };
    logger.error('Error retrieving plan', { ...errorDetails, userId, duration });
    
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}

