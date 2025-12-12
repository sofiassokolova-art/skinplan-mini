// app/api/plan/route.ts
// API endpoint для получения плана БЕЗ генерации (только из кэша/БД)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCachedPlan } from '@/lib/cache';
import { ApiResponse } from '@/lib/api-response';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import type { Plan28 } from '@/lib/plan-types';
import type { PlanResponse } from '@/lib/api-types';

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

    // ИСПРАВЛЕНО: Сначала проверяем БД, а не кэш
    // Это гарантирует, что после генерации плана мы получим свежий план из БД, а не старый из кэша
    // Кэш может содержать старую версию плана с 2 продуктами вместо 5
    logger.debug('Checking database first (before cache) to get fresh plan', { userId, profileVersion: profile.version });
    
    // Проверяем БД сначала
    const planFromDb = await prisma.plan28.findFirst({
      where: {
        userId,
        profileVersion: profile.version,
      },
      select: {
        planData: true,
        updatedAt: true,
      },
    });
    
    if (planFromDb && planFromDb.planData) {
      // ИСПРАВЛЕНО: Используем правильный тип для planData из БД
      const planData = planFromDb.planData as { days?: Array<{ dayIndex: number }>; mainGoals?: string[] };
      
      // Проверяем, что план имеет правильную структуру
      const hasPlan28 = planData && planData.days && Array.isArray(planData.days) && planData.days.length > 0;
      
      if (hasPlan28) {
        // Формируем ответ в формате, который ожидает клиент
        const planResponse: PlanResponse = {
          plan28: planData as Plan28,
        };
        
        // Попытаемся сохранить в кэш для будущих запросов
        try {
          const { setCachedPlan } = await import('@/lib/cache');
          await setCachedPlan(userId, profile.version, planResponse);
          logger.info('Plan retrieved from DB and cached', { userId, profileVersion: profile.version });
        } catch (cacheError) {
          // Ошибка кэширования не критична
          logger.warn('Failed to cache plan from DB (non-critical)', { userId, profileVersion: profile.version });
        }
        
        const duration = Date.now() - startTime;
        logApiRequest(method, path, 200, duration, userId);
        return ApiResponse.success(planResponse);
      }
    }
    
    // Если план не найден в БД, проверяем кэш (fallback)
    logger.debug('Plan not found in DB, checking cache', { userId, profileVersion: profile.version });
    const cachedPlan = await getCachedPlan(userId, profile.version);
    
    if (cachedPlan && cachedPlan.plan28) {
      const duration = Date.now() - startTime;
      logger.info('Plan retrieved from cache (fallback)', { userId, profileVersion: profile.version });
      logApiRequest(method, path, 200, duration, userId);
      return ApiResponse.success(cachedPlan);
    }


    // ВАЖНО: При перепрохождении анкеты НЕ возвращаем план из старой версии
    // Пользователь должен получить план, соответствующий новым ответам
    // Если план не найден для текущей версии - возвращаем 404, чтобы триггерить генерацию
    logger.debug('Plan not found in cache or DB for current version - will trigger generation', { 
      userId, 
      currentVersion: profile.version 
    });

    // План не найден ни в кэше, ни в БД - возвращаем 404
    const duration = Date.now() - startTime;
    logger.info('Plan not found in cache or DB for any version', { userId, profileVersion: profile.version });
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

