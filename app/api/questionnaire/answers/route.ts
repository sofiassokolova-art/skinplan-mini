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

    // Сохраняем или обновляем ответы (upsert для избежания дубликатов)
    const savedAnswers = await Promise.all(
      answers.map(async (answer: AnswerInput) => {
        // Проверяем, существует ли уже ответ
        const existingAnswer = await prisma.userAnswer.findFirst({
          where: {
            userId,
            questionnaireId,
            questionId: answer.questionId,
          },
        });

        if (existingAnswer) {
          // Обновляем существующий ответ (updatedAt обновляется автоматически через @updatedAt)
          return prisma.userAnswer.update({
            where: { id: existingAnswer.id },
            data: {
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
        } else {
          // Создаем новый ответ
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
        }
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

    // Автоматически создаем рекомендации после создания профиля
    // Импортируем логику из recommendations/route.ts
    try {
      // Получаем все активные правила
      const rules = await prisma.recommendationRule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'desc' },
      });

      // Находим подходящее правило
      let matchedRule: any = null;
      
      for (const rule of rules) {
        const conditions = rule.conditionsJson as any;
        let matches = true;

        for (const [key, condition] of Object.entries(conditions)) {
          const profileValue = (profile as any)[key];

          if (Array.isArray(condition)) {
            if (!condition.includes(profileValue)) {
              matches = false;
              break;
            }
          } else if (typeof condition === 'object' && condition !== null) {
            const conditionObj = condition as Record<string, unknown>;
            if (typeof profileValue === 'number') {
              if ('gte' in conditionObj && typeof conditionObj.gte === 'number') {
                const gteValue = conditionObj.gte as number;
                if (profileValue < gteValue) {
                  matches = false;
                  break;
                }
              }
              if ('lte' in conditionObj && typeof conditionObj.lte === 'number') {
                const lteValue = conditionObj.lte as number;
                if (profileValue > lteValue) {
                  matches = false;
                  break;
                }
              }
            }
          } else if (condition !== profileValue) {
            matches = false;
            break;
          }
        }

        if (matches) {
          matchedRule = rule;
          break;
        }
      }

      // Если найдено правило, создаем RecommendationSession
      if (matchedRule) {
        const stepsJson = matchedRule.stepsJson as any;
        const productIds: number[] = [];

        // Собираем ID продуктов из всех шагов
        for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
          const where: any = { status: 'published' };
          const step = stepConfig as any;

          if (step.category && Array.isArray(step.category) && step.category.length > 0) {
            where.category = { in: step.category };
          }
          if (step.skin_types && Array.isArray(step.skin_types) && step.skin_types.length > 0) {
            where.skinTypes = { hasSome: step.skin_types };
          }
          if (step.concerns && Array.isArray(step.concerns) && step.concerns.length > 0) {
            where.concerns = { hasSome: step.concerns };
          }
          if (step.is_non_comedogenic === true) {
            where.isNonComedogenic = true;
          }
          if (step.is_fragrance_free === true) {
            where.isFragranceFree = true;
          }

          const products = await prisma.product.findMany({
            where,
            take: step.max_items || 3,
            orderBy: { createdAt: 'desc' },
          });

          productIds.push(...products.map(p => p.id));
        }

        // Создаем RecommendationSession
        await prisma.recommendationSession.create({
          data: {
            userId,
            profileId: profile.id,
            ruleId: matchedRule.id,
            products: productIds,
          },
        });

        console.log(`✅ RecommendationSession created for user ${userId} with ${productIds.length} products`);
      } else {
        console.warn(`⚠️ No matching rule found for profile ${profile.id}`);
      }
    } catch (recommendationError) {
      // Не блокируем сохранение ответов, если рекомендации не создались
      console.error('Error creating recommendations:', recommendationError);
    }

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
