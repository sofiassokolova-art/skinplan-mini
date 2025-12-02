// app/api/plan/generate/route.ts
// Генерация 28-дневного плана ухода за кожей (улучшенная версия по методике)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCachedPlan, setCachedPlan } from '@/lib/cache';
import { calculateSkinAxes, getDermatologistRecommendations, type QuestionnaireAnswers } from '@/lib/skin-analysis-engine';
import { isStepAllowedForProfile, type StepCategory } from '@/lib/step-category-rules';
import { selectCarePlanTemplate, type CarePlanProfileInput } from '@/lib/care-plan-templates';
import type { Plan28, DayPlan, DayStep } from '@/lib/plan-types';
import { getPhaseForDay, isWeeklyFocusDay } from '@/lib/plan-types';
import { logger, logApiRequest, logApiError } from '@/lib/logger';

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

const isCleanserStep = (step: StepCategory) => step.startsWith('cleanser');
const isSPFStep = (step: StepCategory) => step.startsWith('spf');

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

function getBaseStepFromStepCategory(stepCategory: StepCategory): string {
  // Обратный маппинг: от StepCategory к базовому step
  // Например: 'toner_hydrating' -> 'toner', 'serum_hydrating' -> 'serum'
  if (stepCategory.startsWith('cleanser_')) return 'cleanser';
  if (stepCategory.startsWith('toner_')) return 'toner';
  if (stepCategory.startsWith('serum_')) return 'serum';
  if (stepCategory.startsWith('treatment_')) return 'treatment';
  if (stepCategory.startsWith('moisturizer_')) return 'moisturizer';
  if (stepCategory.startsWith('eye_cream_')) return 'moisturizer';
  if (stepCategory.startsWith('spf_')) return 'spf';
  if (stepCategory.startsWith('mask_')) return 'mask';
  if (stepCategory === 'spot_treatment') return 'treatment';
  if (stepCategory === 'lip_care') return 'moisturizer';
  if (stepCategory === 'balm_barrier_repair') return 'moisturizer';
  return stepCategory; // Если не распознан, возвращаем как есть
}

