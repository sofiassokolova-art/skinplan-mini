// app/api/plan/generate/route.ts
// Генерация 28-дневного плана ухода за кожей

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { generate28DayPlan } from '@/lib/plan-generator';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import '@/lib/env-check'; // Валидация env переменных при старте
import { ApiResponse } from '@/lib/api-response';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { getCurrentProfile } from '@/lib/get-current-profile';

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
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    logger.info('User identified from initData', {
      userId,
      timestamp: new Date().toISOString(),
    });
    
    // ИСПРАВЛЕНО: Поддержка read-your-write через ?profileId= параметр
    // Это решает проблему read-after-write неконсистентности при использовании реплик/accelerate
    const { searchParams } = new URL(request.url);
    const profileIdParam = searchParams.get('profileId');
    
    let profile: { id: string; version: number } | null = null;
    
    // Если передан profileId - сначала пробуем загрузить профиль по нему (read-your-write)
    if (profileIdParam) {
      profile = await prisma.skinProfile.findFirst({
        where: {
          id: profileIdParam,
          userId, // Проверка принадлежности для безопасности
        },
      select: { id: true, version: true },
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
    // ИСПРАВЛЕНО: Используем getCurrentProfile вместо прямого запроса для консистентности
    if (!profile) {
      const resolvedProfile = await getCurrentProfile(userId);
      if (resolvedProfile) {
        profile = {
          id: resolvedProfile.id,
          version: resolvedProfile.version || 1,
        };
        logger.info('Profile found via getCurrentProfile', {
          userId,
          profileId: profile.id,
          profileVersion: profile.version,
        });
      }
    }

    if (!profile) {
      // ИСПРАВЛЕНО: При read-after-write проблеме пробуем подождать и повторить несколько раз
      // Это решает проблему, когда профиль только что создан, но еще не виден в реплике
      logger.warn('No skin profile found for user, retrying after delay (read-after-write)', { userId, profileIdParam });
      
      // Пробуем несколько раз с увеличивающейся задержкой
      const maxRetries = 3;
      let retryProfile = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Увеличиваем задержку с каждой попыткой: 500ms, 1000ms, 2000ms
        const delay = 500 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        retryProfile = await getCurrentProfile(userId);
        if (retryProfile) {
          profile = {
            id: retryProfile.id,
            version: retryProfile.version || 1,
          };
          logger.info('Profile found after retry (read-after-write resolved)', {
            userId,
            profileId: profile.id,
            profileVersion: profile.version,
            attempt,
            delay,
          });
          break;
        } else {
          logger.warn(`Profile not found after retry attempt ${attempt}/${maxRetries}`, {
            userId,
            profileIdParam,
            attempt,
            delay,
          });
        }
      }
      
      if (!profile) {
        // Если после всех retry профиль все еще не найден
        const duration = Date.now() - startTime;
        logger.warn('No skin profile found for user after all retries', {
          userId,
          profileIdParam,
          retries: maxRetries,
        });

        // ИСПРАВЛЕНО: Если был передан profileId, но профиль не найден - вернуть ошибку
        // Это предотвращает network error и дает четкое сообщение
        if (profileIdParam) {
          logger.error('Profile not found for provided profileId', {
            userId,
            profileIdParam,
          });
          logApiError(method, path, new Error('Profile not found'), userId);
          return ApiResponse.error(
            'Профиль не найден. Попробуйте пройти анкету заново.',
            404,
            {
              userId,
              profileIdParam,
              reason: 'profile_not_found',
            }
          );
        }

        // Для обычных случаев без profileId возвращаем no_profile
        logApiRequest(method, path, 200, duration, userId);
        return ApiResponse.success({
          plan28: null,
          state: 'no_profile',
        });
      }
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
    
    // ИСПРАВЛЕНО: Создаем RecommendationSession перед генерацией плана, если её нет
    // Это гарантирует, что план будет использовать продукты из сессии рекомендаций
    try {
      const existingSession = await prisma.recommendationSession.findFirst({
        where: {
          userId,
          profileId: profile.id,
        },
      });
      
      if (!existingSession) {
        logger.info('No RecommendationSession found, creating one before plan generation', {
          userId,
          profileId: profile.id,
          profileVersion: profile.version,
        });
        
        const { generateRecommendationsForProfile } = await import('@/lib/recommendations-generator');
        const recommendationResult = await generateRecommendationsForProfile(userId, profile.id);
        
        // ИСПРАВЛЕНО: Проверяем результат с ok: false
        if ('ok' in recommendationResult && recommendationResult.ok === false) {
          logger.warn('Failed to create RecommendationSession, plan will be generated without session products', {
            userId,
            profileId: profile.id,
            reason: recommendationResult.reason,
          });
        } else if ('sessionId' in recommendationResult) {
          // Type guard: если есть sessionId, это RecommendationGenerationResult
          logger.info('RecommendationSession created successfully before plan generation', {
            userId,
            profileId: profile.id,
            sessionId: recommendationResult.sessionId,
            ruleId: recommendationResult.ruleId,
            productsCount: recommendationResult.products?.length || 0,
          });
        }
      } else {
        logger.info('RecommendationSession already exists, using it for plan generation', {
          userId,
          profileId: profile.id,
          sessionId: existingSession.id,
          ruleId: existingSession.ruleId,
          productsCount: existingSession.products ? (Array.isArray(existingSession.products) ? existingSession.products.length : 0) : 0,
        });
      }
    } catch (recommendationError: any) {
      // Ошибка создания RecommendationSession не критична - план может быть сгенерирован без неё
      logger.warn('Failed to create RecommendationSession (non-critical, plan will continue)', {
        userId,
        profileId: profile.id,
        errorMessage: recommendationError?.message,
      });
    }
    
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
    
    // ИСПРАВЛЕНО (P0): Строгая валидация плана через validatePlan как жёсткий гейт
    if (hasPlan28 && plan.plan28) {
      const { validatePlan } = await import('@/lib/plan-validation');
      
      // Получаем продукты из плана для валидации
      // ИСПРАВЛЕНО: Приводим к ProductWithBrand[] для валидации
      // plan.products уже содержит нужные поля для валидации
      const planProducts = (plan.products || []) as any[]; // ИСПРАВЛЕНО: Временное решение для совместимости типов
      
      const validationResult = await validatePlan(plan.plan28, planProducts, {
        ingredientCompatibility: true,
        dermatologyProtocols: true,
        strictMode: true, // ИСПРАВЛЕНО: В API используем strict режим
      });
      
      // ИСПРАВЛЕНО (P0): Если severity === 'error' - возвращаем 422 с деталями
      if (validationResult.severity === 'error') {
        logger.error('❌ Plan validation failed', undefined, {
          userId,
          profileVersion: profile.version,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          totalDays: plan.plan28.days.length,
        });
        
        return ApiResponse.error(
          'Plan validation failed',
          422, // ИСПРАВЛЕНО: 422 Unprocessable Entity для валидационных ошибок
          {
            userId,
            profileVersion: profile.version,
            validationErrors: validationResult.errors,
            validationWarnings: validationResult.warnings,
            severity: validationResult.severity,
            timestamp: new Date().toISOString(),
          }
        );
      }
      
      // Логируем предупреждения, но не блокируем план
      if (validationResult.warnings.length > 0) {
        logger.warn('Plan validation warnings', {
          userId,
          profileVersion: profile.version,
          warnings: validationResult.warnings,
          severity: validationResult.severity,
        });
      }
      
      logger.info('Plan28 validation passed', {
        userId,
        profileVersion: profile.version,
        totalDays: plan.plan28.days.length,
        severity: validationResult.severity,
        warningsCount: validationResult.warnings.length,
      });
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
        
        // ИСПРАВЛЕНО: При полном перепрохождении (retake_full) обнуляем createdAt для сброса 28-дневного счетчика
        // Проверяем наличие entitlement retake_full_access для определения полного перепрохождения
        const retakeFullEntitlement = await prisma.entitlement.findUnique({
          where: { userId_code: { userId, code: 'retake_full_access' } },
          select: { active: true, validUntil: true },
        });
        const isFullRetake = retakeFullEntitlement?.active === true && 
                            (!retakeFullEntitlement.validUntil || retakeFullEntitlement.validUntil > new Date());
        
        // При полном перепрохождении удаляем старый план и создаем новый с текущей датой
        if (isFullRetake) {
          logger.info('Full retake detected - deleting old plan and creating new one to reset 28-day counter', {
            userId,
            profileVersion: profile.version,
          });
          // Удаляем старый план для этой версии профиля
          await prisma.plan28.deleteMany({
            where: {
              userId,
              profileVersion: profile.version,
            },
          });
          // Создаем новый план с текущей датой (createdAt будет установлен автоматически)
          await prisma.plan28.create({
            data: {
              userId,
              skinProfileId: profile.id,
              profileVersion: profile.version,
              planData: plan.plan28 as any,
            },
          });
          // "Съедаем" entitlement после использования
          await prisma.entitlement.update({
            where: { userId_code: { userId, code: 'retake_full_access' } },
            data: { active: false, updatedAt: new Date() },
          }).catch(() => {
            // Игнорируем ошибки - entitlement может быть уже удален
          });
        } else {
          // Обычное создание/обновление плана
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
        }
        
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
    
    // ИСПРАВЛЕНО: Кэшируем план сразу после генерации для быстрой загрузки
    // Формируем PlanResponse в том же формате, что и /api/plan для консистентности
    if (plan.plan28) {
      try {
        const planCreatedAt = new Date();
        const planResponse = {
          plan28: plan.plan28,
          expired: false, // Только что созданный план не может быть истекшим
          daysSinceCreation: 0,
        };
        
        const { setCachedPlan } = await import('@/lib/cache');
        await setCachedPlan(userId, profile.version, planResponse);
        logger.info('Plan cached immediately after generation', {
          userId,
          profileVersion: profile.version,
          hasPlan28: !!plan.plan28,
          plan28DaysCount: plan.plan28.days?.length || 0,
        });
      } catch (cacheError: any) {
        // Ошибка кэширования не критична, но логируем
        logger.warn('Failed to cache plan after generation (non-critical)', {
          userId,
          profileVersion: profile.version,
          errorMessage: cacheError?.message,
        });
      }
    } else {
      logger.warn('Plan generated but no plan28 to cache', {
        userId,
        profileVersion: profile.version,
        hasPlan28: !!plan.plan28,
        hasWeeks: !!plan.weeks,
      });
    }
    
    // ИСПРАВЛЕНО: Устанавливаем hasPlanProgress = true после успешной генерации плана
    // Это гарантирует, что пользователь не будет редиректиться на /quiz при следующем заходе
    try {
      await prisma.userPreferences.upsert({
        where: { userId },
        update: {
          hasPlanProgress: true,
        },
        create: {
          userId,
          hasPlanProgress: true,
        },
      });
      logger.info('hasPlanProgress set to true after plan generation', {
        userId,
        profileVersion: profile.version,
      });
    } catch (prefsError: any) {
      // Ошибка установки hasPlanProgress не критична, но логируем
      logger.warn('Failed to set hasPlanProgress (non-critical)', {
        userId,
        profileVersion: profile.version,
        errorMessage: prefsError?.message,
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
