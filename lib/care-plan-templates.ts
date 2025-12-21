// lib/care-plan-templates.ts
// Слой Care Plan Template: структурированные шаблоны ухода (утро/вечер/неделя)
//
// Шаблоны опираются на:
// - skinType (из SkinProfile)
// - mainGoals (основные цели: acne, pigmentation, barrier, antiage и т.п.)
// - sensitivity (уровень чувствительности)
// - routineComplexity (минимум / средний / максимум)

import type { StepCategory } from './step-category-rules';
import type { GoalKey } from './concern-taxonomy';
import type { SkinProfile } from './skinprofile-types';

export type RoutineComplexity = 'minimal' | 'medium' | 'maximal';

export type CarePlanTemplate = {
  id: string;
  conditions: {
    skinTypes?: Array<NonNullable<SkinProfile["skinType"]>>;
    mainGoals?: GoalKey[]; // ИСПРАВЛЕНО: Используем GoalKey вместо string[]
    sensitivityLevels?: Array<NonNullable<SkinProfile["sensitivity"]>>;
    routineComplexity?: RoutineComplexity[];
    // ДОБАВЛЕНО: Дополнительные факторы для персонализации
    acneLevels?: number[]; // [0, 1, 2, 3, 4, 5] - уровни акне
    dehydrationLevels?: number[]; // [0, 1, 2, 3, 4, 5] - уровни обезвоженности
    rosaceaRisks?: string[]; // ['none', 'low', 'medium', 'high']
    pigmentationRisks?: string[]; // ['none', 'low', 'medium', 'high']
    ageGroups?: string[]; // ['18_25', '26_30', '31_40', '41_50', '50_plus']
  };
  morning: StepCategory[];
  evening: StepCategory[];
  weekly?: StepCategory[];
};

export type CarePlanProfileInput = {
  skinType: SkinProfile["skinType"]; // ИСПРАВЛЕНО: Используем union тип
  mainGoals: GoalKey[]; // ИСПРАВЛЕНО: Используем GoalKey вместо string[]
  sensitivityLevel: SkinProfile["sensitivity"]; // ИСПРАВЛЕНО: Используем union тип
  routineComplexity: RoutineComplexity;
  // ДОБАВЛЕНО: Дополнительные факторы для персонализации
  acneLevel?: number | null;
  dehydrationLevel?: number | null;
  rosaceaRisk?: string | null;
  pigmentationRisk?: string | null;
  ageGroup?: string | null;
};

