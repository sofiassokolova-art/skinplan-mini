// app/api/plan/route.ts
// API endpoint для получения плана БЕЗ генерации (только из кэша/БД)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCachedPlan } from '@/lib/cache';
import { ApiResponse } from '@/lib/api-response';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { getCurrentProfile } from '@/lib/get-current-profile';
import type { Plan28 } from '@/lib/plan-types';
import type { PlanResponse } from '@/lib/api-types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/plan';
  let userId: string | undefined;
  
  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) {
      const duration = Date.now() - startTime;
      logApiRequest(method, path, 401, duration);
      return auth.response;
    }
    userId = auth.ctx.userId;

    logger.info('User identified from initData', { userId });
    
    // DEBUG: Проверяем идентичность БД
    try {
      const dbIdentity = await prisma.$queryRaw<Array<{ current_database: string; current_schema: string }>>`
        SELECT current_database() as current_database, current_schema() as current_schema
      `;
      logger.warn('DEBUG: DB identity in /api/plan', { 
        userId,
        dbIdentity: dbIdentity[0],
      });
    } catch (dbIdentityError) {
      logger.warn('DEBUG: Failed to get DB identity in /api/plan', { error: (dbIdentityError as any)?.message });
    }
    
    // ИСПРАВЛЕНО: Поддержка read-your-write через ?profileId= параметр
    // Это решает проблему read-after-write неконсистентности при использовании реплик/accelerate
    const { searchParams } = new URL(request.url);
    const profileIdParam = searchParams.get('profileId');
    
    let profile: Awaited<ReturnType<typeof getCurrentProfile>> | null = null;
    
    // Если передан profileId - сначала пробуем загрузить профиль по нему (read-your-write)
    if (profileIdParam) {
      profile = await prisma.skinProfile.findFirst({
        where: {
          id: profileIdParam,
          userId, // Проверка принадлежности для безопасности
        },
      });
      
      if (profile) {
        logger.info('Profile found via profileId parameter (read-your-write)', {
          userId,
          profileId: profile.id,
          profileVersion: profile.version,
        });
      } else {
        logger.warn('Profile not found via profileId parameter, falling back to getCurrentProfile', {
          userId,
          profileIdParam,
    });
      }
    }
    
    // Fallback: используем единый резолвер getCurrentProfile
    // ИСПРАВЛЕНО: Используем единый резолвер активного профиля
    // Это решает проблему, когда current_profile_id отсутствует в БД
    // getCurrentProfile правильно обрабатывает отсутствие колонки и использует fallback на последний профиль
    if (!profile) {
      profile = await getCurrentProfile(userId);
    }

    // ИСПРАВЛЕНО: Логируем результат getCurrentProfile для диагностики
    if (profile) {
      logger.info('Profile found via getCurrentProfile', {
        userId,
        profileId: profile.id,
        profileVersion: profile.version,
        profileUserId: profile.userId,
        profileCreatedAt: profile.createdAt?.toISOString(),
      });
    } else {
      logger.warn('Profile not found on first attempt, waiting and retrying...', { userId });
    }

    // Если профиль не найден, ждем немного и пробуем еще раз (race condition fix)
    // Это решает проблему race condition, когда профиль только что создан, но еще не виден в БД
    if (!profile) {
      await new Promise(resolve => setTimeout(resolve, 200)); // Ждем 200ms
      profile = await getCurrentProfile(userId);
      
      if (profile) {
        logger.info('Profile found on retry', {
          userId,
          profileId: profile.id,
          profileVersion: profile.version,
          profileUserId: profile.userId,
      });
      }
    }

    if (!profile) {
      const duration = Date.now() - startTime;
      // ИСПРАВЛЕНО: Правильная семантика - 200 + null для отсутствия профиля
      // Отсутствие профиля - это не ошибка сервера, а нормальное состояние (пользователь еще не прошел анкету)
      // Это предотвращает проблемы с кэшированием 404 и улучшает UX
      logger.warn('No skin profile found for user after retry', {
        userId,
        // Эти поля помогут сравнить с /api/questionnaire/answers
        // Если там профиль создался, а здесь не находится - проблема в userId или фильтрах
      });
      logApiRequest(method, path, 200, duration, userId);
      return ApiResponse.success({
        plan28: null,
        state: 'no_profile',
      });
    }

    // ИСПРАВЛЕНО: Сначала проверяем БД, а не кэш
    // Это гарантирует, что после генерации плана мы получим свежий план из БД, а не старый из кэша
    // Кэш может содержать старую версию плана с 2 продуктами вместо 5
    logger.debug('Checking database first (before cache) to get fresh plan', { userId, profileVersion: profile.version });
    
    // Проверяем БД сначала
    // ИСПРАВЛЕНО: Добавляем логирование для диагностики медленной загрузки
    logger.info('Looking for plan in DB', {
      userId,
      profileVersion: profile.version,
      timestamp: new Date().toISOString(),
    });
    
    const planFromDb = await prisma.plan28.findFirst({
      where: {
        userId,
        profileVersion: profile.version,
      },
      select: {
        planData: true,
        updatedAt: true,
        id: true,
        createdAt: true,
      },
    });
    
    logger.info('Plan lookup result', {
      userId,
      profileVersion: profile.version,
      found: !!planFromDb,
      planId: planFromDb?.id,
      hasPlanData: !!planFromDb?.planData,
      createdAt: planFromDb?.createdAt?.toISOString(),
      updatedAt: planFromDb?.updatedAt?.toISOString(),
    });
    
    if (planFromDb && planFromDb.planData) {
      // ИСПРАВЛЕНО: Используем правильный тип для planData из БД
      const planData = planFromDb.planData as any;
      
      // Детальное логирование для диагностики
      logger.debug('Plan found in DB, checking structure', {
        userId,
        profileVersion: profile.version,
        hasPlanData: !!planData,
        planDataType: typeof planData,
        planDataKeys: planData ? Object.keys(planData) : [],
        hasDays: !!planData?.days,
        daysType: typeof planData?.days,
        daysIsArray: Array.isArray(planData?.days),
        daysLength: Array.isArray(planData?.days) ? planData.days.length : 0,
      });
      
      // Проверяем, что план имеет правильную структуру
      // ИСПРАВЛЕНО: Более гибкая проверка структуры плана
      const hasPlan28 = planData && 
                        planData.days && 
                        Array.isArray(planData.days) && 
                        planData.days.length > 0;
      
      if (hasPlan28) {
        // ИСПРАВЛЕНО: Проверяем, прошло ли 28 дней с момента создания плана
        const planCreatedAt = planFromDb.createdAt;
        const daysSinceCreation = Math.floor((Date.now() - planCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
        
        // Формируем ответ в формате, который ожидает клиент
        const planResponse: PlanResponse = {
          plan28: planData as Plan28,
          expired: daysSinceCreation >= 28, // Флаг истечения плана
          daysSinceCreation, // Количество дней с момента создания
        };
        
        logger.info('Plan retrieved from DB successfully', {
          userId,
          profileVersion: profile.version,
          daysCount: planData.days.length,
          daysSinceCreation,
          expired: daysSinceCreation >= 28,
        });
        
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
      } else {
        // План есть в БД, но структура некорректна
        logger.warn('Plan found in DB but structure is invalid', {
          userId,
          profileVersion: profile.version,
          hasPlanData: !!planData,
          hasDays: !!planData?.days,
          daysIsArray: Array.isArray(planData?.days),
          daysLength: Array.isArray(planData?.days) ? planData.days.length : 0,
          planDataKeys: planData ? Object.keys(planData) : [],
        });
      }
    } else {
      logger.debug('Plan not found in DB for profile version', {
        userId,
        profileVersion: profile.version,
        hasPlanFromDb: !!planFromDb,
        hasPlanData: !!planFromDb?.planData,
      });
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


    // ИСПРАВЛЕНО: Правильная семантика - 404 для отсутствия плана (но есть профиль)
    // Это триггерит генерацию на фронте
    // ВАЖНО: При перепрохождении анкеты НЕ возвращаем план из старой версии
    // Пользователь должен получить план, соответствующий новым ответам
    logger.debug('Plan not found in cache or DB for current version - will trigger generation', { 
      userId, 
      currentVersion: profile.version 
    });

    // План не найден ни в кэше, ни в БД - возвращаем 404 (есть профиль, но нет плана)
    const duration = Date.now() - startTime;
    logger.info('Plan not found in cache or DB for any version', { 
      userId, 
      profileVersion: profile.version,
      profileId: profile.id,
    });
    logApiRequest(method, path, 404, duration, userId);
    return ApiResponse.notFound('plan_not_found', { 
      userId,
      profileId: profile.id,
      profileVersion: profile.version,
    });
    
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

