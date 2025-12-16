// lib/get-current-profile.ts
// Утилита для получения текущего активного профиля пользователя
// Единый резолвер активного профиля для всех эндпоинтов
// 
// Логика работы:
// 1. Определяет наличие колонки current_profile_id через try/catch с кэшированием
// 2. Если колонка есть и currentProfileId установлен - использует его (с проверкой валидности)
// 3. Fallback на последний профиль по version DESC, затем по createdAt DESC
// 4. Детальное логирование стратегии резолва для диагностики

import { prisma } from './db';
import { logger } from './logger';

// Кэш наличия колонки current_profile_id в module scope
// Определяется один раз при первом запросе, который читает currentProfileId
let hasCurrentProfileColumn: boolean | null = null;

type ResolveStrategy = 'db_column' | 'fallback_version' | 'fallback_createdAt' | 'none';

interface ResolveResult {
  profile: any | null;
  strategy: ResolveStrategy;
  hasCurrentProfileColumn: boolean;
  currentProfileId: string | null;
  resolvedProfileId: string | null;
  profilesCount?: number;
  reason?: string;
}

function isMissingCurrentProfileColumn(err: any): boolean {
  return (
    err?.code === 'P2022' &&
    (err?.meta?.column === 'users.current_profile_id' ||
      (typeof err?.meta?.column === 'string' && err.meta.column.includes('current_profile_id')) ||
      (typeof err?.message === 'string' && err.message.includes('current_profile_id')))
  );
}

/**
 * Получает текущий активный профиль пользователя
 * 
 * Единый резолвер для всех эндпоинтов (/api/plan, /api/profile/current и т.д.)
 * Правильно обрабатывает отсутствие колонки current_profile_id в БД
 * 
 * @param userId - ID пользователя
 * @returns Последний профиль пользователя или null если профилей нет
 */
export async function getCurrentProfile(userId: string) {
  const result = await getCurrentProfileWithDetails(userId);
  
  // Логируем результат для диагностики
  if (result.strategy === 'none') {
    logger.warn('No profile found for user', {
      userId,
      strategy: result.strategy,
      hasCurrentProfileColumn: result.hasCurrentProfileColumn,
      reason: result.reason,
    });
  } else {
    logger.debug('Profile resolved', {
      userId,
      strategy: result.strategy,
      hasCurrentProfileColumn: result.hasCurrentProfileColumn,
      currentProfileId: result.currentProfileId,
      resolvedProfileId: result.resolvedProfileId,
      profilesCount: result.profilesCount,
    });
  }
  
  return result.profile;
}

/**
 * Получает текущий активный профиль с детальной информацией о стратегии резолва
 * Используется для логирования и диагностики
 */
async function getCurrentProfileWithDetails(userId: string): Promise<ResolveResult> {
  try {
    // Шаг 1: Определяем наличие колонки current_profile_id
    // Если еще не определили - пытаемся прочитать currentProfileId
    if (hasCurrentProfileColumn === null) {
      try {
        await prisma.user.findUnique({
          where: { id: userId },
          select: { currentProfileId: true },
        });
        // Если запрос успешен - колонка существует
        hasCurrentProfileColumn = true;
      } catch (err: any) {
        if (isMissingCurrentProfileColumn(err)) {
          hasCurrentProfileColumn = false;
        } else {
          // Другая ошибка - пробрасываем дальше
          throw err;
        }
      }
    }

    // Шаг 2: Если колонка есть - пытаемся использовать currentProfileId
    if (hasCurrentProfileColumn) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { currentProfileId: true },
      });

      if (user?.currentProfileId) {
        // Проверяем валидность профиля: существует ли он и принадлежит ли userId
        const profile = await prisma.skinProfile.findUnique({
          where: { id: user.currentProfileId },
        });

        if (profile && profile.userId === userId) {
          // Профиль валиден - возвращаем его
          return {
            profile,
            strategy: 'db_column',
            hasCurrentProfileColumn: true,
            currentProfileId: user.currentProfileId,
            resolvedProfileId: profile.id,
          };
        }

        // Профиль невалиден (удален или принадлежит другому userId) - очищаем и fallback
        logger.warn('Current profile invalid, clearing currentProfileId', {
          userId,
          currentProfileId: user.currentProfileId,
          profileExists: !!profile,
          profileUserId: profile?.userId,
        });

        try {
          await prisma.user.update({
            where: { id: userId },
            data: { currentProfileId: null },
            select: { id: true },
          });
        } catch (err: any) {
          // Игнорируем ошибки обновления (колонка может исчезнуть между проверками)
          if (!isMissingCurrentProfileColumn(err)) {
            logger.warn('Failed to clear invalid currentProfileId', { userId, error: err });
          }
        }
      }
    }

    // Шаг 3: Fallback - получаем последний профиль
    // Используем множественный orderBy для надежности
    const profiles = await prisma.skinProfile.findMany({
      where: { userId },
      orderBy: [
        { version: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 1,
    });

    const profilesCount = await prisma.skinProfile.count({
      where: { userId },
    });

    if (profiles.length === 0) {
      return {
        profile: null,
        strategy: 'none',
        hasCurrentProfileColumn: hasCurrentProfileColumn || false,
        currentProfileId: null,
        resolvedProfileId: null,
        profilesCount: 0,
        reason: 'no profiles for user',
      };
    }

    const latestProfile = profiles[0];

    // Определяем стратегию по тому, как нашли профиль
    // Если version не null и > 0 - использовали version, иначе createdAt
    const strategy: ResolveStrategy =
      latestProfile.version != null && latestProfile.version > 0
        ? 'fallback_version'
        : 'fallback_createdAt';

    // Если колонка current_profile_id есть - обновляем её для следующих запросов
    if (hasCurrentProfileColumn) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { currentProfileId: latestProfile.id },
          select: { id: true },
        });
      } catch (err: any) {
        // Игнорируем ошибки обновления (колонка может исчезнуть)
        if (!isMissingCurrentProfileColumn(err)) {
          logger.warn('Failed to update currentProfileId after fallback', { userId, error: err });
        }
      }
    }

    return {
      profile: latestProfile,
      strategy,
      hasCurrentProfileColumn: hasCurrentProfileColumn || false,
      currentProfileId: null,
      resolvedProfileId: latestProfile.id,
      profilesCount,
    };
  } catch (error: any) {
    logger.error('Error getting current profile', error, { userId });
    throw error;
  }
}

