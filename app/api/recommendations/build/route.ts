// app/api/recommendations/build/route.ts
// ИСПРАВЛЕНО: Отдельный endpoint для создания RecommendationSession и product-matching
// Вынесен из POST /api/questionnaire/answers для атомарности и производительности
// Идемпотентный: можно вызывать несколько раз с тем же profileId

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { ApiResponse } from '@/lib/api-response';
import { getCurrentProfile } from '@/lib/get-current-profile';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/recommendations/build';
  let userId: string | undefined;

  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    userId = auth.ctx.userId;

    // ИСПРАВЛЕНО: Поддержка profileId через query параметры (для /loading pipeline)
    const { searchParams } = new URL(request.url);
    const profileIdParam = searchParams.get('profileId');
    
    let body: any = {};
    try {
      body = await request.json().catch(() => ({}));
    } catch {
      // Body может быть пустым, если profileId в query
    }
    
    const profileId = profileIdParam || body.profileId;
    const forceRebuild = body.forceRebuild || false;

    if (!profileId) {
      return ApiResponse.badRequest('Missing profileId parameter (query or body)');
    }

    // Проверяем, что профиль принадлежит пользователю
    const profile = await prisma.skinProfile.findFirst({
      where: {
        id: profileId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            // ИСПРАВЛЕНО: currentProfileId не используется в коде, убираем из select
          },
        },
      },
    });

    if (!profile) {
      return ApiResponse.notFound('Profile not found or does not belong to user');
    }

    // ИСПРАВЛЕНО: Проверяем, есть ли уже RecommendationSession для этого профиля
    // Если есть и forceRebuild=false, возвращаем существующую
    if (!forceRebuild) {
      const existingSession = await prisma.recommendationSession.findFirst({
        where: {
          userId,
          profileId: profile.id,
        },
        include: {
          rule: true,
        },
      });

      if (existingSession) {
        logger.info('RecommendationSession already exists, returning existing', {
          userId,
          profileId: profile.id,
          sessionId: existingSession.id,
          ruleId: existingSession.ruleId,
        });
        logApiRequest(method, path, 200, Date.now() - startTime, userId);
        return ApiResponse.success({
          sessionId: existingSession.id,
          ruleId: existingSession.ruleId,
          products: existingSession.products || [],
          isExisting: true,
        });
      }
    }

    // ИСПРАВЛЕНО: Импортируем логику генерации рекомендаций из /api/recommendations
    // Это тяжелая логика, которая была в POST /api/questionnaire/answers
    const { generateRecommendationsForProfile } = await import('@/lib/recommendations-generator');
    
    const result = await generateRecommendationsForProfile(userId, profile.id);

    // ИСПРАВЛЕНО: Проверяем результат с reason для дебага
    if ('ok' in result && result.ok === false) {
      logger.warn('Failed to generate recommendations', { 
        userId, 
        profileId: profile.id,
        reason: result.reason,
      });
      return ApiResponse.error(`Failed to generate recommendations: ${result.reason}`, 500);
    }

    // Type guard: если нет ok: false, это RecommendationGenerationResult
    if ('sessionId' in result) {
      logger.info('RecommendationSession created successfully', {
        userId,
        profileId: profile.id,
        sessionId: result.sessionId,
        ruleId: result.ruleId,
        productsCount: result.products?.length || 0,
      });

      // ИСПРАВЛЕНО (P1): Возвращаем RecommendationBuildResponse с полной информацией
      const products = result.products || [];
      const productCount = products.length;
      const status: 'ok' | 'empty' = productCount > 0 ? 'ok' : 'empty';
      
      logApiRequest(method, path, 200, Date.now() - startTime, userId);
      return ApiResponse.success({
        recommendationSessionId: result.sessionId,
        ruleId: result.ruleId,
        products,
        isExisting: false,
        productCount,
        status,
      });
    }

    // Fallback (не должно произойти, но для TypeScript)
    return ApiResponse.error('Failed to generate recommendations: unknown error', 500);

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId || undefined);
    return ApiResponse.internalError(error, { userId: userId || undefined, method, path, duration });
  }
}

