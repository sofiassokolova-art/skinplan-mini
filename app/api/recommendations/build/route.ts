// app/api/recommendations/build/route.ts
// ИСПРАВЛЕНО: Отдельный endpoint для создания RecommendationSession и product-matching
// Вынесен из POST /api/questionnaire/answers для атомарности и производительности
// Идемпотентный: можно вызывать несколько раз с тем же profileId

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import { ApiResponse } from '@/lib/api-response';
import { getCurrentProfile } from '@/lib/get-current-profile';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/recommendations/build';
  let userId: string | undefined;

  try {
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return ApiResponse.unauthorized('Missing Telegram initData');
    }

    const userIdResult = await getUserIdFromInitData(initData);
    if (!userIdResult) {
      return ApiResponse.unauthorized('Invalid or expired initData');
    }
    userId = userIdResult;

    const body = await request.json();
    const { profileId, forceRebuild = false } = body;

    if (!profileId) {
      return ApiResponse.badRequest('Missing profileId parameter');
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
            currentProfileId: true,
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

    if (!result) {
      logger.warn('Failed to generate recommendations', { userId, profileId: profile.id });
      return ApiResponse.error('Failed to generate recommendations', 500);
    }

    logger.info('RecommendationSession created successfully', {
      userId,
      profileId: profile.id,
      sessionId: result.sessionId,
      ruleId: result.ruleId,
      productsCount: result.products?.length || 0,
    });

    logApiRequest(method, path, 200, Date.now() - startTime, userId);
    return ApiResponse.success({
      sessionId: result.sessionId,
      ruleId: result.ruleId,
      products: result.products || [],
      isExisting: false,
    });

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId || undefined);
    return ApiResponse.internalError(error, { userId: userId || undefined, method, path, duration });
  }
}