/**
 * Генерирует 28-дневный план на основе профиля и ответов анкеты
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
  
  console.log(`✅ Skin profile found:`, {
    profileId: profile.id,
    skinType: profile.skinType,
    version: profile.version,
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
  
  console.log('📊 Skin analysis scores:', skinScores.map(s => `${s.title}: ${s.value} (${s.level})`).join(', '));

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

  const profileClassification = {
    focus: goals.filter((g: string) => 
      ['Акне и высыпания', 'Сократить видимость пор', 'Выровнять пигментацию', 'Морщины и мелкие линии'].includes(g)
    ),
    skinType: profile.skinType || 'normal',
    concerns: concerns,
    ageGroup: profile.ageGroup || '25-34',
    exclude: Array.isArray(answers.exclude_ingredients) ? answers.exclude_ingredients : [],
    budget: answers.budget || 'средний',
    pregnant: profile.hasPregnancy || false,
    stepsPreference: answers.care_steps || 'средний',
    allergies: Array.isArray(answers.allergies) ? answers.allergies : [],
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
  console.log('🧩 Selected care plan template:', {
    templateId: carePlanTemplate.id,
    skinType: carePlanProfileInput.skinType,
    mainGoals: carePlanProfileInput.mainGoals,
    sensitivityLevel: carePlanProfileInput.sensitivityLevel,
    routineComplexity: carePlanProfileInput.routineComplexity,
  });

  // Шаг 2: Фильтрация продуктов
  console.log(`🔍 Filtering products for focus: ${primaryFocus}, skinType: ${profileClassification.skinType}, budget: ${profileClassification.budget}`);
  
  // ВАЖНО: Сначала пытаемся получить продукты из RecommendationSession
  // Это гарантирует, что план использует те же продукты, что и главная страница
  let recommendationProducts: any[] = [];
  const existingSession = await prisma.recommendationSession.findFirst({
    where: {
      userId,
      profileId: profile.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existingSession && existingSession.products && Array.isArray(existingSession.products)) {
    console.log('✅ Using products from RecommendationSession for plan generation');
    const productIds = existingSession.products as number[];
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
    
    // Сортируем в памяти
    recommendationProducts.sort((a: any, b: any) => {
      if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
      return b.priority - a.priority;
    });
    console.log(`📦 Found ${recommendationProducts.length} products from RecommendationSession`);
  } else {
    console.log('⚠️ No RecommendationSession found, will generate products from scratch');
  }
  
  // Если есть продукты из RecommendationSession, используем их
  // Иначе получаем все опубликованные продукты
  let allProducts: any[];
  if (recommendationProducts.length > 0) {
    console.log('✅ Using products from RecommendationSession');
    allProducts = recommendationProducts;
  } else {
    console.log('⚠️ No RecommendationSession products, fetching all published products');
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

  // Если используем продукты из RecommendationSession, пропускаем фильтрацию
  // (они уже прошли фильтрацию при создании сессии)
  // Иначе фильтруем продукты по критериям, СИНХРОНИЗИРОВАННЫМ с полями админки:
  // - step (категория шага)
  // - skinTypes (для каких типов кожи подходит)
  // - concerns (активы / ключевые свойства)
  // - avoidIf (беременность, аллергия на ретинол и т.п.)
  const filteredProducts = recommendationProducts.length > 0 
    ? allProducts // Используем продукты из RecommendationSession без дополнительной фильтрации
    : allProducts.filter(product => {
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
      productSkinTypes.includes(profileClassification.skinType);

    // Проверка бюджета (если указан)
    const budgetMatches =
      !profileClassification.budget ||
      profileClassification.budget === 'любой' ||
      !productPrice ||
      getBudgetTier(productPrice) === profileClassification.budget;

    // Проверка исключенных ингредиентов (по admin-полю concerns + ответу exclude_ingredients)
    const noExcludedIngredients = !containsExcludedIngredients(
      productConcerns,
      profileClassification.exclude
    );

    // Явные противопоказания из админки:
    // - avoidIf: ['pregnant', 'retinol_allergy', ...]
    // - беременность: profileClassification.pregnant (из профиля / ответов)
    const safeForPregnancy =
      !profileClassification.pregnant || !productAvoidIf.includes('pregnant');

    // Аллергия на ретинол / сильные кислоты:
    // если в ответах пользователь исключил ретинол, то избегаем продуктов с avoidIf 'retinol_allergy'
    const hasRetinolContraInAnswers = Array.isArray(profileClassification.exclude)
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

  // Если есть продукты из RecommendationSession, используем их все (не ограничиваем)
  // Иначе ограничиваем количество продуктов (3 утро + 3 вечер = максимум 6)
  let selectedProducts = recommendationProducts.length > 0 
    ? sortedProducts // Используем все продукты из RecommendationSession
    : sortedProducts.slice(0, 6); // Ограничиваем только если генерируем с нуля
  
  // Автозамена продуктов с неактивными брендами
  // Проверяем, перепроходил ли пользователь анкету (если нет - не заменяем)
  const latestProfile = await prisma.skinProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  
  const hasRecentProfile = latestProfile && 
    new Date().getTime() - new Date(latestProfile.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000; // 7 дней
  
  if (hasRecentProfile) {
    // Пользователь недавно проходил анкету - делаем автозамену
    const replacedProducts = await Promise.all(
      selectedProducts.map(async (product: any) => {
        // Проверяем, активен ли бренд
        const productBrand = (product as any).brand;
        if (productBrand && !productBrand.isActive) {
          console.log(`⚠️ Product ${product.name} has inactive brand ${productBrand.name}, searching for replacement...`);
          
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
            console.log(`✅ Replaced ${product.name} with ${replacement.name}`);
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
              console.log(`✅ Replaced ${product.name} with any available ${anyReplacement.name}`);
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
    console.log('ℹ️ User has not retaken questionnaire recently, keeping existing products even if brand is inactive');
  }
  
  console.log(`✅ Selected ${selectedProducts.length} products ${recommendationProducts.length > 0 ? 'from RecommendationSession' : 'after filtering'}`);

  // Группируем продукты по шагам
  const productsByStep: Record<string, typeof selectedProducts> = {};

  const registerProductForStep = (
    stepKey: string,
    product: (typeof selectedProducts)[number]
  ) => {
    if (!productsByStep[stepKey]) {
      productsByStep[stepKey] = [];
    }
    productsByStep[stepKey].push(product);
  };

  selectedProducts.forEach((product) => {
    const stepKey = (product.step || product.category || 'other') as string;
    registerProductForStep(stepKey, product);
    const fallbackStep = getFallbackStep(stepKey);
    if (fallbackStep && fallbackStep !== stepKey) {
      registerProductForStep(fallbackStep, product);
    }
  });

  const getProductsForStep = (step: StepCategory) => {
    // Сначала пробуем найти по точному совпадению StepCategory
    if (productsByStep[step] && productsByStep[step].length > 0) {
      return productsByStep[step];
    }
    
    // Если не найдено, пробуем найти по базовому step (например, 'toner' для 'toner_hydrating')
    const baseStep = getBaseStepFromStepCategory(step);
    if (baseStep !== step && productsByStep[baseStep] && productsByStep[baseStep].length > 0) {
      return productsByStep[baseStep];
    }
    
    // Если не найдено, пробуем fallback StepCategory
    const fallback = getFallbackStep(step);
    if (fallback && fallback !== step && productsByStep[fallback] && productsByStep[fallback].length > 0) {
      return productsByStep[fallback];
    }
    
    // Если fallback тоже не найден, пробуем базовый step от fallback
    if (fallback) {
      const fallbackBaseStep = getBaseStepFromStepCategory(fallback);
      if (fallbackBaseStep !== fallback && productsByStep[fallbackBaseStep] && productsByStep[fallbackBaseStep].length > 0) {
        return productsByStep[fallbackBaseStep];
      }
    }
    
    return [];
  };

  const ensureProductsForRequiredSteps = async () => {
    const missingByBaseStep = new Map<string, Set<StepCategory>>();

    requiredStepCategories.forEach((stepCategory) => {
      if (getProductsForStep(stepCategory).length > 0) {
        return;
      }
      const baseStep = getBaseStepFromStepCategory(stepCategory);
      if (!missingByBaseStep.has(baseStep)) {
        missingByBaseStep.set(baseStep, new Set());
      }
      missingByBaseStep.get(baseStep)!.add(stepCategory);
    });

    for (const [baseStep, stepCategories] of missingByBaseStep.entries()) {
      const whereClause: any = {
        published: true as any,
        brand: {
          isActive: true,
        },
      };

      if (baseStep === 'spf') {
        whereClause.OR = [
          { step: 'spf' },
          { category: 'spf' },
        ];
      } else {
        whereClause.step = baseStep;
      }

      if (baseStep !== 'spf' && profileClassification.skinType) {
        whereClause.AND = [
          ...(whereClause.AND || []),
          {
            OR: [
              { skinTypes: { has: profileClassification.skinType } },
              { skinTypes: { isEmpty: true } },
            ],
          },
        ];
      }

      const fallbackProduct = await prisma.product.findFirst({
        where: whereClause,
        include: { brand: true },
        orderBy: [
          { isHero: 'desc' },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      if (!fallbackProduct) {
        console.warn(`⚠️ Could not find fallback product for base step ${baseStep}`);
        continue;
      }

      console.log(`✅ Added fallback ${baseStep} product for plan: ${fallbackProduct.name} (#${fallbackProduct.id})`);
      registerProductForStep(baseStep, fallbackProduct);
      for (const stepCategory of stepCategories.values()) {
        registerProductForStep(stepCategory, fallbackProduct);
      }
      if (!selectedProducts.some((p: any) => p.id === fallbackProduct.id)) {
        selectedProducts.push(fallbackProduct);
      }
    }
  };

  // ГАРАНТИРУЕМ наличие очищения (cleanser) и SPF - они обязательны для всех
  // Если их нет в отфильтрованных продуктах, добавляем отдельно
  
  // Проверяем и добавляем очищение, если его нет
  if (!productsByStep['cleanser'] || productsByStep['cleanser'].length === 0) {
    console.log('⚠️ No cleanser products found, searching for fallback...');
    const whereCleanser: any = {
      published: true as any,
      step: 'cleanser', // Исправлено: было 'cleansing', должно быть 'cleanser'
      brand: {
        isActive: true, // Только активные бренды
      },
    };
    
    // Очищение должно быть доступно, но если есть тип кожи - предпочтем его
    if (profileClassification.skinType) {
      whereCleanser.OR = [
        { skinTypes: { has: profileClassification.skinType } },
        { skinTypes: { isEmpty: true } },
      ];
    }
    
    const fallbackCleanser = await prisma.product.findFirst({
      where: {
        ...whereCleanser,
        brand: {
          isActive: true, // Только активные бренды
        },
      } as any,
      include: { brand: true },
      orderBy: { createdAt: 'desc' },
    });
    
    if (fallbackCleanser) {
      if (!productsByStep['cleanser']) {
        productsByStep['cleanser'] = [];
      }
      productsByStep['cleanser'].push(fallbackCleanser);
      console.log(`✅ Added fallback cleanser: ${fallbackCleanser.name}`);
    } else {
      // Если даже с фильтром не нашли, берем любой очищающий продукт
      const anyCleanser = await prisma.product.findFirst({
        where: {
          published: true as any,
          step: 'cleanser', // Исправлено: было 'cleansing', должно быть 'cleanser'
          brand: {
            isActive: true, // Только активные бренды
        },
        } as any,
        include: { brand: true },
        orderBy: { createdAt: 'desc' },
      });
      
      if (anyCleanser) {
        if (!productsByStep['cleanser']) {
          productsByStep['cleanser'] = [];
        }
        productsByStep['cleanser'].push(anyCleanser);
        console.log(`✅ Added any available cleanser: ${anyCleanser.name}`);
      }
    }
  }

  // Проверяем и добавляем SPF, если его нет (SPF универсален для всех)
  if (!productsByStep['spf'] || productsByStep['spf'].length === 0) {
    console.log('⚠️ No SPF products found, searching for fallback...');
    const fallbackSPF = await prisma.product.findFirst({
      where: {
        published: true as any,
        OR: [
          { step: 'spf' },
          { category: 'spf' },
        ],
        brand: {
          isActive: true, // Только активные бренды
        },
        // SPF универсален - не фильтруем по типу кожи
      } as any,
      include: { brand: true },
      orderBy: { createdAt: 'desc' },
    });
    
    if (fallbackSPF) {
      if (!productsByStep['spf']) {
        productsByStep['spf'] = [];
      }
      productsByStep['spf'].push(fallbackSPF);
      console.log(`✅ Added fallback SPF: ${fallbackSPF.name}`);
    }
  }

  await ensureProductsForRequiredSteps();

  // Шаг 3: Генерация плана (28 дней, 4 недели)
  const weeks: PlanWeek[] = [];
  
  for (let weekNum = 1; weekNum <= 4; weekNum++) {
    const days: PlanDay[] = [];
    
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
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
      stepsForDay.forEach((step) => {
        const stepProducts = getProductsForStep(step);
        if (stepProducts.length > 0) {
          dayProducts[step] = {
            id: stepProducts[0].id,
            name: stepProducts[0].name,
            brand: stepProducts[0].brand.name,
            step,
          };
        }
      });

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
  if (profileClassification.exclude.length > 0) {
    warnings.push(`⚠️ Исключены ингредиенты: ${profileClassification.exclude.join(', ')}`);
  }
  if (profileClassification.allergies.length > 0) {
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
    const morningSteps: DayStep[] = dayData.morning.map((step: string) => {
      const stepCategory = step as StepCategory;
      const product = dayData.products[step];
      const stepProducts = getProductsForStep(stepCategory);
      const alternatives = stepProducts
        .slice(1, 4) // Берем следующие 3 продукта как альтернативы
        .map(p => String(p.id));
      
      return {
        stepCategory: stepCategory,
        productId: product ? String(product.id) : (stepProducts.length > 0 ? String(stepProducts[0].id) : null),
        alternatives,
      };
    });
    
    // Преобразуем evening steps
    const eveningSteps: DayStep[] = dayData.evening.map((step: string) => {
      const stepCategory = step as StepCategory;
      const product = dayData.products[step];
      const stepProducts = getProductsForStep(stepCategory);
      const alternatives = stepProducts
        .slice(1, 4)
        .map(p => String(p.id));
      
      return {
        stepCategory: stepCategory,
        productId: product ? String(product.id) : (stepProducts.length > 0 ? String(stepProducts[0].id) : null),
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
      concerns: concerns.slice(0, 3),
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
  
  try {
    // Получаем initData из заголовков
    // Получаем initData из заголовков (пробуем оба варианта)
    const initData = request.headers.get('x-telegram-init-data') ||
                     request.headers.get('X-Telegram-Init-Data');
    
    if (!initData) {
      console.error('⚠️ Missing initData in headers for plan generation:', {
        availableHeaders: Array.from(request.headers.keys()),
      });
    }

    if (!initData) {
      console.error('❌ No initData provided');
      return NextResponse.json(
        { error: 'Missing Telegram initData. Please open the app through Telegram Mini App.' },
        { status: 401 }
      );
    }

    // Получаем userId из initData (автоматически создает/обновляет пользователя)
    const { getUserIdFromInitData } = await import('@/lib/get-user-from-initdata');
    const userIdResult = await getUserIdFromInitData(initData);
    userId = userIdResult || undefined;
    
    if (!userId) {
      console.error('❌ Invalid or expired initData');
      return NextResponse.json(
        { error: 'Invalid or expired Telegram initData' },
        { status: 401 }
      );
    }

    console.log('✅ User identified from initData, userId:', userId);
    
    // Получаем профиль для версии
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { version: true },
    });

    if (!profile) {
      console.error(`❌ No skin profile found for user ${userId}`);
      return NextResponse.json(
        { error: 'No skin profile found' },
        { status: 404 }
      );
    }

    // Проверяем кэш
    console.log('🔍 Checking cache for plan...');
    const cachedPlan = await getCachedPlan(userId, profile.version);
    if (cachedPlan) {
      // Проверяем, что кэшированный план содержит plan28 (новый формат)
      // Если нет - игнорируем кэш и генерируем новый план
      if (cachedPlan.plan28) {
        console.log('✅ Plan retrieved from cache (with plan28)');
        return NextResponse.json(cachedPlan);
      } else {
        console.warn('⚠️ Cached plan found but missing plan28, regenerating...');
        // Продолжаем генерацию нового плана вместо возврата старого кэша
      }
    }

    console.log('📋 Starting plan generation for userId:', userId);
    const plan = await generate28DayPlan(userId);
    
    // Сохраняем в кэш
    console.log('💾 Caching plan...');
    await setCachedPlan(userId, profile.version, plan);
    
    console.log('✅ Plan generated successfully:', {
      weeksCount: plan.weeks?.length || 0,
      productsCount: plan.products?.length || 0,
      profile: plan.profile?.skinType || 'unknown',
      warnings: plan.warnings?.length || 0,
    });

    const duration = Date.now() - startTime;
    logApiRequest(method, path, 200, duration, userId);

    return NextResponse.json(plan);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logApiError(method, path, error, userId);
    
    // Не возвращаем детали ошибки в production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment 
      ? error.message || 'Internal server error'
      : 'Internal server error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
