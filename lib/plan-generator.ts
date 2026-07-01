// lib/plan-generator.ts
// Генерация 28-дневного плана ухода за кожей

import { prisma } from '@/lib/db';
import { calculateSkinAxes, getDermatologistRecommendations, type QuestionnaireAnswers } from '@/lib/skin-analysis-engine';
import { calculateSkinIssues } from '@/lib/skin-issues';
import { canApplyStep, isStepAllowedForProfile, type StepCategory } from '@/lib/step-category-rules';
import { selectCarePlanTemplate, type CarePlanProfileInput } from '@/lib/care-plan-templates';
import type { Plan28, DayPlan, DayStep } from '@/lib/plan-types';
import { getPhaseForDay, isWeeklyFocusDay } from '@/lib/plan-types';
import { logger } from '@/lib/logger';
import type { SkinProfile } from '@/lib/skinprofile-types';
import type { GeneratedPlan } from '@/lib/api-types';
import type { GoalKey } from '@/lib/concern-taxonomy';
import { deriveFocusKeys, goalsFromFocusKeys } from '@/lib/focus-keys';
import { PLAN_WEEKS_TOTAL, PLAN_DAYS_PER_WEEK } from '@/lib/constants';
import { getBaseStepFromStepCategory, isCleanserStep, isSPFStep } from '@/lib/plan-helpers';
import { 
  ensureRequiredProducts, 
  findFallbackProduct, 
  type ProductWithBrand
} from '@/lib/product-fallback';
import { mapStepToStepCategory } from '@/lib/step-matching';
import { pickProductForProfileDiversity } from '@/lib/plan-helpers';
import type { ProfileClassification } from '@/lib/plan-generation-helpers';
import {
  determineProtocol,
  type DermatologyProtocol,
} from '@/lib/dermatology-protocols';
import {
  filterProductsWithDermatologyLogic,
  generateProductJustification,
  generateProductWarnings,
  getActiveIngredientsFromStepCategory,
  type ProductSelectionContext,
} from '@/lib/dermatology-product-filter';
import { getApplicationDaysForWeek } from '@/lib/protocol-plan-integration';

/**
 * P0.1: Проверяет, можно ли применять активный шаг в конкретный день согласно
 * титрации/циклированию протокола. Реализует реальную постепенность введения активов
 * (ретинол 1→2→3→4 раз/нед и т.п.), которая раньше декларировалась, но не исполнялась.
 *
 * Логика: шаг разрешён, если у него нет «расписанных» активов (только мягкие/без графика),
 * либо если текущий день недели входит в объединение разрешённых дней расписанных активов.
 * Мягкие ингредиенты без расписания (ceramides, HA, niacinamide, peptides) не ограничивают.
 */
function isActiveStepAllowedOnDay(
  stepCategory: StepCategory,
  dayIndex: number,
  week: number,
  protocol: DermatologyProtocol,
  profileClassification: ProfileClassification
): boolean {
  const ingredients = getActiveIngredientsFromStepCategory(stepCategory);
  if (ingredients.length === 0) return true;

  const dayOfWeek = ((dayIndex - 1) % 7) + 1;
  const isNaive = profileClassification.retinoidExperience === 'naive';
  const naiveCapByWeek: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 4 };

  const scheduledDayGroups: number[][] = [];
  for (const ing of ingredients) {
    const isRamped = ing === 'retinol' || ing === 'retinoid' || ing === 'aha' || ing === 'bha';
    const days = getApplicationDaysForWeek(ing, protocol, week, {
      naiveCap: isNaive && isRamped ? naiveCapByWeek[week] : undefined,
    });
    if (days === null) continue; // нет ограничений для этого актива
    scheduledDayGroups.push(days);
  }

  // Ни у одного актива нет расписания → ограничений нет.
  if (scheduledDayGroups.length === 0) return true;

  const allowedDays = new Set(scheduledDayGroups.flat());
  return allowedDays.has(dayOfWeek);
}

/**
 * P1.5: Убирает из шаблона рутины шаги, явно запрещённые протоколом (forbiddenSteps).
 * Раньше запрет применялся только на уровне подбора продукта, из-за чего запрещённый шаг
 * мог остаться в структуре дня пустым плейсхолдером. Фильтруем только по forbiddenSteps —
 * базовые шаги (очищение/SPF/увлажнение) при этом не теряются и при необходимости
 * восстанавливаются через ensureStepPresence.
 */
function filterStepsByProtocol(
  steps: StepCategory[],
  protocol: DermatologyProtocol
): StepCategory[] {
  if (!protocol.forbiddenSteps || protocol.forbiddenSteps.length === 0) return steps;
  return steps.filter(step => !protocol.forbiddenSteps.includes(step));
}

// ИСПРАВЛЕНО: PlanDay и PlanWeek теперь используются из plan-types.ts и api-types.ts
// Удалено локальное определение для избежания конфликтов типов

// ИСПРАВЛЕНО: GeneratedPlan теперь импортируется из api-types.ts
// Удалено локальное определение для избежания конфликтов

