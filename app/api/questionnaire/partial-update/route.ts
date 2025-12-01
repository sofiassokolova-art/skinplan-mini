// app/api/questionnaire/partial-update/route.ts
// API для частичного обновления ответов анкеты по теме

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';
import { applyRulesToSkinProfile } from '@/lib/skinprofile-rules-engine';
import { getTopicById, shouldRebuildPlan } from '@/lib/quiz-topics';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const initData =
      request.headers.get('x-telegram-init-data') ||
      request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      return NextResponse.json(
        { error: 'Missing Telegram initData' },
        { status: 401 }
      );
    }

    const userId = await getUserIdFromInitData(initData);
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { topicId, answers } = body;

    if (!topicId || !answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'topicId and answers array are required' },
        { status: 400 }
      );
    }

    // Получаем тему
    const topic = getTopicById(topicId);
    if (!topic) {
      return NextResponse.json(
        { error: 'Invalid topicId' },
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

    // Получаем текущие ответы пользователя
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
    const updatedFields: string[] = [];
    
    for (const answer of answers) {
      const { questionId, questionCode, value, values } = answer;
      
      // Находим вопрос по ID или коду
      let question = questionId
        ? questionnaire.questions.find(q => q.id === questionId)
        : questionnaire.questions.find(q => q.code === questionCode);

      if (!question) {
        console.warn(`Question not found: questionId=${questionId}, questionCode=${questionCode}`);
        continue;
      }

      // Проверяем, относится ли вопрос к выбранной теме
      const isInTopic = topic.questionIds.includes(question.id) ||
                       (topic.questionCodes && topic.questionCodes.includes(question.code));
      
      if (!isInTopic) {
        console.warn(`Question ${question.id} (${question.code}) is not in topic ${topicId}`);
        continue;
      }

      // Удаляем старый ответ, если есть
      await prisma.userAnswer.deleteMany({
        where: {
          userId,
          questionnaireId: questionnaire.id,
          questionId: question.id,
        },
      });

      // Создаем новый ответ
      if (question.type === 'multi_choice' && Array.isArray(values)) {
        await prisma.userAnswer.create({
          data: {
            userId,
            questionnaireId: questionnaire.id,
            questionId: question.id,
            answerValues: values,
          },
        });
      } else {
        await prisma.userAnswer.create({
          data: {
            userId,
            questionnaireId: questionnaire.id,
            questionId: question.id,
            answerValue: value || (Array.isArray(values) ? values[0] : null),
          },
        });
      }

      updatedFields.push(question.code);
    }

    // Получаем все ответы (обновленные + старые)
    const allAnswers = await prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId: questionnaire.id,
      },
      include: {
        question: true,
      },
    });

    // Преобразуем в формат для skinprofile-rules-engine
    const rawAnswers = allAnswers.map(answer => ({
      questionId: answer.questionId,
      subKey: answer.question.code, // Можно улучшить, если есть subKey
      value: answer.answerValue || answer.answerValues,
    }));

    // Получаем текущий профиль
    const currentProfile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Генерируем новый SkinProfile
    const newProfileData = applyRulesToSkinProfile(
      rawAnswers,
      currentProfile ? {
        skinType: currentProfile.skinType as any,
        sensitivity: currentProfile.sensitivityLevel as any,
        mainGoals: (currentProfile.medicalMarkers as any)?.mainGoals || [],
        diagnoses: (currentProfile.medicalMarkers as any)?.diagnoses || [],
        contraindications: (currentProfile.medicalMarkers as any)?.contraindications || [],
      } : undefined
    );

    // Обновляем или создаем SkinProfile
    const medicalMarkers = {
      mainGoals: newProfileData.mainGoals,
      secondaryGoals: newProfileData.secondaryGoals,
      diagnoses: newProfileData.diagnoses,
      contraindications: newProfileData.contraindications,
      currentTopicals: newProfileData.currentTopicals,
      currentOralMeds: newProfileData.currentOralMeds,
      lifestyleFactors: newProfileData.lifestyleFactors,
    };

    const newProfile = await prisma.skinProfile.upsert({
      where: {
        userId_version: {
          userId,
          version: currentProfile?.version || 1,
        },
      },
      update: {
        skinType: newProfileData.skinType,
        sensitivityLevel: newProfileData.sensitivity,
        medicalMarkers,
        notes: `Обновлено через тему: ${topic.title}`,
      },
      create: {
        userId,
        version: (currentProfile?.version || 0) + 1,
        skinType: newProfileData.skinType,
        sensitivityLevel: newProfileData.sensitivity,
        medicalMarkers,
        notes: `Создано через тему: ${topic.title}`,
      },
    });

    // Проверяем, нужно ли пересобирать план
    const needsPlanRebuild = shouldRebuildPlan(topicId);

    return NextResponse.json({
      success: true,
      profile: {
        id: newProfile.id,
        version: newProfile.version,
        skinType: newProfile.skinType,
        sensitivityLevel: newProfile.sensitivityLevel,
      },
      updatedFields,
      needsPlanRebuild,
      topic: {
        id: topic.id,
        title: topic.title,
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

