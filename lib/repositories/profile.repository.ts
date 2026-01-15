// lib/repositories/profile.repository.ts
// Repository для работы с профилями кожи пользователей
// Инкапсулирует все Prisma запросы для работы с профилями

import { prisma } from '@/lib/db';
import type { SkinProfile } from '@prisma/client';

/**
 * Repository для работы с профилями кожи
 */
export class ProfileRepository {
  /**
   * Найти профиль по ID
   */
  static async findById(id: string): Promise<SkinProfile | null> {
    return prisma.skinProfile.findUnique({
      where: { id },
    });
  }

  /**
   * Найти профиль по ID с проверкой принадлежности пользователю
   */
  static async findByIdForUser(
    userId: string,
    profileId: string
  ): Promise<SkinProfile | null> {
    return prisma.skinProfile.findFirst({
      where: {
        id: profileId,
        userId, // Проверка принадлежности для безопасности
      },
    });
  }

  /**
   * Найти профиль по ID с минимальными полями (оптимизированный запрос)
   */
  static async findByIdMinimal(
    userId: string,
    profileId: string
  ): Promise<{ id: string; version: number } | null> {
    return prisma.skinProfile.findFirst({
      where: {
        id: profileId,
        userId,
      },
      select: { id: true, version: true },
    });
  }

  /**
   * Найти последний профиль пользователя (по версии)
   */
  static async findLatestByUserId(userId: string): Promise<SkinProfile | null> {
    return prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' }, // Используем version вместо createdAt для корректной версии
    });
  }

  /**
   * Найти последний профиль пользователя (по дате создания)
   */
  static async findLatestByCreatedAt(userId: string): Promise<SkinProfile | null> {
    return prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Найти все профили пользователя
   */
  static async findManyByUserId(userId: string): Promise<SkinProfile[]> {
    return prisma.skinProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Создать новый профиль
   */
  static async create(
    data: Omit<SkinProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SkinProfile> {
    return prisma.skinProfile.create({
      data,
    });
  }

  /**
   * Обновить профиль
   */
  static async update(
    id: string,
    data: Partial<Omit<SkinProfile, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>
  ): Promise<SkinProfile> {
    return prisma.skinProfile.update({
      where: { id },
      data,
    });
  }

  /**
   * Создать или обновить профиль (upsert)
   */
  static async upsert(
    userId: string,
    data: Omit<SkinProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SkinProfile> {
    const existing = await this.findLatestByCreatedAt(userId);

    if (existing) {
      return this.update(existing.id, data);
    }

    return this.create({
      ...data,
      userId,
    });
  }

  /**
   * Удалить профиль
   */
  static async delete(id: string): Promise<SkinProfile> {
    return prisma.skinProfile.delete({
      where: { id },
    });
  }

  /**
   * Удалить все профили пользователя
   */
  static async deleteManyByUserId(userId: string): Promise<{ count: number }> {
    return prisma.skinProfile.deleteMany({
      where: { userId },
    });
  }

  /**
   * Подсчитать количество профилей пользователя
   */
  static async countByUserId(userId: string): Promise<number> {
    return prisma.skinProfile.count({
      where: { userId },
    });
  }
}
