// app/api/plan/generate/route.ts
// Генерация 28-дневного плана ухода за кожей (улучшенная версия по методике)

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getCachedPlan, setCachedPlan } from '@/lib/cache';
import { calculateSkinAxes, getDermatologistRecommendations, type QuestionnaireAnswers } from '@/lib/skin-analysis-engine';
import { calculateSkinIssues } from '@/app/api/analysis/route';
import { isStepAllowedForProfile, type StepCategory } from '@/lib/step-category-rules';
import { selectCarePlanTemplate, type CarePlanProfileInput } from '@/lib/care-plan-templates';
import type { Plan28, DayPlan, DayStep } from '@/lib/plan-types';
import { getPhaseForDay, isWeeklyFocusDay } from '@/lib/plan-types';
import { logger, logApiRequest, logApiError } from '@/lib/logger';
import '@/lib/env-check'; // Валидация env переменных при старте
import { ApiResponse } from '@/lib/api-response';
import { PLAN_DAYS_TOTAL, PLAN_WEEKS_TOTAL, PLAN_DAYS_PER_WEEK } from '@/lib/constants';
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

export const runtime = 'nodejs';

interface PlanDay {
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

interface PlanWeek {
  week: number;
  days: PlanDay[];
  summary: {
    focus: string[];
    productsCount: number;
  };
}

interface GeneratedPlan {
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
  warnings?: string[]; // Предупреждения об аллергиях и исключениях
  plan28?: Plan28; // Новый формат плана Plan28
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

// Вспомогательная функция: содержит ли продукт ретинол
function containsRetinol(productIngredients: string[] | null | undefined): boolean {
  if (!productIngredients || productIngredients.length === 0) return false;
  const ingredientsLower = productIngredients.map(ing => ing.toLowerCase());
  return ingredientsLower.some(ing => 
    ing.includes('ретинол') || 
    ing.includes('retinol') || 
    ing.includes('адапален') ||
    ing.includes('adapalene') ||
    ing.includes('третиноин') ||
    ing.includes('tretinoin')
  );
}

const CLEANER_FALLBACK_STEP: StepCategory = 'cleanser_gentle';
const SPF_FALLBACK_STEP: StepCategory = 'spf_50_face';

// isCleanserStep и isSPFStep теперь импортируются из lib/plan-helpers.ts

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
  // ВАЖНО: SPF всегда должен быть последним в утренней рутине
  // Очищение всегда должно быть первым
  if (isSPFStep(fallback)) {
    return [...steps, fallback];
  }
  if (isCleanserStep(fallback)) {
    return [fallback, ...steps];
  }
  return [fallback, ...steps];
}

function getFallbackStep(step: string): StepCategory | undefined {
  // Маппинг старых значений step на новые StepCategory
  if (step.startsWith('cleanser')) return 'cleanser_gentle';
  if (step.startsWith('toner')) return 'toner_hydrating';
  if (step.startsWith('serum')) return 'serum_hydrating';
  if (step.startsWith('treatment')) return 'treatment_antiage';
  if (step.startsWith('moisturizer')) return 'moisturizer_light';
  if (step.startsWith('spf') || step === 'spf') return 'spf_50_face';
  return undefined;
}

// getBaseStepFromStepCategory теперь импортируется из lib/plan-helpers.ts

/**
 * Генерирует 28-дневный план на основе профиля и ответов анкеты
 * ВАЖНО: Не экспортируем эту функцию, так как Next.js Route файлы могут экспортировать только GET, POST и т.д.
 * Для вызова из других модулей используйте fetch к /api/plan/generate
 */
async function generate28DayPlan(userId: string): Promise<GeneratedPlan> {
    logger.info('Generating plan', { userId });
  
  // Получаем профиль кожи
    logger.debug('Looking for skin profile', { userId });
  const profile = await prisma.skinProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!profile) {
    logger.error('No skin profile found', undefined, { userId });
    throw new Error('No skin profile found');
  }
  
  logger.info('Skin profile found', {
    profileId: profile.id,
    skinType: profile.skinType,
    version: profile.version,
    userId,
  });

  // Получаем ответы пользователя
  const userAnswers = await prisma.userAnswer.findMany({
    where: {
      userId,
      questionnaireId: 2, // v2 анкета
    },
    include: {
      question: {
        include: {
          answerOptions: true,
        },
      },
    },
  });

