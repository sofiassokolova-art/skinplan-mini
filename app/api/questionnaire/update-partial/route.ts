// app/api/questionnaire/update-partial/route.ts
// API для частичного обновления ответов анкеты

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildSkinProfileFromAnswers } from '@/lib/skinprofile-rules-engine';
import { selectCarePlanTemplate, type CarePlanProfileInput } from '@/lib/care-plan-templates';
import { getQuestionCodesForTopic, topicRequiresPlanRebuild, type QuestionTopicId } from '@/lib/questionnaire-topics';
import { requireTelegramAuth } from '@/lib/auth/telegram-auth';

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

      // Ищем существующий ответ
      const existingAnswer = existingAnswers.find(
        (a) => a.questionId === question.id
      );

      // ИСПРАВЛЕНО: Используем upsert вместо проверки существования для предотвращения race condition
      await prisma.userAnswer.upsert({
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
            : null,
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
    const allAnswers = await prisma.userAnswer.findMany({
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
      const value =
        answer.answerValue ||
        (answer.answerValues
          ? JSON.parse(JSON.stringify(answer.answerValues))
          : null);

      return {
        questionId: answer.question.id,
        questionCode: answer.question.code,
        answerValue: answer.answerValue || null,
        answerValues: answer.answerValues || null,
      };
    });

    // Генерируем новый SkinProfile из всех ответов
    const newProfile = buildSkinProfileFromAnswers(rawAnswers);

    // Получаем текущий профиль для версионирования
    const currentProfile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const newVersion = currentProfile ? (currentProfile.version || 1) + 1 : 1;

    // Сохраняем новый профиль
    // Сначала получаем текущий профиль для сохранения других полей
    const currentProfileData = currentProfile ? {
      dehydrationLevel: currentProfile.dehydrationLevel,
      acneLevel: currentProfile.acneLevel,
      rosaceaRisk: currentProfile.rosaceaRisk,
      pigmentationRisk: currentProfile.pigmentationRisk,
      hasPregnancy: currentProfile.hasPregnancy,
      notes: currentProfile.notes,
    } : {};

    const updatedProfile = await prisma.skinProfile.create({
      data: {
        userId,
        version: newVersion,
        skinType: newProfile.skinType || null,
        sensitivityLevel: newProfile.sensitivity || null,
        ...currentProfileData,
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

    // Проверяем, нужно ли пересобирать план
    const requiresPlanRebuild = topicRequiresPlanRebuild(topicId);
    let planRebuilt = false;

    if (requiresPlanRebuild) {
      // Определяем параметры для CarePlanTemplate
      const carePlanProfileInput: CarePlanProfileInput = {
        skinType: newProfile.skinType || 'normal',
        mainGoals: newProfile.mainGoals.length > 0 ? newProfile.mainGoals : ['general'],
        sensitivityLevel: newProfile.sensitivity || 'low',
        routineComplexity: (newProfile.routineComplexity === 'any' ? 'medium' : newProfile.routineComplexity) || 'medium',
      };

      const carePlanTemplate = selectCarePlanTemplate(carePlanProfileInput);

      // Удаляем старую сессию рекомендаций для пользователя, чтобы план пересобрался
      // Удаляем по userId, так как при обновлении профиля создается новая версия с новым profileId
      // И старый RecommendationSession может быть привязан к старой версии профиля
      await prisma.recommendationSession.deleteMany({
        where: { userId },
      });
      
      // Также инвалидируем кэш для всех версий профиля пользователя
      try {
        const { invalidateCache } = await import('@/lib/cache');
        // Инвалидируем для текущей и предыдущей версий профиля
        if (currentProfile) {
          await invalidateCache(userId, currentProfile.version || 1);
        }
        await invalidateCache(userId, newVersion);
      } catch (cacheError) {
        console.warn('Failed to invalidate cache', cacheError);
      }

      planRebuilt = true;
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedProfile.id,
        version: updatedProfile.version,
        skinType: updatedProfile.skinType,
        mainGoals: (updatedProfile.medicalMarkers as any)?.mainGoals || [],
      },
      planRebuilt,
      updatedQuestions: Array.from(updatedQuestionIds),
    });
  } catch (error: any) {
    console.error('Error updating partial questionnaire:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

