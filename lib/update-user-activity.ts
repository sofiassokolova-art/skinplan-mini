// lib/update-user-activity.ts
// Утилита для обновления lastActive пользователя
// Используется в middleware или критичных endpoints для отслеживания активности

import { prisma } from '@/lib/db';
import { logger } from './logger';

/**
 * Обновляет lastActive для пользователя
 * Используется асинхронно, чтобы не блокировать основной запрос
 */
export async function updateUserActivity(userId: string): Promise<void> {
  try {
    // ВАЖНО: используем updateMany, чтобы Prisma не делал RETURNING со всеми колонками User
    // (это ломается, если в БД не применены миграции и отсутствуют новые поля).
    await prisma.user.updateMany({
      where: { id: userId },
      data: { lastActive: new Date() },
    });
  } catch (error) {
    // Логируем ошибку, но не прерываем основной запрос
    logger.warn('Failed to update user activity', { userId, error });
  }
}

/**
 * Обновляет lastActive для нескольких пользователей (для batch операций)
 */
export async function updateUsersActivity(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const now = new Date();
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { lastActive: now },
    });
  } catch (error) {
    logger.warn('Failed to update users activity', { userIdsCount: userIds.length, error });
  }
}