export const CARE_PLAN_TEMPLATES: CarePlanTemplate[] = [
  {
    id: 'acne_oily_basic',
    conditions: {
      skinTypes: ['oily', 'combination_oily'],
      mainGoals: ['acne'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_balancing', 'serum_niacinamide', 'moisturizer_balancing', 'spf_50_oily'],
    evening: ['cleanser_balancing', 'treatment_acne_azelaic', 'moisturizer_balancing'],
    weekly: ['mask_clay'],
  },
  {
    id: 'dry_sensitive_barrier',
    conditions: {
      skinTypes: ['dry', 'combination_dry', 'normal'],
      mainGoals: ['barrier', 'dehydration'],
      sensitivityLevels: ['medium', 'high', 'very_high'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'serum_hydrating', 'moisturizer_barrier', 'spf_50_sensitive'],
    evening: ['cleanser_gentle', 'moisturizer_barrier'],
    weekly: ['mask_soothing'],
  },
  {
    id: 'pigmentation_focus',
    conditions: {
      mainGoals: ['pigmentation'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'serum_vitc', 'spf_50_face'],
    evening: ['cleanser_gentle', 'treatment_pigmentation', 'moisturizer_light'],
    weekly: ['mask_hydrating'],
  },
  {
    id: 'minimalist_any_skin',
    conditions: {
      routineComplexity: ['minimal'],
    },
    morning: ['cleanser_gentle', 'spf_50_face'],
    evening: ['cleanser_gentle', 'moisturizer_light'],
  },
  {
    id: 'default_balanced',
    conditions: {},
    morning: ['cleanser_gentle', 'serum_hydrating', 'moisturizer_light', 'spf_50_face'],
    evening: ['cleanser_gentle', 'treatment_antiage', 'moisturizer_light'], // treatment_antiage будет заменено на подходящее лечение в зависимости от mainGoals
  },
  // ДОБАВЛЕНО: Новые шаблоны с учетом дополнительных факторов
  {
    id: 'acne_severe_oily',
    conditions: {
      skinTypes: ['oily', 'combination_oily'],
      mainGoals: ['acne'],
      acneLevels: [3, 4, 5], // Средний и высокий уровень акне
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_balancing', 'serum_niacinamide', 'treatment_acne_bpo', 'moisturizer_balancing', 'spf_50_oily'],
    evening: ['cleanser_balancing', 'treatment_acne_azelaic', 'treatment_exfoliant_strong', 'moisturizer_balancing'],
    weekly: ['mask_clay', 'treatment_exfoliant_strong'],
  },
  {
    id: 'acne_mild_oily',
    conditions: {
      skinTypes: ['oily', 'combination_oily'],
      mainGoals: ['acne'],
      acneLevels: [1, 2], // Низкий уровень акне
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_balancing', 'serum_niacinamide', 'moisturizer_balancing', 'spf_50_oily'],
    evening: ['cleanser_balancing', 'treatment_acne_azelaic', 'moisturizer_balancing'],
    weekly: ['mask_clay'],
  },
  {
    id: 'dehydration_severe',
    conditions: {
      dehydrationLevels: [3, 4, 5], // Высокий уровень обезвоженности
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'serum_hydrating', 'serum_hydrating', 'moisturizer_barrier', 'spf_50_face'],
    evening: ['cleanser_gentle', 'serum_hydrating', 'moisturizer_barrier', 'balm_barrier_repair'],
    weekly: ['mask_hydrating', 'mask_soothing'],
  },
  {
    id: 'rosacea_sensitive',
    conditions: {
      rosaceaRisks: ['medium', 'high'],
      sensitivityLevels: ['medium', 'high', 'very_high'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'serum_anti_redness', 'moisturizer_barrier', 'spf_50_sensitive'],
    evening: ['cleanser_gentle', 'serum_anti_redness', 'moisturizer_barrier'],
    weekly: ['mask_soothing'],
  },
  {
    id: 'pigmentation_high_risk',
    conditions: {
      pigmentationRisks: ['medium', 'high'],
      mainGoals: ['pigmentation'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'serum_vitc', 'serum_niacinamide', 'spf_50_face'],
    evening: ['cleanser_gentle', 'treatment_pigmentation', 'treatment_exfoliant_mild', 'moisturizer_light'],
    weekly: ['mask_hydrating', 'treatment_exfoliant_mild'],
  },
  {
    id: 'antiage_mature',
    conditions: {
      ageGroups: ['41_50', '50_plus'],
      mainGoals: ['antiage'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'serum_vitc', 'serum_antiage', 'moisturizer_barrier', 'spf_50_face'],
    evening: ['cleanser_gentle', 'treatment_antiage', 'treatment_exfoliant_mild', 'moisturizer_barrier'],
    weekly: ['mask_hydrating', 'mask_sleeping'],
  },
  {
    id: 'combination_oily_acne',
    conditions: {
      skinTypes: ['combination_oily'],
      mainGoals: ['acne'],
      acneLevels: [2, 3, 4],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_balancing', 'serum_niacinamide', 'moisturizer_balancing', 'spf_50_oily'],
    evening: ['cleanser_balancing', 'treatment_acne_azelaic', 'moisturizer_balancing'],
    weekly: ['mask_clay'],
  },
  {
    id: 'combination_dry_dehydration',
    conditions: {
      skinTypes: ['combination_dry'],
      dehydrationLevels: [2, 3, 4, 5],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'serum_hydrating', 'moisturizer_barrier', 'spf_50_face'],
    evening: ['cleanser_gentle', 'moisturizer_barrier'],
    weekly: ['mask_hydrating'],
  },
];

export function selectCarePlanTemplate(
  profile: CarePlanProfileInput
): CarePlanTemplate {
  const { skinType, mainGoals, sensitivityLevel, routineComplexity, acneLevel, dehydrationLevel, rosaceaRisk, pigmentationRisk, ageGroup } = profile;

  // ИСПРАВЛЕНО: Нормализуем тип кожи для сравнения с шаблонами
  // Шаблоны могут использовать "combo", "combination_dry", "combination_oily"
  // Нужно проверить все варианты
  const normalizeForTemplateMatch = (dbSkinType: NonNullable<SkinProfile["skinType"]>): string[] => {
    if (dbSkinType === 'combination_dry' || dbSkinType === 'combination_oily') {
      return [dbSkinType];
    }
    return [dbSkinType];
  };

  const matchesTemplate = (tpl: CarePlanTemplate): boolean => {
    const cond = tpl.conditions;

    if (cond.skinTypes && cond.skinTypes.length > 0) {
      // ИСПРАВЛЕНО: Проверяем все нормализованные варианты типа кожи
      if (!skinType) return false; // Если тип кожи не указан, не подходит
      const normalizedVariants = normalizeForTemplateMatch(skinType);
      const hasMatch = normalizedVariants.some(variant => cond.skinTypes!.includes(variant as NonNullable<SkinProfile["skinType"]>));
      if (!hasMatch) return false;
    }

    if (cond.mainGoals && cond.mainGoals.length > 0) {
      const hasAnyGoal = cond.mainGoals.some((g) => mainGoals.includes(g));
      if (!hasAnyGoal) return false;
    }

    if (cond.sensitivityLevels && cond.sensitivityLevels.length > 0) {
      // ИСПРАВЛЕНО: Проверяем соответствие уровня чувствительности
      // В БД может быть "high", но в шаблонах может быть "very_high"
      // Если в шаблоне есть "very_high", а в БД "high", это не совпадает
      // Но если в шаблоне есть "high", а в БД "high", это совпадает
      if (!sensitivityLevel || !cond.sensitivityLevels.includes(sensitivityLevel)) return false;
    }

    if (cond.routineComplexity && cond.routineComplexity.length > 0) {
      if (!cond.routineComplexity.includes(routineComplexity)) return false;
    }

    // ДОБАВЛЕНО: Проверка уровня акне
    if (cond.acneLevels && cond.acneLevels.length > 0) {
      if (acneLevel === null || acneLevel === undefined || !cond.acneLevels.includes(acneLevel)) return false;
    }

    // ДОБАВЛЕНО: Проверка уровня обезвоженности
    if (cond.dehydrationLevels && cond.dehydrationLevels.length > 0) {
      if (dehydrationLevel === null || dehydrationLevel === undefined || !cond.dehydrationLevels.includes(dehydrationLevel)) return false;
    }

    // ДОБАВЛЕНО: Проверка риска розацеа
    if (cond.rosaceaRisks && cond.rosaceaRisks.length > 0) {
      if (!rosaceaRisk || !cond.rosaceaRisks.includes(rosaceaRisk)) return false;
    }

    // ДОБАВЛЕНО: Проверка риска пигментации
    if (cond.pigmentationRisks && cond.pigmentationRisks.length > 0) {
      if (!pigmentationRisk || !cond.pigmentationRisks.includes(pigmentationRisk)) return false;
    }

    // ДОБАВЛЕНО: Проверка возрастной группы
    if (cond.ageGroups && cond.ageGroups.length > 0) {
      if (!ageGroup || !cond.ageGroups.includes(ageGroup)) return false;
    }

    return true;
  };

  // ДОБАВЛЕНО: Система скоринга для выбора наиболее подходящего шаблона
  // Вместо простого поиска первого совпадения, оцениваем все шаблоны по релевантности
  const scoreTemplate = (tpl: CarePlanTemplate): number => {
    let score = 0;
    const cond = tpl.conditions;

    // Базовые условия (обязательные для совпадения)
    if (cond.skinTypes && cond.skinTypes.length > 0) {
      if (!skinType) return -1;
      const normalizedVariants = normalizeForTemplateMatch(skinType);
      if (!normalizedVariants.some(variant => cond.skinTypes!.includes(variant as NonNullable<SkinProfile["skinType"]>))) {
        return -1; // Не подходит
      }
      score += 10; // Высокий приоритет
    }

    if (cond.mainGoals && cond.mainGoals.length > 0) {
      const hasAnyGoal = cond.mainGoals.some((g) => mainGoals.includes(g));
      if (!hasAnyGoal) return -1; // Не подходит
      score += 10;
    }

    if (cond.sensitivityLevels && cond.sensitivityLevels.length > 0) {
      if (!sensitivityLevel || !cond.sensitivityLevels.includes(sensitivityLevel)) return -1;
      score += 8;
    }

    if (cond.routineComplexity && cond.routineComplexity.length > 0) {
      if (!cond.routineComplexity.includes(routineComplexity)) return -1;
      score += 5;
    }

    // ДОБАВЛЕНО: Дополнительные факторы увеличивают релевантность
    if (cond.acneLevels && cond.acneLevels.length > 0) {
      if (acneLevel !== null && acneLevel !== undefined && cond.acneLevels.includes(acneLevel)) {
        score += 15; // Высокий приоритет для специфичных условий
      }
    } else if (acneLevel !== null && acneLevel !== undefined && acneLevel >= 3) {
      // Если шаблон не учитывает акне, но у пользователя высокий уровень - снижаем приоритет
      score -= 5;
    }

    if (cond.dehydrationLevels && cond.dehydrationLevels.length > 0) {
      if (dehydrationLevel !== null && dehydrationLevel !== undefined && cond.dehydrationLevels.includes(dehydrationLevel)) {
        score += 12;
      }
    } else if (dehydrationLevel !== null && dehydrationLevel !== undefined && dehydrationLevel >= 3) {
      score -= 5;
    }

    if (cond.rosaceaRisks && cond.rosaceaRisks.length > 0) {
      if (rosaceaRisk && cond.rosaceaRisks.includes(rosaceaRisk)) {
        score += 10;
      }
    } else if (rosaceaRisk && (rosaceaRisk === 'medium' || rosaceaRisk === 'high')) {
      score -= 3;
    }

    if (cond.pigmentationRisks && cond.pigmentationRisks.length > 0) {
      if (pigmentationRisk && cond.pigmentationRisks.includes(pigmentationRisk)) {
        score += 10;
      }
    } else if (pigmentationRisk && (pigmentationRisk === 'medium' || pigmentationRisk === 'high')) {
      score -= 3;
    }

    if (cond.ageGroups && cond.ageGroups.length > 0) {
      if (ageGroup && cond.ageGroups.includes(ageGroup)) {
        score += 8;
      }
    }

    return score;
  };

  // Сортируем шаблоны по релевантности
  const scoredTemplates = CARE_PLAN_TEMPLATES.map(tpl => ({
    template: tpl,
    score: scoreTemplate(tpl),
  })).filter(item => item.score >= 0) // Убираем неподходящие
    .sort((a, b) => b.score - a.score); // Сортируем по убыванию релевантности

  // Выбираем наиболее релевантный шаблон
  const matched = scoredTemplates.length > 0 
    ? scoredTemplates[0].template 
    : CARE_PLAN_TEMPLATES.find((tpl) => tpl.id === 'default_balanced')!;

  return matched;
}


