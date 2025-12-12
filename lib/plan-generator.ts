// lib/plan-generator.ts
// Генерация 28-дневного плана ухода за кожей

import { prisma } from '@/lib/db';
import { calculateSkinAxes, getDermatologistRecommendations, type QuestionnaireAnswers } from '@/lib/skin-analysis-engine';
import { calculateSkinIssues } from '@/app/api/analysis/route';
import { isStepAllowedForProfile, type StepCategory } from '@/lib/step-category-rules';
import { selectCarePlanTemplate, type CarePlanProfileInput } from '@/lib/care-plan-templates';
import type { Plan28, DayPlan, DayStep } from '@/lib/plan-types';
import { getPhaseForDay, isWeeklyFocusDay } from '@/lib/plan-types';
import { logger } from '@/lib/logger';
import { PLAN_WEEKS_TOTAL, PLAN_DAYS_PER_WEEK } from '@/lib/constants';
import { getBaseStepFromStepCategory, isCleanserStep, isSPFStep } from '@/lib/plan-helpers';
import { 
  ensureRequiredProducts, 
  findFallbackProduct, 
  type ProductWithBrand
} from '@/lib/product-fallback';
import type { ProfileClassification } from '@/lib/plan-generation-helpers';
import {
  determineProtocol,
  type DermatologyProtocol,
} from '@/lib/dermatology-protocols';
import {
  filterProductsWithDermatologyLogic,
  generateProductJustification,
  generateProductWarnings,
  type ProductSelectionContext,
} from '@/lib/dermatology-product-filter';

export interface PlanDay {
  day: number;
  week: number;
  morning: string[];
  evening: string[];
  products: Record<string, {
    id: number;
    name: string;
    brand: string;
    step: string;
  }>;
  completed: boolean;
}

export interface PlanWeek {
  week: number;
  days: PlanDay[];
  summary: {
    focus: string[];
    productsCount: number;
  };
}

export interface GeneratedPlan {
  profile: {
    skinType: string;
    sensitivityLevel?: string | null;
    acneLevel?: number | null;
    primaryFocus: string;
    concerns: string[];
    ageGroup: string;
  };
  skinScores?: Array<{
    axis: string;
    value: number;
    level: string;
    title: string;
    description: string;
    color: string;
  }>;
  dermatologistRecommendations?: {
    heroActives: string[];
    mustHave: any[];
    avoid: string[];
  };
  weeks: PlanWeek[];
  infographic: {
    progress: Array<{
      week: number;
      acne: number;
      pores: number;
      hydration: number;
      pigmentation: number;
      wrinkles: number;
      inflammation?: number;
      photoaging?: number;
      oiliness?: number;
    }>;
    chartConfig: {
      type: string;
      data: any;
      options: any;
    };
  };
  products: Array<{
    id: number;
    name: string;
    brand: string;
    category: string;
    price: number;
    available: string;
    imageUrl?: string;
    ingredients?: string[];
  }>;
  warnings?: string[];
  plan28?: Plan28;
}

// Вспомогательная функция: определение бюджетного сегмента
function getBudgetTier(price: number | null | undefined): 'бюджетный' | 'средний' | 'премиум' {
  if (!price || price < 2000) return 'бюджетный';
  if (price < 5000) return 'средний';
  return 'премиум';
}

// Вспомогательная функция: проверка, содержит ли продукт исключенные ингредиенты
function containsExcludedIngredients(
  productIngredients: string[] | null | undefined,
  excludedIngredients: string[]
): boolean {
  if (!productIngredients || productIngredients.length === 0) return false;
  if (!excludedIngredients || excludedIngredients.length === 0) return false;
  
  const productIngredientsLower = productIngredients.map(ing => ing.toLowerCase());
  const excludedLower = excludedIngredients.map(ex => ex.toLowerCase());
  
  return excludedLower.some(excluded => 
    productIngredientsLower.some(ing => ing.includes(excluded) || excluded.includes(ing))
  );
}

const CLEANER_FALLBACK_STEP: StepCategory = 'cleanser_gentle';
const SPF_FALLBACK_STEP: StepCategory = 'spf_50_face';

const dedupeSteps = (steps: StepCategory[]): StepCategory[] => {
  const seen = new Set<StepCategory>();
  return steps.filter((step) => {
    if (seen.has(step)) return false;
    seen.add(step);
    return true;
  });
};

function ensureStepPresence(
  steps: StepCategory[],
  predicate: (step: StepCategory) => boolean,
  fallback: StepCategory
): StepCategory[] {
  if (steps.some(predicate)) return steps;
  if (isSPFStep(fallback)) {
    return [...steps, fallback];
  }
  if (isCleanserStep(fallback)) {
    return [fallback, ...steps];
  }
  return [fallback, ...steps];
}

function getFallbackStep(step: string): StepCategory | undefined {
  if (step.startsWith('cleanser')) return 'cleanser_gentle';
  if (step.startsWith('toner')) return 'toner_hydrating';
  if (step.startsWith('serum')) return 'serum_hydrating';
  if (step.startsWith('treatment')) return 'treatment_antiage';
  if (step.startsWith('moisturizer')) return 'moisturizer_light';
  if (step.startsWith('spf') || step === 'spf') return 'spf_50_face';
  return undefined;
}

/**
 * Генерирует 28-дневный план на основе профиля и ответов анкеты
 */