// Вспомогательная функция: определение бюджетного сегмента
// ИСПРАВЛЕНО: Если цена неизвестна (null/undefined), возвращаем 'любой' вместо 'бюджетный'
// чтобы не пускать дорогие продукты в бюджетные режимы по умолчанию
function getBudgetTier(price: number | null | undefined): 'бюджетный' | 'средний' | 'премиум' | 'любой' {
  if (price === null || price === undefined) return 'любой';
  if (price < 2000) return 'бюджетный';
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
/**
 * ИСПРАВЛЕНО: Оригинальная функция для обратной совместимости
 * В будущем должна быть мигрирована на generate28DayPlanFromContext
 * TODO: Полная миграция на DomainContext - все данные должны приходить через context
 */
/**
 * ИСПРАВЛЕНО (P0): Режимы генерации плана
 * strict: день не создаётся если невалиден (нет минимальных шагов)
 * soft: fallback'и допустимы, создаются дни даже с минимальным набором
 */
export type PlanGenerationMode = 'strict' | 'soft';

export async function generate28DayPlan(
  userId: string,
  mode: PlanGenerationMode = 'soft'
): Promise<GeneratedPlan> {
  logger.info('🚀 Starting plan generation', { userId, mode, timestamp: new Date().toISOString() });
  
  try {
    // ИСПРАВЛЕНО: В будущем эта функция должна принимать DomainContext
    // Пока оставляем для обратной совместимости
    
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

    // ИСПРАВЛЕНО: Для skin_concerns также сохраняем лейблы опций для calculateSkinAxes
    if (code === 'skin_concerns' && answer.answerValues && Array.isArray(answer.answerValues)) {
      const concernLabels: string[] = [];
      for (const value of answer.answerValues) {
        const option = answer.question.answerOptions?.find(opt => opt.value === value);
        if (option?.label) {
          concernLabels.push(option.label);
        }
      }
      answers['skin_concerns_labels'] = concernLabels;
    }

    // Аналогично сохраняем лейблы целей: answers.skin_goals — это коды опций
    // ("skin_goals_1"), а downstream-логика матчит по человекочитаемым лейблам.
    if (code === 'skin_goals' && answer.answerValues && Array.isArray(answer.answerValues)) {
      const goalLabels: string[] = [];
      for (const value of answer.answerValues) {
        const option = answer.question.answerOptions?.find(opt => opt.value === value);
        if (option?.label) {
          goalLabels.push(option.label);
        }
      }
      answers['skin_goals_labels'] = goalLabels;
    }

    // ИСПРАВЛЕНО: Для medical_diagnoses также сохраняем лейблы опций
    if (code === 'medical_diagnoses' && answer.answerValues && Array.isArray(answer.answerValues)) {
      const diagnosisLabels: string[] = [];
      for (const value of answer.answerValues) {
        const option = answer.question.answerOptions?.find(opt => opt.value === value);
        if (option?.label) {
          diagnosisLabels.push(option.label);
        }
      }
      answers['medical_diagnoses_labels'] = diagnosisLabels;
    }
  });

  // Дерматологический анализ - рассчитываем 6 осей кожи
  // ИСПРАВЛЕНО: axes должны вычисляться ТОЛЬКО из answers, а не из profile
  // Profile - это snapshot, не source of truth. При retake topic меняются только answers,
  // но profile может быть еще не обновлен, что создает недетерминированность
  const questionnaireAnswers: QuestionnaireAnswers = {
    skinType: answers.skin_type || answers.skinType || 'normal', // ИСПРАВЛЕНО: из answers, не из profile
    age: answers.age || answers.age_group || answers.ageGroup || '25-34', // ИСПРАВЛЕНО: из answers
    // ageGroup из профиля даёт engine разбираемый возраст ("35_44"/"41_50"),
    // тогда как answers.age — это сырой код опции ("age_5"), по которому возраст не восстановить.
    ageGroup: profile.ageGroup || (typeof answers.ageGroup === 'string' ? answers.ageGroup : undefined),
    concerns: Array.isArray(answers.skin_concerns_labels) ? answers.skin_concerns_labels : (Array.isArray(answers.skin_concerns) ? answers.skin_concerns : []),
    diagnoses: Array.isArray(answers.medical_diagnoses_labels) ? answers.medical_diagnoses_labels : (Array.isArray(answers.medical_diagnoses) ? answers.medical_diagnoses : []),
    allergies: Array.isArray(answers.allergies) ? answers.allergies : [],
    seasonChange: answers.seasonal_changes || answers.season_change || answers.seasonChange,
    habits: Array.isArray(answers.lifestyle_habits) ? answers.lifestyle_habits : [],
    retinolReaction: answers.retinoid_reaction || answers.retinolReaction,
    pregnant: answers.pregnancy_breastfeeding || answers.pregnant || answers.has_pregnancy || false, // ИСПРАВЛЕНО: из answers
    spfFrequency: answers.spf_frequency || answers.spfFrequency,
    sunExposure: answers.sun_exposure || answers.sunExposure,
    sensitivityLevel: answers.skin_sensitivity || answers.sensitivity_level || answers.sensitivityLevel || 'low', // ИСПРАВЛЕНО: из answers
    acneLevel: answers.acne_level || (typeof answers.acneLevel === 'number' ? answers.acneLevel : 0), // ИСПРАВЛЕНО: из answers
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
  // ВАЖНО: используем ЛЕЙБЛЫ опций, а не сырые коды ("skin_goals_1"/"skin_concerns_5").
  // Вся downstream-логика (focus, primaryFocus, фототип) матчит по русскому тексту —
  // на кодах эти проверки молча не срабатывали, и primaryFocus у всех залипал на 'general'.
  const goals: string[] = Array.isArray(answers.skin_goals_labels)
    ? answers.skin_goals_labels
    : (Array.isArray(answers.skin_goals) ? answers.skin_goals : []);
  const concerns: string[] = Array.isArray(answers.skin_concerns_labels)
    ? answers.skin_concerns_labels
    : (Array.isArray(answers.skin_concerns) ? answers.skin_concerns : []);

  // Сопоставляем человекочитаемые лейблы целей/беспокойств с каноническими фокусами.
  // Логика и маппинг fold-keys → mainGoals вынесены в lib/focus-keys.ts и покрыты
  // юнит-тестами (tests/focus-keys.test.ts).
  const focusKeys = deriveFocusKeys([...goals, ...concerns]);

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
  
  // ИСПРАВЛЕНО (P0): Добавляем rosaceaRisk и medicalMarkers в stepProfile для canApplyStep
  const stepProfile: import('@/lib/skinprofile-types').SkinProfile & { 
    rosaceaRisk?: string | null; 
    medicalMarkers?: { rosaceaRisk?: "low" | "medium" | "high" | "critical" } 
  } = {
    ...createEmptySkinProfile(),
    skinType: normalizedSkinType as any,
    sensitivity: normalizedSensitivity as any,
    diagnoses: Array.isArray(medicalMarkers.diagnoses) ? medicalMarkers.diagnoses : [],
    contraindications: Array.isArray(medicalMarkers.contraindications)
      ? medicalMarkers.contraindications
      : [],
    mainGoals: Array.isArray(medicalMarkers.mainGoals) 
      ? (medicalMarkers.mainGoals.filter((g): g is GoalKey => 
          ['acne', 'pores', 'pigmentation', 'barrier', 'dehydration', 'wrinkles', 'antiage', 'general', 'dark_circles'].includes(g as GoalKey)
        ) as GoalKey[])
      : [],
    // ИСПРАВЛЕНО (P0): Добавляем rosaceaRisk и medicalMarkers для canApplyStep
    rosaceaRisk: profile.rosaceaRisk || null,
    medicalMarkers: {
      rosaceaRisk: medicalMarkers.rosaceaRisk as "low" | "medium" | "high" | "critical" | undefined,
    },
  };

  // ИСПРАВЛЕНО: Нормализуем diagnoses - берем из medicalMarkers (источник истины), 
  // если их там нет, берем из answers для обратной совместимости
  // Это обеспечивает консистентность: все правила работают с одной структурой
  const normalizedDiagnoses = Array.isArray(medicalMarkers.diagnoses) && medicalMarkers.diagnoses.length > 0
    ? medicalMarkers.diagnoses
    : (Array.isArray(answers.diagnoses) ? answers.diagnoses : []);
  
  // ИСПРАВЛЕНО: Маппинг значений бюджета из БД (budget_1, budget_2, budget_3) на читаемые
  // Также поддерживаем старые значения для обратной совместимости
  const budgetMapping: Record<string, 'бюджетный' | 'средний' | 'премиум' | 'любой'> = {
    // Новые значения из БД
    'budget_1': 'бюджетный',
    'budget_2': 'средний',
    'budget_3': 'премиум',
    'budget_4': 'любой',
    // Старые значения (для обратной совместимости)
    'бюджетный': 'бюджетный',
    'средний': 'средний',
    'премиум': 'премиум',
    'любой': 'любой',
    'budget': 'бюджетный',
    'medium': 'средний',
    'premium': 'премиум',
    'any': 'любой',
  };

  const rawBudget = answers.budget || 'средний';
  const normalizedBudget = budgetMapping[rawBudget] || rawBudget;

  // P0.1: Извлекаем флаги системной фармы из medicalMarkers (заполняется в /api/questionnaire/answers).
  // onIsotretinoin → hard-блок наружных активов; currentOralMeds → передаётся в determineProtocol.
  const markersCurrentOralMeds = Array.isArray((medicalMarkers as any)?.currentOralMeds)
    ? ((medicalMarkers as any).currentOralMeds as string[])
    : [];
  const markersOnIsotretinoin =
    (medicalMarkers as any)?.onIsotretinoin === true ||
    markersCurrentOralMeds.some(m => (m || '').toLowerCase().includes('isotretinoin'));

  // P0.2: Опыт пользователя с ретинолом.
  // Приоритет:
  //  1. answers.retinoid_reaction (точный сигнал — возвращён в анкету в seed-questionnaire-v2.ts):
  //     - «без реакции» → experienced
  //     - «лёгкое шелушение» → experienced (нормально для ретиноида, но не сильное раздражение)
  //     - «сильное раздражение» → naive (cap частоты)
  //     - «никогда не использовал» → naive
  //  2. Иначе fallback на answers.retinoid_usage ("Да" → experienced, иначе → naive).
  //  3. Если оба пусты → naive (безопаснее).
  const retinoidReactionRaw = String(answers.retinoid_reaction ?? '').toLowerCase().trim();
  const retinoidUsageRaw = String(answers.retinoid_usage ?? '').toLowerCase().trim();
  let retinoidExperience: 'naive' | 'experienced';
  if (retinoidReactionRaw) {
    if (
      retinoidReactionRaw.includes('без реакции') ||
      retinoidReactionRaw.includes('лёгкое шелушение') ||
      retinoidReactionRaw.includes('легкое шелушение') ||
      retinoidReactionRaw.includes('конкретное средство') ||
      retinoidReactionRaw.includes('конкретный продукт') ||
      retinoidReactionRaw.includes('другие ретиноиды')
    ) {
      retinoidExperience = 'experienced';
    } else {
      // «сильное раздражение / жжение / краснота» или «никогда не использовал» → строгий старт
      retinoidExperience = 'naive';
    }
  } else if (retinoidUsageRaw === 'да' || retinoidUsageRaw === 'yes' || retinoidUsageRaw === 'true') {
    retinoidExperience = 'experienced';
  } else {
    retinoidExperience = 'naive';
  }

  // P1.3: Эвристика фототипа Фитцпатрика по существующим сигналам.
  // 1. Если в medicalMarkers.fitzpatrickType есть явное значение — берём его (для будущего вопроса).
  // 2. Иначе: pigmentation/postacne/melasma в concerns или diagnoses → как минимум III_IV
  //    (склонность к ПИВ → ограничиваем агрессивные кислоты, усиливаем SPF).
  // 3. Иначе undefined — план без модификаций.
  const explicitFitzpatrick = (medicalMarkers as any)?.fitzpatrickType;
  const looksDarkerPhototype =
    [...concerns, ...normalizedDiagnoses].some(s => {
      const v = String(s || '').toLowerCase();
      return v.includes('pigment') || v.includes('пигмент') || v.includes('пятна')
        || v.includes('post-acne') || v.includes('постакне') || v.includes('pih')
        || v.includes('melasma') || v.includes('мелазма');
    });
  const fitzpatrickType: 'I_II' | 'III_IV' | 'V_VI' | undefined =
    (explicitFitzpatrick === 'I_II' || explicitFitzpatrick === 'III_IV' || explicitFitzpatrick === 'V_VI')
      ? explicitFitzpatrick
      : looksDarkerPhototype ? 'III_IV' : undefined;

  const profileClassification: ProfileClassification = {
    focus: (['acne', 'pigmentation', 'wrinkles', 'pores'].find((k) => focusKeys.has(k))) || 'general', // основной фокус по нормализованным целям
    skinType: profile.skinType || 'normal',
    concerns: concerns,
    diagnoses: normalizedDiagnoses, // ИСПРАВЛЕНО: Используем нормализованные diagnoses
    rosaceaRisk: (profile.rosaceaRisk as string) ?? null,
    ageGroup: profile.ageGroup || '25-34',
    exclude: Array.isArray(answers.exclude_ingredients) ? answers.exclude_ingredients : [],
    budget: normalizedBudget,
    pregnant: profile.hasPregnancy || false,
    stepsPreference: answers.care_steps || 'средний',
    allergies: Array.isArray(answers.allergies) ? answers.allergies : [],
    sensitivityLevel: profile.sensitivityLevel || 'medium',
    onIsotretinoin: markersOnIsotretinoin,
    currentOralMeds: markersCurrentOralMeds,
    retinoidExperience,
    fitzpatrickType,
  };

  // ИСПРАВЛЕНО: Определяем основной фокус используя единую таксономию concerns
  // Используем normalizePrimaryFocus для согласованности с product.concerns
  const { normalizePrimaryFocus, normalizeConcerns } = await import('./concern-taxonomy');
  
  // Нормализуем concerns к каноническим ключам
  const normalizedConcerns = normalizeConcerns(concerns);
  
  // Определяем primaryFocus на основе нормализованных фокусов (focusKeys) и concerns.
  // Приоритет: acne > pores > сухость/обезвоженность > пигментация > морщины > барьер.
  let primaryFocus = 'general';
  if (focusKeys.has('acne') || normalizedConcerns.includes('acne')) {
    primaryFocus = 'acne';
  } else if (focusKeys.has('pores') || normalizedConcerns.includes('pores')) {
    primaryFocus = 'pores';
  } else if (focusKeys.has('dehydration') || normalizedConcerns.includes('dryness') || normalizedConcerns.includes('dehydration')) {
    primaryFocus = 'dryness';
  } else if (focusKeys.has('pigmentation') || normalizedConcerns.includes('pigmentation')) {
    primaryFocus = 'pigmentation';
  } else if (focusKeys.has('wrinkles') || normalizedConcerns.includes('wrinkles')) {
    primaryFocus = 'wrinkles';
  } else if (focusKeys.has('barrier') || normalizedConcerns.includes('barrier') || normalizedConcerns.includes('sensitivity')) {
    primaryFocus = 'barrier';
  }
  
  // ИСПРАВЛЕНО: Нормализуем primaryFocus к каноническому значению
  primaryFocus = normalizePrimaryFocus(primaryFocus, normalizedConcerns);

  // Маппим цели в mainGoals для CarePlanTemplate
  // ВАЖНО: Используем keyProblems (вычисленные из ответов) вместо fallback значений
  // ИСПРАВЛЕНО: Используем GoalKey[] вместо string[]
  const mainGoals: GoalKey[] = [];
  
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
    // ИСПРАВЛЕНО: Добавляем проверку темных кругов под глазами
    if (problemLower.includes('темные круги') || problemLower.includes('dark circles') || problemLower.includes('круги под глазами')) {
      if (!mainGoals.includes('dark_circles')) mainGoals.push('dark_circles');
    }
  }
  
  // Если keyProblems пустые, используем fallback на основе primaryFocus
  if (mainGoals.length === 0) {
    if (primaryFocus === 'acne') mainGoals.push('acne');
    if (primaryFocus === 'pigmentation') mainGoals.push('pigmentation');
    if (primaryFocus === 'wrinkles') mainGoals.push('antiage');
    if (primaryFocus === 'barrier') mainGoals.push('barrier');
    if (primaryFocus === 'dryness') mainGoals.push('dehydration');
  }

  // Аддитивно дополняем mainGoals ЯВНЫМИ целями/беспокойствами пользователя
  // (focusKeys из лейблов). Ничего не убираем — только добавляем недостающее.
  // Раньше эти сигналы (морщины, поры, тёмные круги) терялись: concerns/goals
  // матчились по сырым кодам и неверным строкам-лейблам.
  for (const goal of goalsFromFocusKeys(focusKeys, mainGoals)) {
    mainGoals.push(goal);
    logger.info('Main goal injected from explicit user focus', { userId, goal });
  }
  // Если пользователь явно просил возрастной уход — поднимаем фокус с 'general'.
  if (focusKeys.has('wrinkles') && primaryFocus === 'general') primaryFocus = 'wrinkles';

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

  // ИСПРАВЛЕНО: Нормализуем тип кожи для выбора шаблона
  // Шаблоны могут использовать "combo", "combination_dry", "combination_oily"
  // selectCarePlanTemplate сам нормализует, но для единообразия используем оригинальный тип
  
  // ИСПРАВЛЕНО: Для dry кожи с medium/high sensitivity автоматически добавляем barrier/dehydration в mainGoals
  // Это гарантирует выбор правильного шаблона dry_sensitive_barrier вместо default_balanced
  const finalMainGoals: GoalKey[] = [...mainGoals];
  if ((profile.skinType === 'dry' || profile.skinType === 'combination_dry') && 
      (profile.sensitivityLevel === 'medium' || profile.sensitivityLevel === 'high' || profile.sensitivityLevel === 'very_high')) {
    if (!finalMainGoals.includes('barrier') && !finalMainGoals.includes('dehydration')) {
      finalMainGoals.push('barrier');
      logger.info('Auto-added barrier goal for dry sensitive skin', {
        userId,
        skinType: profile.skinType,
        sensitivityLevel: profile.sensitivityLevel,
        finalMainGoals,
      });
    }
  }
  
  const carePlanProfileInput: CarePlanProfileInput = {
    skinType: (profile.skinType || 'normal') as NonNullable<SkinProfile["skinType"]>,
    mainGoals: finalMainGoals.length > 0 ? finalMainGoals : ['general'],
    sensitivityLevel: (profile.sensitivityLevel || 'low') as NonNullable<SkinProfile["sensitivity"]>,
    routineComplexity,
    // ДОБАВЛЕНО: Передаем дополнительные факторы для персонализации
    acneLevel: profile.acneLevel ?? null,
    dehydrationLevel: profile.dehydrationLevel ?? null,
    rosaceaRisk: profile.rosaceaRisk as CarePlanProfileInput['rosaceaRisk'] ?? null,
    pigmentationRisk: profile.pigmentationRisk as CarePlanProfileInput['pigmentationRisk'] ?? null,
    ageGroup: (profile.ageGroup ?? null) as CarePlanProfileInput['ageGroup'],
  };

  const carePlanTemplate = selectCarePlanTemplate(carePlanProfileInput);

  // ИСПРАВЛЕНО: Логируем выбранный шаблон для диагностики
  logger.info('Care plan template selected', {
    userId,
    templateId: carePlanTemplate.id,
    skinType: profile.skinType,
    sensitivityLevel: profile.sensitivityLevel,
    mainGoals: finalMainGoals,
    routineComplexity,
  });
  
  // ВАЖНО: Заменяем treatment_antiage на подходящий treatment, если у пользователя нет проблем с морщинами
  // ИСПРАВЛЕНО: Используем finalMainGoals и проверяем 'antiage' (а не 'wrinkles'), так как primaryFocus='wrinkles' маппится в 'antiage'
  const hasWrinklesGoal = finalMainGoals.includes('antiage') || finalMainGoals.includes('wrinkles');
  
  // При розацеа/высокой чувствительности (в т.ч. периоральный дерматит) убираем
  // раздражающие активные шаги: ретиноиды, BPO, кислоты, эксфолианты. Барьер сначала
  // стабилизируют мягким уходом, активы вводит врач позже. Из-за «широкого» маппинга
  // generic-treatment продукта (ретинол мог попасть в acne/azelaic-слот) снимаем ВСЕ
  // treatment_*-шаги, а также кислотные тонеры/сыворотки/маски.
  const suppressIrritantActives =
    ['medium', 'high', 'critical'].includes(String(profile.rosaceaRisk || '').toLowerCase()) ||
    ['high', 'very_high'].includes(String(profile.sensitivityLevel || '').toLowerCase());

  const isIrritantActiveStep = (step: StepCategory): boolean => {
    const s = String(step);
    if (s.startsWith('treatment_')) return true;
    if (s.startsWith('toner_') && /(exfoliant|acid|aha|bha|pha)/.test(s)) return true;
    if (s === 'serum_exfoliant') return true;
    return ['mask_acid', 'mask_peel', 'mask_enzyme', 'mask_clay'].includes(s);
  };

  const adjustTemplateSteps = (steps: StepCategory[]): StepCategory[] => {
    return steps.flatMap((step) => {
      // Розацеа/высокая чувствительность — снимаем раздражающие активы целиком.
      if (suppressIrritantActives && isIrritantActiveStep(step)) {
        logger.info('Suppressing irritant active step for rosacea/high-sensitivity', {
          userId, step, rosaceaRisk: profile.rosaceaRisk, sensitivityLevel: profile.sensitivityLevel,
        });
        return [];
      }

      // УСИЛЕНО default_balanced: treatment_antiage заменяем на лечение по mainGoals
      if (step === 'treatment_antiage' && !hasWrinklesGoal) {
        // Приоритет: acne > pigmentation > pores > barrier/dehydration (без активного лечения)
        if (finalMainGoals.includes('acne')) {
          return ['treatment_acne_azelaic'];
        }
        if (finalMainGoals.includes('pigmentation')) {
          return ['treatment_pigmentation'];
        }
        if (finalMainGoals.includes('pores')) {
          return ['treatment_exfoliant_mild'];
        }
        if (finalMainGoals.includes('barrier') || finalMainGoals.includes('dehydration')) {
          // Барьер/обезвоженность — без агрессивного treatment, фокус на увлажнении
          return [];
        }
        if (finalMainGoals.includes('dark_circles')) {
          // Тёмные круги — мягкий эксфолиант или ничего вечером
          return ['treatment_exfoliant_mild'];
        }
        return [];
      }
      
      // ИСПРАВЛЕНО: Для dry кожи заменяем moisturizer_light на moisturizer_barrier
      // moisturizer_light не разрешен для dry кожи (только для normal, combination_dry, combination_oily)
      // Это исправляет проблему, когда выбирается default_balanced шаблон с moisturizer_light
      if (step === 'moisturizer_light' && (profile.skinType === 'dry' || profile.skinType === 'combination_dry')) {
        logger.info('Replacing moisturizer_light with moisturizer_barrier for dry skin', {
          userId,
          skinType: profile.skinType,
          originalStep: step,
          replacementStep: 'moisturizer_barrier',
        });
        return ['moisturizer_barrier'];
      }
      
      return [step];
    });
  };
  
  let adjustedMorning = adjustTemplateSteps(carePlanTemplate.morning);
  let adjustedEvening = adjustTemplateSteps(carePlanTemplate.evening);
  const adjustedWeekly = carePlanTemplate.weekly ? adjustTemplateSteps(carePlanTemplate.weekly) : undefined;

  // P1.2: Сезонная адаптация. Меняет только текстуры увлажняющего; остальные шаги нетронуты.
  // Решение принимается по комбинации (текущий месяц, ответ из анкеты).
  const { applySeasonalAdjustment, normalizeSeasonalProfile, currentSeason } = await import('@/lib/seasonality');
  const seasonalProfile = normalizeSeasonalProfile(questionnaireAnswers.seasonChange);
  const seasonalReasons: string[] = [];
  {
    const m = applySeasonalAdjustment(adjustedMorning, seasonalProfile);
    const e = applySeasonalAdjustment(adjustedEvening, seasonalProfile);
    adjustedMorning = m.steps;
    adjustedEvening = e.steps;
    seasonalReasons.push(...m.appliedReasons, ...e.appliedReasons);
    if (seasonalReasons.length > 0) {
      logger.info('Seasonal adjustment applied', {
        season: currentSeason(),
        seasonalProfile,
        reasons: Array.from(new Set(seasonalReasons)),
        userId,
      });
    }
  }
  
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
  
  // Мониторинг: метрики генерации плана (для аналитики и алертов)
  const planGenMetrics = {
    templateId: carePlanTemplate.id,
    usedDefaultBalanced: carePlanTemplate.id === 'default_balanced',
    skinType: carePlanProfileInput.skinType,
    mainGoals: carePlanProfileInput.mainGoals,
    routineComplexity: carePlanProfileInput.routineComplexity,
  };

  if (carePlanTemplate.id === 'default_balanced') {
    logger.warn('plan_gen_template_default_balanced', {
      ...planGenMetrics,
      userId,
      message: 'Using default_balanced template - no specific template matched',
    }, { saveToDb: true, userId });
  } else {
    logger.info('plan_gen_template_selected', { ...planGenMetrics, userId });
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
    
    // ИСПРАВЛЕНО: НЕ используем "любую" RecommendationSession пользователя как fallback.
    // Это приводит к неверному плану после перепрохождения: берутся продукты, подобранные для старого profileId.
    // Если сессии для текущего profileId нет — план будет собран "с нуля" по текущим answers/profile.

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
        // ИСПРАВЛЕНО: Обнуляем existingSession после удаления, чтобы не использовать удаленную сессию дальше
        existingSession = null;
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
    
    // ИСПРАВЛЕНО: Используем продукты из сессии только если сессия существует и не была удалена
    // Используем продукты из сессии, если их больше 0
    if (existingSession && productIds.length > 0) {
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

  // Адаптер для нормализации продуктов к единому типу ProductWithBrand
  const normalizeToProductWithBrand = (product: any): ProductWithBrand => {
    if (product.brand && typeof product.brand === 'object' && 'name' in product.brand) {
      return {
        id: product.id,
        name: product.name,
        brand: {
          id: product.brand.id,
          name: product.brand.name,
          isActive: product.brand.isActive ?? true,
        },
        step: product.step || '',
        category: product.category || null,
        price: product.price ?? null,
        imageUrl: product.imageUrl || null,
        isHero: product.isHero ?? false,
        priority: product.priority ?? 0,
        skinTypes: product.skinTypes || [],
        published: product.published ?? true,
        activeIngredients: product.activeIngredients || [],
      };
    }
    throw new Error(`Cannot normalize product to ProductWithBrand: missing or invalid brand structure for product ${product.id}`);
  };

  let filteredProducts: any[];
  const { filterProductsBasic } = await import('./unified-product-filter');
  
  if (recommendationProducts.length > 0) {
    const normalizedProducts = recommendationProducts.map(normalizeToProductWithBrand);
    filteredProducts = await filterProductsBasic(normalizedProducts, profileClassification, 'soft');
    
    logger.info('Products from RecommendationSession filtered by current profile', {
      count: filteredProducts.length,
      originalCount: recommendationProducts.length,
      userId,
      profileSkinType: profileClassification.skinType,
      profileBudget: profileClassification.budget,
    });
  } else {
    const normalizedProducts = allProducts.map(normalizeToProductWithBrand);
    logger.info('No RecommendationSession - filtering products from scratch using unified filter', { userId });
    filteredProducts = await filterProductsBasic(normalizedProducts, profileClassification, 'soft');
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
  let selectedProducts: ProductWithBrand[];
  
  if (recommendationProducts.length > 0) {
    // Используем ВСЕ продукты из RecommendationSession - не ограничиваем количество
    // ИСПРАВЛЕНО: Нормализуем все продукты к ProductWithBrand
    selectedProducts = sortedProducts.map(normalizeToProductWithBrand);
    logger.info('Using ALL products from RecommendationSession for plan (no limit)', {
      count: selectedProducts.length,
      userId
    });
  } else {
    // Ограничиваем только если генерируем с нуля
    // ИСПРАВЛЕНО: Нормализуем все продукты к ProductWithBrand
    selectedProducts = sortedProducts.slice(0, 6).map(normalizeToProductWithBrand);
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
    // ИСПРАВЛЕНО: selectedProducts уже нормализован к ProductWithBrand
    const replacedProducts = await Promise.all(
      selectedProducts.map(async (product: ProductWithBrand) => {
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
              // ИСПРАВЛЕНО: concerns не существует в ProductWithBrand, используем activeIngredients
              // concerns - это проблемы кожи, не ингредиенты
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
            // ИСПРАВЛЕНО: Нормализуем замененный продукт к ProductWithBrand
            return normalizeToProductWithBrand(replacement);
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
              // ИСПРАВЛЕНО: Нормализуем замененный продукт к ProductWithBrand
              return normalizeToProductWithBrand(anyReplacement);
            }
          }
        }
        // ИСПРАВЛЕНО: product уже нормализован, возвращаем как есть
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
    productIds: selectedProducts.map((p: ProductWithBrand) => ({ id: p.id, name: p.name, step: p.step, category: p.category })).slice(0, 10),
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

  const mapProductToStepCategories = (step: string | null | undefined, category: string | null | undefined): StepCategory[] => {
    return mapStepToStepCategory(step, category, profile.skinType);
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
    const stepCategories = mapProductToStepCategories(product.step, product.category);
    
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
      
      // ИСПРАВЛЕНО: НЕ регистрируем продукты под "базовым шагом" для serum/treatment.
      // Раньше сыворотка могла регистрироваться под ключом 'serum' и затем
      // ошибочно удовлетворять шаг 'serum_hydrating' (даже если это serum_vitc),
      // что давало "не тот" план.
      // Для обратной совместимости оставляем только безопасные базовые шаги,
      // где подтипы взаимозаменяемы без сильного риска: toner и moisturizer.
      stepCategories.forEach(stepCategory => {
        const baseStep = getBaseStepFromStepCategory(stepCategory);
        if (baseStep !== stepCategory && (baseStep === 'toner' || baseStep === 'moisturizer')) {
          registerProductForStep(baseStep as StepCategory, productWithBrand);
          if (userId === '643160759' || process.env.NODE_ENV === 'development') {
            logger.info('Product also registered for safe base step', {
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
      }, { saveToDb: true, userId });
      
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
        // ИСПРАВЛЕНО: Для dry кожи добавляем moisturizer_barrier, для других - moisturizer_light и balancing
        if (profile.skinType === 'dry' || profile.skinType === 'combination_dry') {
          fallbackCategories.push('moisturizer_barrier', 'moisturizer_soothing', 'moisturizer_light');
        } else {
          fallbackCategories.push('moisturizer_light', 'moisturizer_balancing', 'moisturizer_barrier');
        }
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
        }, { saveToDb: true, userId });
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
  // ИСПРАВЛЕНО: Базовые продукты (toner, moisturizer) всегда доступны во всех фазах
  const filterProductsByPhase = (
    products: ProductWithBrand[],
    phase: 'adaptation' | 'active' | 'support',
    stepCategory: StepCategory
  ): ProductWithBrand[] => {
    if (products.length === 0) return products;
    
    // ИСПРАВЛЕНО: Базовые продукты всегда доступны во всех фазах
    const baseStep = getBaseStepFromStepCategory(stepCategory);
    const isBaseProduct = baseStep === 'toner' || baseStep === 'moisturizer' || baseStep === 'cleanser' || baseStep === 'spf';
    
    // Если это базовый продукт, возвращаем все продукты (но предпочитаем разные по фазам)
    if (isBaseProduct) {
      // Для разнообразия по фазам, возвращаем разные продукты, но не фильтруем строго
      // Просто возвращаем все доступные продукты - они будут распределены по фазам
      return products;
    }
    
    // Определяем, какие активные ингредиенты и stepCategory подходят для каждой фазы
    // ИСПРАВЛЕНО: Используем только те ингредиенты и категории, которые реально есть в БД
    const strongActives = [
      'retinol', 'retinoid', 'tretinoin', 'adapalene', 'benzoyl_peroxide', 
      'benzoyl_peroxide_2_5', 'aha', 'bha', 'glycolic', 'salicylic_acid', 
      'azelaic_acid', 'azelaic_acid_10', 'azelaic_acid_15', 'hydroquinone'
    ];
    const moderateActives = [
      'azelaic_acid', 'azelaic_acid_10', 'azelaic_acid_15', 'niacinamide', 
      'vitamin_c10', 'vitamin_c15', 'vitamin_c23', 'alpha_arbutin', 
      'tranexamic_acid', 'ferulic_acid', 'vitamin_e', 'zinc_pca'
    ];
    const gentleActives = [
      'hyaluronic_acid', 'glycerin', 'centella', 'panthenol', 'ceramides', 
      'squalane', 'shea_butter', 'soothing_complex'
    ];
    
    // Определяем, какие stepCategory подходят для каждой фазы
    // ИСПРАВЛЕНО: Используем только существующие категории из БД
    const adaptationSteps: StepCategory[] = [
      'cleanser_gentle', 'toner_hydrating', 'toner_soothing',
      'serum_hydrating', 'serum_anti_redness',
      'moisturizer_barrier', 'moisturizer_soothing', 'moisturizer_light',
      'treatment_exfoliant_mild'
    ];
    
    // ИСПРАВЛЕНО: Используем существующие категории шагов с активными ингредиентами
    // В активной фазе должны быть продукты с кислотами и активными ингредиентами
    // ВАЖНО: Эти категории должны соответствовать тем, что используются в правилах и сессиях рекомендаций
    // Правила используют простые названия (serum, treatment), которые маппятся на эти stepCategory через mapStepToStepCategory
    const activeSteps = [
      'serum_niacinamide', 'serum_vitc', 'serum_brightening_soft',
      'serum_peptide', 'serum_antiage', 'serum_exfoliant', // Новые категории сывороток
      'toner_exfoliant', 'toner_acid', 'toner_aha', 'toner_bha', // Тонеры с кислотами
      'treatment_acne_azelaic', 'treatment_acne_bpo', 'treatment_pigmentation',
      'treatment_antiage', 'treatment_exfoliant_strong', 'treatment_exfoliant_mild',
      'treatment_acid', // Средства с кислотами
      'mask_enzyme', 'mask_acid', 'mask_peel', // Маски с активными ингредиентами
      'cleanser_deep' // Очищение с кислотами тоже подходит для активной фазы
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
      
      // ИСПРАВЛЕНО: Тонер и крем всегда доступны во всех фазах
      if (baseStep === 'toner' || baseStep === 'moisturizer') {
        return true;
      }
      
      // Получаем активные ингредиенты продукта (из БД или из stepCategory)
      const productActives = (product as any).activeIngredients || [];
      const activeIngredientsStr = Array.isArray(productActives) 
        ? productActives.join(' ').toLowerCase()
        : '';
      
      if (phase === 'adaptation') {
        // Фаза 1: только мягкие продукты
        // ИСПРАВЛЕНО: Используем точное совпадение или сравнение базовых шагов вместо startsWith(split('_')[0])
        // чтобы избежать ложных совпадений (например, serum_vitc не должен проходить для serum_hydrating)
        const stepBaseStep = getBaseStepFromStepCategory(stepCategory);
        if (adaptationSteps.some((adaptStep: StepCategory) => {
          if (stepCategory === adaptStep) return true;
          const adaptBaseStep = getBaseStepFromStepCategory(adaptStep);
          return stepBaseStep === adaptBaseStep && stepBaseStep !== 'serum' && stepBaseStep !== 'treatment';
        })) {
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
        // ИСПРАВЛЕНО: Используем точное совпадение или сравнение базовых шагов вместо startsWith(split('_')[0])
        const stepBaseStep = getBaseStepFromStepCategory(stepCategory);
        if (activeSteps.some(activeStep => {
          if (stepCategory === activeStep) return true;
          const activeBaseStep = getBaseStepFromStepCategory(activeStep as StepCategory);
          // Для активной фазы разрешаем только точные совпадения или совпадения базовых шагов для определенных категорий
          return stepBaseStep === activeBaseStep && (stepBaseStep === 'mask' || stepBaseStep === 'cleanser');
        })) {
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
        // ИСПРАВЛЕНО: Используем точное совпадение или сравнение базовых шагов вместо startsWith(split('_')[0])
        const stepBaseStep = getBaseStepFromStepCategory(stepCategory);
        if (supportSteps.some(supportStep => {
          if (stepCategory === supportStep) return true;
          const supportBaseStep = getBaseStepFromStepCategory(supportStep as StepCategory);
          return stepBaseStep === supportBaseStep;
        })) {
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
      
      // ИСПРАВЛЕНО: Если базовый шаг не найден, пробуем варианты с этим базовым шагом.
      // ВАЖНО: для serum_hydrating нельзя подмешивать любые serum_* (vitc/кислоты),
      // иначе "увлажняющая" сыворотка заменяется на витамин C и план выглядит неправильным.
      const allVariants: ProductWithBrand[] = [];
      for (const [mapStep, products] of productsByStepMap.entries()) {
        if (baseStep === 'serum' && step === 'serum_hydrating') {
          const allowedSerumFallback = new Set<string>([
            'serum_hydrating',
            'serum_anti_redness',
            'serum_niacinamide',
          ]);
          if (allowedSerumFallback.has(mapStep)) {
            allVariants.push(...products);
          }
          continue;
        }

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
      const fallbackCleanser = await findFallbackProduct('cleanser', profileClassification, { userId });
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
        }, { saveToDb: true, userId });
      }
    }
  }

  // Проверяем и добавляем SPF, если его нет
  const spfSteps = Array.from(requiredStepCategories).filter((step: StepCategory) => isSPFStep(step));
  if (spfSteps.length > 0) {
    const existingSPF = spfSteps.some(step => getProductsForStep(step).length > 0);
    if (!existingSPF) {
      logger.info('No SPF products found, searching for fallback', { userId });
      const fallbackSPF = await findFallbackProduct('spf', profileClassification, { userId });
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
        }, { saveToDb: true, userId });
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
      const fallbackMoisturizer = await findFallbackProduct('moisturizer', profileClassification, { userId });
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
        }, { saveToDb: true, userId });
      } else {
        logger.error('CRITICAL: Could not find fallback moisturizer!', { userId });
      }
    }
  } else {
    // Если в шаблоне вообще нет moisturizer - добавляем его в requiredStepCategories
    logger.warn('No moisturizer step in template, adding moisturizer_light as required', { userId });
    requiredStepCategories.add('moisturizer_light');
    const fallbackMoisturizer = await findFallbackProduct('moisturizer', profileClassification, { userId });
    if (fallbackMoisturizer) {
      registerProductForStep('moisturizer_light', fallbackMoisturizer);
      if (!selectedProducts.some((p: any) => p.id === fallbackMoisturizer.id)) {
        selectedProducts.push(fallbackMoisturizer as any);
      }
      logger.info('Added missing moisturizer to plan', { 
        productId: fallbackMoisturizer.id, 
        productName: fallbackMoisturizer.name,
        userId 
      }, { saveToDb: true, userId });
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
      const fallbackToner = await findFallbackProduct('toner', profileClassification, { userId });
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
        }, { saveToDb: true, userId });
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
      // Диагностика: почему не нашли serum в productsByStepMap/каталоге.
      // Включаем только для явной отладки (env) или для конкретного юзера (чтобы не шуметь).
      let debugDiagnostics = process.env.DEBUG_PLAN_PRODUCTS === 'true';
      let telegramIdForLog: string | null = null;

      // ИСПРАВЛЕНО: userId здесь — это внутренний id пользователя (cuid), а не telegramId.
      // Поэтому для таргетированной отладки под одного пользователя подтягиваем telegramId из БД.
      if (!debugDiagnostics) {
        try {
          const u = await prisma.user.findUnique({
            where: { id: userId },
            select: { telegramId: true },
          });
          telegramIdForLog = u?.telegramId ?? null;
          if (telegramIdForLog === '643160759') {
            debugDiagnostics = true;
          }
        } catch {
          // ignore
        }
      }

      if (debugDiagnostics) {
        try {
          const baseStep = 'serum';
          const whereOr = [
            { category: baseStep },
            { step: baseStep },
            { step: { startsWith: baseStep } },
          ] as any;

          const baseWhere: any = {
            published: true,
            OR: whereOr,
          };

          const totalPublished = await prisma.product.count({
            where: baseWhere,
          });
          const totalPublishedActiveBrand = await prisma.product.count({
            where: {
              ...baseWhere,
              brand: { isActive: true },
            },
          });
          const totalPublishedActiveBrandSkin = profileClassification.skinType
            ? await prisma.product.count({
                where: {
                  ...baseWhere,
                  brand: { isActive: true },
                  OR: undefined,
                  AND: [
                    { OR: whereOr },
                    {
                      OR: [
                        { skinTypes: { has: profileClassification.skinType } },
                        { skinTypes: { isEmpty: true } },
                      ],
                    },
                  ],
                },
              })
            : null;

          const sample = await prisma.product.findMany({
            where: {
              ...baseWhere,
              brand: { isActive: true },
            },
            select: {
              id: true,
              name: true,
              step: true,
              category: true,
              skinTypes: true,
              published: true,
              brand: { select: { id: true, name: true, isActive: true } },
            },
            orderBy: [{ isHero: 'desc' }, { priority: 'desc' }, { createdAt: 'desc' }],
            take: 5,
          });

          logger.info('Serum availability diagnostics', {
            userId,
            telegramId: telegramIdForLog,
            requiredSerumSteps: serumSteps,
            profileSkinType: profileClassification.skinType,
            counts: {
              totalPublished,
              totalPublishedActiveBrand,
              totalPublishedActiveBrandSkin,
            },
            sample: sample.map((p) => ({
              id: p.id,
              name: p.name,
              step: p.step,
              category: p.category,
              skinTypes: p.skinTypes,
              brand: p.brand?.name,
              brandActive: p.brand?.isActive,
            })),
            productsByStepMapSerumKeys: Array.from(productsByStepMap.keys()).filter((k) =>
              String(k).startsWith('serum')
            ),
          });
        } catch (e) {
          logger.warn('Serum availability diagnostics failed (non-critical)', { userId, error: e });
        }
      }

      const fallbackSerum = await findFallbackProduct('serum', profileClassification, { userId });
      if (fallbackSerum) {
        // ИСПРАВЛЕНО: это не ошибка, если мы успешно нашли fallback.
        // Логируем как info, чтобы не засорять WARN-логи в проде.
        logger.info('No serum products found for required steps, using fallback serum', {
          userId,
          serumSteps,
          productId: fallbackSerum.id,
          productName: fallbackSerum.name,
        }, { saveToDb: true, userId });
        for (const step of serumSteps) {
          registerProductForStep(step, fallbackSerum);
        }
        if (!selectedProducts.some((p: any) => p.id === fallbackSerum.id)) {
          selectedProducts.push(fallbackSerum as any);
        }
      } else {
        // Это уже реально проблемная ситуация: ни одной сыворотки не нашли даже для fallback.
        logger.warn('No serum products found and fallback serum could not be selected', {
          userId,
          serumSteps,
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
      const fallbackTreatment = await findFallbackProduct('treatment', profileClassification, { userId });
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
        }, { saveToDb: true, userId });
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
      // ИСПРАВЛЕНО: Изменено с WARN на INFO, так как это нормальное поведение - поиск fallback
      logger.info('No mask products found for specific steps, searching for fallback', { userId, maskSteps });
      const fallbackMask = await findFallbackProduct('mask', profileClassification, { userId });
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
        }, { saveToDb: true, userId });
      } else {
        logger.warn('No fallback mask found', { userId, maskSteps });
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
    
    // ИСПРАВЛЕНО: Для каждого missing step пробуем найти fallback через иерархию
    // Например, для moisturizer_light пробуем: moisturizer_barrier, moisturizer_balancing, moisturizer
    for (const missingStep of missingSteps) {
      const baseStep = getBaseStepFromStepCategory(missingStep);
      
      // Для moisturizer пробуем иерархию fallback
      if (baseStep === 'moisturizer' || missingStep.startsWith('moisturizer_')) {
        const moisturizerFallbackHierarchy = [
          'moisturizer_barrier',
          'moisturizer_balancing',
          'moisturizer_soothing',
          'moisturizer_light',
          'moisturizer',
        ];
        
        logger.info('Trying moisturizer fallback hierarchy for missing step', {
          missingStep,
          baseStep,
          hierarchy: moisturizerFallbackHierarchy,
        });
        
        for (const fallbackCategory of moisturizerFallbackHierarchy) {
          const fallbackProduct = await findFallbackProduct(fallbackCategory, profileClassification, { userId });
          if (fallbackProduct) {
            // Регистрируем fallback продукт для missing step
            registerProductForStep(missingStep, fallbackProduct);
            logger.info('Found moisturizer fallback from hierarchy for missing step', {
              missingStep,
              fallbackCategory,
              productId: fallbackProduct.id,
              productName: fallbackProduct.name,
            });
            break;
          }
        }
      } else {
        // Для других шагов пробуем базовый fallback
        const fallbackProduct = await findFallbackProduct(baseStep, profileClassification, { userId });
        if (fallbackProduct) {
          registerProductForStep(missingStep, fallbackProduct);
          logger.info('Found fallback product for missing step', {
            missingStep,
            baseStep,
            productId: fallbackProduct.id,
            productName: fallbackProduct.name,
          });
        }
      }
    }
    
    // Проверяем еще раз после fallback попыток
    const stillMissingSteps = Array.from(requiredStepCategories).filter((step: StepCategory) => {
      const stepProducts = getProductsForStep(step);
      return stepProducts.length === 0;
    });
    
    if (stillMissingSteps.length > 0) {
      logger.warn('Still missing products after fallback hierarchy attempts, trying last resort fallback', {
        userId,
        stillMissingSteps,
      }, { saveToDb: true, userId });
      
      // ИСПРАВЛЕНО: Последняя попытка - находим ЛЮБОЙ продукт для каждого missing step
      for (const missingStep of stillMissingSteps) {
        const baseStep = getBaseStepFromStepCategory(missingStep);
        
        // Пробуем найти любой продукт из БД для этого базового шага
        try {
          const anyProduct = await prisma.product.findFirst({
            where: {
              published: true,
              brand: { isActive: true },
              OR: [
                { step: { contains: baseStep } },
                { category: { contains: baseStep } },
              ],
            },
            include: { brand: true },
            orderBy: [
              { isHero: 'desc' },
              { priority: 'desc' },
              { createdAt: 'desc' },
            ],
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
            
            registerProductForStep(missingStep, anyProductWithBrand);
            logger.info('Last resort fallback product found for missing step', {
              missingStep,
              baseStep,
              productId: anyProduct.id,
              productName: anyProduct.name,
              userId,
            }, { saveToDb: true, userId });
          } else {
            logger.error('CRITICAL: Could not find ANY product in DB for missing step', {
              missingStep,
              baseStep,
              userId,
              note: 'Plan will be generated with placeholder step (productId = null)',
            });
          }
        } catch (dbError: any) {
          logger.error('Error searching for last resort fallback product', {
            missingStep,
            baseStep,
            userId,
            error: dbError?.message,
          });
        }
      }
      
      // Финальная проверка после последней попытки
      const finalMissingSteps = Array.from(requiredStepCategories).filter((step: StepCategory) => {
        const stepProducts = getProductsForStep(step);
        return stepProducts.length === 0;
      });
      
      if (finalMissingSteps.length > 0) {
        logger.error('CRITICAL: Still missing products after ALL fallback attempts', {
          userId,
          finalMissingSteps,
          note: 'Plan will be generated with placeholder steps (productId = null)',
        });
      } else {
        logger.info('All missing steps resolved with last resort fallback', {
          userId,
          resolvedSteps: stillMissingSteps,
        }, { saveToDb: true, userId });
      }
    }
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
    rosaceaRisk: profileClassification.rosaceaRisk || undefined,
    onIsotretinoin: profileClassification.onIsotretinoin,
    currentOralMeds: profileClassification.currentOralMeds,
    fitzpatrickType: profileClassification.fitzpatrickType, // P2.9: учёт фототипа
  });

  logger.info('Dermatology protocol determined', {
    protocol: dermatologyProtocol.condition,
    protocolName: dermatologyProtocol.name,
    userId,
  });

  // Шаг 3: Генерация плана (28 дней, 4 недели)
  const plan28Days: DayPlan[] = [];
  
  // ИСПРАВЛЕНО (P1): Кэшируем результаты canApplyStep для всех возможных шагов
  // Шаги одинаковые для всех дней (шаблон не меняется), поэтому проверяем один раз
  const stepAllowanceCache = new Map<StepCategory, { allowed: boolean; reason?: string }>();
  const allPossibleSteps = new Set<StepCategory>([
    ...adjustedMorning,
    ...adjustedEvening,
    ...(adjustedWeekly || []),
    'cleanser_oil', // Может быть добавлен динамически
    'cleanser_micellar', // Может быть добавлен динамически (жирная кожа + ежедневный макияж)
  ]);
  
  logger.info('Caching step allowance results', {
    userId,
    totalSteps: allPossibleSteps.size,
    steps: Array.from(allPossibleSteps),
  });
  
  // ИСПРАВЛЕНО (P1, P2): Проверяем все возможные шаги один раз с получением причины
  // ИСПРАВЛЕНО (P2): canApplyStep теперь синхронная, убран async/await
  const rosaceaRisk = profile.rosaceaRisk as "low" | "medium" | "high" | "critical" | null | undefined;
  Array.from(allPossibleSteps).forEach((step) => {
    const result = canApplyStep(step, stepProfile, rosaceaRisk);
    stepAllowanceCache.set(step, result);
    if (!result.allowed) {
      logger.debug('Step not allowed for profile (cached)', {
        step,
        reason: result.reason,
        skinType: stepProfile.skinType,
        sensitivity: stepProfile.sensitivity,
        diagnoses: stepProfile.diagnoses,
        rosaceaRisk,
        userId,
      });
    }
  });
  
  logger.info('Step allowance cache populated', {
    userId,
    cachedCount: stepAllowanceCache.size,
    allowedCount: Array.from(stepAllowanceCache.values()).filter(v => v.allowed).length,
  });
  
  // Определяем, нужно ли двойное очищение (гидрофильное масло вечером) для пользователей с ежедневным макияжем
  const makeupFrequency = medicalMarkers?.makeupFrequency as string | undefined;
  // P3.2: Гидрофильное масло НЕ предлагаем жирной/комби-жирной коже — для неё первым
  // этапом предпочтительнее водное/гелевое очищение (мицеллярка/гель), а не масло.
  // Мицеллярной категории в каталоге пока нет, поэтому для жирной кожи просто не добавляем
  // масляный шаг — основной (балансирующий/гелевый) клинзер закрывает снятие макияжа.
  const normalizedSkinTypeForCleanse = normalizeSkinTypeForRules(profileClassification.skinType);
  const isOilySkin = normalizedSkinTypeForCleanse === 'oily' || normalizedSkinTypeForCleanse === 'combination_oily';
  const needsOilCleansing = makeupFrequency === 'daily' && !isOilySkin;
  // P3.2: Жирной/комби-жирной коже первым этапом — мицеллярная вода (а не масло).
  // Шаг активируется автоматически, когда в каталоге появятся мицеллярные средства;
  // до тех пор он просто не наполняется продуктом и опускается.
  const needsMicellarCleansing = makeupFrequency === 'daily' && isOilySkin;
  
  // [REMOVED] ~530 lines of legacy weeks generation loop.
  // The loop duplicated product selection, dermatology filtering, and step-building logic
  // that the plan28Days loop (below) already performs.
  // `weeks` is now derived from plan28Days after generation (see below).

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

  // P1.1: Brand diversity — не более N продуктов одного бренда в финальной выборке.
  // SPF/cleanser защищены внутри enforceBrandDiversity. Limit = 3 для дефолтной массовой рутины.
  {
    const { enforceBrandDiversity } = await import('@/lib/plan-helpers');
    const candidatesByStep = new Map<string, ProductWithBrand[]>();
    productsByStepMap.forEach((products, stepCategory) => {
      candidatesByStep.set(String(stepCategory), products);
    });
    const diversified = enforceBrandDiversity(selectedProducts, candidatesByStep, 3);
    // Сохраняем мутацию, чтобы UI и день-планер видели сбалансированный список.
    selectedProducts.length = 0;
    selectedProducts.push(...diversified);
  }

  // Форматируем продукты для карусели
  const formattedProducts = selectedProducts.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand.name,
    category: p.category,
    price: (p as any).price || 0,
    available: 'in_stock', // ИСПРАВЛЕНО: marketLinks не существует в ProductWithBrand, используем дефолтное значение
    imageUrl: p.imageUrl || undefined,
    // ИСПРАВЛЕНО: Используем activeIngredients вместо concerns (concerns - это проблемы кожи, не ингредиенты)
    ingredients: (p as any).activeIngredients || [],
  }));

  // Генерируем предупреждения об аллергиях и исключениях
  const warnings: string[] = [];
  // P0.1: Самое важное предупреждение — выше беременности по приоритету, потому что
  // системный изотретиноин это прямая фарма-терапия и любые активы наружу противопоказаны.
  if (profileClassification.onIsotretinoin) {
    warnings.push('⚠️ Вы отметили приём изотретиноина (Аккутан/Роаккутан). На время терапии наружные ретиноиды, AHA/BHA, бензоилпероксид, азелаиновая кислота и витамин C исключены из плана. Любые изменения ухода согласуйте с дерматологом.');
  }
  if (profileClassification.pregnant) {
    warnings.push('⚠️ Во время беременности исключены продукты с ретинолом');
  }
  // P0.2: Подсказка для тех, кто впервые столкнётся с ретинолом или AHA.
  if (profileClassification.retinoidExperience === 'naive') {
    warnings.push('💡 Ретинол и кислоты вводим постепенно: 1 раз в неделю → 2 → 3 → ежедневно за 4 недели. Это снижает шелушение и раздражение.');
  }
  // P1.3: Для тёмного фототипа — предупреждение о ПИВ.
  if (profileClassification.fitzpatrickType === 'V_VI') {
    warnings.push('🌑 Для тёмного фототипа (V–VI по Фитцпатрику) сильные кислотные пилинги исключены — выше риск пост-воспалительной гиперпигментации. SPF 50+ ежедневно обязателен.');
  } else if (profileClassification.fitzpatrickType === 'III_IV') {
    warnings.push('💛 Из-за склонности к пигментации активы вводим осторожно, SPF 50+ обязателен — это основная защита от ПИВ.');
  }
  // P0.4: Patch-test reminder для всех новых активов (универсально, без UI-перестройки).
  warnings.push('🧪 Перед первым применением новых активных средств (ретинол, AHA/BHA, витамин C, азелаиновая кислота) сделайте тест: нанесите на сгиб локтя и оцените реакцию через 24 часа.');
  // P1.2: Если применили сезонную адаптацию — поясняем пользователю.
  for (const reason of Array.from(new Set(seasonalReasons))) {
    warnings.push(`🍂 ${reason}`);
  }
  if (profileClassification.exclude && profileClassification.exclude.length > 0) {
    warnings.push(`⚠️ Исключены ингредиенты: ${profileClassification.exclude.join(', ')}`);
  }
  if (profileClassification.allergies && profileClassification.allergies.length > 0) {
    warnings.push(`⚠️ Учитываются аллергии: ${profileClassification.allergies.join(', ')}`);
  }

  const hasRosaceaDiagnosisForWaterCleanse = normalizedDiagnoses.some((diagnosis) => {
    const value = String(diagnosis || '').toLowerCase();
    return value.includes('rosacea') || value.includes('розацеа');
  });
  const shouldUseMorningWaterCleanse =
    ['high', 'very_high'].includes(String(profile.sensitivityLevel || '').toLowerCase()) ||
    ['medium', 'high', 'critical'].includes(String(profile.rosaceaRisk || '').toLowerCase()) ||
    hasRosaceaDiagnosisForWaterCleanse;

  // Преобразуем план в новый формат Plan28
  // ИСПРАВЛЕНО: plan28Days уже объявлен выше, используем существующий
  const weeklySteps = carePlanTemplate.weekly || [];
  
  // Используем уже определенную routineComplexity из carePlanProfileInput
  // Если нужно переопределить из medicalMarkers, делаем это без const
  if ((medicalMarkers as any)?.routineComplexity) {
    routineComplexity = (medicalMarkers as any).routineComplexity;
  }
  
  for (let dayIndex = 1; dayIndex <= 28; dayIndex++) {
    const weekNum = Math.ceil(dayIndex / 7);
    
    // ИСПРАВЛЕНО: Используем протокол для определения фазы дня
    const { getPhaseForDayFromProtocol, isBarrierDay } = await import('./protocol-plan-integration');
    const basePhase = getPhaseForDay(dayIndex);
    const protocolPhase = getPhaseForDayFromProtocol(dayIndex, dermatologyProtocol, weekNum);
    const isBarrier = isBarrierDay(dayIndex, weekNum, dermatologyProtocol);
    // Используем протоколную фазу, если она более строгая (adaptation вместо active)
    const phase = (protocolPhase === 'adaptation' && basePhase === 'active') ? 'adaptation' : basePhase;
    const isWeekly = isWeeklyFocusDay(dayIndex, weeklySteps, routineComplexity as any);
    
    // ИСПРАВЛЕНО: Используем шаги из шаблона напрямую, а не из weeks
    // P1.5: Дополнительно убираем шаги, запрещённые дерматологическим протоколом,
    // чтобы запрещённый активный шаг не оставался в плане пустым плейсхолдером.
    const rawMorningSteps = filterStepsByProtocol(adjustedMorning, dermatologyProtocol);
    // Если пользователь ежедневно использует макияж, добавляем гидрофильное масло первым этапом вечернего очищения
    const rawEveningSteps = filterStepsByProtocol(dedupeSteps([
      ...(needsOilCleansing ? ['cleanser_oil' as StepCategory] : []),
      ...(needsMicellarCleansing ? ['cleanser_micellar' as StepCategory] : []),
      ...adjustedEvening,
    ]), dermatologyProtocol);
    
    // Фильтруем шаги по правилам профиля
    const allowedMorningSteps = rawMorningSteps.filter((step) => {
      const result = stepAllowanceCache.get(step);
      const isAllowed = result?.allowed ?? true;
      if (!isAllowed) {
        logger.debug('Step filtered out by canApplyStep (morning, from cache)', {
          step,
          reason: result?.reason,
          userId,
          day: dayIndex,
        });
      }
      return isAllowed;
    });
    
    const allowedEveningSteps = rawEveningSteps.filter((step) => {
      const result = stepAllowanceCache.get(step);
      const isAllowed = result?.allowed ?? true;
      if (!isAllowed) {
        logger.debug('Step filtered out by canApplyStep (evening, from cache)', {
          step,
          reason: result?.reason,
          userId,
          day: dayIndex,
        });
      }
      return isAllowed;
    });
    
    const morningStepsTemplate = ensureStepPresence(
      ensureStepPresence(allowedMorningSteps, isCleanserStep, CLEANER_FALLBACK_STEP),
      isSPFStep,
      SPF_FALLBACK_STEP
    );
    const eveningStepsTemplate = ensureStepPresence(
      allowedEveningSteps.filter((step) => !isSPFStep(step)),
      isCleanserStep,
      CLEANER_FALLBACK_STEP
    );
    
    // ИСПРАВЛЕНО (P0): Преобразуем morning steps - шаг создаётся ТОЛЬКО если есть продукты
    // КРИТИЧНО: Шаг не должен попадать в план без продуктов
    const morningSteps: DayStep[] = [];
    for (const stepCategory of morningStepsTemplate) {
      const baseStep = getBaseStepFromStepCategory(stepCategory);

      if (shouldUseMorningWaterCleanse && isCleanserStep(stepCategory)) {
        morningSteps.push({
          stepCategory,
          productId: null,
          alternatives: [],
          manualLabel: 'Умывание тёплой водой',
          instruction: 'Утром без очищающего средства: умойтесь тёплой водой и промокните кожу полотенцем.',
        });
        continue;
      }

      // P0.1: Титрация — пропускаем активный шаг в дни, когда актив не должен применяться
      // согласно протоколу (постепенное введение ретинола/кислот/витамина C).
      if (!isActiveStepAllowedOnDay(stepCategory, dayIndex, weekNum, dermatologyProtocol, profileClassification)) {
        logger.debug('Active step skipped by titration schedule (morning)', {
          stepCategory, dayIndex, weekNum, userId,
        });
        continue;
      }

      let stepProducts = getProductsForStep(stepCategory, phase);
      
      // ИСПРАВЛЕНО (P1): Если продуктов не найдено, пробуем найти через fallback с логированием причины
      let fallbackReason: string | undefined;
      if (stepProducts.length === 0) {
        // Пробуем fallback
        const fallback = getFallbackStep(stepCategory);
        if (fallback && fallback !== stepCategory) {
          stepProducts = getProductsForStep(fallback, phase);
          if (stepProducts.length > 0) {
            fallbackReason = `Used fallback step: ${fallback} instead of ${stepCategory}`;
            logger.info('Fallback step used (morning)', {
              stepCategory,
              fallback,
              dayIndex,
              userId,
            });
          }
        }
        
        // Если все еще нет, пробуем найти любой продукт для базового шага
        if (stepProducts.length === 0) {
          // ИСПРАВЛЕНО: Ищем в productsByStepMap все ключи, которые начинаются с базового шага
          for (const [mapStep, products] of productsByStepMap.entries()) {
            const mapBaseStep = getBaseStepFromStepCategory(mapStep as StepCategory);
            if (mapBaseStep === baseStep || mapStep.startsWith(baseStep + '_') || mapStep === baseStep) {
              stepProducts.push(...products);
            }
          }
          // Удаляем дубликаты
          stepProducts = Array.from(new Map(stepProducts.map(p => [p.id, p])).values());
          
          if (stepProducts.length > 0) {
            fallbackReason = `Used base step match: ${baseStep} for ${stepCategory}`;
            logger.info('Base step match used (morning)', {
              stepCategory,
              baseStep,
              dayIndex,
              userId,
            });
          }
          
          // ИСПРАВЛЕНО: Фильтруем по фазе после сбора всех вариантов
          if (phase && stepProducts.length > 0) {
            const beforeFilter = stepProducts.length;
            stepProducts = filterProductsByPhase(stepProducts, phase, stepCategory);
            if (stepProducts.length < beforeFilter) {
              fallbackReason = `${fallbackReason || ''} (filtered by phase: ${phase})`.trim();
            }
          }
          
          // ИСПРАВЛЕНО: Если продуктов все еще нет, ищем через БД (асинхронный fallback)
          if (stepProducts.length === 0) {
            fallbackReason = `No products found, searching DB for base step: ${baseStep}`;
            logger.warn('No products found for step after all fallbacks, searching DB (morning)', {
              stepCategory,
              baseStep,
              dayIndex,
              phase,
              userId,
              fallbackReason,
            });
            
            // Последняя попытка: ищем через findFallbackProduct в БД
            try {
              const fallbackProduct = await findFallbackProduct(baseStep, profileClassification, { userId });
              if (fallbackProduct) {
                registerProductForStep(stepCategory, fallbackProduct);
                stepProducts = [fallbackProduct];
                fallbackReason = `DB fallback product found: ${fallbackProduct.name} (${fallbackProduct.id})`;
                logger.info('Fallback product found from DB (morning)', {
                  stepCategory,
                  baseStep,
                  productId: fallbackProduct.id,
                  productName: fallbackProduct.name,
                  userId,
                  fallbackReason,
                });
              } else {
                fallbackReason = `No fallback product found in DB for base step: ${baseStep}`;
                logger.warn('No fallback product found in DB (morning)', {
                  stepCategory,
                  baseStep,
                  dayIndex,
                  userId,
                  fallbackReason,
                });
              }
            } catch (fallbackError) {
              fallbackReason = `Error searching fallback product: ${fallbackError}`;
              logger.error('Error searching fallback product in DB (morning)', {
                stepCategory,
                baseStep,
                error: fallbackError,
                userId,
                fallbackReason,
              });
            }
          }
        }
      }
      
      // ИСПРАВЛЕНО (P0): Шаг создаётся ТОЛЬКО если есть продукты
      if (stepProducts.length === 0) {
        logger.warn('Skipping step: no products found (morning)', {
          stepCategory,
          baseStep,
          dayIndex,
          phase,
          userId,
          fallbackReason: fallbackReason || 'No products found after all fallback attempts',
        });
        continue; // Пропускаем шаг без продуктов
      }
      
      // ИСПРАВЛЕНО: Разнообразие подбора — разные пользователи получают разные продукты
      // (ограничиваем повторяемость Lip Balm, Vitamin C и т.д.)
      const selectedProduct = pickProductForProfileDiversity(
        stepProducts,
        userId ?? '',
        stepCategory,
        phase
      );
      const selectedProductIndex = selectedProduct
        ? stepProducts.findIndex((p) => p.id === selectedProduct.id)
        : 0;
      const alternatives = stepProducts
        .filter((p) => p.id !== selectedProduct?.id)
        .slice(0, 3)
        .map(p => String(p.id));
      
      // Логируем для отладки
      if (userId === '643160759' || process.env.NODE_ENV === 'development') {
        logger.info('Products for step in plan28 morning', {
          step: stepCategory,
          dayIndex,
          phase,
          productsCount: stepProducts.length,
          selectedProductIndex,
          selectedProductId: selectedProduct?.id,
          productIds: stepProducts.map(p => p.id).slice(0, 5),
          productsByStepMapKeys: Array.from(productsByStepMap.keys()),
          userId,
        });
      }
      
      // ИСПРАВЛЕНО (P0): Шаг добавляется ТОЛЬКО если есть продукт
      // Гарантируем, что в плане нет пустых шагов
      if (selectedProduct) {
        morningSteps.push({
          stepCategory: stepCategory,
          productId: String(selectedProduct.id),
          alternatives,
        });
      }
    }
    
    // ИСПРАВЛЕНО: Добавляем бальзам для губ утром для всех пользователей
    // Подбираем в зависимости от типа кожи
    // Для разных типов кожи можно использовать разные варианты lip_care
    // Сейчас используем универсальный lip_care
    const lipBalmStep: StepCategory = 'lip_care';
    
    // Проверяем, есть ли продукты для бальзама для губ
    let lipBalmProducts = getProductsForStep(lipBalmStep, phase);
    if (lipBalmProducts.length === 0) {
      // Пробуем найти через fallback в БД
      try {
        const fallbackLipBalm = await findFallbackProduct('lip_care', profileClassification, { userId });
        if (fallbackLipBalm) {
          registerProductForStep(lipBalmStep, fallbackLipBalm);
          lipBalmProducts = [fallbackLipBalm];
        }
      } catch (err) {
        logger.warn('Could not find lip balm product', { userId, dayIndex });
      }
    }
    
    // Добавляем бальзам для губ только если есть продукт
    if (lipBalmProducts.length > 0) {
      const selectedLipBalm = pickProductForProfileDiversity(
        lipBalmProducts,
        userId ?? '',
        lipBalmStep,
        phase
      ) ?? lipBalmProducts[0];
      const alternatives = lipBalmProducts
        .filter((p) => p.id !== selectedLipBalm.id)
        .slice(0, 3)
        .map(p => String(p.id));
      morningSteps.push({
        stepCategory: lipBalmStep,
        productId: String(selectedLipBalm.id),
        alternatives,
      });
      logger.debug('Added lip balm to morning routine', {
        userId,
        dayIndex,
        productId: selectedLipBalm.id,
      });
    }
    
    // ИСПРАВЛЕНО: Добавляем крем для глаз только для тех, у кого проблема с темными кругами
    // Проверяем наличие цели dark_circles в mainGoals (уже добавлено выше)
    const hasDarkCircles = mainGoals.includes('dark_circles');
    
    if (hasDarkCircles) {
      const eyeCreamStep: StepCategory = 'eye_cream_dark_circles';
      let eyeCreamProducts = getProductsForStep(eyeCreamStep, phase);
      
      if (eyeCreamProducts.length === 0) {
        // Пробуем найти через fallback в БД
        try {
          const fallbackEyeCream = await findFallbackProduct('eye_cream_dark_circles', profileClassification, { userId });
          if (fallbackEyeCream) {
            registerProductForStep(eyeCreamStep, fallbackEyeCream);
            eyeCreamProducts = [fallbackEyeCream];
          }
        } catch (err) {
          logger.warn('Could not find eye cream product for dark circles', { userId, dayIndex });
        }
      }
      
      // Добавляем крем для глаз только если есть продукт
      if (eyeCreamProducts.length > 0) {
        const selectedEyeCream = pickProductForProfileDiversity(
          eyeCreamProducts,
          userId ?? '',
          eyeCreamStep,
          phase
        ) ?? eyeCreamProducts[0];
        const alternatives = eyeCreamProducts
          .filter((p) => p.id !== selectedEyeCream.id)
          .slice(0, 3)
          .map(p => String(p.id));
        morningSteps.push({
          stepCategory: eyeCreamStep,
          productId: String(selectedEyeCream.id),
          alternatives,
        });
        logger.debug('Added eye cream for dark circles to morning routine', {
          userId,
          dayIndex,
          productId: selectedEyeCream.id,
        });
      }
    }
    
    // Преобразуем evening steps
    // ИСПРАВЛЕНО: передаем фазу для фильтрации продуктов по этапу плана
    // ИСПРАВЛЕНО: Используем async цикл вместо map для поддержки await в fallback через БД
    // ИСПРАВЛЕНО: Собираем уже выбранные продукты из утренних шагов для проверки дубликатов
    // ВАЖНО: Сохраняем stepCategory для каждого продукта, чтобы правильно определять активные ингредиенты
    const selectedProductsForDay: ProductWithBrand[] = [];
    for (const morningStep of morningSteps) {
      if (morningStep.productId) {
        const product = selectedProducts.find(p => String(p.id) === morningStep.productId);
        if (product) {
          // ИСПРАВЛЕНО: Сохраняем stepCategory в продукте для правильного определения активных ингредиентов
          const productWithStepCategory = {
            ...product,
            stepCategory: morningStep.stepCategory, // Временно сохраняем stepCategory для проверки дубликатов
          } as ProductWithBrand & { stepCategory?: StepCategory };
          selectedProductsForDay.push(productWithStepCategory as ProductWithBrand);
        }
      }
    }
    
    const eveningSteps: DayStep[] = [];
    for (const stepCategory of eveningStepsTemplate) {
      // P0.1: Титрация — пропускаем активный шаг в дни, когда актив не должен применяться
      // согласно протоколу (постепенное введение ретинола/кислот).
      if (!isActiveStepAllowedOnDay(stepCategory, dayIndex, weekNum, dermatologyProtocol, profileClassification)) {
        logger.debug('Active step skipped by titration schedule (evening)', {
          stepCategory, dayIndex, weekNum, userId,
        });
        continue;
      }

      let stepProducts = getProductsForStep(stepCategory, phase);
      
      // ИСПРАВЛЕНО (P1): Если продуктов не найдено, пробуем найти через fallback с логированием причины
      let fallbackReasonEvening: string | undefined;
      if (stepProducts.length === 0) {
        // Пробуем fallback
        const fallback = getFallbackStep(stepCategory);
        if (fallback && fallback !== stepCategory) {
          stepProducts = getProductsForStep(fallback, phase);
          if (stepProducts.length > 0) {
            fallbackReasonEvening = `Used fallback step: ${fallback} instead of ${stepCategory}`;
            logger.info('Fallback step used (evening)', {
              stepCategory,
              fallback,
              dayIndex,
              userId,
            });
          }
        }
        
        // Если все еще нет, пробуем найти любой продукт для базового шага
        if (stepProducts.length === 0) {
          const baseStep = getBaseStepFromStepCategory(stepCategory);
          // ИСПРАВЛЕНО: Ищем в productsByStepMap все ключи, которые начинаются с базового шага
          for (const [mapStep, products] of productsByStepMap.entries()) {
            const mapBaseStep = getBaseStepFromStepCategory(mapStep as StepCategory);
            if (mapBaseStep === baseStep || mapStep.startsWith(baseStep + '_') || mapStep === baseStep) {
              stepProducts.push(...products);
            }
          }
          // Удаляем дубликаты
          stepProducts = Array.from(new Map(stepProducts.map(p => [p.id, p])).values());
          
          if (stepProducts.length > 0) {
            fallbackReasonEvening = `Used base step match: ${baseStep} for ${stepCategory}`;
            logger.info('Base step match used (evening)', {
              stepCategory,
              baseStep,
              dayIndex,
              userId,
            });
          }
          
          // ИСПРАВЛЕНО: Фильтруем по фазе после сбора всех вариантов
          if (phase && stepProducts.length > 0) {
            const beforeFilter = stepProducts.length;
            stepProducts = filterProductsByPhase(stepProducts, phase, stepCategory);
            if (stepProducts.length < beforeFilter) {
              fallbackReasonEvening = `${fallbackReasonEvening || ''} (filtered by phase: ${phase})`.trim();
            }
          }
          
          // ИСПРАВЛЕНО: Если продуктов все еще нет, ищем через БД (асинхронный fallback)
          if (stepProducts.length === 0) {
            fallbackReasonEvening = `No products found, searching DB for base step: ${baseStep}`;
            logger.warn('No products found for step after all fallbacks, searching DB (evening)', {
              stepCategory,
              baseStep,
              dayIndex,
              phase,
              userId,
              fallbackReason: fallbackReasonEvening,
            });
            
            // Последняя попытка: ищем через findFallbackProduct в БД
            try {
              const fallbackProduct = await findFallbackProduct(baseStep, profileClassification, { userId });
              if (fallbackProduct) {
                registerProductForStep(stepCategory, fallbackProduct);
                stepProducts = [fallbackProduct];
                fallbackReasonEvening = `DB fallback product found: ${fallbackProduct.name} (${fallbackProduct.id})`;
                logger.info('Fallback product found from DB (evening)', {
                  stepCategory,
                  baseStep,
                  productId: fallbackProduct.id,
                  productName: fallbackProduct.name,
                  userId,
                  fallbackReason: fallbackReasonEvening,
                });
              } else {
                fallbackReasonEvening = `No fallback product found in DB for base step: ${baseStep}`;
                logger.warn('No fallback product found in DB (evening)', {
                  stepCategory,
                  baseStep,
                  dayIndex,
                  userId,
                  fallbackReason: fallbackReasonEvening,
                });
              }
            } catch (fallbackError) {
              fallbackReasonEvening = `Error searching fallback product: ${fallbackError}`;
              logger.error('Error searching fallback product in DB (evening)', {
                stepCategory,
                baseStep,
                error: fallbackError,
                userId,
                fallbackReason: fallbackReasonEvening,
              });
            }
          }
        }
      }
      
      // ИСПРАВЛЕНО (P0): Шаг создаётся ТОЛЬКО если есть продукты
      if (stepProducts.length === 0) {
        logger.warn('Skipping step: no products found (evening)', {
          stepCategory,
          dayIndex,
          phase,
          userId,
          fallbackReason: fallbackReasonEvening || 'No products found after all fallback attempts',
        });
        continue; // Пропускаем шаг без продуктов
      }
      
      // ИСПРАВЛЕНО: Применяем дерматологическую фильтрацию с проверкой дубликатов
      // Это предотвращает добавление продуктов с дублирующими активными ингредиентами
      const baseStepEvening = getBaseStepFromStepCategory(stepCategory);
      let filteredStepProducts = stepProducts;
      
      // Для обязательных шагов (cleanser) не применяем строгую фильтрацию
      if (!isCleanserStep(stepCategory)) {
        const context: ProductSelectionContext = {
          timeOfDay: 'evening',
          day: dayIndex,
          week: weekNum,
          alreadySelected: selectedProductsForDay,
          protocol: dermatologyProtocol,
          profileClassification,
          stepCategory: stepCategory, // ИСПРАВЛЕНО: Передаем stepCategory для проверки дубликатов
        };
        
        const filteredResults = filterProductsWithDermatologyLogic(stepProducts, context);
        const compatibleProducts = filteredResults.filter(r => r.allowed);
        
        if (compatibleProducts.length > 0) {
          filteredStepProducts = compatibleProducts.map(r => r.product);
          logger.debug('Products filtered by dermatology logic (evening)', {
            stepCategory,
            dayIndex,
            originalCount: stepProducts.length,
            filteredCount: filteredStepProducts.length,
            userId,
          });
        } else if (stepProducts.length > 0) {
          // Если все продукты отфильтрованы, используем первый доступный с предупреждением
          logger.warn('All products filtered, using first available (evening)', {
            stepCategory,
            dayIndex,
            totalProducts: stepProducts.length,
            filteredReasons: filteredResults.filter(r => !r.allowed).map(r => r.reason).slice(0, 3),
            userId,
          });
          filteredStepProducts = stepProducts;
        }
      }
      
      // ИСПРАВЛЕНО: Разнообразие подбора — разные пользователи получают разные продукты
      const selectedProductEvening = pickProductForProfileDiversity(
        filteredStepProducts,
        userId ?? '',
        stepCategory,
        phase
      ) ?? filteredStepProducts[0];
      const selectedProductIndexEvening = selectedProductEvening
        ? filteredStepProducts.findIndex((p) => p.id === selectedProductEvening.id)
        : 0;
      const alternativesEvening = filteredStepProducts
        .filter((p) => p.id !== selectedProductEvening?.id)
        .slice(0, 3)
        .map(p => String(p.id));
      
      // Добавляем выбранный продукт в список для проверки дубликатов следующих шагов
      if (selectedProductEvening) {
        selectedProductsForDay.push(selectedProductEvening);
      }
      
      // Логируем для отладки
      if (userId === '643160759' || process.env.NODE_ENV === 'development') {
        logger.info('Products for step in plan28 evening', {
          step: stepCategory,
          dayIndex,
          phase,
          productsCount: stepProducts.length,
          selectedProductIndexEvening,
          selectedProductId: selectedProductEvening?.id,
          userId,
        });
      }
      
      // ИСПРАВЛЕНО (P0): Шаг добавляется ТОЛЬКО если есть продукт
      eveningSteps.push({
        stepCategory: stepCategory,
        productId: String(selectedProductEvening.id),
        alternatives: alternativesEvening,
      });
    }
    
    // ИСПРАВЛЕНО (P0): Преобразуем weekly steps - шаг создаётся ТОЛЬКО если есть продукты
    const weeklyDaySteps: DayStep[] = [];
    if (isWeekly) {
      for (const step of weeklySteps) {
        const stepCategory = step as StepCategory;
        const stepProducts = getProductsForStep(stepCategory, phase);
        
        // ИСПРАВЛЕНО (P0): Шаг создаётся ТОЛЬКО если есть продукты
        if (stepProducts.length === 0) {
          logger.warn('Skipping weekly step: no products found', {
            stepCategory,
            dayIndex,
            phase,
            userId,
          });
          continue;
        }
        
        const selectedWeeklyProduct = pickProductForProfileDiversity(
          stepProducts,
          userId ?? '',
          stepCategory,
          phase
        ) ?? stepProducts[0];
        const alternatives = stepProducts
          .filter((p) => p.id !== selectedWeeklyProduct.id)
          .slice(0, 3)
          .map(p => String(p.id));
        
        weeklyDaySteps.push({
          stepCategory: stepCategory,
          productId: String(selectedWeeklyProduct.id),
          alternatives,
        });
      }
    }
    
    // ИСПРАВЛЕНО (P0): День добавляется ТОЛЬКО если есть хотя бы один шаг с продуктом
    // В strict режиме требуется минимум cleanser + moisturizer
    const hasMorningSteps = morningSteps.length > 0;
    const hasEveningSteps = eveningSteps.length > 0;
    const hasWeeklySteps = weeklyDaySteps.length > 0;
    
    // ИСПРАВЛЕНО (P0): В strict режиме проверяем минимальные требования
    if (mode === 'strict') {
      const hasCleanser = morningSteps.some(s => s.stepCategory.startsWith('cleanser')) ||
                         eveningSteps.some(s => s.stepCategory.startsWith('cleanser'));
      const hasMoisturizer = morningSteps.some(s => s.stepCategory.startsWith('moisturizer')) ||
                            eveningSteps.some(s => s.stepCategory.startsWith('moisturizer'));
      
      if (!hasCleanser || !hasMoisturizer) {
        logger.warn('Skipping day in strict mode: missing required steps (cleanser or moisturizer)', {
          dayIndex,
          phase,
          hasCleanser,
          hasMoisturizer,
          userId,
        });
        continue; // Пропускаем день без обязательных шагов
      }
    }
    
    if (!hasMorningSteps && !hasEveningSteps && !hasWeeklySteps) {
      logger.warn('Skipping day: no steps with products', {
        dayIndex,
        phase,
        userId,
      });
      continue; // Пропускаем день без шагов
    }
    
    plan28Days.push({
      dayIndex,
      phase,
      isWeeklyFocusDay: isWeekly,
      morning: morningSteps,
      evening: eveningSteps,
      weekly: weeklyDaySteps,
    });
  }
  
  // ИСПРАВЛЕНО (P1): Валидация шаблона vs реальности
  // Проверяем, что реальный план соответствует шаблону
  const templateMorningSteps = new Set(adjustedMorning);
  const templateEveningSteps = new Set(adjustedEvening);
  const templateWeeklySteps = new Set(adjustedWeekly || []);
  
  // Собираем реальные шаги из всех дней
  const actualMorningSteps = new Set<StepCategory>();
  const actualEveningSteps = new Set<StepCategory>();
  const actualWeeklySteps = new Set<StepCategory>();
  
  for (const day of plan28Days) {
    day.morning.forEach(step => actualMorningSteps.add(step.stepCategory));
    day.evening.forEach(step => actualEveningSteps.add(step.stepCategory));
    day.weekly.forEach(step => actualWeeklySteps.add(step.stepCategory));
  }
  
  // Находим расхождения
  const missingMorningSteps = Array.from(templateMorningSteps).filter(s => !actualMorningSteps.has(s));
  const missingEveningSteps = Array.from(templateEveningSteps).filter(s => !actualEveningSteps.has(s));
  const missingWeeklySteps = Array.from(templateWeeklySteps).filter(s => !actualWeeklySteps.has(s));
  
  // Логируем расхождения
  if (missingMorningSteps.length > 0 || missingEveningSteps.length > 0 || missingWeeklySteps.length > 0) {
    logger.warn('Template vs reality mismatch: some template steps missing in actual plan', {
      userId,
      missingMorningSteps,
      missingEveningSteps,
      missingWeeklySteps,
      templateMorningCount: templateMorningSteps.size,
      templateEveningCount: templateEveningSteps.size,
      templateWeeklyCount: templateWeeklySteps.size,
      actualMorningCount: actualMorningSteps.size,
      actualEveningCount: actualEveningSteps.size,
      actualWeeklyCount: actualWeeklySteps.size,
      totalDays: plan28Days.length,
    });
  } else {
    logger.info('Template vs reality validation passed: all template steps present in actual plan', {
      userId,
      templateMorningCount: templateMorningSteps.size,
      templateEveningCount: templateEveningSteps.size,
      templateWeeklyCount: templateWeeklySteps.size,
      totalDays: plan28Days.length,
    });
  }
  
  // P0.4 follow-up: проставляем requiresPatchTest на первый день введения каждого
  // сильного актива. UI-баннер «сделай patch-test» рендерится только на эти шаги,
  // а не на каждый день — иначе пользователь привыкнет и перестанет читать.
  // Категории, требующие patch-теста (через startsWith для гибкости):
  const PATCH_TEST_ACTIVE_PREFIXES: Array<{ prefix: string; key: string }> = [
    { prefix: 'treatment_antiage', key: 'retinol' },
    { prefix: 'treatment_acne_azelaic', key: 'azelaic' },
    { prefix: 'treatment_acne_bpo', key: 'bpo' },
    { prefix: 'treatment_exfoliant', key: 'exfoliant' },
    { prefix: 'serum_vitc', key: 'vitamin_c' },
    { prefix: 'toner_aha', key: 'aha' },
    { prefix: 'toner_bha', key: 'bha' },
    { prefix: 'toner_acid', key: 'acid_toner' },
    { prefix: 'toner_exfoliant', key: 'exfoliant_toner' },
    { prefix: 'mask_acid', key: 'acid_mask' },
  ];
  {
    const seenActives = new Set<string>();
    const sortedDays = [...plan28Days].sort((a, b) => a.dayIndex - b.dayIndex);
    for (const day of sortedDays) {
      const allSteps = [...(day.morning || []), ...(day.evening || []), ...(day.weekly || [])];
      for (const step of allSteps) {
        for (const { prefix, key } of PATCH_TEST_ACTIVE_PREFIXES) {
          if (step.stepCategory.startsWith(prefix) && !seenActives.has(key)) {
            step.requiresPatchTest = true;
            seenActives.add(key);
            break;
          }
        }
      }
    }
    if (seenActives.size > 0) {
      logger.info('Patch-test flags applied to first-use days', {
        userId,
        activesFlagged: Array.from(seenActives),
      });
    }
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
  
  // ИСПРАВЛЕНО: Финальная проверка - все ли обязательные шаги имеют продукты
  const stepsWithoutProducts: string[] = [];
  for (const requiredStep of requiredStepCategories) {
    const stepProducts = getProductsForStep(requiredStep);
    if (stepProducts.length === 0) {
      stepsWithoutProducts.push(requiredStep);
    }
  }
  
  if (stepsWithoutProducts.length > 0) {
    logger.error('CRITICAL: Some required steps still have no products after all fallbacks', {
      userId,
      stepsWithoutProducts,
      requiredSteps: Array.from(requiredStepCategories),
      note: 'This should not happen - check ensureRequiredProducts and fallback logic',
    });
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
    requiredStepsCount: requiredStepCategories.size,
    stepsWithoutProducts: stepsWithoutProducts.length > 0 ? stepsWithoutProducts : undefined,
  });
  
  // Формируем legacy weeks из plan28Days для обратной совместимости
  const weeks: Array<{
    week: number;
    days: Array<{ morning: number[]; evening: number[] }>;
    summary: { focus: GoalKey[]; productsCount: number };
  }> = [];
  
  for (let w = 1; w <= PLAN_WEEKS_TOTAL; w++) {
    const startDay = (w - 1) * PLAN_DAYS_PER_WEEK + 1;
    const endDay = w * PLAN_DAYS_PER_WEEK;
    const weekDays = plan28Days.filter(d => d.dayIndex >= startDay && d.dayIndex <= endDay);
    
    const legacyDays = weekDays.map(day => ({
      morning: day.morning
        .map(step => step.productId ? Number(step.productId) : null)
        .filter((id): id is number => id !== null && !isNaN(id)),
      evening: day.evening
        .map(step => step.productId ? Number(step.productId) : null)
        .filter((id): id is number => id !== null && !isNaN(id)),
    }));
    
    // Дополняем до 7 дней пустыми, если plan28Days пропустил какие-то дни
    while (legacyDays.length < PLAN_DAYS_PER_WEEK) {
      legacyDays.push({ morning: [], evening: [] });
    }
    
    const weekProductsCount = legacyDays.reduce(
      (sum, d) => sum + d.morning.length + d.evening.length, 0
    );
    
    weeks.push({
      week: w,
      days: legacyDays,
      summary: {
        focus: [primaryFocus as GoalKey],
        productsCount: weekProductsCount,
      },
    });
  }
  
  let plan28: Plan28 = {
    userId,
    skinProfileId: profile.id,
    days: plan28Days,
    // ИСПРАВЛЕНО: в plan28 нужно сохранять финальные mainGoals,
    // т.к. UI и шаблоны опираются на них. mainGoals (до авто-добавлений и fallback 'general')
    // может быть пустым → в итоге на клиенте "не те" блоки и ощущения "не тот план".
    mainGoals: carePlanProfileInput.mainGoals,
  };

  // ИСПРАВЛЕНО: Проверка инвариантов плана перед возвратом
  // ИСПРАВЛЕНО: Добавлена проверка совместимости ингредиентов в течение дня
  const assertPlanInvariants = async (plan: Plan28): Promise<{ isValid: boolean; warnings: string[] }> => {
    const warnings: string[] = [];
    const requiredSteps: StepCategory[] = ['cleanser_gentle', 'moisturizer_light', 'spf_50_face'];
    const requiredBaseSteps = ['cleanser', 'moisturizer', 'spf'];
    
    // ИСПРАВЛЕНО: Импортируем функции проверки совместимости ингредиентов
    const { checkProductCompatibility } = await import('./ingredient-compatibility');
    
    // 1. Проверка обязательных шагов (должны быть хотя бы в одном дне)
    const allStepCategories = new Set<StepCategory>();
    const allBaseSteps = new Set<string>();
    plan.days.forEach(day => {
      [...day.morning, ...day.evening, ...day.weekly].forEach(step => {
        allStepCategories.add(step.stepCategory);
        const baseStep = getBaseStepFromStepCategory(step.stepCategory);
        allBaseSteps.add(baseStep);
      });
    });
    
    const missingRequiredSteps = requiredBaseSteps.filter(baseStep => {
      return !Array.from(allBaseSteps).some(step => step === baseStep || step.startsWith(baseStep + '_'));
    });
    
    if (missingRequiredSteps.length > 0) {
      warnings.push(`Missing required steps: ${missingRequiredSteps.join(', ')}`);
    }
    
    // 2. Проверка дубликатов продуктов в одном дне
    // ИСПРАВЛЕНО: повтор одного и того же продукта в рамках ОДНОГО базового шага (например cleanser утром+вечером)
    // допустим. Предупреждаем только если один productId используется в РАЗНЫХ базовых шагах в рамках дня,
    // что указывает на ошибку маппинга "продукт → stepCategory".
    plan.days.forEach((day, dayIndex) => {
      const productBaseSteps = new Map<string, Set<string>>();
      
      [...day.morning, ...day.evening, ...day.weekly].forEach(step => {
        if (step.productId) {
          const base = getBaseStepFromStepCategory(step.stepCategory as StepCategory);
          const set = productBaseSteps.get(step.productId) ?? new Set<string>();
          set.add(base);
          productBaseSteps.set(step.productId, set);
        }
      });
      
      // ИСПРАВЛЕНО: Проверка совместимости ингредиентов между morning и evening в течение дня
      const morningProducts = day.morning
        .filter(step => step.productId)
        .map(step => {
          // ИСПРАВЛЕНО: productId может быть string, но selectedProducts содержит number id
          const product = selectedProducts.find(p => String(p.id) === step.productId);
          return product ? {
            id: product.id,
            name: product.name,
            activeIngredients: product.activeIngredients || [],
          } : null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);
      
      const eveningProducts = day.evening
        .filter(step => step.productId)
        .map(step => {
          // ИСПРАВЛЕНО: productId может быть string, но selectedProducts содержит number id
          const product = selectedProducts.find(p => String(p.id) === step.productId);
          return product ? {
            id: product.id,
            name: product.name,
            activeIngredients: product.activeIngredients || [],
          } : null;
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);
      
      // Проверяем совместимость между morning и evening продуктами
      for (const morningProduct of morningProducts) {
        for (const eveningProduct of eveningProducts) {
          const conflict = checkProductCompatibility(morningProduct, eveningProduct);
          if (conflict && conflict.severity === 'high') {
            warnings.push(
              `Day ${dayIndex + 1}: High-severity ingredient conflict between morning product "${morningProduct.name}" and evening product "${eveningProduct.name}": ${conflict.reason}. ${conflict.recommendation}`
            );
          } else if (conflict && conflict.severity === 'medium') {
            warnings.push(
              `Day ${dayIndex + 1}: Medium-severity ingredient conflict between morning product "${morningProduct.name}" and evening product "${eveningProduct.name}": ${conflict.reason}. ${conflict.recommendation}`
            );
          }
        }
      }
      
      const crossBaseDuplicates = Array.from(productBaseSteps.entries())
        .filter(([, bases]) => bases.size > 1)
        .map(([productId]) => productId);

      if (crossBaseDuplicates.length > 0) {
        warnings.push(`Day ${dayIndex + 1}: duplicate products across different steps: ${crossBaseDuplicates.join(', ')}`);
      }
    });
    
    // 3. Проверка максимального количества продуктов на шаг (не более 1 основного + 3 альтернативы)
    plan.days.forEach((day, dayIndex) => {
      [...day.morning, ...day.evening, ...day.weekly].forEach(step => {
        if (step.alternatives.length > 3) {
          warnings.push(`Day ${dayIndex + 1}, step ${step.stepCategory}: too many alternatives (${step.alternatives.length}, max 3)`);
        }
      });
    });
    
    // 4. Проверка, что план не пустой
    if (plan.days.length === 0) {
      warnings.push('Plan has no days');
    }
    
    // 5. Проверка, что каждый день имеет хотя бы один шаг
    plan.days.forEach((day, dayIndex) => {
      const totalSteps = day.morning.length + day.evening.length + day.weekly.length;
      if (totalSteps === 0) {
        warnings.push(`Day ${dayIndex + 1}: no steps in routine`);
      }
    });
    
    const isValid = warnings.length === 0;
    
    if (!isValid) {
      logger.warn('Plan invariants validation failed', {
        userId,
        profileId: profile.id,
        warnings,
        planDaysCount: plan.days.length,
        allStepCategories: Array.from(allStepCategories),
        allBaseSteps: Array.from(allBaseSteps),
      });
    } else {
      logger.info('Plan invariants validation passed', {
        userId,
        profileId: profile.id,
        planDaysCount: plan.days.length,
        totalSteps: plan.days.reduce((sum, d) => sum + d.morning.length + d.evening.length + d.weekly.length, 0),
      });
    }
    
    return { isValid, warnings };
  };
  
  // ИСПРАВЛЕНО: assertPlanInvariants теперь async, используем await
  // ИСПРАВЛЕНО: устраняем дубли продуктов в рамках одного дня МЕЖДУ разными базовыми шагами.
  // В прод-логах видно массовое нарушение инварианта: "Day N: duplicate products: 577, 479, 577"
  // Это признак того, что один и тот же продукт используется в разных stepCategory (например, toner/moisturizer),
  // что неверно. При этом повтор одного и того же продукта утром и вечером в рамках ОДНОГО базового шага
  // (например, cleanser) допустим и не должен принудительно "разводиться" разными продуктами.
  const fixDuplicateProductsInDay = (day: any, dayIndex: number) => {
    const productToBaseStep = new Map<number, string>();
    const parseId = (v: any): number | null => {
      if (v === null || v === undefined) return null;
      const n = typeof v === 'number' ? v : Number(String(v));
      return Number.isFinite(n) ? n : null;
    };
    const getStepBase = (step: any): string | null => {
      const stepCategory = step?.stepCategory as any;
      if (!stepCategory) return null;
      try {
        return getBaseStepFromStepCategory(stepCategory);
      } catch {
        return null;
      }
    };
    const findReplacementFromAlternatives = (step: any): number | null => {
      const base = getStepBase(step);
      const alts = Array.isArray(step?.alternatives) ? step.alternatives : [];
      for (const alt of alts) {
        const altId = parseId(alt?.productId ?? alt?.id);
        if (!altId) continue;
        const existingBase = productToBaseStep.get(altId);
        if (!existingBase || (base && existingBase === base)) {
          return altId;
        }
      }
      return null;
    };
    const findReplacementFromSelectedProducts = (step: any): number | null => {
      // Пытаемся найти продукт того же базового шага, но не использованный в этом дне
      const stepCategory = step?.stepCategory as any;
      const base = stepCategory ? getBaseStepFromStepCategory(stepCategory) : null;
      if (!base) return null;
      for (const p of selectedProducts) {
        if (!p?.id) continue;
        const existingBase = productToBaseStep.get(p.id);
        if (existingBase && existingBase !== base) continue;
        const pStep = String((p as any).step || '').toLowerCase();
        if (pStep === base || pStep.startsWith(base)) {
          return p.id;
        }
      }
      return null;
    };
    const processStep = (step: any, slot: 'morning' | 'evening' | 'weekly') => {
      const currentId = parseId(step?.productId);
      if (!currentId) return;
      const base = getStepBase(step) || 'unknown';
      const existingBase = productToBaseStep.get(currentId);
      if (!existingBase) {
        productToBaseStep.set(currentId, base);
        return;
      }
      // Повтор того же продукта в рамках одного базового шага допустим (например cleanser утром+вечером)
      if (existingBase === base) {
        return;
      }

      // Дубликат — пробуем заменить
      let replacementId = findReplacementFromAlternatives(step);
      if (!replacementId) {
        replacementId = findReplacementFromSelectedProducts(step);
      }

      if (replacementId) {
        const old = currentId;
        step.productId = String(replacementId);
        productToBaseStep.set(replacementId, base);
        warnings.push(`Day ${dayIndex + 1}: duplicate product replaced in ${slot}/${step.stepCategory} (${old} → ${replacementId})`);
      } else {
        // Последний fallback: убираем productId, чтобы не повторять один и тот же продукт
        step.productId = null;
        warnings.push(`Day ${dayIndex + 1}: duplicate product removed in ${slot}/${step.stepCategory} (${currentId})`);
      }
    };

    for (const step of Array.isArray(day?.morning) ? day.morning : []) processStep(step, 'morning');
    for (const step of Array.isArray(day?.evening) ? day.evening : []) processStep(step, 'evening');
    for (const step of Array.isArray(day?.weekly) ? day.weekly : []) processStep(step, 'weekly');
  };

  plan28.days.forEach((day: any, idx: number) => fixDuplicateProductsInDay(day, idx));

  const invariantsCheck = await assertPlanInvariants(plan28);
  if (!invariantsCheck.isValid) {
    logger.warn('Plan generated with invariant violations, but continuing', {
      userId,
      warnings: invariantsCheck.warnings,
      note: 'Plan will be returned with violations - UI should handle gracefully',
    });
    // Добавляем инвариантные предупреждения в общий массив, чтобы они попали в API-ответ
    warnings.push(...invariantsCheck.warnings);
  }

  // ИСПРАВЛЕНО: Валидация плана на совместимость ингредиентов и протоколы
  // ИСПРАВЛЕНО (P0): Валидация плана как жёсткий гейт
  const { validatePlan, markIncompatibleDaysAsRecovery } = await import('./plan-validation');
  const validationResult = await validatePlan(plan28, selectedProducts, {
    ingredientCompatibility: true,
    dermatologyProtocols: true,
    strictMode: mode === 'strict', // ИСПРАВЛЕНО: В strict режиме ошибки блокируют план
  });
  
  // ИСПРАВЛЕНО (P0): Если severity === 'error' - план невалиден, выбрасываем ошибку
  if (validationResult.severity === 'error') {
    logger.error('CRITICAL: Plan validation failed with errors', {
      userId,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      daysCount: plan28.days.length,
    });
    throw new Error(`Plan validation failed: ${validationResult.errors.join(', ')}`);
  }
  
  // ИСПРАВЛЕНО: Логируем предупреждения, но не блокируем план
  if (validationResult.warnings.length > 0) {
    logger.warn('Plan validation warnings', {
      userId,
      warnings: validationResult.warnings,
      severity: validationResult.severity,
    });
  }

  if (validationResult.warnings.length > 0 || validationResult.errors.length > 0) {
    logger.warn('Plan validation found issues', {
      userId,
      warnings: validationResult.warnings,
      errors: validationResult.errors,
      incompatibleDays: validationResult.incompatibleDays,
    });

    // Автоматически помечаем несовместимые дни как recovery
    if (validationResult.incompatibleDays.length > 0) {
      plan28 = markIncompatibleDaysAsRecovery(plan28, validationResult.incompatibleDays);
    }
  }

  // Мониторинг: финальный лог успешной генерации (для подсчёта default_balanced и аналитики)
  logger.info('plan_gen_complete', {
    templateId: planGenMetrics.templateId,
    usedDefaultBalanced: planGenMetrics.usedDefaultBalanced,
    daysCount: plan28.days.length,
    productsCount: formattedProducts.length,
    userId,
  });

  return {
    profile: {
      skinType: (profile.skinType || 'normal') as SkinProfile["skinType"], // ИСПРАВЛЕНО: Приводим к типу
      sensitivityLevel: (profile.sensitivityLevel || 'low') as SkinProfile["sensitivity"] | null,
      acneLevel: profile.acneLevel || null,
      primaryFocus: primaryFocus as GoalKey, // ИСПРАВЛЕНО: Приводим к типу GoalKey
      // Синхронизируем с /analysis: используем те же ключевые проблемы (критичные и плохие)
      concerns: (keyProblems.length > 0 ? keyProblems : concerns.slice(0, 3)) as GoalKey[], // ИСПРАВЛЕНО: Приводим к типу GoalKey[]
      ageGroup: (profile.ageGroup || '25-34') as SkinProfile["ageGroup"] | null,
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
    products: formattedProducts.map(p => ({
      ...p,
      category: (p.category || 'unknown') as StepCategory, // ИСПРАВЛЕНО: Приводим к StepCategory
      price: typeof p.price === 'number' ? p.price : 0, // ИСПРАВЛЕНО: price должен быть number
    })),
    warnings: warnings.length > 0 ? warnings : undefined,
    // Новый формат плана Plan28
    plan28,
    // ИСПРАВЛЕНО (P0): Обязательное поле версии формата
    formatVersion: 'v2' as const,
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
