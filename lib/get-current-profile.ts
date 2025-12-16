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

// Кэш наличия колонки current_profile_id в module scope с TTL
// ИСПРАВЛЕНО: Добавлен TTL для безопасной работы на serverless (Vercel)
// После миграции или rollback кэш автоматически обновится
const COLUMN_CHECK_TTL = 60_000; // 60 секунд
let columnState: { value: boolean; checkedAt: number } | null = null;

type ResolveStrategy = 'db_column' | 'fallback_latest' | 'none';

interface ResolveResult {
  profile: any | null;
  strategy: ResolveStrategy;
  hasCurrentProfileColumn: boolean;
  currentProfileId: string | null;
  resolvedProfileId: string | null;
  profileDetails?: {
    id: string;
    userId: string;
    version: number | null;
    createdAt: Date;
  };
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
    // ИСПРАВЛЕНО: Добавлены детали профиля для сравнения с /api/questionnaire/answers
    logger.debug('Profile resolved', {
      userId,
      strategy: result.strategy,
      hasCurrentProfileColumn: result.hasCurrentProfileColumn,
      currentProfileId: result.currentProfileId,
      resolvedProfileId: result.resolvedProfileId,
      profileDetails: result.profileDetails,
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
    // Шаг 1: Определяем наличие колонки current_profile_id с TTL
    // ИСПРАВЛЕНО: Кэш с TTL для безопасной работы на serverless
    const now = Date.now();
    if (!columnState || now - columnState.checkedAt > COLUMN_CHECK_TTL) {
      try {
        await prisma.user.findUnique({
        where: { id: userId },
        select: { currentProfileId: true },
      });
        // Если запрос успешен - колонка существует
        columnState = { value: true, checkedAt: now };
    } catch (err: any) {
      if (isMissingCurrentProfileColumn(err)) {
          columnState = { value: false, checkedAt: now };
        } else {
          // Другая ошибка - пробрасываем дальше
          throw err;
        }
      }
    }

    const hasCurrentProfileColumn = columnState.value;

    // Шаг 2: Если колонка есть - пытаемся использовать currentProfileId
    if (hasCurrentProfileColumn) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { currentProfileId: true },
        });

      // ИСПРАВЛЕНО: Проверка на отсутствие user записи
      if (!user) {
        logger.warn('User not found in DB', { userId });
        // Продолжаем в fallback - возможно профиль есть, но user записи нет
      } else if (user.currentProfileId) {
        // ИСПРАВЛЕНО: Оптимизированная проверка - ищем профиль сразу с where: { id, userId }
        // Это дешевле, чем отдельная проверка profile.userId === userId
        const profile = await prisma.skinProfile.findFirst({
          where: {
            id: user.currentProfileId,
            userId: userId, // Проверка принадлежности в одном запросе
          },
      });

      if (profile) {
          // Профиль валиден - возвращаем его
          return {
            profile,
            strategy: 'db_column',
            hasCurrentProfileColumn: true,
            currentProfileId: user.currentProfileId,
            resolvedProfileId: profile.id,
            profileDetails: {
              id: profile.id,
              userId: profile.userId,
              version: profile.version,
              createdAt: profile.createdAt,
            },
          };
      }

        // Профиль невалиден (удален или принадлежит другому userId) - очищаем и fallback
        logger.warn('Current profile invalid, clearing currentProfileId', {
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
          // Игнорируем ошибки обновления (колонка может исчезнуть между проверками)
          if (!isMissingCurrentProfileColumn(err)) {
            logger.warn('Failed to clear invalid currentProfileId', { userId, error: err });
          }
        }
      }
    }

    // Шаг 3: Fallback - получаем последний профиль
    // ИСПРАВЛЕНО: Используем множественный orderBy для надежности
    // ИСПРАВЛЕНО: Убран count() - он не нужен для функциональности, только для логов
    const profiles = await prisma.skinProfile.findMany({
      where: { userId },
      orderBy: [
        { version: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 1,
    });

    if (profiles.length === 0) {
      return {
        profile: null,
        strategy: 'none',
        hasCurrentProfileColumn: hasCurrentProfileColumn || false,
        currentProfileId: null,
        resolvedProfileId: null,
        reason: 'no profiles for user',
      };
    }

    const latestProfile = profiles[0];

    // ИСПРАВЛЕНО: Упрощена стратегия - всегда fallback_latest
    // version всегда >= 1, поэтому различать fallback_version и fallback_createdAt не имеет смысла

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
      strategy: 'fallback_latest',
      hasCurrentProfileColumn: hasCurrentProfileColumn || false,
      currentProfileId: null,
      resolvedProfileId: latestProfile.id,
      profileDetails: {
        id: latestProfile.id,
        userId: latestProfile.userId,
        version: latestProfile.version,
        createdAt: latestProfile.createdAt,
      },
    };
  } catch (error: any) {
    logger.error('Error getting current profile', error, { userId });
    throw error;
  }
}