export async function generate28DayPlan(userId: string): Promise<GeneratedPlan> {
  logger.info('🚀 Starting plan generation', { userId, timestamp: new Date().toISOString() });
  
  try {
    // Получаем профиль кожи
    logger.debug('🔍 Looking for skin profile', { userId });
    // ВАЖНО: Используем orderBy по version DESC, чтобы получить последнюю версию
    // При перепрохождении анкеты создается новая версия профиля, и план должен быть для новой версии
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' }, // Используем version вместо createdAt для корректной версии
    });

    if (!profile) {
      logger.error('❌ No skin profile found', undefined, { userId });
      throw new Error('No skin profile found');
    }
    
    logger.info('✅ Skin profile found', {
      profileId: profile.id,
      skinType: profile.skinType,
      version: profile.version,
      userId,
    });

    // Получаем активную анкету для определения questionnaireId
    logger.debug('🔍 Looking for active questionnaire', { userId });
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    if (!activeQuestionnaire) {
      logger.error('❌ No active questionnaire found', { userId });
      throw new Error('No active questionnaire found');
    }

    logger.info('✅ Active questionnaire found', {
      questionnaireId: activeQuestionnaire.id,
      userId,
    });

    // Получаем ответы пользователя для активной анкеты
    logger.debug('🔍 Fetching user answers', { userId, questionnaireId: activeQuestionnaire.id });
    const userAnswers = await prisma.userAnswer.findMany({
      where: {
        userId,
        questionnaireId: activeQuestionnaire.id, // Используем активную анкету
      },
    include: {
      question: {
        include: {
          answerOptions: true,
        },
      },
    },
    });

    logger.info('✅ User answers fetched', {
      userId,
      answersCount: userAnswers.length,
      questionnaireId: activeQuestionnaire.id,
    });

    if (userAnswers.length === 0) {
      logger.error('❌ No user answers found', { userId, questionnaireId: activeQuestionnaire.id });
      throw new Error(`No user answers found for questionnaire ${activeQuestionnaire.id}`);
    }

    // Парсим ответы в удобный формат
    logger.debug('📝 Parsing user answers', { userId, answersCount: userAnswers.length });
    const answers: Record<string, any> = {};
    userAnswers.forEach((answer) => {
    const code = answer.question.code;
    if (answer.answerValue) {
      answers[code] = answer.answerValue;
    } else if (answer.answerValues) {
      answers[code] = JSON.parse(JSON.stringify(answer.answerValues));
    }
  });

  // Дерматологический анализ - рассчитываем 6 осей кожи
  const questionnaireAnswers: QuestionnaireAnswers = {
    skinType: profile.skinType || 'normal',
    age: profile.ageGroup || answers.age || '25-34',
    concerns: Array.isArray(answers.skin_concerns) ? answers.skin_concerns : [],
    diagnoses: Array.isArray(answers.diagnoses) ? answers.diagnoses : [],
    allergies: Array.isArray(answers.allergies) ? answers.allergies : [],
    seasonChange: answers.season_change || answers.seasonChange,
    habits: Array.isArray(answers.habits) ? answers.habits : [],
    retinolReaction: answers.retinol_reaction || answers.retinolReaction,
    pregnant: profile.hasPregnancy || false,
    spfFrequency: answers.spf_frequency || answers.spfFrequency,
    sunExposure: answers.sun_exposure || answers.sunExposure,
    sensitivityLevel: profile.sensitivityLevel || 'low',
    acneLevel: profile.acneLevel || 0,
    ...answers, // дополнительные поля
  };
  
  const skinScores = calculateSkinAxes(questionnaireAnswers);
  const dermatologistRecs = getDermatologistRecommendations(skinScores, questionnaireAnswers);
  
  // Вычисляем проблемы кожи для синхронизации ключевых проблем с /analysis
  const issues = calculateSkinIssues(profile, userAnswers, skinScores);
  const keyProblems = issues
    .filter((i: any) => i.severity_label === 'критично' || i.severity_label === 'плохо')
    .map((i: any) => i.name);
  
  logger.debug('Skin analysis scores', { 
    scores: skinScores.map(s => ({ title: s.title, value: s.value, level: s.level })),
    keyProblems,
    userId 
  });

  // Шаг 1: Классификация профиля (улучшенная логика)
  const goals = Array.isArray(answers.skin_goals) ? answers.skin_goals : [];
  const concerns = Array.isArray(answers.skin_concerns) ? answers.skin_concerns : [];
  
  const medicalMarkers = (profile.medicalMarkers as Record<string, any> | null) || {};
  // Создаем минимальный SkinProfile для проверки шагов
  const { createEmptySkinProfile } = await import('@/lib/skinprofile-types');
  const { normalizeSkinTypeForRules, normalizeSensitivityForRules } = await import('@/lib/skin-type-normalizer');
  
  // ИСПРАВЛЕНО: Нормализуем тип кожи и чувствительность для совместимости с правилами
  // Правила используют "combination_dry" и "combination_oily", но в БД используется "combo"
  const normalizedSkinType = normalizeSkinTypeForRules(profile.skinType, {
    userId: userId as string,
    // Можно добавить oiliness и dehydration из medicalMarkers, если доступны
  });
  const normalizedSensitivity = normalizeSensitivityForRules(profile.sensitivityLevel);
  
  const stepProfile: import('@/lib/skinprofile-types').SkinProfile = {
    ...createEmptySkinProfile(),
    skinType: normalizedSkinType as any,
    sensitivity: normalizedSensitivity as any,
    diagnoses: Array.isArray(medicalMarkers.diagnoses) ? medicalMarkers.diagnoses : [],
    contraindications: Array.isArray(medicalMarkers.contraindications)
      ? medicalMarkers.contraindications
      : [],
    mainGoals: Array.isArray(medicalMarkers.mainGoals) ? medicalMarkers.mainGoals : [],
  };

  const profileClassification: ProfileClassification = {
    focus: goals.filter((g: string) => 
      ['Акне и высыпания', 'Сократить видимость пор', 'Выровнять пигментацию', 'Морщины и мелкие линии'].includes(g)
    )[0] || 'general', // Берем первую цель как основной фокус
    skinType: profile.skinType || 'normal',
    concerns: concerns,
    diagnoses: Array.isArray(answers.diagnoses) ? answers.diagnoses : [],
    ageGroup: profile.ageGroup || '25-34',
    exclude: Array.isArray(answers.exclude_ingredients) ? answers.exclude_ingredients : [],
    budget: answers.budget || 'средний',
    pregnant: profile.hasPregnancy || false,
    stepsPreference: answers.care_steps || 'средний',
    allergies: Array.isArray(answers.allergies) ? answers.allergies : [],
    sensitivityLevel: profile.sensitivityLevel || 'medium',
  };

  // Определяем основной фокус (приоритет по частоте упоминаний)
  let primaryFocus = 'general';
  if (goals.includes('Акне и высыпания') || concerns.includes('Акне')) {
    primaryFocus = 'acne';
  } else if (goals.includes('Сократить видимость пор') || concerns.includes('Расширенные поры')) {
    primaryFocus = 'pores';
  } else if (concerns.includes('Сухость')) {
    primaryFocus = 'dryness';
  } else if (goals.includes('Выровнять пигментацию') || concerns.includes('Пигментация')) {
    primaryFocus = 'pigmentation';
  } else if (goals.includes('Морщины и мелкие линии') || concerns.includes('Морщины')) {
    primaryFocus = 'wrinkles';
  }

  // Маппим цели в mainGoals для CarePlanTemplate
  // ВАЖНО: Используем keyProblems (вычисленные из ответов) вместо fallback значений
  const mainGoals: string[] = [];
  
  // Маппим keyProblems в mainGoals
  for (const problem of keyProblems) {
    const problemLower = problem.toLowerCase();
    if (problemLower.includes('акне') || problemLower.includes('acne') || problemLower.includes('высыпания')) {
      if (!mainGoals.includes('acne')) mainGoals.push('acne');
    }
    if (problemLower.includes('пигментация') || problemLower.includes('pigmentation') || problemLower.includes('пятна')) {
      if (!mainGoals.includes('pigmentation')) mainGoals.push('pigmentation');
    }
    if (problemLower.includes('морщин') || problemLower.includes('wrinkle') || problemLower.includes('старение') || problemLower.includes('age')) {
      if (!mainGoals.includes('antiage')) mainGoals.push('antiage');
    }
    if (problemLower.includes('барьер') || problemLower.includes('barrier') || problemLower.includes('чувствительность') || problemLower.includes('sensitivity')) {
      if (!mainGoals.includes('barrier')) mainGoals.push('barrier');
    }
    if (problemLower.includes('обезвоженность') || problemLower.includes('dehydration') || problemLower.includes('сухость') || problemLower.includes('dryness')) {
      if (!mainGoals.includes('dehydration')) mainGoals.push('dehydration');
    }
  }
  
  // Если keyProblems пустые, используем fallback на основе primaryFocus и concerns
  if (mainGoals.length === 0) {
    if (primaryFocus === 'acne') mainGoals.push('acne');
    if (primaryFocus === 'pigmentation') mainGoals.push('pigmentation');
    if (primaryFocus === 'wrinkles') mainGoals.push('antiage');
    if (concerns.includes('Барьер') || concerns.includes('Чувствительность')) {
      mainGoals.push('barrier');
    }
    if (concerns.includes('Обезвоженность') || concerns.includes('Сухость')) {
      mainGoals.push('dehydration');
    }
  }
  
  logger.info('Main goals determined', {
    userId,
    keyProblems,
    primaryFocus,
    mainGoals,
    concerns,
  });

  // Определяем сложность рутины для CarePlanTemplate
  let routineComplexity: CarePlanProfileInput['routineComplexity'] = 'medium';
  if (typeof profileClassification.stepsPreference === 'string') {
    if (profileClassification.stepsPreference.toLowerCase().includes('миним')) {
      routineComplexity = 'minimal';
    } else if (profileClassification.stepsPreference.toLowerCase().includes('максим')) {
      routineComplexity = 'maximal';
    }
  }

  const carePlanProfileInput: CarePlanProfileInput = {
    skinType: profile.skinType || 'normal',
    mainGoals: mainGoals.length > 0 ? mainGoals : ['general'],
    sensitivityLevel: profile.sensitivityLevel || 'low',
    routineComplexity,
  };

  const carePlanTemplate = selectCarePlanTemplate(carePlanProfileInput);
  
  // ВАЖНО: Заменяем treatment_antiage на подходящий treatment, если у пользователя нет проблем с морщинами
  const hasWrinklesGoal = mainGoals.includes('wrinkles') || mainGoals.some(g => g.toLowerCase().includes('wrinkle'));
  
  const adjustTemplateSteps = (steps: StepCategory[]): StepCategory[] => {
    return steps.flatMap((step) => {
      // Если это treatment_antiage, но нет проблем с морщинами - заменяем на подходящее лечение
      if (step === 'treatment_antiage' && !hasWrinklesGoal) {
        // Ищем другие проблемы, для которых нужны treatments
        if (mainGoals.includes('acne')) {
          return ['treatment_acne_azelaic'];
        } else if (mainGoals.includes('pigmentation')) {
          return ['treatment_pigmentation'];
        } else if (mainGoals.includes('pores') || mainGoals.includes('oiliness')) {
          return ['treatment_exfoliant_mild'];
        } else {
          // Если нет специфических проблем - просто убираем treatment
          return [];
        }
      }
      return [step];
    });
  };
  
  const adjustedMorning = adjustTemplateSteps(carePlanTemplate.morning);
  const adjustedEvening = adjustTemplateSteps(carePlanTemplate.evening);
  const adjustedWeekly = carePlanTemplate.weekly ? adjustTemplateSteps(carePlanTemplate.weekly) : undefined;
  
  const requiredStepCategories = new Set<StepCategory>();
  adjustedMorning.forEach((step) => requiredStepCategories.add(step));
  adjustedEvening.forEach((step) => requiredStepCategories.add(step));
  adjustedWeekly?.forEach((step) => requiredStepCategories.add(step));
  
  // ИСПРАВЛЕНО: Детальное логирование выбора шаблона для диагностики
  logger.info('Selected care plan template', {
    templateId: carePlanTemplate.id,
    skinType: carePlanProfileInput.skinType,
    mainGoals: carePlanProfileInput.mainGoals,
    hasWrinklesGoal,
    sensitivityLevel: carePlanProfileInput.sensitivityLevel,
    routineComplexity: carePlanProfileInput.routineComplexity,
    originalMorning: carePlanTemplate.morning,
    adjustedMorning,
    originalEvening: carePlanTemplate.evening,
    adjustedEvening,
    requiredSteps: Array.from(requiredStepCategories),
    userId,
  });
  
  // КРИТИЧНО: Проверяем, что шаблон выбран правильно
  if (carePlanTemplate.id === 'default_balanced') {
    logger.warn('Using default_balanced template - may indicate no specific template matched', {
      userId,
      skinType: carePlanProfileInput.skinType,
      mainGoals: carePlanProfileInput.mainGoals,
      sensitivityLevel: carePlanProfileInput.sensitivityLevel,
      routineComplexity: carePlanProfileInput.routineComplexity,
  });
  }

  // Шаг 2: Фильтрация продуктов
  logger.debug('Filtering products', { primaryFocus, skinType: profileClassification.skinType, budget: profileClassification.budget, userId });
  
    // ВАЖНО: Сначала пытаемся получить продукты из RecommendationSession
    // Это гарантирует, что план использует те же продукты, что и главная страница
    // Ищем сессию для текущего профиля, чтобы при перепрохождении анкеты использовались новые продукты
    logger.info('🔍 Looking for RecommendationSession', { 
      userId, 
      profileId: profile.id,
      profileVersion: profile.version,
    });
    let recommendationProducts: any[] = [];
    
    // ИСПРАВЛЕНО: Ищем сессию сначала по profileId, потом по userId
    // Это гарантирует, что найдем сессию даже если profileId не совпадает
    let existingSession = await prisma.recommendationSession.findFirst({
      where: {
        userId,
        profileId: profile.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    logger.info('First search result', {
      userId,
      profileId: profile.id,
      found: !!existingSession,
      sessionId: existingSession?.id,
      productsCount: existingSession?.products ? (Array.isArray(existingSession.products) ? existingSession.products.length : 0) : 0,
    });
    
    // Дополнительно: если не нашли по profileId, ищем любую сессию с продуктами для пользователя
    if (!existingSession || !existingSession.products || !Array.isArray(existingSession.products) || existingSession.products.length === 0) {
      logger.info('No RecommendationSession found for current profileId, searching any session with products', { 
        userId, 
        profileId: profile.id,
        searchedProfileId: profile.id,
      });
      const anySession = await prisma.recommendationSession.findFirst({
        where: {
          userId,
          products: { not: { equals: [] } }, // Сессия с непустым массивом продуктов
        },
        orderBy: { createdAt: 'desc' },
      });
      
      logger.info('Second search result (any session)', {
        userId,
        found: !!anySession,
        sessionId: anySession?.id,
        sessionProfileId: anySession?.profileId,
        productsCount: anySession?.products ? (Array.isArray(anySession.products) ? anySession.products.length : 0) : 0,
      });
      
      if (anySession && anySession.products && Array.isArray(anySession.products) && anySession.products.length > 0) {
        logger.info('Found RecommendationSession from any profile (fallback)', {
          userId,
          sessionId: anySession.id,
          profileId: anySession.profileId,
          ruleId: anySession.ruleId,
          productsCount: anySession.products.length,
        });
        // Используем эту сессию как fallback
        const fallbackSession = anySession;
        const productIds = fallbackSession.products as number[];
        
        if (productIds.length > 0) {
          recommendationProducts = await prisma.product.findMany({
            where: {
              id: { in: productIds },
              published: true as any,
              brand: { isActive: true },
            } as any,
            include: { brand: true },
          });
          
          recommendationProducts.sort((a: any, b: any) => {
            if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
            return b.priority - a.priority;
          });
          
          logger.info('Using fallback RecommendationSession products', {
            userId,
            productsCount: recommendationProducts.length,
            productIds: productIds.slice(0, 10),
          });
        }
      }
    }

    if (existingSession && existingSession.products && Array.isArray(existingSession.products) && existingSession.products.length > 0) {
      logger.info('✅ RecommendationSession found', {
        userId,
        sessionId: existingSession.id,
        ruleId: existingSession.ruleId,
        profileId: existingSession.profileId,
        productsCount: existingSession.products.length,
        products: existingSession.products.slice(0, 10),
      });
    } else {
      // ИСПРАВЛЕНО: Детальное логирование для диагностики
      logger.warn('⚠️ No RecommendationSession found or empty', { 
        userId, 
        profileId: profile.id,
        profileVersion: profile.version,
        existingSessionId: existingSession?.id,
        existingSessionProductsCount: existingSession?.products ? (Array.isArray(existingSession.products) ? existingSession.products.length : 0) : 0,
      });
      
      // ИСПРАВЛЕНО: Если сессия найдена, но продуктов нет - не используем её
      if (existingSession && (!existingSession.products || !Array.isArray(existingSession.products) || existingSession.products.length === 0)) {
        logger.warn('⚠️ RecommendationSession found but has no products, will generate from scratch', {
          userId,
          sessionId: existingSession.id,
        });
      }
    }

  // ИСПРАВЛЕНО: Используем сессию даже если продуктов меньше MIN_PRODUCTS_IN_SESSION
  // Лучше использовать 1-2 продукта, чем генерировать план с нуля
  // Но логируем предупреждение для диагностики
  const { MIN_PRODUCTS_IN_SESSION } = await import('@/lib/constants');
  const minProductsInSession = MIN_PRODUCTS_IN_SESSION || 3;

  if (existingSession && existingSession.products && Array.isArray(existingSession.products)) {
    const productIds = existingSession.products as number[];
    
    // ИСПРАВЛЕНО: Используем сессию даже если продуктов меньше минимума
    // Логируем предупреждение, но продолжаем использовать продукты
    if (productIds.length < minProductsInSession) {
      logger.warn('RecommendationSession has fewer products than recommended, but using them anyway', {
        userId,
        sessionId: existingSession.id,
        productCount: productIds.length,
        minRecommended: minProductsInSession,
        ruleId: existingSession.ruleId,
      });
      
      // Если сессия была создана из плана (ruleId = null) И продуктов очень мало (0-1), удаляем её
      if (existingSession.ruleId === null && productIds.length <= 1) {
        logger.info('Deleting RecommendationSession created from plan (too few products: 0-1)', {
          userId,
          sessionId: existingSession.id,
        });
        await prisma.recommendationSession.delete({
          where: { id: existingSession.id },
        });
        // Продолжаем без этой сессии - будем генерировать с нуля
        logger.info('Deleted empty RecommendationSession, will generate plan from scratch', {
          userId,
        });
      } else {
        // Используем продукты, даже если их меньше минимума
        logger.info('Using RecommendationSession with fewer products than recommended', {
          userId,
          sessionId: existingSession.id,
          productCount: productIds.length,
        });
      }
    }
    
    // Используем продукты из сессии, если их больше 0
    if (productIds.length > 0) {
      logger.info('Using products from RecommendationSession for plan generation', { 
        userId,
        sessionId: existingSession.id,
        productIdsCount: productIds.length,
        productIds: productIds.slice(0, 10), // Первые 10 для логов
        ruleId: existingSession.ruleId,
      });
      
    recommendationProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        published: true as any,
        brand: {
          isActive: true, // Только активные бренды
        },
      } as any,
      include: { brand: true },
    });
      
      // Детальное логирование для диагностики
      logger.info('Products loaded from RecommendationSession', {
        userId,
        requestedIds: productIds.length,
        foundProducts: recommendationProducts.length,
        missingIds: productIds.filter(id => !recommendationProducts.find(p => p.id === id)).slice(0, 10),
        foundProductIds: recommendationProducts.map(p => p.id).slice(0, 10),
        productDetails: recommendationProducts.map(p => ({
          id: p.id,
          name: p.name,
          step: p.step,
          category: p.category,
          brandName: p.brand?.name,
          brandActive: p.brand?.isActive,
        })),
    });
    
    // Сортируем в памяти
    recommendationProducts.sort((a: any, b: any) => {
      if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
      return b.priority - a.priority;
    });
    logger.info('Products found from RecommendationSession', { count: recommendationProducts.length, userId });
    }
  }
  
  if (recommendationProducts.length === 0) {
    logger.info('No RecommendationSession with enough products found, will generate products from scratch', { userId });
  }
  
  // Если есть продукты из RecommendationSession, используем их
  // Иначе получаем все опубликованные продукты
  let allProducts: any[];
  if (recommendationProducts.length > 0) {
    logger.info('Using products from RecommendationSession', { userId });
    allProducts = recommendationProducts;
  } else {
    logger.info('No RecommendationSession products, fetching all published products', { userId });
    allProducts = await prisma.product.findMany({
      where: {
        published: true as any,
        brand: {
          isActive: true, // Только активные бренды
        },
      } as any,
      include: { brand: true },
    });
    
    // Сортируем в памяти
    allProducts.sort((a: any, b: any) => {
      if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  // ВАЖНО: Если используем продукты из RecommendationSession, используем их ВСЕ без фильтрации
  // Это гарантирует синхронизацию с главной страницей
  // Продукты из RecommendationSession уже прошли все проверки и фильтрацию
  let filteredProducts: any[];
  
  if (recommendationProducts.length > 0) {
    // Используем все продукты из RecommendationSession - они уже отфильтрованы и синхронизированы с главной
    filteredProducts = recommendationProducts;
    logger.info('Using all products from RecommendationSession (no additional filtering)', {
      count: filteredProducts.length,
      userId
    });
  } else {
    // Если нет RecommendationSession, фильтруем продукты по критериям
    logger.info('No RecommendationSession - filtering products from scratch', { userId });
    filteredProducts = allProducts.filter((product: any) => {
      const productPrice = (product as any).price as number | null | undefined;
      const productSkinTypes: string[] = product.skinTypes || [];
      const productConcerns: string[] = product.concerns || [];
      const productAvoidIf: string[] = product.avoidIf || [];

      // SPF универсален для всех типов кожи - пропускаем проверку типа кожи
      const isSPF = product.step === 'spf' || product.category === 'spf';
      
      // Проверка типа кожи (кроме SPF)
      const skinTypeMatches =
        isSPF ||
        productSkinTypes.length === 0 ||
        (profileClassification.skinType && productSkinTypes.includes(profileClassification.skinType));

      // Проверка бюджета (если указан)
      const budgetMatches =
        !profileClassification.budget ||
        profileClassification.budget === 'любой' ||
        !productPrice ||
        getBudgetTier(productPrice) === profileClassification.budget;

      // Проверка исключенных ингредиентов (по admin-полю concerns + ответу exclude_ingredients)
      const noExcludedIngredients = !containsExcludedIngredients(
        productConcerns,
        profileClassification.exclude || []
      );

      // Явные противопоказания из админки:
      // - avoidIf: ['pregnant', 'retinol_allergy', ...]
      // - беременность: profileClassification.pregnant (из профиля / ответов)
      const safeForPregnancy =
        !profileClassification.pregnant || !productAvoidIf.includes('pregnant');

      // Аллергия на ретинол / сильные кислоты:
      // если в ответах пользователь исключил ретинол, то избегаем продуктов с avoidIf 'retinol_allergy'
      const hasRetinolContraInAnswers = Array.isArray(profileClassification.exclude) && profileClassification.exclude.length > 0
        ? profileClassification.exclude.some((ex: string) =>
            ex.toLowerCase().includes('ретинол') || ex.toLowerCase().includes('retinol')
          )
        : false;
      const safeForRetinolAllergy =
        !hasRetinolContraInAnswers || !productAvoidIf.includes('retinol_allergy');

      return (
        skinTypeMatches &&
        budgetMatches &&
        noExcludedIngredients &&
        safeForPregnancy &&
        safeForRetinolAllergy
      );
    });
  }

  // Сортируем продукты по релевантности (приоритет основному фокусу, затем isHero и priority)
  const sortedProducts = filteredProducts.sort((a, b) => {
    // 1. Соответствие основному фокусу
    const aMatchesFocus = a.concerns?.includes(primaryFocus) ? 1 : 0;
    const bMatchesFocus = b.concerns?.includes(primaryFocus) ? 1 : 0;
    if (bMatchesFocus !== aMatchesFocus) return bMatchesFocus - aMatchesFocus;
    
    // 2. Hero продукты
    const aIsHero = (a as any).isHero ? 1 : 0;
    const bIsHero = (b as any).isHero ? 1 : 0;
    if (bIsHero !== aIsHero) return bIsHero - aIsHero;
    
    // 3. Приоритет
    const aPriority = (a as any).priority || 0;
    const bPriority = (b as any).priority || 0;
    return bPriority - aPriority;
  });

  // ВАЖНО: Если используем продукты из RecommendationSession, используем их ВСЕ без ограничений
  // Это гарантирует, что план будет содержать те же продукты, что и главная страница
  // Иначе ограничиваем количество продуктов (3 утро + 3 вечер = максимум 6)
  let selectedProducts: any[];
  
  if (recommendationProducts.length > 0) {
    // Используем ВСЕ продукты из RecommendationSession - не ограничиваем количество
    selectedProducts = sortedProducts;
    logger.info('Using ALL products from RecommendationSession for plan (no limit)', {
      count: selectedProducts.length,
      userId
    });
  } else {
    // Ограничиваем только если генерируем с нуля
    selectedProducts = sortedProducts.slice(0, 6);
    logger.info('Limited products count (generating from scratch)', {
      count: selectedProducts.length,
      userId
    });
  }
  
  // Автозамена продуктов с неактивными брендами
  // Проверяем, перепроходил ли пользователь анкету (если нет - не заменяем)
  // Используем updatedAt вместо createdAt, так как при повторном прохождении профиль обновляется, а не создается заново
  const latestProfile = await prisma.skinProfile.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
  
  // Проверяем, был ли профиль обновлен недавно - это означает, что пользователь недавно проходил анкету
  const { PROFILE_UPDATE_THRESHOLD_DAYS } = await import('@/lib/constants');
  const hasRecentProfileUpdate = latestProfile && 
    new Date().getTime() - new Date(latestProfile.updatedAt).getTime() < PROFILE_UPDATE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  
  if (hasRecentProfileUpdate) {
    // Пользователь недавно проходил анкету - делаем автозамену продуктов с неактивными брендами
    const replacedProducts = await Promise.all(
      selectedProducts.map(async (product: any) => {
        // Проверяем, активен ли бренд
        const productBrand = (product as any).brand;
        if (productBrand && !productBrand.isActive) {
          logger.warn('Product has inactive brand, searching for replacement', { productId: product.id, productName: product.name, brandName: productBrand.name, userId });
          
          // Ищем похожий продукт с активным брендом
          const replacementCandidates = await prisma.product.findMany({
            where: {
              published: true as any,
              step: product.step,
              id: { not: product.id },
              brand: {
                isActive: true,
              },
              // Похожие критерии
              ...(product.skinTypes && product.skinTypes.length > 0 ? {
                skinTypes: { hasSome: product.skinTypes },
              } : {}),
              ...(product.concerns && product.concerns.length > 0 ? {
                concerns: { hasSome: product.concerns },
              } : {}),
            } as any,
            include: { brand: true },
            take: 10,
          });
          
          // Сортируем в памяти по приоритету
          replacementCandidates.sort((a: any, b: any) => {
            if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
            if (a.priority !== b.priority) return b.priority - a.priority;
            return b.createdAt.getTime() - a.createdAt.getTime();
          });
          
          if (replacementCandidates.length > 0) {
            const replacement = replacementCandidates[0];
            logger.info('Product replaced', { oldProduct: product.name, newProduct: replacement.name, userId });
            return replacement;
          } else {
            // Если не нашли похожий, ищем любой продукт того же шага
            const anyReplacementCandidates = await prisma.product.findMany({
              where: {
                published: true as any,
                step: product.step,
                id: { not: product.id },
                brand: {
                  isActive: true,
                },
              } as any,
              include: { brand: true },
              take: 10,
            });
            
            // Сортируем в памяти
            anyReplacementCandidates.sort((a: any, b: any) => {
              if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
              if (a.priority !== b.priority) return b.priority - a.priority;
              return b.createdAt.getTime() - a.createdAt.getTime();
            });
            
            if (anyReplacementCandidates.length > 0) {
              const anyReplacement = anyReplacementCandidates[0];
              logger.info('Product replaced with any available', { oldProduct: product.name, newProduct: anyReplacement.name, userId });
              return anyReplacement;
            }
          }
        }
        return product;
      })
    );
    
    selectedProducts = replacedProducts;
  } else {
    // Пользователь не перепроходил анкету - оставляем продукты как есть
    logger.info('User has not retaken questionnaire recently, keeping existing products even if brand is inactive', { userId });
  }
  
  logger.info('Products selected', { 
    count: selectedProducts.length, 
    source: recommendationProducts.length > 0 ? 'recommendationSession' : 'filtering',
    userId,
    productIds: selectedProducts.map((p: any) => ({ id: p.id, name: p.name, step: p.step, category: p.category })).slice(0, 10),
  });

  // Группируем продукты по шагам (используем Map для лучшей типизации)
  const productsByStepMap = new Map<StepCategory, ProductWithBrand[]>();

  const registerProductForStep = (
    stepKey: StepCategory | string,
    product: ProductWithBrand
  ) => {
    const category = stepKey as StepCategory;
    const existing = productsByStepMap.get(category) || [];
    if (!existing.some(p => p.id === product.id)) {
      productsByStepMap.set(category, [...existing, product]);
      // Логируем для диагностики (особенно для пользователя 643160759)
      if (userId === '643160759' || process.env.NODE_ENV === 'development') {
        logger.info('Product registered for step', {
          productId: product.id,
          productName: product.name,
          step: category,
          userId,
        });
      }
    }
  };

  // Функция для преобразования старого формата step/category в StepCategory
  const mapStepToStepCategory = (step: string | null | undefined, category: string | null | undefined): StepCategory[] => {
    const stepStr = (step || category || '').toLowerCase();
    const categoryStr = (category || '').toLowerCase();
    const categories: StepCategory[] = [];
    
    // Маппинг старого формата в StepCategory
    // Проверяем и step, и category для более точного маппинга
    if (stepStr === 'cleanser_oil' || categoryStr.includes('oil') || stepStr.includes('oil')) {
      categories.push('cleanser_oil');
      // Также ищем по ключевым словам: гидрофильное, масло, oil, double cleans
      categories.push('cleanser_gentle'); // Базовый поиск для совместимости
    } else if (stepStr.startsWith('cleanser_gentle') || categoryStr.includes('gentle')) {
      categories.push('cleanser_gentle');
    } else if (stepStr.startsWith('cleanser_balancing') || stepStr.includes('balancing') || categoryStr.includes('balancing')) {
      categories.push('cleanser_balancing');
    } else if (stepStr.startsWith('cleanser_deep') || stepStr.includes('deep') || categoryStr.includes('deep')) {
      categories.push('cleanser_deep');
    } else if (stepStr.startsWith('cleanser') || categoryStr === 'cleanser' || stepStr === 'cleanser') {
      // Если просто 'cleanser' без уточнения, пробуем все варианты для максимальной совместимости
      categories.push('cleanser_gentle');
      categories.push('cleanser_balancing');
      categories.push('cleanser_deep');
    }
    
    if (stepStr.startsWith('toner_hydrating') || categoryStr.includes('hydrating')) {
      categories.push('toner_hydrating');
    } else if (stepStr.startsWith('toner_soothing') || stepStr.includes('soothing') || categoryStr.includes('soothing')) {
      categories.push('toner_soothing');
    } else if (stepStr === 'toner' || categoryStr === 'toner') {
      // Если просто 'toner' без уточнения, пробуем оба варианта
      categories.push('toner_hydrating');
      categories.push('toner_soothing');
    }
    
    if (stepStr.startsWith('serum_hydrating') || categoryStr.includes('hydrating')) {
      categories.push('serum_hydrating');
    } else if (stepStr.startsWith('serum_niacinamide') || stepStr.includes('niacinamide') || categoryStr.includes('niacinamide')) {
      categories.push('serum_niacinamide');
    } else if (stepStr.startsWith('serum_vitc') || stepStr.includes('vitamin c') || stepStr.includes('vitc') || categoryStr.includes('vitamin c')) {
      categories.push('serum_vitc');
    } else if (stepStr.startsWith('serum_anti_redness') || stepStr.includes('anti-redness') || categoryStr.includes('anti-redness')) {
      categories.push('serum_anti_redness');
    } else if (stepStr.startsWith('serum_brightening') || stepStr.includes('brightening') || categoryStr.includes('brightening')) {
      categories.push('serum_brightening_soft');
    } else if (stepStr === 'serum' || categoryStr === 'serum') {
      // Если просто 'serum' без уточнения, пробуем основные варианты
      categories.push('serum_hydrating');
      categories.push('serum_niacinamide');
    }
    
    if (stepStr.startsWith('treatment_acne_bpo') || stepStr.includes('benzoyl peroxide')) {
      categories.push('treatment_acne_bpo');
    } else if (stepStr.startsWith('treatment_acne_azelaic') || stepStr.includes('azelaic')) {
      categories.push('treatment_acne_azelaic');
    } else if (stepStr.startsWith('treatment_acne_local') || stepStr.includes('spot treatment')) {
      categories.push('treatment_acne_local');
    } else if (stepStr.startsWith('treatment_exfoliant_mild') || (stepStr.includes('exfoliant') && !stepStr.includes('strong'))) {
      categories.push('treatment_exfoliant_mild');
    } else if (stepStr.startsWith('treatment_exfoliant_strong') || stepStr.includes('strong exfoliant')) {
      categories.push('treatment_exfoliant_strong');
    } else if (stepStr.startsWith('treatment_pigmentation') || stepStr.includes('pigmentation')) {
      categories.push('treatment_pigmentation');
    } else if (stepStr.startsWith('treatment_antiage') || stepStr.includes('antiage') || stepStr.includes('anti-age')) {
      categories.push('treatment_antiage');
    } else if (stepStr.startsWith('spot_treatment') || stepStr.includes('spot treatment')) {
      categories.push('spot_treatment');
    } else if (stepStr === 'treatment' || categoryStr === 'treatment') {
      // Если просто 'treatment' без уточнения, НЕ добавляем fallback
      // Это позволяет использовать более специфичные фильтры (concerns, activeIngredients)
      // Fallback будет добавлен через ensureRequiredProducts, если ничего не найдено
      // Не добавляем ничего, чтобы не засорять выборку неспецифичными продуктами
    }
    
    if (stepStr.startsWith('moisturizer_light') || categoryStr.includes('light')) {
      categories.push('moisturizer_light');
    } else if (stepStr.startsWith('moisturizer_balancing') || stepStr.includes('balancing') || categoryStr.includes('balancing')) {
      categories.push('moisturizer_balancing');
    } else if (stepStr.startsWith('moisturizer_barrier') || stepStr.includes('barrier') || categoryStr.includes('barrier')) {
      categories.push('moisturizer_barrier');
    } else if (stepStr.startsWith('moisturizer_soothing') || stepStr.includes('soothing') || categoryStr.includes('soothing')) {
      categories.push('moisturizer_soothing');
    } else if (stepStr === 'moisturizer' || stepStr === 'cream' || categoryStr === 'moisturizer' || categoryStr === 'cream') {
      // Если просто 'moisturizer' или 'cream' без уточнения, пробуем основные варианты
      categories.push('moisturizer_light');
      categories.push('moisturizer_balancing');
    }
    
    if (stepStr.startsWith('spf_50_face') || stepStr === 'spf' || category === 'spf') {
      categories.push('spf_50_face');
    } else if (stepStr.startsWith('spf_50_oily') || stepStr.includes('oily')) {
      categories.push('spf_50_oily');
    } else if (stepStr.startsWith('spf_50_sensitive') || stepStr.includes('sensitive')) {
      categories.push('spf_50_sensitive');
    }
    
    // Маски
    if (stepStr.startsWith('mask_clay') || stepStr.includes('clay')) {
      categories.push('mask_clay');
    } else if (stepStr.startsWith('mask_hydrating') || stepStr.includes('hydrating')) {
      categories.push('mask_hydrating');
    } else if (stepStr.startsWith('mask_soothing') || stepStr.includes('soothing')) {
      categories.push('mask_soothing');
    } else if (stepStr.startsWith('mask_sleeping') || stepStr.includes('sleeping')) {
      categories.push('mask_sleeping');
    } else if (stepStr === 'mask' || categoryStr === 'mask') {
      // Если просто 'mask' без уточнения, пробуем все варианты
      categories.push('mask_clay', 'mask_hydrating', 'mask_soothing', 'mask_sleeping');
    }
    
    // ИСПРАВЛЕНО: Если ничего не найдено, добавляем жесткий fallback
    // Это критично важно - без этого продукты не попадают в productsByStepMap
    if (categories.length === 0) {
      // Жесткий fallback на основе базового шага
      const baseStep = stepStr || categoryStr || '';
      
      if (baseStep.includes('cleanser') || baseStep.includes('очищ')) {
        categories.push('cleanser_gentle');
      } else if (baseStep.includes('toner') || baseStep.includes('тоник')) {
        categories.push('toner_hydrating');
      } else if (baseStep.includes('serum') || baseStep.includes('сыворотк')) {
        categories.push('serum_hydrating');
      } else if (baseStep.includes('treatment') || baseStep.includes('лечени') || baseStep.includes('активн')) {
        categories.push('treatment_antiage');
      } else if (baseStep.includes('moisturizer') || baseStep.includes('cream') || baseStep.includes('крем') || baseStep.includes('увлажн')) {
        categories.push('moisturizer_light');
      } else if (baseStep.includes('spf') || baseStep.includes('sunscreen') || baseStep.includes('защит')) {
        categories.push('spf_50_face');
      } else if (baseStep.includes('mask') || baseStep.includes('маск')) {
        categories.push('mask_hydrating');
      }
      
      // Если все еще пусто, логируем предупреждение
      if (categories.length === 0) {
        logger.warn('mapStepToStepCategory: Could not map step/category to any StepCategory, using generic fallback', {
          step: stepStr,
          category: categoryStr,
          userId,
        });
        // Последний fallback - пробуем использовать как есть
        if (stepStr) {
          categories.push(stepStr as StepCategory);
        }
      } else {
        logger.info('mapStepToStepCategory: Used hard fallback for unmapped step', {
          step: stepStr,
          category: categoryStr,
          fallbackCategories: categories,
          userId,
        });
      }
    }
    
    return categories;
  };
  
  // Логируем начальное состояние selectedProducts для диагностики
  if (userId === '643160759' || process.env.NODE_ENV === 'development') {
    logger.info('Registering products in productsByStepMap', {
      userId,
      totalProducts: selectedProducts.length,
      sampleProducts: selectedProducts.slice(0, 5).map(p => ({
        id: p.id,
        name: p.name,
        step: p.step,
        category: p.category,
      })),
    });
  }
  
  selectedProducts.forEach((product) => {
    const productBrand = product.brand as any;
    const productWithBrand: ProductWithBrand = {
      id: product.id,
      name: product.name,
      brand: {
        id: productBrand.id,
        name: productBrand.name,
        isActive: productBrand.isActive,
      },
      step: product.step || '',
      category: product.category,
      price: product.price,
      imageUrl: product.imageUrl,
      isHero: product.isHero || false,
      priority: product.priority || 0,
      skinTypes: (product.skinTypes as string[]) || [],
      published: product.published || false,
      activeIngredients: (product.activeIngredients as string[]) || [],
    };
    
    // Преобразуем старый формат step/category в StepCategory
    const stepCategories = mapStepToStepCategory(product.step, product.category);
    
    // Детальное логирование для диагностики (особенно для пользователя 643160759)
    if (userId === '643160759' || process.env.NODE_ENV === 'development') {
      logger.info('Mapping product to StepCategory', {
        productId: product.id,
        productName: product.name,
        originalStep: product.step,
        originalCategory: product.category,
        mappedStepCategories: stepCategories,
        userId,
      });
    }
    
    // ИСПРАВЛЕНО: Всегда регистрируем продукт, даже если mapStepToStepCategory вернул пустой массив
    // Это критично важно - без этого продукты не попадают в план
    if (stepCategories.length > 0) {
      // Регистрируем продукт для всех подходящих StepCategory
      stepCategories.forEach(stepCategory => {
        registerProductForStep(stepCategory, productWithBrand);
        if (userId === '643160759' || process.env.NODE_ENV === 'development') {
          logger.info('Product registered for StepCategory', {
            productId: product.id,
            productName: product.name,
            stepCategory,
            userId,
          });
        }
      });
      
      // Также регистрируем по базовому шагу для обратной совместимости
      stepCategories.forEach(stepCategory => {
        const baseStep = getBaseStepFromStepCategory(stepCategory);
        if (baseStep !== stepCategory) {
          registerProductForStep(baseStep as StepCategory, productWithBrand);
          if (userId === '643160759' || process.env.NODE_ENV === 'development') {
            logger.info('Product also registered for base step', {
              productId: product.id,
              productName: product.name,
              stepCategory,
              baseStep,
              userId,
            });
          }
        }
      });
    } else {
      // КРИТИЧНО: Если mapStepToStepCategory вернул пустой массив, используем агрессивный fallback
      // Это последняя попытка зарегистрировать продукт
      logger.warn('Product not recognized by mapStepToStepCategory, using aggressive fallback', {
        productId: product.id,
        productName: product.name,
        step: product.step,
        category: product.category,
        userId,
      });
      
      // Пробуем все возможные варианты на основе step/category
      const stepStr = (product.step || '').toLowerCase();
      const categoryStr = (product.category || '').toLowerCase();
      
      // Агрессивный fallback: пробуем все базовые шаги
      const fallbackCategories: StepCategory[] = [];
      
      if (stepStr.includes('cleanser') || categoryStr.includes('cleanser') || categoryStr.includes('очищ')) {
        fallbackCategories.push('cleanser_gentle', 'cleanser_balancing');
      }
      if (stepStr.includes('toner') || categoryStr.includes('toner') || categoryStr.includes('тоник')) {
        fallbackCategories.push('toner_hydrating');
      }
      if (stepStr.includes('serum') || categoryStr.includes('serum') || categoryStr.includes('сыворотк')) {
        fallbackCategories.push('serum_hydrating', 'serum_niacinamide');
      }
      if (stepStr.includes('treatment') || categoryStr.includes('treatment') || categoryStr.includes('лечени')) {
        fallbackCategories.push('treatment_antiage', 'treatment_exfoliant_mild');
      }
      if (stepStr.includes('moisturizer') || stepStr.includes('cream') || categoryStr.includes('moisturizer') || categoryStr.includes('cream') || categoryStr.includes('крем')) {
        fallbackCategories.push('moisturizer_light', 'moisturizer_balancing');
      }
      if (stepStr.includes('spf') || categoryStr.includes('spf') || categoryStr.includes('защит')) {
        fallbackCategories.push('spf_50_face');
      }
      if (stepStr.includes('mask') || categoryStr.includes('mask') || categoryStr.includes('маск')) {
        fallbackCategories.push('mask_hydrating');
      }
      
      // Если все еще пусто, используем универсальные fallback
      if (fallbackCategories.length === 0) {
        // Последний резерв: пробуем использовать step/category как есть
        const directStep = (product.step || product.category) as StepCategory;
        if (directStep) {
          fallbackCategories.push(directStep);
        }
        // Если и это не помогло, регистрируем в 'other' или пропускаем с предупреждением
        if (fallbackCategories.length === 0) {
          logger.error('CRITICAL: Could not register product - no fallback categories found', {
        productId: product.id,
        productName: product.name,
        step: product.step,
        category: product.category,
        userId,
      });
          // Пропускаем этот продукт, но продолжаем
          return;
        }
      }
      
      // Регистрируем по всем найденным fallback категориям
      fallbackCategories.forEach(category => {
        registerProductForStep(category, productWithBrand);
        logger.info('Product registered via aggressive fallback', {
          productId: product.id,
          productName: product.name,
          fallbackCategory: category,
          userId,
        });
      });
    }
  });
  
  // Логируем итоговое состояние productsByStepMap после регистрации
  if (userId === '643160759' || process.env.NODE_ENV === 'development') {
    const stepSummary = Array.from(productsByStepMap.entries()).map(([step, products]) => ({
      step,
      count: products.length,
      productIds: products.map(p => p.id).slice(0, 5),
    }));
    logger.info('ProductsByStepMap after registration', {
      userId,
      totalSteps: productsByStepMap.size,
      steps: stepSummary,
    });
  }

  // Функция для фильтрации продуктов по фазе плана
  const filterProductsByPhase = (
    products: ProductWithBrand[],
    phase: 'adaptation' | 'active' | 'support',
    stepCategory: StepCategory
  ): ProductWithBrand[] => {
    if (products.length === 0) return products;
    
    // Определяем, какие активные ингредиенты и stepCategory подходят для каждой фазы
    const strongActives = ['retinol', 'retinoid', 'tretinoin', 'adapalene', 'benzoyl_peroxide', 'aha', 'bha', 'glycolic', 'salicylic'];
    const moderateActives = ['azelaic_acid', 'niacinamide', 'vitamin_c', 'alpha_arbutin', 'tranexamic'];
    const gentleActives = ['hyaluronic_acid', 'glycerin', 'centella', 'panthenol', 'ceramide'];
    
    // Определяем, какие stepCategory подходят для каждой фазы
    const adaptationSteps = [
      'cleanser_gentle', 'toner_hydrating', 'toner_soothing',
      'serum_hydrating', 'serum_anti_redness',
      'moisturizer_barrier', 'moisturizer_soothing', 'moisturizer_light',
      'treatment_exfoliant_mild'
    ];
    
    const activeSteps = [
      'serum_niacinamide', 'serum_vitc', 'serum_brightening_soft',
      'treatment_acne_azelaic', 'treatment_acne_bpo', 'treatment_pigmentation',
      'treatment_antiage', 'treatment_exfoliant_strong'
    ];
    
    const supportSteps = [
      'moisturizer_barrier', 'moisturizer_balancing',
      'serum_hydrating', 'serum_niacinamide'
    ];
    
    return products.filter(product => {
      // SPF и очищение всегда подходят для всех фаз
      if (stepCategory.startsWith('spf_') || stepCategory.startsWith('cleanser_')) {
        return true;
      }
      
      // Получаем активные ингредиенты продукта (из БД или из stepCategory)
      const productActives = (product as any).activeIngredients || [];
      const activeIngredientsStr = Array.isArray(productActives) 
        ? productActives.join(' ').toLowerCase()
        : '';
      
      if (phase === 'adaptation') {
        // Фаза 1: только мягкие продукты
        // Проверяем stepCategory
        if (adaptationSteps.some(adaptStep => stepCategory === adaptStep || stepCategory.startsWith(adaptStep.split('_')[0]))) {
          return true;
        }
        
        // Проверяем активные ингредиенты - исключаем сильные
        const hasStrongActive = strongActives.some(active => 
          activeIngredientsStr.includes(active.toLowerCase())
        );
        if (hasStrongActive) return false;
        
        // Предпочитаем мягкие ингредиенты
        const hasGentleActive = gentleActives.some(active => 
          activeIngredientsStr.includes(active.toLowerCase())
        );
        return hasGentleActive || activeIngredientsStr.length === 0; // Если нет активных ингредиентов, тоже подходит
      } else if (phase === 'active') {
        // Фаза 2: активные ингредиенты
        // Проверяем stepCategory
        if (activeSteps.some(activeStep => stepCategory === activeStep || stepCategory.startsWith(activeStep.split('_')[0]))) {
          return true;
        }
        
        // Проверяем активные ингредиенты - предпочитаем сильные или умеренные
        const hasStrongActive = strongActives.some(active => 
          activeIngredientsStr.includes(active.toLowerCase())
        );
        const hasModerateActive = moderateActives.some(active => 
          activeIngredientsStr.includes(active.toLowerCase())
        );
        return hasStrongActive || hasModerateActive;
      } else {
        // Фаза 3: поддерживающие продукты
        // Проверяем stepCategory
        if (supportSteps.some(supportStep => stepCategory === supportStep || stepCategory.startsWith(supportStep.split('_')[0]))) {
          return true;
        }
        
        // Предпочитаем умеренные или мягкие ингредиенты
        const hasModerateActive = moderateActives.some(active => 
          activeIngredientsStr.includes(active.toLowerCase())
        );
        const hasGentleActive = gentleActives.some(active => 
          activeIngredientsStr.includes(active.toLowerCase())
        );
        return hasModerateActive || hasGentleActive || activeIngredientsStr.length === 0;
      }
    });
  };

  const getProductsForStep = (step: StepCategory, phase?: 'adaptation' | 'active' | 'support'): ProductWithBrand[] => {
    // Сначала пробуем найти по точному совпадению StepCategory
    const exact = productsByStepMap.get(step);
    if (exact && exact.length > 0) {
      // Детальное логирование для диагностики (особенно для пользователя 643160759)
      if (userId === '643160759' || process.env.NODE_ENV === 'development') {
        logger.debug('Products found for step (exact match)', {
          step,
          count: exact.length,
          productIds: exact.map(p => p.id),
          phase,
          userId,
        });
      }
      // Фильтруем по фазе, если указана
      if (phase) {
        const filtered = filterProductsByPhase(exact, phase, step);
        if (filtered.length > 0) {
          return filtered;
        }
        // Если после фильтрации ничего не осталось, возвращаем исходный список
        // (лучше показать продукт, чем ничего)
        return exact;
      }
      return exact;
    }
    
    // ИСПРАВЛЕНО: Если не найдено, пробуем найти по базовому step (например, 'toner' для 'toner_hydrating')
    // Но также пробуем все варианты с этим базовым шагом (например, 'toner_hydrating', 'toner_soothing' для 'toner')
    const baseStep = getBaseStepFromStepCategory(step);
    if (baseStep !== step) {
      // Сначала пробуем базовый шаг как StepCategory
      const base = productsByStepMap.get(baseStep as StepCategory);
      if (base && base.length > 0) {
        // Детальное логирование для диагностики
        if (userId === '643160759' || process.env.NODE_ENV === 'development') {
          logger.debug('Products found for step (base step match)', {
            step,
            baseStep,
            count: base.length,
            productIds: base.map(p => p.id),
            phase,
            userId,
          });
        }
        // Фильтруем по фазе, если указана
        if (phase) {
          const filtered = filterProductsByPhase(base, phase, step);
          if (filtered.length > 0) {
            return filtered;
          }
          return base;
        }
        return base;
      }
      
      // ИСПРАВЛЕНО: Если базовый шаг не найден, пробуем все варианты с этим базовым шагом
      // Например, для 'serum_hydrating' пробуем все 'serum_*'
      // ИСПРАВЛЕНО: Также для 'moisturizer_light' пробуем все 'moisturizer_*' (barrier, balancing и т.д.)
      const allVariants: ProductWithBrand[] = [];
      for (const [mapStep, products] of productsByStepMap.entries()) {
        if (mapStep.startsWith(baseStep + '_') || mapStep === baseStep) {
          allVariants.push(...products);
        }
      }
      
      if (allVariants.length > 0) {
        // Удаляем дубликаты по id
        const uniqueProducts = Array.from(
          new Map(allVariants.map(p => [p.id, p])).values()
        );
        
        if (userId === '643160759' || process.env.NODE_ENV === 'development') {
          logger.debug('Products found for step (base step variants match)', {
            step,
            baseStep,
            count: uniqueProducts.length,
            productIds: uniqueProducts.map(p => p.id),
            variantSteps: Array.from(productsByStepMap.keys()).filter(k => k.startsWith(baseStep + '_') || k === baseStep),
            phase,
            userId,
          });
        }
        // Фильтруем по фазе, если указана
        if (phase) {
          const filtered = filterProductsByPhase(uniqueProducts, phase, step);
          if (filtered.length > 0) {
            return filtered;
          }
          return uniqueProducts;
        }
        return uniqueProducts;
      }
    }
    
    // ИСПРАВЛЕНО: Дополнительная проверка для moisturizer - если ищем moisturizer_light, 
    // но нашли только moisturizer_barrier или другие варианты, используем их
    if (step.startsWith('moisturizer_')) {
      const moisturizerVariants: ProductWithBrand[] = [];
      for (const [mapStep, products] of productsByStepMap.entries()) {
        if (mapStep.startsWith('moisturizer_')) {
          moisturizerVariants.push(...products);
        }
      }
      
      if (moisturizerVariants.length > 0) {
        const uniqueProducts = Array.from(
          new Map(moisturizerVariants.map(p => [p.id, p])).values()
        );
        
        if (userId === '643160759' || process.env.NODE_ENV === 'development') {
          logger.debug('Products found for step (moisturizer variants match)', {
            step,
            count: uniqueProducts.length,
            productIds: uniqueProducts.map(p => p.id),
            variantSteps: Array.from(productsByStepMap.keys()).filter(k => k.startsWith('moisturizer_')),
            phase,
            userId,
          });
        }
        // Фильтруем по фазе, если указана
        if (phase) {
          const filtered = filterProductsByPhase(uniqueProducts, phase, step);
          if (filtered.length > 0) {
            return filtered;
          }
          return uniqueProducts;
        }
        return uniqueProducts;
      }
    }
    
    // ИСПРАВЛЕНО: Аналогично для serum - если ищем serum_hydrating, но нашли только serum_niacinamide, используем его
    if (step.startsWith('serum_')) {
      const serumVariants: ProductWithBrand[] = [];
      for (const [mapStep, products] of productsByStepMap.entries()) {
        if (mapStep.startsWith('serum_')) {
          serumVariants.push(...products);
        }
      }
      
      if (serumVariants.length > 0) {
        const uniqueProducts = Array.from(
          new Map(serumVariants.map(p => [p.id, p])).values()
        );
        
        if (userId === '643160759' || process.env.NODE_ENV === 'development') {
          logger.debug('Products found for step (serum variants match)', {
            step,
            count: uniqueProducts.length,
            productIds: uniqueProducts.map(p => p.id),
            variantSteps: Array.from(productsByStepMap.keys()).filter(k => k.startsWith('serum_')),
            phase,
            userId,
          });
        }
        // Фильтруем по фазе, если указана
        if (phase) {
          const filtered = filterProductsByPhase(uniqueProducts, phase, step);
          if (filtered.length > 0) {
            return filtered;
          }
          return uniqueProducts;
        }
        return uniqueProducts;
      }
    }
    
    // Если не найдено, пробуем fallback StepCategory
    const fallback = getFallbackStep(step);
    if (fallback && fallback !== step) {
      const fallbackProducts = productsByStepMap.get(fallback);
      if (fallbackProducts && fallbackProducts.length > 0) {
        // Детальное логирование для диагностики
        if (userId === '643160759' || process.env.NODE_ENV === 'development') {
          logger.debug('Products found for step (fallback match)', {
            step,
            fallback,
            count: fallbackProducts.length,
            productIds: fallbackProducts.map(p => p.id),
            userId,
          });
        }
        return fallbackProducts;
      }
      
      // Если fallback тоже не найден, пробуем базовый step от fallback
      const fallbackBaseStep = getBaseStepFromStepCategory(fallback);
      if (fallbackBaseStep !== fallback) {
        const fallbackBase = productsByStepMap.get(fallbackBaseStep as StepCategory);
        if (fallbackBase && fallbackBase.length > 0) {
          // Детальное логирование для диагностики
          if (userId === '643160759' || process.env.NODE_ENV === 'development') {
            logger.debug('Products found for step (fallback base step match)', {
              step,
              fallback,
              fallbackBaseStep,
              count: fallbackBase.length,
              productIds: fallbackBase.map(p => p.id),
              userId,
            });
          }
          return fallbackBase;
        }
      }
    }
    
    // Детальное логирование, если продукты не найдены
    if (userId === '643160759' || process.env.NODE_ENV === 'development') {
      logger.warn('No products found for step in productsByStepMap', {
        step,
        baseStep,
        fallback,
        productsByStepMapSize: productsByStepMap.size,
        productsByStepMapKeys: Array.from(productsByStepMap.keys()),
        userId,
      });
    }
    
    return [];
  };

  // Используем новый модуль для обеспечения продуктов - устраняет N+1 запросы
  const ensureRequiredProductsForPlan = async () => {
    const requiredStepsArray = Array.from(requiredStepCategories);
    const updatedProductsMap = await ensureRequiredProducts(
      requiredStepsArray,
      profileClassification,
      productsByStepMap
    );
    
    // Обновляем productsByStepMap
    for (const [step, products] of updatedProductsMap.entries()) {
      productsByStepMap.set(step, products);
    }
    
    // Добавляем новые продукты в selectedProducts
    for (const products of updatedProductsMap.values()) {
      for (const product of products) {
        if (!selectedProducts.some(p => p.id === product.id)) {
          selectedProducts.push(product as any);
        }
      }
    }
  };

  // ГАРАНТИРУЕМ наличие очищения (cleanser) и SPF - они обязательны для всех
  // Используем новый модуль для устранения дублирования и N+1 запросов
  
  // Проверяем и добавляем очищение, если его нет
  const cleanserSteps = Array.from(requiredStepCategories).filter((step: StepCategory) => isCleanserStep(step));
  if (cleanserSteps.length > 0) {
    const existingCleanser = cleanserSteps.some(step => getProductsForStep(step).length > 0);
    if (!existingCleanser) {
      logger.info('No cleanser products found, searching for fallback', { userId });
      const fallbackCleanser = await findFallbackProduct('cleanser', profileClassification);
      if (fallbackCleanser) {
        for (const step of cleanserSteps) {
          registerProductForStep(step, fallbackCleanser);
        }
        if (!selectedProducts.some((p: any) => p.id === fallbackCleanser.id)) {
          selectedProducts.push(fallbackCleanser as any);
        }
        logger.info('Fallback cleanser added', { 
          productId: fallbackCleanser.id, 
          productName: fallbackCleanser.name,
          userId 
        });
      }
    }
  }

  // Проверяем и добавляем SPF, если его нет
  const spfSteps = Array.from(requiredStepCategories).filter((step: StepCategory) => isSPFStep(step));
  if (spfSteps.length > 0) {
    const existingSPF = spfSteps.some(step => getProductsForStep(step).length > 0);
    if (!existingSPF) {
      logger.info('No SPF products found, searching for fallback', { userId });
      const fallbackSPF = await findFallbackProduct('spf', profileClassification);
      if (fallbackSPF) {
        for (const step of spfSteps) {
          registerProductForStep(step, fallbackSPF);
        }
        if (!selectedProducts.some((p: any) => p.id === fallbackSPF.id)) {
          selectedProducts.push(fallbackSPF as any);
        }
        logger.info('Fallback SPF added', { 
          productId: fallbackSPF.id, 
          productName: fallbackSPF.name,
          userId 
        });
      }
    }
  }

  // ВАЖНО: Гарантируем наличие крема (moisturizer) - это обязательный шаг для всех
  const moisturizerSteps = Array.from(requiredStepCategories).filter((step: StepCategory) => 
    step.startsWith('moisturizer_') || step === 'moisturizer_light' || step === 'moisturizer_balancing' || 
    step === 'moisturizer_barrier' || step === 'moisturizer_soothing'
  );
  if (moisturizerSteps.length > 0) {
    const existingMoisturizer = moisturizerSteps.some(step => getProductsForStep(step).length > 0);
    if (!existingMoisturizer) {
      logger.warn('No moisturizer products found, searching for fallback', { userId, moisturizerSteps });
      const fallbackMoisturizer = await findFallbackProduct('moisturizer', profileClassification);
      if (fallbackMoisturizer) {
        for (const step of moisturizerSteps) {
          registerProductForStep(step, fallbackMoisturizer);
        }
        if (!selectedProducts.some((p: any) => p.id === fallbackMoisturizer.id)) {
          selectedProducts.push(fallbackMoisturizer as any);
        }
        logger.info('Fallback moisturizer added', { 
          productId: fallbackMoisturizer.id, 
          productName: fallbackMoisturizer.name,
          userId 
        });
      } else {
        logger.error('CRITICAL: Could not find fallback moisturizer!', { userId });
      }
    }
  } else {
    // Если в шаблоне вообще нет moisturizer - добавляем его в requiredStepCategories
    logger.warn('No moisturizer step in template, adding moisturizer_light as required', { userId });
    requiredStepCategories.add('moisturizer_light');
    const fallbackMoisturizer = await findFallbackProduct('moisturizer', profileClassification);
    if (fallbackMoisturizer) {
      registerProductForStep('moisturizer_light', fallbackMoisturizer);
      if (!selectedProducts.some((p: any) => p.id === fallbackMoisturizer.id)) {
        selectedProducts.push(fallbackMoisturizer as any);
      }
      logger.info('Added missing moisturizer to plan', { 
        productId: fallbackMoisturizer.id, 
        productName: fallbackMoisturizer.name,
        userId 
      });
    }
  }

  // ВАЖНО: Гарантируем наличие всех остальных средств из шаблона
  
  // Проверяем и добавляем тонер (toner), если его нет
  const tonerSteps = Array.from(requiredStepCategories).filter((step: StepCategory) => 
    step.startsWith('toner_')
  );
  if (tonerSteps.length > 0) {
    const existingToner = tonerSteps.some(step => getProductsForStep(step).length > 0);
    if (!existingToner) {
      logger.warn('No toner products found, searching for fallback', { userId, tonerSteps });
      const fallbackToner = await findFallbackProduct('toner', profileClassification);
      if (fallbackToner) {
        for (const step of tonerSteps) {
          registerProductForStep(step, fallbackToner);
        }
        if (!selectedProducts.some((p: any) => p.id === fallbackToner.id)) {
          selectedProducts.push(fallbackToner as any);
        }
        logger.info('Fallback toner added', { 
          productId: fallbackToner.id, 
          productName: fallbackToner.name,
          userId 
        });
      }
    }
  }

  // Проверяем и добавляем сыворотку (serum), если ее нет
  const serumSteps = Array.from(requiredStepCategories).filter((step: StepCategory) => 
    step.startsWith('serum_')
  );
  if (serumSteps.length > 0) {
    const existingSerum = serumSteps.some(step => getProductsForStep(step).length > 0);
    if (!existingSerum) {
      logger.warn('No serum products found, searching for fallback', { userId, serumSteps });
      const fallbackSerum = await findFallbackProduct('serum', profileClassification);
      if (fallbackSerum) {
        for (const step of serumSteps) {
          registerProductForStep(step, fallbackSerum);
        }
        if (!selectedProducts.some((p: any) => p.id === fallbackSerum.id)) {
          selectedProducts.push(fallbackSerum as any);
        }
        logger.info('Fallback serum added', { 
          productId: fallbackSerum.id, 
          productName: fallbackSerum.name,
          userId 
        });
      }
    }
  }

  // Проверяем и добавляем лечение (treatment), если его нет
  const treatmentSteps = Array.from(requiredStepCategories).filter((step: StepCategory) => 
    step.startsWith('treatment_') || step.startsWith('spot_treatment')
  );
  if (treatmentSteps.length > 0) {
    const existingTreatment = treatmentSteps.some(step => getProductsForStep(step).length > 0);
    if (!existingTreatment) {
      logger.warn('No treatment products found, searching for fallback', { userId, treatmentSteps });
      const fallbackTreatment = await findFallbackProduct('treatment', profileClassification);
      if (fallbackTreatment) {
        for (const step of treatmentSteps) {
          registerProductForStep(step, fallbackTreatment);
        }
        if (!selectedProducts.some((p: any) => p.id === fallbackTreatment.id)) {
          selectedProducts.push(fallbackTreatment as any);
        }
        logger.info('Fallback treatment added', { 
          productId: fallbackTreatment.id, 
          productName: fallbackTreatment.name,
          userId 
        });
      }
    }
  }

  // Проверяем и добавляем маску (mask), если ее нет (еженедельные средства)
  const maskSteps = Array.from(requiredStepCategories).filter((step: StepCategory) => 
    step.startsWith('mask_')
  );
  if (maskSteps.length > 0) {
    const existingMask = maskSteps.some(step => getProductsForStep(step).length > 0);
    if (!existingMask) {
      logger.warn('No mask products found, searching for fallback', { userId, maskSteps });
      const fallbackMask = await findFallbackProduct('mask', profileClassification);
      if (fallbackMask) {
        for (const step of maskSteps) {
          registerProductForStep(step, fallbackMask);
        }
        if (!selectedProducts.some((p: any) => p.id === fallbackMask.id)) {
          selectedProducts.push(fallbackMask as any);
        }
        logger.info('Fallback mask added', { 
          productId: fallbackMask.id, 
          productName: fallbackMask.name,
          userId 
        });
      }
    }
  }

  // Обеспечиваем продукты для всех обязательных шагов из шаблона (batch запрос - устраняет N+1)
  // Логируем состояние ДО ensureRequiredProducts
  if (userId === '643160759' || process.env.NODE_ENV === 'development') {
    const beforeSummary = Array.from(productsByStepMap.entries()).map(([step, products]) => ({
      step,
      count: products.length,
      productIds: products.map(p => p.id),
    }));
    logger.info('ProductsByStepMap BEFORE ensureRequiredProducts', {
      userId,
      requiredSteps: Array.from(requiredStepCategories),
      totalSteps: productsByStepMap.size,
      steps: beforeSummary,
    });
  }
  
  await ensureRequiredProductsForPlan();
  
  // ИСПРАВЛЕНО: Всегда логируем итоговое состояние для диагностики
    const stepSummary = Array.from(productsByStepMap.entries()).map(([step, products]) => ({
      step,
      count: products.length,
    productIds: products.map(p => p.id).slice(0, 5),
      productNames: products.map(p => p.name).slice(0, 3),
    }));
  
  // КРИТИЧНО: Проверяем, что для всех обязательных шагов есть продукты
  const missingSteps: StepCategory[] = [];
  for (const requiredStep of requiredStepCategories) {
    const stepProducts = getProductsForStep(requiredStep);
    if (stepProducts.length === 0) {
      missingSteps.push(requiredStep);
    }
  }
  
  if (missingSteps.length > 0) {
    logger.error('CRITICAL: Missing products for required steps after ensureRequiredProducts', {
      userId,
      missingSteps,
      requiredSteps: Array.from(requiredStepCategories),
      productsByStepMapKeys: Array.from(productsByStepMap.keys()),
    });
  }
  
    logger.info('ProductsByStepMap summary AFTER ensureRequiredProducts', {
      userId,
      requiredSteps: Array.from(requiredStepCategories),
      totalSteps: productsByStepMap.size,
      steps: stepSummary,
      selectedProductsCount: selectedProducts.length,
    selectedProductIds: selectedProducts.map((p: any) => p.id).slice(0, 10),
    missingSteps: missingSteps.length > 0 ? missingSteps : undefined,
    });

  // Определяем дерматологический протокол
  const dermatologyProtocol = determineProtocol({
    diagnoses: profileClassification.diagnoses || [],
    concerns: profileClassification.concerns || [],
    skinType: profileClassification.skinType || undefined,
    sensitivityLevel: (profileClassification.sensitivityLevel || 'medium') as 'low' | 'medium' | 'high' | 'very_high',
  });
  
  logger.info('Dermatology protocol determined', {
    protocol: dermatologyProtocol.condition,
    protocolName: dermatologyProtocol.name,
    userId,
  });

  // Шаг 3: Генерация плана (28 дней, 4 недели)
  const weeks: PlanWeek[] = [];
  
  for (let weekNum = 1; weekNum <= PLAN_WEEKS_TOTAL; weekNum++) {
    const days: PlanDay[] = [];
    
    for (let dayNum = 1; dayNum <= PLAN_DAYS_PER_WEEK; dayNum++) {
      const day = (weekNum - 1) * 7 + dayNum;
      
      // Используем скорректированные шаги вместо оригинальных из шаблона
      const templateMorningBase = adjustedMorning;
      const templateEveningBase = adjustedEvening;

      // ВАЖНО: Все средства показываются с первого дня (прогрессия убрана)
      // Это обеспечивает полную рутину сразу, а не постепенное добавление средств
      const progressionFactor = Math.min(1, (weekNum - 1) / 3); // Используется для других параметров, но не для количества средств

      const baseMorningCleanser =
        templateMorningBase.find(isCleanserStep) ?? CLEANER_FALLBACK_STEP;
      const baseMorningSPF = templateMorningBase.find(isSPFStep) ?? SPF_FALLBACK_STEP;
      const templateMorningAdditional = templateMorningBase.filter(
        (step) => !isCleanserStep(step) && !isSPFStep(step)
      );
      // ВАЖНО: Всегда показываем все дополнительные средства с первого дня
      // Прогрессия больше не ограничивает количество средств
      const rawMorningSteps = dedupeSteps([
        baseMorningCleanser,
        ...templateMorningAdditional, // Всегда все средства с первого дня
        baseMorningSPF,
      ]);

      const baseEveningCleanser =
        templateEveningBase.find(isCleanserStep) ?? CLEANER_FALLBACK_STEP;
      const templateEveningAdditional = templateEveningBase.filter(
        (step) => !isCleanserStep(step) && !isSPFStep(step)
      );
      // ВАЖНО: Всегда показываем все дополнительные средства вечером с первого дня
      // Проверяем, использует ли пользователь макияж ежедневно
      // Если да, добавляем гидрофильное масло первым этапом очищения вечером
      const makeupFrequency = medicalMarkers?.makeupFrequency as string | undefined;
      const needsOilCleansing = makeupFrequency === 'daily';
      
      const rawEveningSteps = dedupeSteps([
        // Если используется макияж ежедневно, добавляем гидрофильное масло первым
        ...(needsOilCleansing ? ['cleanser_oil' as StepCategory] : []),
        baseEveningCleanser,
        ...templateEveningAdditional, // Всегда все средства с первого дня
      ]);

      // ИСПРАВЛЕНО: Логируем фильтрацию шагов для диагностики
      // ИСПРАВЛЕНО: isStepAllowedForProfile теперь async, используем Promise.all
      const allowedMorningStepsPromises = rawMorningSteps.map(async (step) => {
        const isAllowed = await isStepAllowedForProfile(step, stepProfile);
        if (!isAllowed) {
          logger.warn('Step filtered out by isStepAllowedForProfile (morning)', {
            step,
            skinType: stepProfile.skinType,
            sensitivity: stepProfile.sensitivity,
            diagnoses: stepProfile.diagnoses,
            userId,
            day,
          });
        }
        return { step, isAllowed };
      });
      const allowedMorningResults = await Promise.all(allowedMorningStepsPromises);
      const allowedMorningSteps = allowedMorningResults.filter(r => r.isAllowed).map(r => r.step);
      
      const allowedEveningStepsPromises = rawEveningSteps.map(async (step) => {
        const isAllowed = await isStepAllowedForProfile(step, stepProfile);
        if (!isAllowed) {
          logger.warn('Step filtered out by isStepAllowedForProfile (evening)', {
            step,
            skinType: stepProfile.skinType,
            sensitivity: stepProfile.sensitivity,
            diagnoses: stepProfile.diagnoses,
            userId,
            day,
          });
        }
        return { step, isAllowed };
      });
      const allowedEveningResults = await Promise.all(allowedEveningStepsPromises);
      const allowedEveningSteps = allowedEveningResults.filter(r => r.isAllowed).map(r => r.step);
      
      // ИСПРАВЛЕНО: Если после фильтрации осталось только 2 шага (cleanser и SPF), логируем предупреждение
      if (allowedMorningSteps.length <= 2 && allowedEveningSteps.length <= 1) {
        logger.warn('CRITICAL: Only minimal steps after filtering', {
          userId,
          day,
          rawMorningSteps,
          rawEveningSteps,
          allowedMorningSteps,
          allowedEveningSteps,
          stepProfile: {
            skinType: stepProfile.skinType,
            sensitivity: stepProfile.sensitivity,
            diagnoses: stepProfile.diagnoses,
          },
        });
      }

      const morningSteps = ensureStepPresence(
        ensureStepPresence(allowedMorningSteps, isCleanserStep, CLEANER_FALLBACK_STEP),
        isSPFStep,
        SPF_FALLBACK_STEP
      );
      const eveningSteps = ensureStepPresence(
        allowedEveningSteps.filter((step) => !isSPFStep(step)),
        isCleanserStep,
        CLEANER_FALLBACK_STEP
      );

      const dayProducts: Record<string, any> = {};
      const stepsForDay = [...morningSteps, ...eveningSteps];
      
      // Собираем уже выбранные продукты для проверки совместимости
      const selectedProductsForDay: ProductWithBrand[] = [];
      
      // Сначала обрабатываем утренние шаги
      for (const step of morningSteps) {
        let stepProducts = getProductsForStep(step);
        
        // КРИТИЧНО: Если продуктов нет, ищем fallback
        if (stepProducts.length === 0) {
          logger.warn('No products found for step, searching fallback (morning)', {
            step,
            day,
            week: weekNum,
            userId,
            productsByStepMapSize: productsByStepMap.size,
            productsByStepMapKeys: Array.from(productsByStepMap.keys()),
          });
          
          const baseStep = getBaseStepFromStepCategory(step);
          const fallbackProduct = await findFallbackProduct(baseStep, profileClassification);
          
          if (fallbackProduct) {
            // Регистрируем fallback продукт для этого шага
            registerProductForStep(step, fallbackProduct);
            stepProducts = [fallbackProduct];
            logger.info('Fallback product found and registered (morning)', {
              step,
              baseStep,
              productId: fallbackProduct.id,
              productName: fallbackProduct.name,
              userId,
            });
          } else {
            // ИСПРАВЛЕНО: Если даже fallback не найден, пробуем найти ЛЮБОЙ продукт для этого шага
            logger.error('CRITICAL: No products available for step, even after fallback search', {
              step,
              baseStep,
              day,
              week: weekNum,
              userId,
            });
            
            // Последняя попытка: ищем любой опубликованный продукт с этим step
            const anyProduct = await prisma.product.findFirst({
              where: {
                published: true as any,
                step: { startsWith: baseStep },
                brand: { isActive: true },
              } as any,
              include: { brand: true },
            });
            
            if (anyProduct) {
              const anyProductWithBrand: ProductWithBrand = {
                id: anyProduct.id,
                name: anyProduct.name,
                brand: {
                  id: anyProduct.brand.id,
                  name: anyProduct.brand.name,
                  isActive: anyProduct.brand.isActive,
                },
                step: anyProduct.step || '',
                category: anyProduct.category,
                price: anyProduct.price,
                imageUrl: anyProduct.imageUrl,
                isHero: (anyProduct as any).isHero || false,
                priority: (anyProduct as any).priority || 0,
                skinTypes: (anyProduct.skinTypes as string[]) || [],
                published: anyProduct.published || false,
              };
              
              registerProductForStep(step, anyProductWithBrand);
              stepProducts = [anyProductWithBrand];
              logger.warn('Using ANY available product as last resort fallback', {
                step,
                productId: anyProduct.id,
                productName: anyProduct.name,
                userId,
              });
            } else {
              // ИСПРАВЛЕНО: Не пропускаем шаг, даже если продукт не найден
              // Шаг должен быть добавлен в план, даже без продукта (productId будет null в plan28)
              logger.warn('CRITICAL: Could not find ANY product for step, but keeping step in plan with null productId', {
                step,
                baseStep,
                day,
                week: weekNum,
                userId,
              });
              // Продолжаем выполнение - шаг будет добавлен в days.push() ниже, но без продукта
              // stepProducts остается пустым, но шаг все равно будет в morningSteps
            }
          }
        }
        
        // ИСПРАВЛЕНО: Проверяем, есть ли продукты перед использованием
        // Если продуктов нет, шаг все равно должен быть добавлен в план (без продукта)
        if (stepProducts.length === 0) {
          // Шаг без продукта - не добавляем в dayProducts, но шаг остается в morningSteps массиве
          logger.warn('Step has no products, but keeping step in plan', {
            step,
            day,
            week: weekNum,
            userId,
          });
        } else if (isCleanserStep(step) || isSPFStep(step)) {
          // ВАЖНО: Для очищения и SPF не применяем строгую дерматологическую фильтрацию
          // Они должны быть всегда доступны
          // Для обязательных шагов используем первый доступный продукт без фильтрации
          const selectedProduct = stepProducts[0];
          selectedProductsForDay.push(selectedProduct);
          
          dayProducts[step] = {
            id: selectedProduct.id,
            name: selectedProduct.name,
            brand: selectedProduct.brand.name,
            step,
          };
        } else {
          // Для остальных шагов применяем дерматологическую фильтрацию
          const context: ProductSelectionContext = {
            timeOfDay: 'morning',
            day,
            week: weekNum,
            alreadySelected: selectedProductsForDay,
            protocol: dermatologyProtocol,
            profileClassification,
          };
          
          const filteredResults = filterProductsWithDermatologyLogic(stepProducts, context);
          const compatibleProducts = filteredResults.filter(r => r.allowed);
          
          // Логируем для диагностики, если нет совместимых продуктов
          if (compatibleProducts.length === 0 && stepProducts.length > 0) {
            logger.warn('No compatible products after dermatology filter (morning)', {
              step,
              day,
              week: weekNum,
              totalProducts: stepProducts.length,
              filteredReasons: filteredResults.filter(r => !r.allowed).map(r => r.reason).slice(0, 3),
              userId,
            });
          }
          
          // ИСПРАВЛЕНО: Если нет совместимых продуктов после фильтрации, используем первый доступный продукт
          // Это гарантирует, что шаги из шаблона не пропускаются из-за строгой фильтрации
          if (compatibleProducts.length > 0) {
            const selectedProduct = compatibleProducts[0].product;
            selectedProductsForDay.push(selectedProduct);
            
            const justification = generateProductJustification(
              selectedProduct,
              dermatologyProtocol,
              profileClassification
            );
            const warnings = generateProductWarnings(
              selectedProduct,
              dermatologyProtocol,
              profileClassification
            );
            
            dayProducts[step] = {
              id: selectedProduct.id,
              name: selectedProduct.name,
              brand: selectedProduct.brand.name,
              step,
              justification,
              warnings: warnings.length > 0 ? warnings : undefined,
            };
          } else if (stepProducts.length > 0) {
            // ИСПРАВЛЕНО: Если продукты есть, но они отфильтрованы, используем первый доступный
            // Это лучше, чем пропускать шаг из шаблона
            logger.warn('Using first available product despite dermatology filter (morning)', {
              step,
              day,
              week: weekNum,
              totalProducts: stepProducts.length,
              selectedProductId: stepProducts[0].id,
              userId,
            });
            
            const selectedProduct = stepProducts[0];
            selectedProductsForDay.push(selectedProduct);
            
            const justification = generateProductJustification(
              selectedProduct,
              dermatologyProtocol,
              profileClassification
            );
            const warnings = generateProductWarnings(
              selectedProduct,
              dermatologyProtocol,
              profileClassification
            );
            
            dayProducts[step] = {
              id: selectedProduct.id,
              name: selectedProduct.name,
              brand: selectedProduct.brand.name,
              step,
              justification,
              warnings: warnings.length > 0 ? warnings : undefined,
            };
          }
        }
      }
      
      // Затем обрабатываем вечерние шаги
      for (const step of eveningSteps) {
        let stepProducts = getProductsForStep(step);
        
        // КРИТИЧНО: Если продуктов нет, ищем fallback
        if (stepProducts.length === 0) {
          logger.warn('No products found for step, searching fallback (evening)', {
            step,
            day,
            week: weekNum,
            userId,
            productsByStepMapSize: productsByStepMap.size,
            productsByStepMapKeys: Array.from(productsByStepMap.keys()),
          });
          
          const baseStep = getBaseStepFromStepCategory(step);
          const fallbackProduct = await findFallbackProduct(baseStep, profileClassification);
          
          if (fallbackProduct) {
            // Регистрируем fallback продукт для этого шага
            registerProductForStep(step, fallbackProduct);
            stepProducts = [fallbackProduct];
            logger.info('Fallback product found and registered (evening)', {
              step,
              baseStep,
              productId: fallbackProduct.id,
              productName: fallbackProduct.name,
              userId,
            });
          } else {
            // ИСПРАВЛЕНО: Если даже fallback не найден, пробуем найти ЛЮБОЙ продукт для этого шага
            logger.error('CRITICAL: No products available for step, even after fallback search', {
              step,
              baseStep,
              day,
              week: weekNum,
              userId,
            });
            
            // Последняя попытка: ищем любой опубликованный продукт с этим step
            const anyProduct = await prisma.product.findFirst({
              where: {
                published: true as any,
                step: { startsWith: baseStep },
                brand: { isActive: true },
              } as any,
              include: { brand: true },
            });
            
            if (anyProduct) {
              const anyProductWithBrand: ProductWithBrand = {
                id: anyProduct.id,
                name: anyProduct.name,
                brand: {
                  id: anyProduct.brand.id,
                  name: anyProduct.brand.name,
                  isActive: anyProduct.brand.isActive,
                },
                step: anyProduct.step || '',
                category: anyProduct.category,
                price: anyProduct.price,
                imageUrl: anyProduct.imageUrl,
                isHero: (anyProduct as any).isHero || false,
                priority: (anyProduct as any).priority || 0,
                skinTypes: (anyProduct.skinTypes as string[]) || [],
                published: anyProduct.published || false,
              };
              
              registerProductForStep(step, anyProductWithBrand);
              stepProducts = [anyProductWithBrand];
              logger.warn('Using ANY available product as last resort fallback', {
                step,
                productId: anyProduct.id,
                productName: anyProduct.name,
                userId,
              });
            } else {
              // ИСПРАВЛЕНО: Не пропускаем шаг, даже если продукт не найден
              // Шаг должен быть добавлен в план, даже без продукта (productId будет null в plan28)
              logger.warn('CRITICAL: Could not find ANY product for step, but keeping step in plan with null productId', {
                step,
                baseStep,
                day,
                week: weekNum,
                userId,
              });
              // Продолжаем выполнение - шаг будет добавлен в days.push() ниже, но без продукта
              // stepProducts остается пустым, но шаг все равно будет в eveningSteps
            }
          }
        }
        
        // ИСПРАВЛЕНО: Проверяем, есть ли продукты перед использованием
        // Если продуктов нет, шаг все равно должен быть добавлен в план (без продукта)
        if (stepProducts.length === 0) {
          // Шаг без продукта - добавляем в dayProducts как null, но шаг остается в eveningSteps
          logger.warn('Step has no products, but keeping step in plan', {
            step,
            day,
            week: weekNum,
            userId,
          });
          // Не добавляем в dayProducts, но шаг останется в eveningSteps массиве
        } else if (isCleanserStep(step)) {
          // ВАЖНО: Для очищения не применяем строгую дерматологическую фильтрацию
          // Оно должно быть всегда доступно
          // Для обязательных шагов используем первый доступный продукт без фильтрации
          const selectedProduct = stepProducts[0];
          selectedProductsForDay.push(selectedProduct);
          
          dayProducts[step] = {
            id: selectedProduct.id,
            name: selectedProduct.name,
            brand: selectedProduct.brand.name,
            step,
          };
        } else {
          // Для остальных шагов применяем дерматологическую фильтрацию
          const context: ProductSelectionContext = {
            timeOfDay: 'evening',
            day,
            week: weekNum,
            alreadySelected: selectedProductsForDay,
            protocol: dermatologyProtocol,
            profileClassification,
          };
          
          const filteredResults = filterProductsWithDermatologyLogic(stepProducts, context);
          const compatibleProducts = filteredResults.filter(r => r.allowed);
          
          // Логируем для диагностики, если нет совместимых продуктов
          if (compatibleProducts.length === 0 && stepProducts.length > 0) {
            logger.warn('No compatible products after dermatology filter (evening)', {
              step,
              day,
              week: weekNum,
              totalProducts: stepProducts.length,
              filteredReasons: filteredResults.filter(r => !r.allowed).map(r => r.reason).slice(0, 3),
              userId,
            });
          }
          
          if (compatibleProducts.length > 0) {
            const selectedProduct = compatibleProducts[0].product;
            selectedProductsForDay.push(selectedProduct);
            
            const justification = generateProductJustification(
              selectedProduct,
              dermatologyProtocol,
              profileClassification
            );
            const warnings = generateProductWarnings(
              selectedProduct,
              dermatologyProtocol,
              profileClassification
            );
            
            dayProducts[step] = {
              id: selectedProduct.id,
              name: selectedProduct.name,
              brand: selectedProduct.brand.name,
              step,
              justification,
              warnings: warnings.length > 0 ? warnings : undefined,
            };
          } else if (stepProducts.length > 0) {
            // Если нет совместимых, используем первый доступный (fallback)
            // Это важно, чтобы план не был пустым
            const fallbackProduct = stepProducts[0];
            selectedProductsForDay.push(fallbackProduct);
            
            logger.info('Using fallback product (no compatible after filter)', {
              step,
              day,
              productId: fallbackProduct.id,
              productName: fallbackProduct.name,
              userId,
            });
            
            dayProducts[step] = {
              id: fallbackProduct.id,
              name: fallbackProduct.name,
              brand: fallbackProduct.brand.name,
              step,
              warning: 'Продукт может требовать дополнительной проверки совместимости',
            };
          }
        }
      }

      // ИСПРАВЛЕНО: Не фильтруем шаги по наличию продуктов - оставляем все шаги
      // Продукты будут найдены позже при создании plan28 через fallback логику
      // Фильтрация приводит к тому, что дни остаются без шагов, и plan28Days становится пустым
      days.push({
        day,
        week: weekNum,
        morning: morningSteps, // Убрана фильтрация - оставляем все шаги
        evening: eveningSteps, // Убрана фильтрация - оставляем все шаги
        products: dayProducts,
        completed: false,
      });
    }
    
    const weekProducts = days.length > 0 ? Object.keys(days[0].products).length : 0;
    
    weeks.push({
      week: weekNum,
      days,
      summary: {
        focus: [primaryFocus],
        productsCount: weekProducts,
      },
    });
  }

  // Шаг 4: Генерация инфографики (динамическая на основе дерматологических осей)
  // Используем дерматологические skin scores для инфографики
  const inflammationScore = skinScores.find(s => s.axis === 'inflammation')?.value || 0;
  const pigmentationScore = skinScores.find(s => s.axis === 'pigmentation')?.value || 0;
  const hydrationScore = skinScores.find(s => s.axis === 'hydration')?.value || 0;
  const photoagingScore = skinScores.find(s => s.axis === 'photoaging')?.value || 0;
  const oilinessScore = skinScores.find(s => s.axis === 'oiliness')?.value || 50;

  // Прогресс по неделям на основе дерматологических осей
  const infographicProgress = [1, 2, 3, 4].map(week => {
    // Рассчитываем улучшение: от текущего значения к целевому (улучшение на 20-30% за неделю)
    const weekProgress = (week / 4) * 0.25; // 25% улучшения к концу 4 недели
    
    // Для воспаления: уменьшаем (inverse progress)
    const inflammationTarget = Math.max(0, inflammationScore - (inflammationScore * weekProgress));
    
    // Для пигментации: уменьшаем
    const pigmentationTarget = Math.max(0, pigmentationScore - (pigmentationScore * weekProgress));
    
    // Для обезвоженности: уменьшаем (hydration score = уровень обезвоженности)
    const hydrationTarget = Math.max(0, hydrationScore - (hydrationScore * weekProgress));
    
    // Для фотостарения: уменьшаем
    const photoagingTarget = Math.max(0, photoagingScore - (photoagingScore * weekProgress));
    
    // Для жирности: нормализуем к 50 (нейтральное значение)
    const oilinessTarget = oilinessScore > 50 
      ? Math.max(50, oilinessScore - ((oilinessScore - 50) * weekProgress))
      : Math.min(50, oilinessScore + ((50 - oilinessScore) * weekProgress));
    
    return {
      week,
      // Конвертируем в проценты улучшения (100 - текущее значение = уровень улучшения)
      inflammation: Math.round(100 - inflammationTarget),
      pigmentation: Math.round(100 - pigmentationTarget),
      hydration: Math.round(100 - hydrationTarget),
      photoaging: Math.round(100 - photoagingTarget),
      oiliness: Math.round(oilinessTarget),
      // Для обратной совместимости со старым форматом
      acne: Math.round(100 - inflammationTarget),
      pores: oilinessScore > 70 ? Math.round(100 - (oilinessScore - 50) * weekProgress) : 0,
      wrinkles: Math.round(100 - photoagingTarget),
    };
  });

  // Определяем активные метрики для графика на основе skin scores
  const activeMetrics: string[] = [];
  if (inflammationScore > 40) activeMetrics.push('inflammation');
  if (pigmentationScore > 40) activeMetrics.push('pigmentation');
  if (hydrationScore > 40) activeMetrics.push('hydration');
  if (photoagingScore > 40) activeMetrics.push('photoaging');
  if (Math.abs(oilinessScore - 50) > 20) activeMetrics.push('oiliness');
  
  // Если нет активных метрик, используем основные
  if (activeMetrics.length === 0) {
    activeMetrics.push('inflammation', 'hydration');
  }

  // Конфигурация графика для Chart.js (обновленная с дерматологическими осями)
  const chartConfig = {
    type: 'line' as const,
    data: {
      labels: ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4'],
      datasets: activeMetrics.map((metric, idx) => {
        const score = skinScores.find(s => {
          if (metric === 'inflammation') return s.axis === 'inflammation';
          if (metric === 'pigmentation') return s.axis === 'pigmentation';
          if (metric === 'hydration') return s.axis === 'hydration';
          if (metric === 'photoaging') return s.axis === 'photoaging';
          if (metric === 'oiliness') return s.axis === 'oiliness';
          return false;
        });
        
        return {
          label: score?.title || metric,
          data: infographicProgress.map(p => (p as any)[metric] || 0),
          borderColor: score?.color || [
            '#EF4444', // Красный (воспаление)
            '#8B5CF6', // Фиолетовый (пигментация)
            '#3B82F6', // Синий (увлажнение)
            '#EC4899', // Розовый (фотостарение)
            '#10B981', // Зеленый (жирность)
          ][idx % 5],
          backgroundColor: 'transparent',
          tension: 0.4,
        };
      }),
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value: any) {
              return value + '%';
            },
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
        },
      },
    },
  };

  // Форматируем продукты для карусели
  const formattedProducts = selectedProducts.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand.name,
    category: p.category,
    price: (p as any).price || 0,
    available: (p.marketLinks as any)?.ozon ? 'Ozon' : 
               (p.marketLinks as any)?.wb ? 'Wildberries' :
               (p.marketLinks as any)?.apteka ? 'Apteka.ru' :
               'Доступно в аптеках',
    imageUrl: p.imageUrl || undefined,
    ingredients: p.concerns || [], // Используем concerns как ингредиенты (можно добавить отдельное поле)
  }));

  // Генерируем предупреждения об аллергиях и исключениях
  const warnings: string[] = [];
  if (profileClassification.pregnant) {
    warnings.push('⚠️ Во время беременности исключены продукты с ретинолом');
  }
  if (profileClassification.exclude && profileClassification.exclude.length > 0) {
    warnings.push(`⚠️ Исключены ингредиенты: ${profileClassification.exclude.join(', ')}`);
  }
  if (profileClassification.allergies && profileClassification.allergies.length > 0) {
    warnings.push(`⚠️ Учитываются аллергии: ${profileClassification.allergies.join(', ')}`);
  }

  // Преобразуем план в новый формат Plan28
  const plan28Days: DayPlan[] = [];
  const weeklySteps = carePlanTemplate.weekly || [];
  
  // Используем уже определенную routineComplexity из carePlanProfileInput
  // Если нужно переопределить из medicalMarkers, делаем это без const
  if ((medicalMarkers as any)?.routineComplexity) {
    routineComplexity = (medicalMarkers as any).routineComplexity;
  }
  
  // ИСПРАВЛЕНО: Проверяем, что weeks не пустой перед генерацией plan28
  if (weeks.length === 0) {
    logger.error('CRITICAL: weeks array is empty, cannot generate plan28', {
      userId,
      profileId: profile.id,
      weeksLength: weeks.length,
    });
    throw new Error('Plan generation failed: weeks array is empty');
  }
  
  for (let dayIndex = 1; dayIndex <= 28; dayIndex++) {
    const weekNum = Math.ceil(dayIndex / 7);
    const dayInWeek = ((dayIndex - 1) % 7) + 1;
    const weekData = weeks.find(w => w.week === weekNum);
    const dayData = weekData?.days.find(d => d.day === dayIndex);
    
    // ИСПРАВЛЕНО: Логируем, если dayData не найден, но не пропускаем день
    // Вместо этого создаем день с пустыми шагами, чтобы план не был пустым
    if (!dayData) {
      logger.warn('dayData not found for day, creating empty day structure', {
        dayIndex,
        weekNum,
        weeksCount: weeks.length,
        weekDataExists: !!weekData,
        weekDataDaysCount: weekData?.days?.length || 0,
        userId,
      });
      // Создаем минимальную структуру дня, чтобы план не был пустым
      plan28Days.push({
        dayIndex,
        phase: getPhaseForDay(dayIndex),
        isWeeklyFocusDay: false,
        morning: [],
        evening: [],
        weekly: [],
      });
      continue;
    }
    
    const phase = getPhaseForDay(dayIndex);
    const isWeekly = isWeeklyFocusDay(dayIndex, weeklySteps, routineComplexity as any);
    
    // Преобразуем morning steps
    // ИСПРАВЛЕНО: всегда используем getProductsForStep для plan28, не полагаемся на dayData.products
    // dayData.products может содержать только cleanser и SPF из-за фильтрации в старом формате
    // ИСПРАВЛЕНО: передаем фазу для фильтрации продуктов по этапу плана
    // ИСПРАВЛЕНО: Используем async цикл вместо map для поддержки await в fallback через БД
    const morningSteps: DayStep[] = [];
    for (const step of dayData.morning) {
      const stepCategory = step as StepCategory;
      let stepProducts = getProductsForStep(stepCategory, phase);
      
      // ИСПРАВЛЕНО: Если продуктов не найдено, пробуем найти через fallback
      if (stepProducts.length === 0) {
        // Пробуем fallback
        const fallback = getFallbackStep(stepCategory);
        if (fallback && fallback !== stepCategory) {
          stepProducts = getProductsForStep(fallback, phase);
        }
        
        // Если все еще нет, пробуем найти любой продукт для базового шага
        if (stepProducts.length === 0) {
          const baseStep = getBaseStepFromStepCategory(stepCategory);
          // ИСПРАВЛЕНО: Ищем в productsByStepMap все ключи, которые начинаются с базового шага
          // Например, для 'toner_hydrating' базовый шаг 'toner', ищем все 'toner_*'
          for (const [mapStep, products] of productsByStepMap.entries()) {
            const mapBaseStep = getBaseStepFromStepCategory(mapStep as StepCategory);
            // Сравниваем базовые шаги, а не полные названия
            if (mapBaseStep === baseStep || mapStep.startsWith(baseStep + '_') || mapStep === baseStep) {
              stepProducts.push(...products);
            }
          }
          // Удаляем дубликаты
          stepProducts = Array.from(new Map(stepProducts.map(p => [p.id, p])).values());
          
          // ИСПРАВЛЕНО: Фильтруем по фазе после сбора всех вариантов
          if (phase && stepProducts.length > 0) {
            stepProducts = filterProductsByPhase(stepProducts, phase, stepCategory);
          }
          
          // ИСПРАВЛЕНО: Если продуктов все еще нет, ищем через БД (асинхронный fallback)
          if (stepProducts.length === 0) {
            logger.warn('No products found for step after all fallbacks, searching DB (morning)', {
              stepCategory,
              baseStep,
              dayIndex,
              phase,
              userId,
            });
            
            // Последняя попытка: ищем через findFallbackProduct в БД
            try {
              const fallbackProduct = await findFallbackProduct(baseStep, profileClassification);
              if (fallbackProduct) {
                // Регистрируем fallback продукт для этого шага
                registerProductForStep(stepCategory, fallbackProduct);
                stepProducts = [fallbackProduct];
                logger.info('Fallback product found from DB (morning)', {
                  stepCategory,
                  baseStep,
                  productId: fallbackProduct.id,
                  productName: fallbackProduct.name,
                  userId,
                });
              } else {
                logger.warn('No fallback product found in DB (morning)', {
                  stepCategory,
                  baseStep,
                  dayIndex,
                  userId,
                });
              }
            } catch (fallbackError) {
              logger.error('Error searching fallback product in DB (morning)', {
                stepCategory,
                baseStep,
                error: fallbackError,
                userId,
              });
            }
          }
        }
      }
      
      const alternatives = stepProducts
        .slice(1, 4) // Берем следующие 3 продукта как альтернативы
        .map(p => String(p.id));
      
      // Логируем для отладки (особенно для пользователя 643160759)
      if (stepProducts.length === 0 || userId === '643160759' || process.env.NODE_ENV === 'development') {
        logger.warn('Products for step in plan28 morning', {
          step: stepCategory,
          dayIndex,
          productsCount: stepProducts.length,
          productIds: stepProducts.map(p => p.id).slice(0, 5),
          productsByStepMapKeys: Array.from(productsByStepMap.keys()),
          userId,
        });
      }
      
      // ВАЖНО: Всегда добавляем шаг в план, даже если productId = null
      // Это гарантирует, что все шаги из шаблона попадают в план
      morningSteps.push({
        stepCategory: stepCategory,
        productId: stepProducts.length > 0 ? String(stepProducts[0].id) : null,
        alternatives,
      });
    }
    
    // Преобразуем evening steps
    // ИСПРАВЛЕНО: передаем фазу для фильтрации продуктов по этапу плана
    // ИСПРАВЛЕНО: Используем async цикл вместо map для поддержки await в fallback через БД
    const eveningSteps: DayStep[] = [];
    for (const step of dayData.evening) {
      const stepCategory = step as StepCategory;
      let stepProducts = getProductsForStep(stepCategory, phase);
      
      // ИСПРАВЛЕНО: Если продуктов не найдено, пробуем найти через fallback
      if (stepProducts.length === 0) {
        // Пробуем fallback
        const fallback = getFallbackStep(stepCategory);
        if (fallback && fallback !== stepCategory) {
          stepProducts = getProductsForStep(fallback, phase);
        }
        
        // Если все еще нет, пробуем найти любой продукт для базового шага
        if (stepProducts.length === 0) {
          const baseStep = getBaseStepFromStepCategory(stepCategory);
          // ИСПРАВЛЕНО: Ищем в productsByStepMap все ключи, которые начинаются с базового шага
          // Например, для 'toner_hydrating' базовый шаг 'toner', ищем все 'toner_*'
          for (const [mapStep, products] of productsByStepMap.entries()) {
            const mapBaseStep = getBaseStepFromStepCategory(mapStep as StepCategory);
            // Сравниваем базовые шаги, а не полные названия
            if (mapBaseStep === baseStep || mapStep.startsWith(baseStep + '_') || mapStep === baseStep) {
              stepProducts.push(...products);
            }
          }
          // Удаляем дубликаты
          stepProducts = Array.from(new Map(stepProducts.map(p => [p.id, p])).values());
          
          // ИСПРАВЛЕНО: Фильтруем по фазе после сбора всех вариантов
          if (phase && stepProducts.length > 0) {
            stepProducts = filterProductsByPhase(stepProducts, phase, stepCategory);
          }
          
          // ИСПРАВЛЕНО: Если продуктов все еще нет, ищем через БД (асинхронный fallback)
          if (stepProducts.length === 0) {
            logger.warn('No products found for step after all fallbacks, searching DB (evening)', {
              stepCategory,
              baseStep,
              dayIndex,
              phase,
              userId,
            });
            
            // Последняя попытка: ищем через findFallbackProduct в БД
            try {
              const fallbackProduct = await findFallbackProduct(baseStep, profileClassification);
              if (fallbackProduct) {
                // Регистрируем fallback продукт для этого шага
                registerProductForStep(stepCategory, fallbackProduct);
                stepProducts = [fallbackProduct];
                logger.info('Fallback product found from DB (evening)', {
                  stepCategory,
                  baseStep,
                  productId: fallbackProduct.id,
                  productName: fallbackProduct.name,
                  userId,
                });
              } else {
                logger.warn('No fallback product found in DB (evening)', {
                  stepCategory,
                  baseStep,
                  dayIndex,
                  userId,
                });
              }
            } catch (fallbackError) {
              logger.error('Error searching fallback product in DB (evening)', {
                stepCategory,
                baseStep,
                error: fallbackError,
                userId,
              });
            }
          }
        }
      }
      
      const alternatives = stepProducts
        .slice(1, 4)
        .map(p => String(p.id));
      
      // Логируем для отладки (особенно для пользователя 643160759)
      if (stepProducts.length === 0 || userId === '643160759' || process.env.NODE_ENV === 'development') {
        logger.warn('Products for step in plan28 evening', {
          step: stepCategory,
          dayIndex,
          productsCount: stepProducts.length,
          productIds: stepProducts.map(p => p.id).slice(0, 5),
          productsByStepMapKeys: Array.from(productsByStepMap.keys()),
          userId,
        });
      }
      
      // ВАЖНО: Всегда добавляем шаг в план, даже если productId = null
      // Это гарантирует, что все шаги из шаблона попадают в план
      eveningSteps.push({
        stepCategory: stepCategory,
        productId: stepProducts.length > 0 ? String(stepProducts[0].id) : null,
        alternatives,
      });
    }
    
    // Преобразуем weekly steps (если это день для недельного ухода)
    // ИСПРАВЛЕНО: передаем фазу для фильтрации продуктов по этапу плана
    const weeklyDaySteps: DayStep[] = isWeekly ? weeklySteps.map((step: StepCategory) => {
      const stepProducts = getProductsForStep(step, phase);
      const alternatives = stepProducts
        .slice(1, 4)
        .map(p => String(p.id));
      
      return {
        stepCategory: step,
        productId: stepProducts.length > 0 ? String(stepProducts[0].id) : null,
        alternatives,
      };
    }) : [];
    
    plan28Days.push({
      dayIndex,
      phase,
      isWeeklyFocusDay: isWeekly,
      morning: morningSteps,
      evening: eveningSteps,
      weekly: weeklyDaySteps,
    });
  }
  
  // ИСПРАВЛЕНО: Проверяем, что план28Days не пустой перед возвратом
  if (plan28Days.length === 0) {
    logger.error('CRITICAL: plan28Days is empty after generation', {
      userId,
      profileId: profile.id,
      productsByStepMapSize: productsByStepMap.size,
      productsByStepMapKeys: Array.from(productsByStepMap.keys()),
      recommendationProductsCount: recommendationProducts.length,
      selectedProductsCount: selectedProducts.length,
    });
    throw new Error('Plan generation failed: no days generated');
  }
  
  logger.info('Plan28 days generated successfully', {
    userId,
    daysCount: plan28Days.length,
    daysWithProducts: plan28Days.filter(d => 
      d.morning.some(s => s.productId) || 
      d.evening.some(s => s.productId) || 
      d.weekly.some(s => s.productId)
    ).length,
    totalMorningSteps: plan28Days.reduce((sum, d) => sum + d.morning.length, 0),
    totalEveningSteps: plan28Days.reduce((sum, d) => sum + d.evening.length, 0),
    morningStepsWithProducts: plan28Days.reduce((sum, d) => 
      sum + d.morning.filter(s => s.productId).length, 0
    ),
    eveningStepsWithProducts: plan28Days.reduce((sum, d) => 
      sum + d.evening.filter(s => s.productId).length, 0
    ),
  });
  
  const plan28: Plan28 = {
    userId,
    skinProfileId: profile.id,
    days: plan28Days,
    mainGoals,
  };

  return {
    profile: {
      skinType: profile.skinType || 'normal',
      sensitivityLevel: profile.sensitivityLevel || 'low',
      acneLevel: profile.acneLevel || null,
      primaryFocus,
      // Синхронизируем с /analysis: используем те же ключевые проблемы (критичные и плохие)
      concerns: keyProblems.length > 0 ? keyProblems : concerns.slice(0, 3), // Если нет критичных/плохих, берем первые 3 concerns
      ageGroup: profile.ageGroup || '25-34',
    },
    skinScores: skinScores.map(s => ({
      axis: s.axis,
      value: s.value,
      level: s.level,
      title: s.title,
      description: s.description,
      color: s.color,
    })),
    dermatologistRecommendations: {
      heroActives: dermatologistRecs.heroActives,
      mustHave: dermatologistRecs.mustHave,
      avoid: dermatologistRecs.avoid,
    },
    weeks,
    infographic: {
      progress: infographicProgress,
      chartConfig,
    },
    products: formattedProducts,
    warnings: warnings.length > 0 ? warnings : undefined,
    // Новый формат плана Plan28
    plan28,
  };
  } catch (error: unknown) {
    logger.error('❌ Error in generate28DayPlan', error, {
      userId,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
    });
    throw error; // Пробрасываем ошибку дальше
  }
}
