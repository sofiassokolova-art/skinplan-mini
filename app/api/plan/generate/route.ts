// app/api/plan/generate/route.ts
// Генерация 28-дневного плана ухода за кожей

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { setCachedPlan } from '@/lib/cache';
import { generate28DayPlan } from '@/lib/plan-generator';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import '@/lib/env-check'; // Валидация env переменных при старте
import { ApiResponse } from '@/lib/api-response';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/plan/generate';
  let userId: string | undefined;
  
  // Таймаут для генерации плана (60 секунд)
  const PLAN_GENERATION_TIMEOUT = 60000;
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Plan generation timeout after 60 seconds'));
    }, PLAN_GENERATION_TIMEOUT);
  });
  
  try {
    // Получаем initData из заголовков
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');
    
    if (!initData) {
      logger.error('Missing initData in headers for plan generation', {
        availableHeaders: Array.from(request.headers.keys()),
      });
      return ApiResponse.unauthorized('Missing Telegram initData. Please open the app through Telegram Mini App.');
    }

    // Получаем userId из initData (автоматически создает/обновляет пользователя)
    const { getUserIdFromInitData } = await import('@/lib/get-user-from-initdata');
    const userIdResult = await getUserIdFromInitData(initData);
    userId = userIdResult || undefined;
    
    if (!userId) {
      logger.error('Invalid or expired initData', undefined, {
        initDataLength: initData.length,
        initDataPrefix: initData.substring(0, 50),
      });
      return ApiResponse.unauthorized('Invalid or expired Telegram initData');
    }

    logger.info('User identified from initData', {
      userId,
      timestamp: new Date().toISOString(),
    });
    
    // Получаем профиль для версии
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    if (!profile) {
      logger.error('No skin profile found for user', { userId });
      return ApiResponse.notFound('No skin profile found', { userId });
    }

    logger.info('Plan generation request', {
      userId,
      profileVersion: profile.version,
      timestamp: new Date().toISOString(),
    });

    logger.info('Starting plan generation', {
      userId,
      profileVersion: profile.version,
      timestamp: new Date().toISOString(),
    });
    
    // Выполняем генерацию с таймаутом и детальной обработкой ошибок
    let plan: Awaited<ReturnType<typeof generate28DayPlan>>;
    try {
      logger.info('🚀 Starting generate28DayPlan function', {
        userId,
        profileVersion: profile.version,
        timestamp: new Date().toISOString(),
      });
      
      plan = await Promise.race([
        generate28DayPlan(userId),
        timeoutPromise,
      ]) as Awaited<ReturnType<typeof generate28DayPlan>>;
      
      logger.info('✅ generate28DayPlan completed successfully', {
        userId,
        profileVersion: profile.version,
        hasPlan28: !!plan?.plan28,
        hasWeeks: !!plan?.weeks,
        plan28DaysCount: plan?.plan28?.days?.length || 0,
      });
    } catch (error: any) {
      // ИСПРАВЛЕНО: Детальное логирование ошибки генерации
      logger.error('❌ Error during plan generation', error, {
        userId,
        profileVersion: profile.version,
        errorMessage: error?.message,
        errorStack: error?.stack?.substring(0, 1000),
        errorName: error?.name,
        errorCode: error?.code,
        timestamp: new Date().toISOString(),
      });
      
      // Возвращаем детальную ошибку клиенту
      return ApiResponse.error(
        `Failed to generate plan: ${error?.message || 'Unknown error'}`,
        500,
        {
          userId,
          profileVersion: profile.version,
          error: error?.message,
          errorName: error?.name,
          timestamp: new Date().toISOString(),
        }
      );
    }
    
    // Проверяем, что план действительно сгенерирован
    // ИСПРАВЛЕНО: Проверяем не только наличие plan28, но и что в нем есть дни
    const hasPlan28 = plan?.plan28 && plan.plan28.days && Array.isArray(plan.plan28.days) && plan.plan28.days.length > 0;
    const hasWeeks = plan?.weeks && Array.isArray(plan.weeks) && plan.weeks.length > 0;
    
    if (!plan || (!hasPlan28 && !hasWeeks)) {
      logger.error('❌ Plan generation returned empty result', undefined, {
        userId,
        profileVersion: profile.version,
        hasPlan28: !!plan?.plan28,
        hasPlan28Days: plan?.plan28?.days?.length || 0,
        hasWeeks: !!plan?.weeks,
        weeksCount: plan?.weeks?.length || 0,
        planKeys: plan ? Object.keys(plan) : [],
        plan28Structure: plan?.plan28 ? {
          hasDays: !!plan.plan28.days,
          daysType: typeof plan.plan28.days,
          daysIsArray: Array.isArray(plan.plan28.days),
          daysLength: Array.isArray(plan.plan28.days) ? plan.plan28.days.length : 'N/A',
        } : null,
      });
      
      return ApiResponse.error(
        'Plan generation returned empty result',
        500,
        {
          userId,
          profileVersion: profile.version,
          hasPlan28: !!plan?.plan28,
          hasPlan28Days: plan?.plan28?.days?.length || 0,
          timestamp: new Date().toISOString(),
        }
      );
    }
    
    // ИСПРАВЛЕНО: Дополнительная проверка - план может быть сгенерирован, но с пустыми днями
    if (hasPlan28 && plan.plan28 && plan.plan28.days.length === 0) {
      logger.error('❌ Plan28 generated but has no days', undefined, {
        userId,
        profileVersion: profile.version,
        plan28Keys: Object.keys(plan.plan28),
      });
      
      return ApiResponse.error(
        'Plan generation returned empty days',
        500,
        {
          userId,
          profileVersion: profile.version,
          timestamp: new Date().toISOString(),
        }
      );
    }
    
    logger.info('Plan generated - RecommendationSession should be created from recommendation rules, not from plan', {
          userId,
      planProductsCount: plan.products?.length || 0,
      });
    
    // Сохраняем в кэш
    try {
      logger.info('Caching plan', { userId, profileVersion: profile.version });
      await setCachedPlan(userId, profile.version, plan);
    } catch (cacheError: any) {
      // Ошибка кэширования не должна блокировать возврат плана
      logger.warn('Failed to cache plan (non-critical)', cacheError, {
        userId,
      });
    }
    
    logger.info('Plan generated successfully', {
      userId,
      weeksCount: plan.weeks?.length || 0,
      productsCount: plan.products?.length || 0,
      profile: plan.profile?.skinType || 'unknown',
      warnings: plan.warnings?.length || 0,
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return ApiResponse.success(plan);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    
    // Детальное логирование ошибки
    logger.error('❌ Plan generation failed', error, {
      userId,
      method,
      path,
      duration,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    
    logApiError(method, path, error, userId);
    
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}
