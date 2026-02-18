// lib/repositories/plan.repository.ts
// Repository для работы с планами ухода за кожей
// Инкапсулирует все Prisma запросы для работы с планами

import { prisma } from '@/lib/db';
import type { Plan28 as Plan28Model } from '@prisma/client';
import type { Plan28 } from '@/lib/plan-types';

/**
 * Repository для работы с планами ухода (Plan28)
 */
export class PlanRepository {
  /**
   * Найти план по ID
   */
  static async findById(id: string): Promise<Plan28Model | null> {
    return prisma.plan28.findUnique({
      where: { id },
    });
  }

  /**
   * Найти план пользователя для профиля
   */
  static async findByUserAndProfile(
    userId: string,
    profileId: string
  ): Promise<Plan28Model | null> {
    return prisma.plan28.findFirst({
      where: {
        userId,
        skinProfileId: profileId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Найти план пользователя по версии профиля
   */
  static async findByUserAndProfileVersion(
    userId: string,
    profileVersion: number
  ): Promise<Plan28Model | null> {
    return prisma.plan28.findFirst({
      where: {
        userId,
        profileVersion,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Найти последний план пользователя
   */
  static async findLatestByUserId(userId: string): Promise<Plan28Model | null> {
    return prisma.plan28.findFirst({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Найти все планы пользователя
   */
  static async findManyByUserId(userId: string): Promise<Plan28Model[]> {
    return prisma.plan28.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Найти все планы для профиля
   */
  static async findManyByProfileId(profileId: string): Promise<Plan28Model[]> {
    return prisma.plan28.findMany({
      where: { skinProfileId: profileId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Создать новый план
   */
  static async create(data: {
    userId: string;
    profileId: string;
    profileVersion: number;
    plan: Plan28;
  }): Promise<Plan28Model> {
    return prisma.plan28.create({
      data: {
        userId: data.userId,
        skinProfileId: data.profileId,
        profileVersion: data.profileVersion,
        planData: data.plan as any, // Prisma JSON type (planData в схеме)
      },
    });
  }

  /**
   * Обновить план
   */
  static async update(
    id: string,
    data: {
      plan?: Plan28;
      profileVersion?: number;
    }
  ): Promise<Plan28Model> {
    return prisma.plan28.update({
      where: { id },
      data: {
        ...(data.plan && { planData: data.plan as any }), // planData в схеме
        ...(data.profileVersion && { profileVersion: data.profileVersion }),
      },
    });
  }

  /**
   * Удалить план
   */
  static async delete(id: string): Promise<Plan28Model> {
    return prisma.plan28.delete({
      where: { id },
    });
  }

  /**
   * Удалить все планы пользователя
   */
  static async deleteManyByUserId(userId: string): Promise<{ count: number }> {
    return prisma.plan28.deleteMany({
      where: { userId },
    });
  }

  /**
   * Удалить все планы для профиля
   */
  static async deleteManyByProfileId(profileId: string): Promise<{ count: number }> {
    return prisma.plan28.deleteMany({
      where: { skinProfileId: profileId },
    });
  }

  /**
   * Подсчитать количество планов пользователя
   */
  static async countByUserId(userId: string): Promise<number> {
    return prisma.plan28.count({
      where: { userId },
    });
  }

  /**
   * Проверить существование плана для пользователя и профиля
   */
  static async exists(userId: string, profileId: string): Promise<boolean> {
    const count = await prisma.plan28.count({
      where: {
        userId,
        skinProfileId: profileId,
      },
    });
    return count > 0;
  }
}
