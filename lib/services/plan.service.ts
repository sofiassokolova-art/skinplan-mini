// lib/services/plan.service.ts
// Сервис для работы с планами ухода
// Вынесена бизнес-логика из API routes

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ProfileService } from './profile.service';
import type { Plan28 } from '@/lib/plan-types';
import { PlanRepository } from '@/lib/repositories/plan.repository';

export interface PlanServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  state?: 'no_profile' | 'generating' | 'ready';
}

/**
 * Сервис для работы с планами ухода
 */
export class PlanService {
  /**
   * Получить план пользователя
   */
  static async getPlan(
    userId: string,
    profileIdParam?: string | null
  ): Promise<PlanServiceResult<{ plan28: Plan28 | null; state: string }>> {
    try {
      // Получаем профиль с retry для решения read-after-write проблем
      const profileResult = await ProfileService.getProfileWithRetry(
        userId,
        profileIdParam
      );

      if (!profileResult.success) {
        return {
          success: false,
          error: profileResult.error || 'Failed to get profile',
        };
      }

      if (!profileResult.data) {
        return {
          success: true,
          data: {
            plan28: null,
            state: 'no_profile',
          },
          state: 'no_profile',
        };
      }

      const profile = profileResult.data;

      // Ищем план для профиля через репозиторий
      const plan = await PlanRepository.findByUserAndProfile(userId, profile.id);

      if (!plan) {
        return {
          success: true,
          data: {
            plan28: null,
            state: 'no_plan',
          },
        };
      }

      return {
        success: true,
        data: {
          plan28: plan.planData as unknown as Plan28,
          state: 'ready',
        },
        state: 'ready',
      };
    } catch (error: any) {
      logger.error('Error getting plan', error, { userId, profileIdParam });
      return {
        success: false,
        error: error?.message || 'Failed to get plan',
      };
    }
  }

  /**
   * Проверить статус генерации плана
   */
  static async checkPlanStatus(
    userId: string
  ): Promise<PlanServiceResult<{ state: string; plan28?: Plan28 | null }>> {
    try {
      const profileResult = await ProfileService.getCurrentProfile(userId);

      if (!profileResult.success || !profileResult.data) {
        return {
          success: true,
          data: {
            state: 'no_profile',
          },
          state: 'no_profile',
        };
      }

      const profile = profileResult.data;

      // Проверяем, есть ли план через репозиторий
      const plan = await PlanRepository.findByUserAndProfile(userId, profile.id);

      if (plan) {
        return {
          success: true,
          data: {
            state: 'ready',
            plan28: plan.planData as unknown as Plan28,
          },
          state: 'ready',
        };
      }

      // Если плана нет, проверяем, идет ли генерация
      // (можно добавить проверку через флаги или очереди)
      return {
        success: true,
        data: {
          state: 'generating',
        },
        state: 'generating',
      };
    } catch (error: any) {
      logger.error('Error checking plan status', error, { userId });
      return {
        success: false,
        error: error?.message || 'Failed to check plan status',
      };
    }
  }

  /**
   * Создать или обновить RecommendationSession перед генерацией плана
   */
  static async ensureRecommendationSession(
    userId: string,
    profileId: string
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      const existingSession = await prisma.recommendationSession.findFirst({
        where: {
          userId,
          profileId,
        },
      });

      if (existingSession) {
        return {
          success: true,
          sessionId: String(existingSession.id),
        };
      }

      const newSession = await prisma.recommendationSession.create({
        data: {
          userId,
          profileId,
          products: [], // Пустой массив по умолчанию
        },
      });

      logger.info('RecommendationSession created before plan generation', {
        userId,
        profileId,
        sessionId: String(newSession.id),
      });

      return {
        success: true,
        sessionId: String(newSession.id),
      };
    } catch (error: any) {
      logger.error('Error ensuring RecommendationSession', error, {
        userId,
        profileId,
      });
      return {
        success: false,
        error: error?.message || 'Failed to ensure RecommendationSession',
      };
    }
  }
}