  // Парсим ответы в удобный формат
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
  const stepProfile: import('@/lib/skinprofile-types').SkinProfile = {
    ...createEmptySkinProfile(),
    skinType: profile.skinType as any,
    sensitivity: profile.sensitivityLevel as any,
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
  const mainGoals: string[] = [];
  if (primaryFocus === 'acne') mainGoals.push('acne');
  if (primaryFocus === 'pigmentation') mainGoals.push('pigmentation');
  if (primaryFocus === 'wrinkles') mainGoals.push('antiage');
  if (concerns.includes('Барьер') || concerns.includes('Чувствительность')) {
    mainGoals.push('barrier');
  }
  if (concerns.includes('Обезвоженность') || concerns.includes('Сухость')) {
    mainGoals.push('dehydration');
  }

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
  const requiredStepCategories = new Set<StepCategory>();
  carePlanTemplate.morning.forEach((step) => requiredStepCategories.add(step));
  carePlanTemplate.evening.forEach((step) => requiredStepCategories.add(step));
  carePlanTemplate.weekly?.forEach((step) => requiredStepCategories.add(step));
  logger.info('Selected care plan template', {
    templateId: carePlanTemplate.id,
    skinType: carePlanProfileInput.skinType,
    mainGoals: carePlanProfileInput.mainGoals,
    sensitivityLevel: carePlanProfileInput.sensitivityLevel,
    routineComplexity: carePlanProfileInput.routineComplexity,
    requiredSteps: Array.from(requiredStepCategories),
  });

  // Шаг 2: Фильтрация продуктов
  logger.debug('Filtering products', { primaryFocus, skinType: profileClassification.skinType, budget: profileClassification.budget, userId });
  
  // ВАЖНО: Сначала пытаемся получить продукты из RecommendationSession
  // Это гарантирует, что план использует те же продукты, что и главная страница
  // Ищем сессию для текущего профиля, чтобы при перепрохождении анкеты использовались новые продукты
  let recommendationProducts: any[] = [];
  const existingSession = await prisma.recommendationSession.findFirst({
    where: {
      userId,
      profileId: profile.id, // Только для текущего профиля
      ruleId: { not: null }, // Только сессии, созданные из правил (не из плана)
    },
    orderBy: { createdAt: 'desc' },
  });

  // КРИТИЧНО: Если в сессии слишком мало продуктов (меньше 3), игнорируем её
  // Это предотвращает замкнутый круг, когда план использует только 2 продукта из сессии,
  // а затем перезаписывает сессию теми же 2 продуктами
  const { MIN_PRODUCTS_IN_SESSION } = await import('@/lib/constants');
  const minProductsInSession = MIN_PRODUCTS_IN_SESSION;

  if (existingSession && existingSession.products && Array.isArray(existingSession.products)) {
    const productIds = existingSession.products as number[];
    
    // Проверяем, достаточно ли продуктов в сессии
    if (productIds.length < minProductsInSession) {
      logger.warn('RecommendationSession has too few products, ignoring it', {
        userId,
        sessionId: existingSession.id,
        productCount: productIds.length,
        minRequired: minProductsInSession,
        ruleId: existingSession.ruleId,
      });
      
      // Если сессия была создана из плана (ruleId = null), удаляем её, чтобы не мешала
      if (existingSession.ruleId === null) {
        logger.info('Deleting RecommendationSession created from plan (too few products)', {
          userId,
          sessionId: existingSession.id,
        });
        await prisma.recommendationSession.delete({
          where: { id: existingSession.id },
        });
      }
    } else {
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
    if (stepStr.startsWith('cleanser_gentle') || categoryStr.includes('gentle')) {
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
    } else if (stepStr === 'treatment') {
      categories.push('treatment_antiage'); // fallback
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
    
    // Если ничего не найдено, возвращаем пустой массив
    return categories.length > 0 ? categories : [];
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
      // Fallback: если не удалось распознать, пытаемся использовать напрямую
      const stepKey = (product.step || product.category || 'other') as StepCategory;
      registerProductForStep(stepKey, productWithBrand);
      const fallbackStep = getFallbackStep(stepKey);
      if (fallbackStep && fallbackStep !== stepKey) {
        registerProductForStep(fallbackStep, productWithBrand);
      }
      
      // Логируем, если продукт не был распознан
      logger.warn('Product not recognized by mapStepToStepCategory, using fallback', {
        productId: product.id,
        productName: product.name,
        step: product.step,
        category: product.category,
        stepKey,
        fallbackStep,
        userId,
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

  const getProductsForStep = (step: StepCategory): ProductWithBrand[] => {
    // Сначала пробуем найти по точному совпадению StepCategory
    const exact = productsByStepMap.get(step);
    if (exact && exact.length > 0) {
      return exact;
    }
    
    // Если не найдено, пробуем найти по базовому step (например, 'toner' для 'toner_hydrating')
    const baseStep = getBaseStepFromStepCategory(step);
    if (baseStep !== step) {
      const base = productsByStepMap.get(baseStep as StepCategory);
      if (base && base.length > 0) {
        return base;
      }
    }
    
    // Если не найдено, пробуем fallback StepCategory
    const fallback = getFallbackStep(step);
    if (fallback && fallback !== step) {
      const fallbackProducts = productsByStepMap.get(fallback);
      if (fallbackProducts && fallbackProducts.length > 0) {
        return fallbackProducts;
      }
      
      // Если fallback тоже не найден, пробуем базовый step от fallback
      const fallbackBaseStep = getBaseStepFromStepCategory(fallback);
      if (fallbackBaseStep !== fallback) {
        const fallbackBase = productsByStepMap.get(fallbackBaseStep as StepCategory);
        if (fallbackBase && fallbackBase.length > 0) {
          return fallbackBase;
        }
      }
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
  
  // Логируем итоговое состояние productsByStepMap для диагностики
  if (userId === '643160759' || process.env.NODE_ENV === 'development') {
    const stepSummary = Array.from(productsByStepMap.entries()).map(([step, products]) => ({
      step,
      count: products.length,
      productIds: products.map(p => p.id),
      productNames: products.map(p => p.name).slice(0, 3),
    }));
    logger.info('ProductsByStepMap summary AFTER ensureRequiredProducts', {
      userId,
      requiredSteps: Array.from(requiredStepCategories),
      totalSteps: productsByStepMap.size,
      steps: stepSummary,
      selectedProductsCount: selectedProducts.length,
      selectedProductIds: selectedProducts.map((p: any) => p.id),
    });
  }

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
      
      const templateMorningBase = carePlanTemplate.morning;
      const templateEveningBase = carePlanTemplate.evening;

      const progressionFactor = (weekNum - 1) / 3;

      const baseMorningCleanser =
        templateMorningBase.find(isCleanserStep) ?? CLEANER_FALLBACK_STEP;
      const baseMorningSPF = templateMorningBase.find(isSPFStep) ?? SPF_FALLBACK_STEP;
      const templateMorningAdditional = templateMorningBase.filter(
        (step) => !isCleanserStep(step) && !isSPFStep(step)
      );
      const morningAdditionalLimit = Math.max(
        0,
        Math.round(
          1 +
            progressionFactor *
              Math.max(templateMorningAdditional.length - 1, 0)
        )
      );
      const rawMorningSteps = dedupeSteps([
        baseMorningCleanser,
        ...templateMorningAdditional.slice(0, morningAdditionalLimit),
        baseMorningSPF,
      ]);

      const baseEveningCleanser =
        templateEveningBase.find(isCleanserStep) ?? CLEANER_FALLBACK_STEP;
      const templateEveningAdditional = templateEveningBase.filter(
        (step) => !isCleanserStep(step) && !isSPFStep(step)
      );
      const eveningAdditionalLimit = Math.max(
        0,
        Math.round(
          1 +
            progressionFactor *
              Math.max(templateEveningAdditional.length - 1, 0)
        )
      );
      const rawEveningSteps = dedupeSteps([
        baseEveningCleanser,
        ...templateEveningAdditional.slice(0, eveningAdditionalLimit),
      ]);

      const allowedMorningSteps = rawMorningSteps.filter((step) =>
        isStepAllowedForProfile(step, stepProfile)
      );
      const allowedEveningSteps = rawEveningSteps.filter((step) =>
        isStepAllowedForProfile(step, stepProfile)
      );

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
            // Если даже fallback не найден, логируем критическую ошибку
            logger.error('CRITICAL: No products available for step, even after fallback search', {
              step,
              baseStep,
              day,
              week: weekNum,
              userId,
            });
            // Пропускаем этот шаг, но продолжаем обработку остальных
            continue;
          }
        }
        
        // ВАЖНО: Для очищения и SPF не применяем строгую дерматологическую фильтрацию
        // Они должны быть всегда доступны
        if (isCleanserStep(step) || isSPFStep(step)) {
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
            // Если даже fallback не найден, логируем критическую ошибку
            logger.error('CRITICAL: No products available for step, even after fallback search', {
              step,
              baseStep,
              day,
              week: weekNum,
              userId,
            });
            // Пропускаем этот шаг, но продолжаем обработку остальных
            continue;
          }
        }
        
        // ВАЖНО: Для очищения не применяем строгую дерматологическую фильтрацию
        // Оно должно быть всегда доступно
        if (isCleanserStep(step)) {
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

      days.push({
        day,
        week: weekNum,
        morning: morningSteps.filter((step) => {
          if (isCleanserStep(step) || isSPFStep(step)) return true;
          return getProductsForStep(step).length > 0;
        }),
        evening: eveningSteps.filter((step) => {
          if (isCleanserStep(step)) return true;
          return getProductsForStep(step).length > 0;
        }),
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
  
  for (let dayIndex = 1; dayIndex <= 28; dayIndex++) {
    const weekNum = Math.ceil(dayIndex / 7);
    const dayInWeek = ((dayIndex - 1) % 7) + 1;
    const weekData = weeks.find(w => w.week === weekNum);
    const dayData = weekData?.days.find(d => d.day === dayIndex);
    
    if (!dayData) continue;
    
    const phase = getPhaseForDay(dayIndex);
    const isWeekly = isWeeklyFocusDay(dayIndex, weeklySteps, routineComplexity as any);
    
    // Преобразуем morning steps
    // ИСПРАВЛЕНО: всегда используем getProductsForStep для plan28, не полагаемся на dayData.products
    // dayData.products может содержать только cleanser и SPF из-за фильтрации в старом формате
    const morningSteps: DayStep[] = dayData.morning.map((step: string) => {
      const stepCategory = step as StepCategory;
      const stepProducts = getProductsForStep(stepCategory);
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
          userId,
        });
      }
      
      // Всегда используем продукты из getProductsForStep, который использует productsByStepMap
      // Это гарантирует, что будут использованы все найденные продукты для каждого шага
      return {
        stepCategory: stepCategory,
        productId: stepProducts.length > 0 ? String(stepProducts[0].id) : null,
        alternatives,
      };
    });
    
    // Преобразуем evening steps
    const eveningSteps: DayStep[] = dayData.evening.map((step: string) => {
      const stepCategory = step as StepCategory;
      const stepProducts = getProductsForStep(stepCategory);
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
          userId,
        });
      }
      
      // Всегда используем продукты из getProductsForStep
      return {
        stepCategory: stepCategory,
        productId: stepProducts.length > 0 ? String(stepProducts[0].id) : null,
        alternatives,
      };
    });
    
    // Преобразуем weekly steps (если это день для недельного ухода)
    const weeklyDaySteps: DayStep[] = isWeekly ? weeklySteps.map((step: StepCategory) => {
      const stepProducts = getProductsForStep(step);
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
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const method = 'GET';
  const path = '/api/plan/generate';
  let userId: string | undefined;
  
  // Таймаут для генерации плана (60 секунд)
  const PLAN_GENERATION_TIMEOUT = 60000;
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Plan generation timeout after 60 seconds'));
    }, PLAN_GENERATION_TIMEOUT);
  });
  
  try {
    // Получаем initData из заголовков
    // Получаем initData из заголовков (пробуем оба варианта)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');
    
    if (!initData) {
      logger.error('Missing initData in headers for plan generation', {
        availableHeaders: Array.from(request.headers.keys()),
      });
    }

    if (!initData) {
      logger.error('No initData provided');
      return ApiResponse.unauthorized('Missing Telegram initData. Please open the app through Telegram Mini App.');
    }

    // Получаем userId из initData (автоматически создает/обновляет пользователя)
    const { getUserIdFromInitData } = await import('@/lib/get-user-from-initdata');
    const userIdResult = await getUserIdFromInitData(initData);
    userId = userIdResult || undefined;
    
    if (!userId) {
      logger.error('Invalid or expired initData');
      return ApiResponse.unauthorized('Invalid or expired Telegram initData');
    }

    logger.info('User identified from initData', { userId });
    
    // Получаем профиль для версии
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { version: true },
    });

