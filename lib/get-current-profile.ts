// lib/get-current-profile.ts
// Утилита для получения текущего активного профиля пользователя
// ИСПРАВЛЕНО: Использует currentProfileId для быстрого доступа вместо orderBy

import { prisma } from './db';
import { logger } from './logger';

/**
 * Получает текущий активный профиль пользователя
 * ИСПРАВЛЕНО: Использует currentProfileId для быстрого доступа
 * Fallback на orderBy version DESC если currentProfileId не установлен
 */
export async function getCurrentProfile(userId: string) {
  try {
    // Сначала пытаемся получить через currentProfileId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { currentProfileId: true },
    });

    if (user?.currentProfileId) {
      const profile = await prisma.skinProfile.findUnique({
        where: { id: user.currentProfileId },
      });

      if (profile) {
        return profile;
      }

      // Если профиль не найден (был удален), очищаем currentProfileId
      logger.warn('Current profile not found, clearing currentProfileId', {
        userId,
        currentProfileId: user.currentProfileId,
      });
      await prisma.user.update({
        where: { id: userId },
        data: { currentProfileId: null },
      });
    }

    // Fallback: получаем последний профиль по version DESC
    const latestProfile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });

    // Если нашли профиль, обновляем currentProfileId для следующих запросов
    if (latestProfile) {
      await prisma.user.update({
        where: { id: userId },
        data: { currentProfileId: latestProfile.id },
      });
    }

    return latestProfile;
  } catch (error: any) {
    logger.error('Error getting current profile', error, { userId });
    throw error;
  }
}

