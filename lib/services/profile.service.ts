// lib/services/profile.service.ts
// Сервис для работы с профилями пользователей
// Вынесена бизнес-логика из API routes

import { prisma } from '@/lib/db';
import { getCurrentProfile } from '@/lib/get-current-profile';
import { logger } from '@/lib/logger';
import type { SkinProfile } from '@prisma/client';
import { ProfileRepository } from '@/lib/repositories/profile.repository';

export interface ProfileServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Сервис для работы с профилями пользователей
 */
export class ProfileService {
  /**
   * Получить текущий профиль пользователя
   */
  static async getCurrentProfile(userId: string): Promise<ProfileServiceResult<SkinProfile | null>> {
    try {
      const profile = await getCurrentProfile(userId);
      
      if (!profile) {
        return {
          success: true,
          data: null,
        };
      }

      return {
        success: true,
        data: profile,
      };
    } catch (error: any) {
      logger.error('Error getting current profile', error, { userId });
      return {
        success: false,
        error: error?.message || 'Failed to get profile',
      };
    }
  }

  /**
   * Получить профиль по ID с проверкой принадлежности пользователю
   */
  static async getProfileById(
    userId: string,
    profileId: string
  ): Promise<ProfileServiceResult<{ id: string; version: number } | null>> {
    try {
      const profile = await ProfileRepository.findByIdMinimal(userId, profileId);

      if (!profile) {
        return {
          success: true,
          data: null,
        };
      }

      return {
        success: true,
        data: {
          id: profile.id,
          version: profile.version || 1,
        },
      };
    } catch (error: any) {
      logger.error('Error getting profile by ID', error, { userId, profileId });
      return {
        success: false,
        error: error?.message || 'Failed to get profile',
      };
    }
  }

  /**
   * Получить профиль с retry для решения read-after-write проблем
   */
  static async getProfileWithRetry(
    userId: string,
    profileIdParam?: string | null,
    maxRetries: number = 3
  ): Promise<ProfileServiceResult<{ id: string; version: number } | null>> {
    // Если передан profileId - сначала пробуем загрузить профиль по нему (read-your-write)
    if (profileIdParam) {
      const profileResult = await this.getProfileById(userId, profileIdParam);
      if (profileResult.success && profileResult.data) {
        logger.info('Profile found via profileId parameter (read-your-write)', {
          userId,
          profileId: profileResult.data.id,
          profileVersion: profileResult.data.version,
        });
        return profileResult;
      }
    }

    // Fallback: используем единый резолвер getCurrentProfile
    const currentProfileResult = await this.getCurrentProfile(userId);
    if (currentProfileResult.success && currentProfileResult.data) {
      return {
        success: true,
        data: {
          id: currentProfileResult.data.id,
          version: currentProfileResult.data.version || 1,
        },
      };
    }

    // Если профиль не найден, пробуем с retry
    logger.warn('No skin profile found for user, retrying after delay (read-after-write)', {
      userId,
      profileIdParam,
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const delay = 500 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      const retryResult = await this.getCurrentProfile(userId);
      if (retryResult.success && retryResult.data) {
        logger.info('Profile found after retry (read-after-write resolved)', {
          userId,
          profileId: retryResult.data.id,
          profileVersion: retryResult.data.version,
          attempt,
          delay,
        });
        return {
          success: true,
          data: {
            id: retryResult.data.id,
            version: retryResult.data.version || 1,
          },
        };
      }

      logger.warn(`Profile not found after retry attempt ${attempt}/${maxRetries}`, {
        userId,
        profileIdParam,
        attempt,
        delay,
      });
    }

    return {
      success: true,
      data: null,
    };
  }

  /**
   * Преобразовать тип кожи в русский для отображения
   */
  static getSkinTypeRu(skinType: string | null): string {
    const skinTypeRuMap: Record<string, string> = {
      dry: 'Сухая',
      oily: 'Жирная',
      combo: 'Комбинированная',
      normal: 'Нормальная',
      sensitive: 'Чувствительная',
    };

    return skinTypeRuMap[skinType || 'normal'] || 'Нормальная';
  }
}
