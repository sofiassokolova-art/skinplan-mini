// app/api/questionnaire/update-partial/route.ts
// API для частичного обновления ответов анкеты

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildSkinProfileFromAnswers } from '@/lib/skinprofile-rules-engine';
import { selectCarePlanTemplate, type CarePlanProfileInput } from '@/lib/care-plan-templates';
import { getQuestionCodesForTopic, topicRequiresPlanRebuild, type QuestionTopicId } from '@/lib/questionnaire-topics';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';
import { requiresPlanRebuild, requiresSafetyLock } from '@/lib/profile-change-detector';
import { validateSkinProfile } from '@/lib/profile-validator';

export const runtime = 'nodejs';

interface UpdateRequest {
  topicId: QuestionTopicId;
  answers: Array<{
    questionCode: string;
    answerValue?: string;
    answerValues?: string[];
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTelegramAuth(request, { ensureUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.ctx.userId;

    const body: UpdateRequest = await request.json();
    const { topicId, answers } = body;

    if (!topicId || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: 'topicId and answers are required' },
        { status: 400 }
      );
    }

    // Получаем активную анкету
    const questionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      include: {
        questions: {
          include: {
            answerOptions: true,
          },
        },
      },
    });

    if (!questionnaire) {
      return NextResponse.json(
        { error: 'No active questionnaire found' },
        { status: 404 }
      );
    }

    // Получаем все текущие ответы пользователя
    const existingAnswers = await prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId: questionnaire.id,
      },
      include: {
        question: true,
      },
    });

    // ИСПРАВЛЕНО (P0): Обернуть весь flow в транзакцию для атомарности
    const result = await prisma.$transaction(async (tx) => {
      // Обновляем или создаем ответы для выбранной темы
      const questionCodes = getQuestionCodesForTopic(topicId);
      const updatedQuestionIds = new Set<number>();

      for (const answerData of answers) {
        const question = questionnaire.questions.find(
          (q) => q.code === answerData.questionCode
        );

        if (!question) {
          console.warn(`Question with code ${answerData.questionCode} not found`);
          continue;
        }

        updatedQuestionIds.add(question.id);

        // ИСПРАВЛЕНО: Используем tx вместо prisma для транзакции
        await tx.userAnswer.upsert({
          where: {
            userId_questionnaireId_questionId: {
              userId,
              questionnaireId: questionnaire.id,
              questionId: question.id,
            },
          },
          update: {
            answerValue: answerData.answerValue || null,
            answerValues: answerData.answerValues
              ? (answerData.answerValues as any)
              : (null as any),
          },
          create: {
            userId,
            questionnaireId: questionnaire.id,
            questionId: question.id,
            answerValue: answerData.answerValue || null,
            answerValues: answerData.answerValues
              ? (answerData.answerValues as any)
              : null,
          },
        });
      }

      // Получаем все ответы (включая обновленные) для пересчета профиля
      const allAnswers = await tx.userAnswer.findMany({
        where: {
          userId,
          questionnaireId: questionnaire.id,
        },
        include: {
          question: true,
        },
      });

      // Преобразуем ответы в формат для skinprofile-rules-engine
      const rawAnswers = allAnswers.map((answer) => {
        return {
          questionId: answer.question.id,
          questionCode: answer.question.code,
          answerValue: answer.answerValue || null,
          answerValues: answer.answerValues || null,
        };
      });

      // Генерируем новый SkinProfile из всех ответов
      const newProfile = buildSkinProfileFromAnswers(rawAnswers);

      // ИСПРАВЛЕНО (P0): Валидация профиля после rules-engine
      const validationResult = validateSkinProfile(newProfile);
      if (!validationResult.isValid) {
        throw new Error(`Profile validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Получаем текущий профиль для версионирования
      const currentProfile = await tx.skinProfile.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      const newVersion = currentProfile ? (currentProfile.version || 1) + 1 : 1;

      // Сохраняем новый профиль
      const profileLegacyData = currentProfile ? {
        dehydrationLevel: currentProfile.dehydrationLevel,
        acneLevel: currentProfile.acneLevel,
        rosaceaRisk: currentProfile.rosaceaRisk,
        pigmentationRisk: currentProfile.pigmentationRisk,
        hasPregnancy: currentProfile.hasPregnancy,
        notes: currentProfile.notes,
      } : {};

      const updatedProfile = await tx.skinProfile.create({
        data: {
          userId,
          version: newVersion,
          skinType: newProfile.skinType || null,
          sensitivityLevel: newProfile.sensitivity || null,
          ...profileLegacyData,
          medicalMarkers: {
            mainGoals: newProfile.mainGoals,
            secondaryGoals: newProfile.secondaryGoals,
            diagnoses: newProfile.diagnoses,
            contraindications: newProfile.contraindications,
            ageGroup: newProfile.ageGroup,
            gender: newProfile.gender,
            seasonality: newProfile.seasonality,
            pregnancyStatus: newProfile.pregnancyStatus,
            spfHabit: newProfile.spfHabit,
            makeupFrequency: newProfile.makeupFrequency,
            lifestyleFactors: newProfile.lifestyleFactors,
            carePreference: newProfile.carePreference,
            routineComplexity: newProfile.routineComplexity,
            budgetSegment: newProfile.budgetSegment,
            currentTopicals: newProfile.currentTopicals,
            currentOralMeds: newProfile.currentOralMeds,
          } as any,
        },
      });

      // ИСПРАВЛЕНО (P0): Усиленные условия rebuild плана (не только topicId)
      const topicRequiresRebuild = topicRequiresPlanRebuild(topicId);
      
      const currentProfileData = currentProfile ? {
        skinType: currentProfile.skinType as any, // ИСПРАВЛЕНО: Приводим к типу SkinTypeKey
        sensitivity: currentProfile.sensitivityLevel as any, // ИСПРАВЛЕНО: Приводим к типу sensitivity
        mainGoals: (currentProfile.medicalMarkers as any)?.mainGoals || [],
        diagnoses: (currentProfile.medicalMarkers as any)?.diagnoses || [],
        pregnancyStatus: (currentProfile.medicalMarkers as any)?.pregnancyStatus || null,
        contraindications: (currentProfile.medicalMarkers as any)?.contraindications || [],
        currentTopicals: (currentProfile.medicalMarkers as any)?.currentTopicals || [],
        currentOralMeds: (currentProfile.medicalMarkers as any)?.currentOralMeds || [],
      } : null;

      const rebuildCheck = requiresPlanRebuild(
        topicRequiresRebuild,
        currentProfileData,
        newProfile
      );

      // ИСПРАВЛЕНО (UX): Определяем safetyLock - нужно ли блокировать старый план
      const safetyLock = requiresSafetyLock(currentProfileData, newProfile);

      let planInvalidated = false;
      let recommendationsInvalidated = false;

      if (rebuildCheck.requires) {
        // Удаляем старую сессию рекомендаций для пользователя
        await tx.recommendationSession.deleteMany({
          where: { userId },
        });
        
        recommendationsInvalidated = true;
        planInvalidated = true;
      }

      return {
        updatedProfile,
        updatedQuestionIds: Array.from(updatedQuestionIds),
        planInvalidated,
        recommendationsInvalidated,
        rebuildReason: rebuildCheck.reason,
        validationWarnings: validationResult.warnings,
        safetyLock, // ИСПРАВЛЕНО (UX): Добавлен safetyLock
      };
    });

    // Инвалидируем кэш вне транзакции (best effort)
    if (result.planInvalidated) {
      try {
        const { invalidateCache } = await import('@/lib/cache');
        const currentProfile = await prisma.skinProfile.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
        if (currentProfile) {
          await invalidateCache(userId, currentProfile.version || 1);
        }
        await invalidateCache(userId, result.updatedProfile.version);
      } catch (cacheError) {
        console.warn('Failed to invalidate cache', cacheError);
      }
    }

    // ИСПРАВЛЕНО (P0 + UX): Улучшенный контракт ответа API с поддержкой UX retake
    const nextActions: string[] = [];
    if (result.recommendationsInvalidated) {
      nextActions.push('REBUILD_RECOMMENDATIONS');
    }
    if (result.planInvalidated) {
      nextActions.push('REBUILD_PLAN');
    }

    // ИСПРАВЛЕНО (UX): Определяем estimatedSteps для прогресс-бара
    // 1. Сохраняем ответы (уже сделано)
    // 2. Обновляем профиль (уже сделано)
    // 3. Подбираем средства (если нужно)
    // 4. Собираем план (если нужно)
    const estimatedSteps = [
      { id: 'saving_answers', label: 'Сохраняем ответы', completed: true },
      { id: 'updating_profile', label: 'Обновляем профиль кожи', completed: true },
      ...(result.recommendationsInvalidated ? [{
        id: 'rebuilding_recommendations',
        label: 'Подбираем средства',
        completed: false,
      }] : []),
      ...(result.planInvalidated ? [{
        id: 'rebuilding_plan',
        label: 'Собираем обновлённый план на 28 дней',
        completed: false,
      }] : []),
    ];

    return NextResponse.json({
      success: true,
      mode: 'full' as const, // Всегда full rebuild профиля
      updated: {
        answers: true,
        profile: true,
        recommendations: result.recommendationsInvalidated,
        plan: false, // План не пересобран, только инвалидирован
      },
      nextActions, // ИСПРАВЛЕНО (UX): Включает REBUILD_RECOMMENDATIONS и REBUILD_PLAN
      safetyLock: result.safetyLock, // ИСПРАВЛЕНО (UX): Блокировать ли старый план
      estimatedSteps, // ИСПРАВЛЕНО (UX): Шаги для прогресс-бара
      data: {
        profile: {
          id: result.updatedProfile.id,
          version: result.updatedProfile.version,
          skinType: result.updatedProfile.skinType,
          mainGoals: (result.updatedProfile.medicalMarkers as any)?.mainGoals || [],
        },
        planInvalidated: result.planInvalidated,
        planStatus: result.planInvalidated ? 'invalidated' : 'valid',
        rebuildReason: result.rebuildReason,
        updatedQuestions: result.updatedQuestionIds,
        validationWarnings: result.validationWarnings,
      },
    });
  } catch (error: any) {
    console.error('Error updating partial questionnaire:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

