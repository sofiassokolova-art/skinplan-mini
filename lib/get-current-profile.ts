// lib/get-current-profile.ts
// Утилита для получения текущего активного профиля пользователя
// Единый резолвер активного профиля для всех эндпоинтов
// 
// Логика работы:
// 1. Если колонка current_profile_id существует в БД - используем её для быстрого доступа
// 2. Если колонки нет или currentProfileId не установлен - fallback на последний профиль по version DESC
// 3. Это решает проблему, когда профиль создан, но current_profile_id не обновлен (колонка отсутствует в БД)

import { prisma } from './db';
import { logger } from './logger';

/**
 * Получает текущий активный профиль пользователя
 * 
 * Единый резолвер для всех эндпоинтов (/api/plan, /api/profile/current и т.д.)
 * Правильно обрабатывает отсутствие колонки current_profile_id в БД
 * 
 * @param userId - ID пользователя
 * @returns Последний профиль пользователя по version DESC или null если профилей нет
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

