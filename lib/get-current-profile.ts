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
    const isMissingCurrentProfileColumn = (err: any) =>
      err?.code === 'P2022' &&
      (err?.meta?.column === 'users.current_profile_id' ||
        (typeof err?.meta?.column === 'string' && err.meta.column.includes('current_profile_id')) ||
        (typeof err?.message === 'string' && err.message.includes('current_profile_id')));

    // Сначала пытаемся получить через currentProfileId
    let user: { currentProfileId: string | null } | null = null;
    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { currentProfileId: true },
      });
    } catch (err: any) {
      // Если колонка current_profile_id отсутствует в БД (не применена миграция),
      // работаем без оптимизации: просто берем последний профиль.
      if (isMissingCurrentProfileColumn(err)) {
        logger.warn('users.current_profile_id missing in DB; falling back to latest profile lookup', { userId });
        const latestProfile = await prisma.skinProfile.findFirst({
          where: { userId },
          orderBy: { version: 'desc' },
        });
        return latestProfile;
      }
      throw err;
    }

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
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { currentProfileId: null },
          select: { id: true },
        });
      } catch (err: any) {
        if (!isMissingCurrentProfileColumn(err)) throw err;
      }
    }

    // Fallback: получаем последний профиль по version DESC
    const latestProfile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });

    // Если нашли профиль, обновляем currentProfileId для следующих запросов
    if (latestProfile) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { currentProfileId: latestProfile.id },
          select: { id: true },
        });
      } catch (err: any) {
        if (!isMissingCurrentProfileColumn(err)) throw err;
      }
    }

    return latestProfile;
  } catch (error: any) {
    logger.error('Error getting current profile', error, { userId });
    throw error;
  }
}

