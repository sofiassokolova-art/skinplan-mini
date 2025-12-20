// lib/recommendations-generator.ts
// ИСПРАВЛЕНО: Вынесенная логика генерации RecommendationSession
// Используется в /api/recommendations/build для идемпотентной генерации рекомендаций

import { prisma } from '@/lib/db';
import { logger } from './logger';
import { calculateSkinAxes, getDermatologistRecommendations } from './skin-analysis-engine';
import { buildRuleContext } from './rule-context';
import { normalizeSkinTypeForRules, normalizeSensitivityForRules } from './skin-type-normalizer';
import { getProductsForStep } from './product-selection';
import type { ProfileClassification } from './plan-generation-helpers';

export interface RecommendationGenerationResult {
  sessionId: string;
  ruleId: number | null;
  products: number[];
}

export interface RecommendationGenerationError {
  ok: false;
  reason: 'profile_not_found' | 'no_active_questionnaire' | 'no_matching_rule' | 'invalid_steps_json' | 'no_products_found' | 'unknown_error';
}

/**
 * ИСПРАВЛЕНО: Полная поддержка операторов условий для правил рекомендаций
 * Поддерживает: gte, lte, equals, not/neq, in, hasSome, hasEvery, contains, startsWith
 */
function matchCondition(condition: any, profileValue: any): boolean {
  // Если profileValue null/undefined и условие требует значение - не матчится
  if (profileValue === undefined || profileValue === null) {
    // Для числовых сравнений (gte/lte) null = не матчится
    if (typeof condition === 'object' && condition !== null && ('gte' in condition || 'lte' in condition || 'gt' in condition || 'lt' in condition)) {
      return false;
    }
    // Для equals/not null = не матчится (если явно не указано null)
    if (typeof condition === 'object' && condition !== null && ('equals' in condition || 'not' in condition || 'neq' in condition)) {
      return condition.equals === null || condition.not === null || condition.neq === null;
    }
    // Для остальных случаев - пропускаем проверку (может быть опциональное поле)
    return true;
  }

  // Массив условий = in (любое из значений)
  if (Array.isArray(condition)) {
    return condition.includes(profileValue);
  }

  // Объект условий = операторы
  if (typeof condition === 'object' && condition !== null) {
    // Числовые сравнения
    if ('gte' in condition) {
      const numValue = typeof profileValue === 'number' ? profileValue : parseFloat(profileValue);
      const numCondition = typeof condition.gte === 'number' ? condition.gte : parseFloat(condition.gte);
      if (isNaN(numValue) || isNaN(numCondition)) return false;
      return numValue >= numCondition;
    }
    if ('lte' in condition) {
      const numValue = typeof profileValue === 'number' ? profileValue : parseFloat(profileValue);
      const numCondition = typeof condition.lte === 'number' ? condition.lte : parseFloat(condition.lte);
      if (isNaN(numValue) || isNaN(numCondition)) return false;
      return numValue <= numCondition;
    }
    if ('gt' in condition) {
      const numValue = typeof profileValue === 'number' ? profileValue : parseFloat(profileValue);
      const numCondition = typeof condition.gt === 'number' ? condition.gt : parseFloat(condition.gt);
      if (isNaN(numValue) || isNaN(numCondition)) return false;
      return numValue > numCondition;
    }
    if ('lt' in condition) {
      const numValue = typeof profileValue === 'number' ? profileValue : parseFloat(profileValue);
      const numCondition = typeof condition.lt === 'number' ? condition.lt : parseFloat(condition.lt);
      if (isNaN(numValue) || isNaN(numCondition)) return false;
      return numValue < numCondition;
    }

    // Равенство
    if ('equals' in condition) {
      return profileValue === condition.equals;
    }

    // Неравенство
    if ('not' in condition || 'neq' in condition) {
      const notValue = condition.not !== undefined ? condition.not : condition.neq;
      return profileValue !== notValue;
    }

    // in (массив значений)
    if ('in' in condition && Array.isArray(condition.in)) {
      return condition.in.includes(profileValue);
    }

    // hasSome (хотя бы один элемент массива совпадает)
    if ('hasSome' in condition && Array.isArray(condition.hasSome)) {
      const profileArray = Array.isArray(profileValue) ? profileValue : [profileValue];
      return condition.hasSome.some((item: any) => profileArray.includes(item));
    }

    // hasEvery (все элементы массива присутствуют)
    if ('hasEvery' in condition && Array.isArray(condition.hasEvery)) {
      const profileArray = Array.isArray(profileValue) ? profileValue : [profileValue];
      return condition.hasEvery.every((item: any) => profileArray.includes(item));
    }

    // contains (строка содержит подстроку)
    if ('contains' in condition) {
      const strValue = String(profileValue).toLowerCase();
      const strCondition = String(condition.contains).toLowerCase();
      return strValue.includes(strCondition);
    }

    // startsWith (строка начинается с подстроки)
    if ('startsWith' in condition) {
      const strValue = String(profileValue).toLowerCase();
      const strCondition = String(condition.startsWith).toLowerCase();
      return strValue.startsWith(strCondition);
    }
  }

  // Простое сравнение (примитив)
  return condition === profileValue;
}

