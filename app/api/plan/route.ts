// app/api/plan/route.ts
// API endpoint для получения плана БЕЗ генерации (только из кэша/БД)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCachedPlan } from '@/lib/cache';
import { ApiResponse } from '@/lib/api-response';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
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
      const duration = Date.now() - startTime;
      logger.error('Missing initData in headers for plan retrieval', {
        availableHeaders: Array.from(request.headers.keys()),
      });
      logApiRequest(method, path, 401, duration);
      return ApiResponse.unauthorized('Missing Telegram initData. Please open the app through Telegram Mini App.');
    }

    // Получаем userId из initData
    const userIdResult = await getUserIdFromInitData(initData);
    userId = userIdResult || undefined;
    
    if (!userId) {
      const duration = Date.now() - startTime;
      logger.error('Invalid or expired initData');
      logApiRequest(method, path, 401, duration);
      return ApiResponse.unauthorized('Invalid or expired Telegram initData');
    }

    logger.info('User identified from initData', { userId });
    
    // Получаем профиль для версии
    // ВАЖНО: Используем orderBy по version DESC, чтобы получить последнюю версию
    // При перепрохождении анкеты создается новая версия профиля, и план должен быть для новой версии
    // ИСПРАВЛЕНО: Добавляем небольшую задержку и повторную попытку, если профиль не найден
    // Это решает проблему race condition, когда профиль только что создан, но еще не виден в БД
    let profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
      select: { version: true, updatedAt: true },
    });

    // Если профиль не найден, ждем немного и пробуем еще раз (race condition fix)
    if (!profile) {
      logger.warn('Profile not found on first attempt, waiting and retrying...', { userId });
      await new Promise(resolve => setTimeout(resolve, 200)); // Ждем 200ms
      profile = await prisma.skinProfile.findFirst({
        where: { userId },
        orderBy: { version: 'desc' },
        select: { version: true, updatedAt: true },
      });
    }

    if (!profile) {
      const duration = Date.now() - startTime;
      logger.error('No skin profile found for user after retry', { userId });
      logApiRequest(method, path, 404, duration, userId);
      return ApiResponse.notFound('No skin profile found', { userId });
    }

    // Проверяем кэш - только кэш, без генерации
    logger.debug('Checking cache for plan (no generation)', { userId, profileVersion: profile.version });
    const cachedPlan = await getCachedPlan(userId, profile.version);
    
    if (cachedPlan && cachedPlan.plan28) {
      const duration = Date.now() - startTime;
      logger.info('Plan retrieved from cache', { userId, profileVersion: profile.version });
      logApiRequest(method, path, 200, duration, userId);
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
    const duration = Date.now() - startTime;
    logger.info('Plan not found in cache for any version', { userId, profileVersion: profile.version });
    logApiRequest(method, path, 404, duration, userId);
    return ApiResponse.notFound('Plan not found. Please generate a plan first.', { userId });
    
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    // Правильно сериализуем ошибку для логирования
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name }
      : { error: String(error) };
    logger.error('Error retrieving plan', { ...errorDetails, userId, duration });
    logApiError(method, path, error, userId);
    
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}