    if (!profile) {
      logger.error('No skin profile found for user', { userId });
      return ApiResponse.notFound('No skin profile found', { userId });
    }

    // Детальное логирование для диагностики (особенно для пользователя 643160759)
    logger.info('Plan generation request', {
      userId,
      profileVersion: profile.version,
      timestamp: new Date().toISOString(),
    });

    // Проверяем кэш
    logger.debug('Checking cache for plan', { userId, profileVersion: profile.version });

    logger.info('Starting plan generation', { userId });
    
    // Выполняем генерацию с таймаутом
    const plan = await Promise.race([
      generate28DayPlan(userId),
      timeoutPromise,
    ]) as Awaited<ReturnType<typeof generate28DayPlan>>;
    
    // ВАЖНО: RecommendationSession создается из правил рекомендаций (/api/recommendations),
    // а НЕ из плана. План только читает из сессии, но не перезаписывает её.
    // Это гарантирует, что план использует те же продукты, что показаны на главной странице.
    logger.info('Plan generated - RecommendationSession should be created from recommendation rules, not from plan', {
          userId,
      planProductsCount: plan.products?.length || 0,
      });
    
    // Сохраняем в кэш
    logger.info('Caching plan', { userId, profileVersion: profile.version });
    await setCachedPlan(userId, profile.version, plan);
    
    logger.info('Plan generated successfully', {
      userId,
      weeksCount: plan.weeks?.length || 0,
      productsCount: plan.products?.length || 0,
      profile: plan.profile?.skinType || 'unknown',
      warnings: plan.warnings?.length || 0,
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return ApiResponse.success(plan);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    
    return ApiResponse.internalError(error, { userId, method, path, duration });
  }
}
