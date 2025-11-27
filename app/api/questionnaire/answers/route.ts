// app/api/questionnaire/answers/route.ts
// Сохранение ответов пользователя и расчет профиля

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSkinProfile } from '@/lib/profile-calculator';
import { getUserIdFromInitData } from '@/lib/get-user-from-initdata';

export const runtime = 'nodejs';

interface AnswerInput {
  questionId: number;
  answerValue?: string;
  answerValues?: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Получаем initData из заголовков (пробуем оба варианта регистра)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');

    if (!initData) {
      console.error('⚠️ Missing initData in headers for questionnaire answers:', {
        availableHeaders: Array.from(request.headers.keys()),
        userAgent: request.headers.get('user-agent'),
      });
      return NextResponse.json(
        { error: 'Missing Telegram initData. Please open the app through Telegram Mini App.' },
        { status: 401 }
      );
    }
    
    console.log('✅ initData получен, длина:', initData.length);

    // Получаем userId из initData (автоматически создает/обновляет пользователя)
    const userId = await getUserIdFromInitData(initData);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired initData' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { questionnaireId, answers } = body;

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
            version: existingProfile.version + 1, // Инкрементируем версию при обновлении профиля
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
    
    // Очищаем кэш плана и рекомендаций при обновлении профиля
    if (existingProfile) {
      console.log(`🔄 Profile updated, clearing cache for userId: ${userId}, old version: ${existingProfile.version}, new version: ${profile.version}`);
      try {
        const { invalidateCache } = await import('@/lib/cache');
        // Очищаем кэш для старой версии
        await invalidateCache(userId, existingProfile.version);
        console.log('✅ Cache cleared for old profile version');
      } catch (cacheError) {
        console.warn('⚠️ Failed to clear cache:', cacheError);
      }
    }

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
          const where: any = { published: true };
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
            take: (step.max_items || 3) * 2,
          });
          
          // Сортируем в памяти
          products.sort((a: any, b: any) => {
            if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
            if (a.priority !== b.priority) return b.priority - a.priority;
            return b.createdAt.getTime() - a.createdAt.getTime();
          });
          
          const sortedProducts = products.slice(0, step.max_items || 3);

          productIds.push(...sortedProducts.map(p => p.id));
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
        // Если правило не найдено, создаем fallback сессию с базовыми продуктами
        console.warn(`⚠️ No matching rule found for profile ${profile.id}, creating fallback session...`);
        
        const fallbackProductIds: number[] = [];
        
        // ГАРАНТИРУЕМ наличие базовых шагов: cleanser, moisturizer, spf
        const requiredSteps = ['cleanser', 'moisturizer', 'spf'];
        
        for (const step of requiredSteps) {
          const products = await prisma.product.findMany({
            where: {
              published: true,
              step: step,
              // SPF универсален, для остальных учитываем тип кожи
              ...(step !== 'spf' && profile.skinType ? {
                skinTypes: { has: profile.skinType },
              } : {}),
            },
            take: 1,
            orderBy: { createdAt: 'desc' },
          });
          
          if (products.length > 0) {
            fallbackProductIds.push(products[0].id);
            console.log(`✅ Added fallback ${step}: ${products[0].name}`);
          }
        }
        
        // Добавляем дополнительные продукты (toner, serum) если есть
        const optionalSteps = ['toner', 'serum'];
        for (const step of optionalSteps) {
          const products = await prisma.product.findMany({
            where: {
              published: true,
              step: step,
              ...(profile.skinType ? {
                skinTypes: { has: profile.skinType },
              } : {}),
            },
            take: 1,
            orderBy: { createdAt: 'desc' },
          });
          
          if (products.length > 0 && !fallbackProductIds.includes(products[0].id)) {
            fallbackProductIds.push(products[0].id);
          }
        }

        if (fallbackProductIds.length > 0) {
          await prisma.recommendationSession.create({
            data: {
              userId,
              profileId: profile.id,
              ruleId: null,
              products: fallbackProductIds,
            },
          });
          
          console.log(`✅ Fallback RecommendationSession created with ${fallbackProductIds.length} products`);
        } else {
          console.error(`❌ No products available for fallback session`);
        }
      }
    } catch (recommendationError) {
      // Не блокируем сохранение ответов, если рекомендации не создались
      console.error('Error creating recommendations:', recommendationError);
    }

    // После успешного создания профиля, очищаем прогресс анкеты на сервере
    // Прогресс больше не нужен, так как анкета завершена
    try {
      await prisma.userAnswer.deleteMany({
        where: {
          userId,
          questionnaireId,
        },
      });
      console.log(`✅ Quiz progress cleared for user ${userId} after profile creation`);
    } catch (clearError) {
      // Не критично, если не удалось очистить - прогресс просто не будет показываться
      console.warn('⚠️ Failed to clear quiz progress (non-critical):', clearError);
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
