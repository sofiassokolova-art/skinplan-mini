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
      select: { id: true, version: true },
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
    
    // Сохраняем план в PostgreSQL
    if (plan.plan28) {
      try {
        // ИСПРАВЛЕНО: Детальная проверка структуры плана перед сохранением
        const plan28Structure = {
          hasUserId: !!plan.plan28.userId,
          hasSkinProfileId: !!plan.plan28.skinProfileId,
          hasDays: !!plan.plan28.days,
          daysIsArray: Array.isArray(plan.plan28.days),
          daysLength: Array.isArray(plan.plan28.days) ? plan.plan28.days.length : 0,
          hasMainGoals: !!plan.plan28.mainGoals,
          mainGoalsIsArray: Array.isArray(plan.plan28.mainGoals),
          mainGoalsLength: Array.isArray(plan.plan28.mainGoals) ? plan.plan28.mainGoals.length : 0,
        };
        
        logger.info('Plan28 structure before saving', {
          userId,
          profileVersion: profile.version,
          skinProfileId: profile.id,
          structure: plan28Structure,
        });
        
        // ИСПРАВЛЕНО: Проверяем, что план не пустой перед сохранением
        if (!plan.plan28.days || !Array.isArray(plan.plan28.days) || plan.plan28.days.length === 0) {
          logger.error('❌ Cannot save plan: plan28.days is empty or invalid', undefined, {
            userId,
            profileVersion: profile.version,
            plan28Structure,
            plan28Keys: Object.keys(plan.plan28),
            plan28DaysType: typeof plan.plan28.days,
            plan28DaysIsArray: Array.isArray(plan.plan28.days),
            plan28DaysLength: Array.isArray(plan.plan28.days) ? plan.plan28.days.length : 'N/A',
          });
          throw new Error('Plan28.days is empty or invalid - cannot save to database');
        }
        
        // ИСПРАВЛЕНО: Проверяем, что хотя бы в одном дне есть продукты
        const daysWithProducts = plan.plan28.days.filter((day: any) => {
          const morningHasProducts = day.morning?.some((step: any) => step.productId);
          const eveningHasProducts = day.evening?.some((step: any) => step.productId);
          const weeklyHasProducts = day.weekly?.some((step: any) => step.productId);
          return morningHasProducts || eveningHasProducts || weeklyHasProducts;
        });
        
        logger.info('Plan28 days analysis', {
          userId,
          profileVersion: profile.version,
          totalDays: plan.plan28.days.length,
          daysWithProducts: daysWithProducts.length,
          firstDayMorningSteps: plan.plan28.days[0]?.morning?.length || 0,
          firstDayEveningSteps: plan.plan28.days[0]?.evening?.length || 0,
          firstDayMorningWithProducts: plan.plan28.days[0]?.morning?.filter((s: any) => s.productId).length || 0,
          firstDayEveningWithProducts: plan.plan28.days[0]?.evening?.filter((s: any) => s.productId).length || 0,
        });
        
        if (daysWithProducts.length === 0) {
          logger.warn('⚠️ Plan28 has no days with products, but saving anyway', {
            userId,
            profileVersion: profile.version,
            totalDays: plan.plan28.days.length,
          });
        }
        
        logger.info('Saving plan to database', { 
          userId, 
          profileVersion: profile.version, 
          skinProfileId: profile.id,
          plan28Structure,
        });
        
        await prisma.plan28.upsert({
          where: {
            userId_profileVersion: {
              userId: userId,
              profileVersion: profile.version,
            },
          },
          update: {
            planData: plan.plan28 as any, // Сохраняем полный план28 в JSON
            updatedAt: new Date(),
          },
          create: {
            userId,
            skinProfileId: profile.id,
            profileVersion: profile.version,
            planData: plan.plan28 as any, // Сохраняем полный план28 в JSON
          },
        });
        
        // ИСПРАВЛЕНО: Проверяем, что план действительно сохранился
        const savedPlan = await prisma.plan28.findUnique({
          where: {
            userId_profileVersion: {
              userId: userId,
              profileVersion: profile.version,
            },
          },
          select: {
            id: true,
            planData: true,
            profileVersion: true, // ИСПРАВЛЕНО: Добавлено для логирования
          },
        });
        
        if (!savedPlan) {
          logger.error('❌ Plan was not saved to database', undefined, {
            userId,
            profileVersion: profile.version,
          });
          throw new Error('Plan was not saved to database');
        }
        
        // Проверяем структуру сохраненного плана
        const savedPlanData = savedPlan.planData as any;
        const savedPlanStructure = {
          hasDays: !!savedPlanData?.days,
          daysIsArray: Array.isArray(savedPlanData?.days),
          daysLength: Array.isArray(savedPlanData?.days) ? savedPlanData.days.length : 0,
          hasMainGoals: !!savedPlanData?.mainGoals,
        };
        
        logger.info('Plan saved to database successfully', { 
          userId, 
          profileVersion: profile.version,
          planId: savedPlan.id,
          hasPlan28: !!plan.plan28,
          plan28Days: plan.plan28.days?.length || 0,
          savedPlanStructure,
        });
        
        // ИСПРАВЛЕНО: Создаем PlanProgress для согласованности триады: profile -> Plan28 -> PlanProgress
        // Это важно для корректного отображения текущего дня и прогресса
        // ВАЖНО: PlanProgress должен быть создан для той же версии профиля, что и Plan28
        try {
          await prisma.planProgress.upsert({
            where: { userId },
            update: {
              // ИСПРАВЛЕНО: Сбрасываем прогресс при создании нового плана для новой версии профиля
              currentDay: 1,
              completedDays: [],
              currentStreak: 0,
              longestStreak: 0,
              totalCompletedDays: 0,
            },
            create: {
              userId,
              currentDay: 1,
              completedDays: [],
              currentStreak: 0,
              longestStreak: 0,
              totalCompletedDays: 0,
            },
          });
          logger.info('PlanProgress created/updated successfully for profile version', {
            userId,
            profileVersion: profile.version,
            planId: savedPlan.id,
          });
        } catch (progressError: any) {
          // Ошибка создания PlanProgress не критична - он создастся при первом обновлении прогресса
          logger.warn('Failed to create PlanProgress (non-critical)', {
            userId,
            profileVersion: profile.version,
            error: progressError?.message,
          });
        }
        
        // ИСПРАВЛЕНО: Проверяем согласованность триады: profile -> Plan28 -> PlanProgress
        // После успешного создания всех трех сущностей логируем подтверждение
        const progressCheck = await prisma.planProgress.findUnique({
          where: { userId },
          select: { id: true, currentDay: true },
        });
        
        if (savedPlan && progressCheck) {
          logger.info('✅ Coherent trio verified: skinProfile(version) -> Plan28 -> PlanProgress', {
            userId,
            profileId: profile.id,
            profileVersion: profile.version,
            planId: savedPlan.id,
            planProfileVersion: savedPlan.profileVersion,
            progressId: progressCheck.id,
            progressCurrentDay: progressCheck.currentDay,
          });
        } else {
          logger.warn('⚠️ Coherent trio incomplete after plan generation', {
            userId,
            profileId: profile.id,
            profileVersion: profile.version,
            hasPlan28: !!savedPlan,
            hasPlanProgress: !!progressCheck,
          });
        }
      } catch (dbError: any) {
        // Ошибка сохранения в БД не должна блокировать возврат плана
        logger.error('Failed to save plan to database (non-critical)', dbError, {
          userId,
          profileVersion: profile.version,
          errorMessage: dbError?.message,
          errorStack: dbError?.stack?.substring(0, 500),
          plan28Structure: plan.plan28 ? {
            hasDays: !!plan.plan28.days,
            daysLength: Array.isArray(plan.plan28.days) ? plan.plan28.days.length : 0,
          } : null,
        });
      }
    }
    
    // ИСПРАВЛЕНО: Инвалидируем старый кэш перед сохранением нового плана
    // Это предотвращает проблему, когда старый план с 2 продуктами показывается вместо нового с 5 продуктами
    try {
      const { invalidateAllUserCache } = await import('@/lib/cache');
      await invalidateAllUserCache(userId);
      logger.info('Old cache invalidated before caching new plan', { userId, profileVersion: profile.version });
    } catch (invalidateError: any) {
      // Ошибка инвалидации не критична, но логируем
      logger.warn('Failed to invalidate old cache (non-critical)', {
        userId,
        profileVersion: profile.version,
        errorMessage: invalidateError?.message,
      });
    }
    
    // Сохраняем в кэш
    try {
      logger.info('Caching plan', { userId, profileVersion: profile.version });
      await setCachedPlan(userId, profile.version, plan);
      logger.info('Plan cached successfully', { 
        userId, 
        profileVersion: profile.version,
        hasPlan28: !!plan.plan28,
        hasWeeks: !!plan.weeks,
        plan28DaysCount: plan?.plan28?.days?.length || 0,
        // ИСПРАВЛЕНО: Логируем количество продуктов для диагностики
        day1MorningProducts: plan?.plan28?.days?.[0]?.morning?.filter((s: any) => s.productId).length || 0,
        day1EveningProducts: plan?.plan28?.days?.[0]?.evening?.filter((s: any) => s.productId).length || 0,
      });
    } catch (cacheError: any) {
      // Ошибка кэширования не должна блокировать возврат плана
      logger.error('Failed to cache plan (non-critical)', cacheError, {
        userId,
        profileVersion: profile.version,
        errorMessage: cacheError?.message,
        errorStack: cacheError?.stack?.substring(0, 500),
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
