// app/api/questionnaire/answers/route.ts
// Сохранение ответов пользователя и расчет профиля

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSkinProfile } from '@/lib/profile-calculator';
import jwt from 'jsonwebtoken';

// Используем Node.js runtime для поддержки jsonwebtoken
export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface AnswerInput {
  questionId: number;
  answerValue?: string;
  answerValues?: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Проверяем токен
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { questionnaireId, answers } = await request.json();

    if (!questionnaireId || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Получаем анкету
    const questionnaire = await prisma.questionnaire.findUnique({
      where: { id: questionnaireId },
    });

    if (!questionnaire) {
      return NextResponse.json(
        { error: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    // Сохраняем ответы
    const savedAnswers = await Promise.all(
      answers.map(async (answer: AnswerInput) => {
        return prisma.userAnswer.create({
          data: {
            userId,
            questionnaireId,
            questionId: answer.questionId,
            answerValue: answer.answerValue || null,
            answerValues: answer.answerValues ? (answer.answerValues as any) : null,
          },
          include: {
            question: {
              include: {
                answerOptions: true,
              },
            },
          },
        });
      })
    );

    // Загружаем полные данные для расчета профиля
    const fullAnswers = await prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId,
      },
      include: {
        question: {
          include: {
            answerOptions: true,
          },
        },
      },
    });

    // Рассчитываем профиль кожи
    const profileData = createSkinProfile(
      userId,
      questionnaireId,
      fullAnswers,
      questionnaire.version
    );

    // Сохраняем или обновляем профиль
    // Проверяем существующий профиль
    const existingProfile = await prisma.skinProfile.findUnique({
      where: {
        userId_version: {
          userId,
          version: questionnaire.version,
        },
      },
    });

    // Подготавливаем данные для Prisma
    const profileDataForPrisma = {
      ...profileData,
      medicalMarkers: profileData.medicalMarkers ? (profileData.medicalMarkers as any) : null,
    };

    const profile = existingProfile
      ? await prisma.skinProfile.update({
          where: { id: existingProfile.id },
          data: {
            ...profileDataForPrisma,
            updatedAt: new Date(),
          },
        })
      : await prisma.skinProfile.create({
          data: {
            userId,
            version: questionnaire.version,
            ...profileDataForPrisma,
          },
        });

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        skinType: profile.skinType,
        sensitivityLevel: profile.sensitivityLevel,
        acneLevel: profile.acneLevel,
        dehydrationLevel: profile.dehydrationLevel,
        rosaceaRisk: profile.rosaceaRisk,
        pigmentationRisk: profile.pigmentationRisk,
        ageGroup: profile.ageGroup,
        notes: profile.notes,
      },
      answersCount: savedAnswers.length,
    });
  } catch (error) {
    console.error('Error saving answers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
