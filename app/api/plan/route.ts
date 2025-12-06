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
    // ВАЖНО: Используем orderBy по version DESC, чтобы получить последнюю версию
    // При перепрохождении анкеты создается новая версия профиля, и план должен быть для новой версии
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' }, // Используем version вместо createdAt для корректной версии
      select: { version: true, updatedAt: true },
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

    // ВАЖНО: При перепрохождении анкеты НЕ возвращаем план из старой версии
    // Пользователь должен получить план, соответствующий новым ответам
    // Если план не найден для текущей версии - возвращаем 404, чтобы триггерить генерацию
    logger.debug('Plan not found in cache for current version - will trigger generation', { 
      userId, 
      currentVersion: profile.version 
    });

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