/**
 * Генерирует RecommendationSession для профиля
 * ИСПРАВЛЕНО: Идемпотентная функция - можно вызывать несколько раз
 */
export async function generateRecommendationsForProfile(
  userId: string,
  profileId: string
): Promise<RecommendationGenerationResult | RecommendationGenerationError> {
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
      return { ok: false, reason: 'profile_not_found' };
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
      return { ok: false, reason: 'no_active_questionnaire' };
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

    // ИСПРАВЛЕНО: Полная поддержка операторов условий (gte/lte/equals/not/hasEvery/in/contains)
    let matchedRule: any = null;
    for (const rule of rules) {
      const conditions = rule.conditionsJson as any;
      
      let matches = true;
      for (const [key, condition] of Object.entries(conditions)) {
        const profileValue = (ruleContext as any)[key];
        
        // ИСПРАВЛЕНО: Проверяем условие с поддержкой всех операторов
        if (!matchCondition(condition, profileValue)) {
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
      return { ok: false, reason: 'no_matching_rule' };
    }

    // Получаем продукты для каждого шага правила
    const stepsJson = matchedRule.stepsJson as any;
    const allProductIds: number[] = [];

    // ИСПРАВЛЕНО: budgetSegment не в RuleContext, получаем из профиля или используем null
    const budgetSegment = (profile as any).budgetSegment || null;

    // ИСПРАВЛЕНО: Строим ProfileClassification для unified-product-filter
    const profileClassification: ProfileClassification = {
      skinType: profile.skinType || 'normal',
      concerns: (profile as any).concerns || [],
      diagnoses: (profile as any).diagnoses || [],
      pregnant: profile.hasPregnancy || false,
      mainGoals: (profile as any).mainGoals || [],
      secondaryGoals: (profile as any).secondaryGoals || [],
      sensitivityLevel: profile.sensitivityLevel || 'low',
      budget: budgetSegment || 'средний',
      exclude: (profile as any).exclude || [],
      allergies: (profile as any).allergies || [],
      ageGroup: profile.ageGroup || null,
    };

    // ИСПРАВЛЕНО: stepsJson в БД обычно объект { stepName: RuleStep }, но поддерживаем и массив для обратной совместимости
    if (Array.isArray(stepsJson)) {
      for (const step of stepsJson) {
        const products = await getProductsForStep(step, budgetSegment, profileClassification);
        allProductIds.push(...products.map((p: any) => p.id));
      }
    } else if (stepsJson && typeof stepsJson === 'object') {
      for (const stepConfig of Object.values(stepsJson)) {
        const products = await getProductsForStep(stepConfig as any, budgetSegment, profileClassification);
        allProductIds.push(...products.map((p: any) => p.id));
      }
    } else {
      logger.warn('Matched rule has invalid stepsJson, cannot select products', {
        userId,
        profileId,
        ruleId: matchedRule.id,
        stepsJsonType: typeof stepsJson,
      });
      return { ok: false, reason: 'invalid_steps_json' } as any;
    }

    // ИСПРАВЛЕНО: Убираем дубли продуктов и стабилизируем порядок
    const uniqueProductIds = Array.from(new Set(allProductIds));
    // Стабилизируем сортировку по ID для предсказуемости
    const sortedProductIds = uniqueProductIds.sort((a, b) => a - b);

    // ИСПРАВЛЕНО: Создаем или обновляем RecommendationSession
    // ВАЖНО: Для избежания гонок рекомендуется добавить @@unique([userId, profileId]) в схему Prisma
    // и использовать upsert с userId_profileId. Пока используем findFirst + create/update
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
            products: sortedProductIds, // ИСПРАВЛЕНО: Используем отсортированные уникальные ID
          },
        })
      : await prisma.recommendationSession.create({
          data: {
            userId,
            profileId: profile.id,
            ruleId: matchedRule.id,
            products: sortedProductIds, // ИСПРАВЛЕНО: Используем отсортированные уникальные ID
          },
        });

    // ИСПРАВЛЕНО: Проверяем, что есть продукты
    if (sortedProductIds.length === 0) {
      logger.warn('No products found for matched rule', { userId, profileId, ruleId: matchedRule.id });
      return { ok: false, reason: 'no_products_found' };
    }

    return {
      sessionId: String(session.id), // ИСПРАВЛЕНО: Приводим к строке
      ruleId: matchedRule.id,
      products: sortedProductIds, // ИСПРАВЛЕНО: Используем отсортированные уникальные ID
    };

  } catch (error) {
    logger.error('Error generating recommendations', { userId, profileId, error });
    return { ok: false, reason: 'unknown_error' };
  }
}

