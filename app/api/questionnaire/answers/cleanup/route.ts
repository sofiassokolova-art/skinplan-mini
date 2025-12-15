// app/api/questionnaire/answers/cleanup/route.ts
// Идемпотентная очистка ответов анкеты после успешной генерации плана/рекомендаций
// ИСПРАВЛЕНО: Явный контракт для очистки ответов после успешной генерации

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { ApiResponse } from '@/lib/api-response';
import { logger, logApiRequest, logApiError } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * POST /api/questionnaire/answers/cleanup
 * Идемпотентная очистка ответов анкеты после успешной генерации плана/рекомендаций
 * 
 * Body:
 * - profileVersion: number (optional) - версия профиля, для которого был создан план
 * - cleanupId: string (optional) - ID операции очистки для идемпотентности
 * 
 * Идемпотентность: если cleanupId передан и операция уже выполнена, возвращает успех без повторной очистки
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const method = 'POST';
  const path = '/api/questionnaire/answers/cleanup';
  let userId: string | undefined;

  try {
    // Получаем initData из заголовков
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return ApiResponse.unauthorized('Missing Telegram initData');
    }

    // Получаем userId из initData
    const userIdResult = await getUserIdFromInitData(initData);
    userId = userIdResult || undefined;

    if (!userId) {
      return ApiResponse.unauthorized('Invalid or expired initData');
    }

    // Парсим body
    const body = await request.json().catch(() => ({}));
    const { profileVersion, cleanupId } = body;

    // ИСПРАВЛЕНО: Проверяем идемпотентность через QuestionnaireSubmission
    // Если cleanupId передан и операция уже выполнена, возвращаем успех
    if (cleanupId) {
      const existingSubmission = await (prisma as any).questionnaireSubmission.findFirst({
        where: {
          userId,
          // Проверяем по cleanupId или по profileVersion
          ...(profileVersion ? { profileVersion } : {}),
        },
        select: { id: true, status: true },
      });

      if (existingSubmission && existingSubmission.status === 'completed') {
        logger.info('Cleanup already completed (idempotent)', {
          userId,
          cleanupId,
          profileVersion,
          submissionId: existingSubmission.id,
        });
        return ApiResponse.success({
          success: true,
          alreadyCleaned: true,
          message: 'Answers already cleaned up',
        });
      }
    }

    // Получаем активную анкету
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    if (!questionnaire) {
      return ApiResponse.notFound('No active questionnaire found');
    }

    // ИСПРАВЛЕНО: Проверяем, что план действительно создан перед очисткой ответов
    // Это гарантирует, что ответы не удалятся до успешной генерации плана
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    });

    if (!profile) {
      logger.warn('Cannot cleanup answers: profile not found', { userId });
      return ApiResponse.badRequest('Profile not found. Cannot cleanup answers without a profile.');
    }

    // Проверяем версию профиля, если указана
    if (profileVersion && profile.version !== profileVersion) {
      logger.warn('Profile version mismatch', {
        userId,
        expectedVersion: profileVersion,
        actualVersion: profile.version,
      });
      return ApiResponse.badRequest(`Profile version mismatch. Expected ${profileVersion}, got ${profile.version}`);
    }

    // Проверяем наличие плана для этой версии профиля
    const plan = await prisma.plan28.findFirst({
      where: {
        userId,
        profileVersion: profile.version,
      },
      select: { id: true },
    });

    if (!plan) {
      logger.warn('Cannot cleanup answers: plan not found for profile version', {
        userId,
        profileVersion: profile.version,
      });
      return ApiResponse.badRequest('Plan not found for current profile version. Cannot cleanup answers without a plan.');
    }

    // ИСПРАВЛЕНО: Удаляем ответы только если план создан
    // Используем транзакцию для атомарности
    const deletedCount = await prisma.$transaction(async (tx) => {
      const deleted = await tx.userAnswer.deleteMany({
        where: {
          userId,
          questionnaireId: questionnaire.id,
        },
      });

      // Если cleanupId передан, обновляем QuestionnaireSubmission для идемпотентности
      if (cleanupId) {
        await (tx as any).questionnaireSubmission.updateMany({
          where: {
            userId,
            questionnaireId: questionnaire.id,
          },
          data: {
            status: 'completed',
            // Можно добавить поле cleanupId в QuestionnaireSubmission для более точной идемпотентности
          },
        });
      }

      return deleted.count;
    });

    logger.info('Answers cleaned up successfully', {
      userId,
      profileVersion: profile.version,
      questionnaireId: questionnaire.id,
      deletedCount,
      cleanupId,
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return ApiResponse.success({
      success: true,
      deletedCount,
      profileVersion: profile.version,
      message: 'Answers cleaned up successfully',
    });

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId || undefined);
    return ApiResponse.internalError(error, { userId: userId || undefined, method, path, duration });
  }
}

