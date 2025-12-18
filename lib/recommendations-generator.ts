// lib/recommendations-generator.ts
// ИСПРАВЛЕНО: Вынесенная логика генерации RecommendationSession
// Используется в /api/recommendations/build для идемпотентной генерации рекомендаций

import { prisma } from '@/lib/db';
import { logger } from './logger';
import { calculateSkinAxes, getDermatologistRecommendations } from './skin-analysis-engine';
import { buildRuleContext } from './rule-context';
import { normalizeSkinTypeForRules, normalizeSensitivityForRules } from './skin-type-normalizer';
import { getProductsForStep } from './product-selection';

export interface RecommendationGenerationResult {
  sessionId: string;
  ruleId: number | null;
  products: number[];
}

/**
 * Генерирует RecommendationSession для профиля
 * ИСПРАВЛЕНО: Идемпотентная функция - можно вызывать несколько раз
 */
export async function generateRecommendationsForProfile(
  userId: string,
  profileId: string
): Promise<RecommendationGenerationResult | null> {
  try {
    // Получаем профиль
    const profile = await prisma.skinProfile.findUnique({
      where: { id: profileId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!profile || profile.userId !== userId) {
      logger.error('Profile not found or does not belong to user', { userId, profileId });
      return null;
    }

    // Используем активную анкету как source of truth для answers/scores
    // ИСПРАВЛЕНО: ранее ошибочно использовали profile.version как questionnaireId
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    const questionnaireId = activeQuestionnaire?.id ?? null;
    if (!questionnaireId) {
      logger.error('No active questionnaire found for recommendations generation', { userId, profileId });
      return null;
    }

    // Получаем ответы пользователя для расчета axes
    const userAnswers = await prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId, // ИСПРАВЛЕНО: активная анкета
      },
      include: {
        question: {
          include: {
            answerOptions: true,
          },
        },
      },
    });

    // Строим questionnaireAnswers для расчета axes
    const questionnaireAnswers: any = {};
    for (const answer of userAnswers) {
      const code = answer.question?.code;
      if (!code) continue;

      const value = answer.answerValue || 
        (Array.isArray(answer.answerValues) ? answer.answerValues[0] : null);
      
      if (code === 'skin_type' || code === 'skinType') {
        questionnaireAnswers.skinType = value;
      } else if (code === 'age' || code === 'age_group') {
        questionnaireAnswers.age = value;
      } else if (code === 'concerns' || code === 'skin_concerns') {
        questionnaireAnswers.concerns = Array.isArray(answer.answerValues) ? answer.answerValues : [];
      } else if (code === 'habits') {
        questionnaireAnswers.habits = Array.isArray(answer.answerValues) ? answer.answerValues : [];
      } else if (code === 'sensitivity_level' || code === 'sensitivityLevel') {
        questionnaireAnswers.sensitivityLevel = value || 'low';
      } else if (code === 'acne_level' || code === 'acneLevel') {
        questionnaireAnswers.acneLevel = typeof value === 'number' ? value : (parseInt(value as string) || 0);
      }
    }

    // Вычисляем skin scores
    const skinScores = calculateSkinAxes(questionnaireAnswers);

    // Нормализуем тип кожи и чувствительность
    const normalizedSkinType = normalizeSkinTypeForRules(profile.skinType, { userId });
    const normalizedSensitivity = normalizeSensitivityForRules(profile.sensitivityLevel);

    // Строим RuleContext
    const ruleContext = buildRuleContext(profile as any, skinScores, normalizedSkinType, normalizedSensitivity);

    // Ищем подходящее правило
    const rules = await prisma.recommendationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    let matchedRule: any = null;
    for (const rule of rules) {
      const conditions = rule.conditionsJson as any;
      
      // Упрощенная проверка условий (можно улучшить)
      let matches = true;
      for (const [key, condition] of Object.entries(conditions)) {
        const profileValue = (ruleContext as any)[key];
        
        if (profileValue === undefined || profileValue === null) {
          if (typeof condition === 'object' && condition !== null && ('gte' in condition || 'lte' in condition)) {
            matches = false;
            break;
          }
        }

        if (Array.isArray(condition)) {
          if (!condition.includes(profileValue)) {
            matches = false;
            break;
          }
        } else if (typeof condition === 'object' && condition !== null) {
          if ('hasSome' in condition && Array.isArray(condition.hasSome)) {
            const profileArray = Array.isArray(profileValue) ? profileValue : [];
            const hasMatch = condition.hasSome.some((item: any) => profileArray.includes(item));
            if (!hasMatch) {
              matches = false;
              break;
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

    if (!matchedRule) {
      logger.warn('No matching rule found', { userId, profileId });
      return null;
    }

    // Получаем продукты для каждого шага правила
    const stepsJson = matchedRule.stepsJson as any;
    const allProductIds: number[] = [];

    // ИСПРАВЛЕНО: budgetSegment не в RuleContext, получаем из профиля или используем null
    const budgetSegment = (profile as any).budgetSegment || null;

    // ИСПРАВЛЕНО: stepsJson в БД обычно объект { stepName: RuleStep }, но поддерживаем и массив для обратной совместимости
    if (Array.isArray(stepsJson)) {
      for (const step of stepsJson) {
        const products = await getProductsForStep(step, budgetSegment);
        allProductIds.push(...products.map((p: any) => p.id));
      }
    } else if (stepsJson && typeof stepsJson === 'object') {
      for (const stepConfig of Object.values(stepsJson)) {
        const products = await getProductsForStep(stepConfig as any, budgetSegment);
        allProductIds.push(...products.map((p: any) => p.id));
      }
    } else {
      logger.warn('Matched rule has invalid stepsJson, cannot select products', {
        userId,
        profileId,
        ruleId: matchedRule.id,
        stepsJsonType: typeof stepsJson,
      });
      return null;
    }

    // Создаем или обновляем RecommendationSession
    // ИСПРАВЛЕНО: Используем findFirst + create/update вместо upsert, так как userId_profileId может не быть уникальным ключом
    const existingSession = await prisma.recommendationSession.findFirst({
      where: {
        userId,
        profileId: profile.id,
      },
    });

    const session = existingSession
      ? await prisma.recommendationSession.update({
          where: { id: existingSession.id },
          data: {
            ruleId: matchedRule.id,
            products: allProductIds,
            // ИСПРАВЛЕНО: updatedAt не существует в схеме RecommendationSession
          },
        })
      : await prisma.recommendationSession.create({
          data: {
            userId,
            profileId: profile.id,
            ruleId: matchedRule.id,
            products: allProductIds,
          },
        });

    return {
      sessionId: String(session.id), // ИСПРАВЛЕНО: Приводим к строке
      ruleId: matchedRule.id,
      products: allProductIds,
    };

  } catch (error) {
    logger.error('Error generating recommendations', { userId, profileId, error });
    return null;
  }
}

