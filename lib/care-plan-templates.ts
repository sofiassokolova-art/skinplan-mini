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

// ИСПРАВЛЕНО: Добавлены union-типы для безопасности типизации
export type RiskLevel = 'none' | 'low' | 'medium' | 'high';
export type AgeGroup = '18_25' | '26_30' | '31_40' | '41_50' | '50_plus';

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
    rosaceaRisks?: RiskLevel[]; // ИСПРАВЛЕНО: Используем union-тип
    pigmentationRisks?: RiskLevel[]; // ИСПРАВЛЕНО: Используем union-тип
    ageGroups?: AgeGroup[]; // ИСПРАВЛЕНО: Используем union-тип
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
  rosaceaRisk?: RiskLevel | null; // ИСПРАВЛЕНО: Используем union-тип
  pigmentationRisk?: RiskLevel | null; // ИСПРАВЛЕНО: Используем union-тип
  ageGroup?: AgeGroup | null; // ИСПРАВЛЕНО: Используем union-тип
};

export const CARE_PLAN_TEMPLATES: CarePlanTemplate[] = [
  {
    id: 'acne_oily_basic',
    conditions: {
      skinTypes: ['oily', 'combination_oily'],
      mainGoals: ['acne'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_balancing', 'toner_hydrating', 'serum_niacinamide', 'moisturizer_balancing', 'spf_50_oily'],
    evening: ['cleanser_balancing', 'toner_soothing', 'treatment_acne_azelaic', 'moisturizer_balancing'],
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
    morning: ['cleanser_gentle', 'toner_hydrating', 'serum_hydrating', 'moisturizer_barrier', 'spf_50_sensitive'],
    evening: ['cleanser_gentle', 'toner_soothing', 'moisturizer_barrier'],
    weekly: ['mask_soothing'],
  },
  {
    id: 'pigmentation_focus',
    conditions: {
      mainGoals: ['pigmentation'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'toner_hydrating', 'serum_vitc', 'spf_50_face'],
    evening: ['cleanser_gentle', 'toner_soothing', 'treatment_pigmentation', 'moisturizer_light'],
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
    morning: ['cleanser_gentle', 'toner_hydrating', 'serum_hydrating', 'moisturizer_light', 'spf_50_face'],
    evening: ['cleanser_gentle', 'toner_hydrating', 'treatment_antiage', 'moisturizer_light'], // treatment_antiage будет заменено на подходящее лечение в зависимости от mainGoals
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
    morning: ['cleanser_balancing', 'toner_hydrating', 'serum_niacinamide', 'treatment_acne_bpo', 'moisturizer_balancing', 'spf_50_oily'],
    evening: ['cleanser_balancing', 'toner_soothing', 'treatment_acne_azelaic', 'moisturizer_balancing'],
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
    morning: ['cleanser_balancing', 'toner_hydrating', 'serum_niacinamide', 'moisturizer_balancing', 'spf_50_oily'],
    evening: ['cleanser_balancing', 'toner_soothing', 'treatment_acne_azelaic', 'moisturizer_balancing'],
    weekly: ['mask_clay'],
  },
  {
    id: 'dehydration_severe',
    conditions: {
      dehydrationLevels: [3, 4, 5], // Высокий уровень обезвоженности
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'toner_hydrating', 'serum_hydrating', 'moisturizer_barrier', 'spf_50_face'],
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
    morning: ['cleanser_gentle', 'toner_soothing', 'serum_anti_redness', 'moisturizer_barrier', 'spf_50_sensitive'],
    evening: ['cleanser_gentle', 'toner_soothing', 'serum_anti_redness', 'moisturizer_barrier'],
    weekly: ['mask_soothing'],
  },
  {
    id: 'pigmentation_high_risk',
    conditions: {
      pigmentationRisks: ['medium', 'high'],
      mainGoals: ['pigmentation'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'toner_hydrating', 'serum_vitc', 'serum_niacinamide', 'spf_50_face'],
    evening: ['cleanser_gentle', 'toner_soothing', 'treatment_pigmentation', 'moisturizer_light'],
    weekly: ['mask_hydrating', 'treatment_exfoliant_mild'],
  },
  {
    id: 'antiage_mature',
    conditions: {
      ageGroups: ['41_50', '50_plus'],
      mainGoals: ['antiage'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'toner_hydrating', 'serum_vitc', 'serum_antiage', 'moisturizer_barrier', 'spf_50_face'],
    evening: ['cleanser_gentle', 'toner_soothing', 'treatment_antiage', 'treatment_exfoliant_mild', 'moisturizer_barrier'],
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
    morning: ['cleanser_balancing', 'toner_hydrating', 'serum_niacinamide', 'moisturizer_balancing', 'spf_50_oily'],
    evening: ['cleanser_balancing', 'toner_soothing', 'treatment_acne_azelaic', 'moisturizer_balancing'],
    weekly: ['mask_clay'],
  },
  {
    id: 'combination_dry_dehydration',
    conditions: {
      skinTypes: ['combination_dry'],
      dehydrationLevels: [2, 3, 4, 5],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'toner_hydrating', 'serum_hydrating', 'moisturizer_barrier', 'spf_50_face'],
    evening: ['cleanser_gentle', 'toner_soothing', 'moisturizer_barrier'],
    weekly: ['mask_hydrating'],
  },
  // ДОБАВЛЕНО: Частые комбинации для лучшего покрытия
  {
    id: 'acne_normal',
    conditions: {
      skinTypes: ['normal'],
      mainGoals: ['acne'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'toner_hydrating', 'serum_niacinamide', 'moisturizer_light', 'spf_50_face'],
    evening: ['cleanser_gentle', 'toner_soothing', 'treatment_acne_azelaic', 'moisturizer_light'],
    weekly: ['mask_clay'],
  },
  {
    id: 'antiage_oily',
    conditions: {
      skinTypes: ['oily', 'combination_oily'],
      mainGoals: ['antiage', 'wrinkles'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_balancing', 'toner_hydrating', 'serum_vitc', 'serum_niacinamide', 'moisturizer_balancing', 'spf_50_oily'],
    evening: ['cleanser_balancing', 'toner_soothing', 'treatment_antiage', 'moisturizer_balancing'],
    weekly: ['mask_hydrating'],
  },
  {
    id: 'pigmentation_dry',
    conditions: {
      skinTypes: ['dry', 'combination_dry'],
      mainGoals: ['pigmentation'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'toner_hydrating', 'serum_vitc', 'moisturizer_barrier', 'spf_50_face'],
    evening: ['cleanser_gentle', 'toner_soothing', 'treatment_pigmentation', 'moisturizer_barrier'],
    weekly: ['mask_hydrating', 'mask_soothing'],
  },
  {
    id: 'acne_combination_dry',
    conditions: {
      skinTypes: ['combination_dry'],
      mainGoals: ['acne'],
      routineComplexity: ['medium', 'maximal'],
    },
    morning: ['cleanser_gentle', 'toner_hydrating', 'serum_niacinamide', 'moisturizer_light', 'spf_50_face'],
    evening: ['cleanser_gentle', 'toner_soothing', 'treatment_acne_azelaic', 'moisturizer_light'],
    weekly: ['mask_hydrating'],
  },
];

export function selectCarePlanTemplate(
  profile: CarePlanProfileInput
): CarePlanTemplate {
  const { skinType, mainGoals, sensitivityLevel, routineComplexity, acneLevel, dehydrationLevel, rosaceaRisk, pigmentationRisk, ageGroup } = profile;

  // ИСПРАВЛЕНО: Обработка 'general' в mainGoals - не блокируем подбор шаблонов
  // Если mainGoals содержит только 'general', считаем это нейтральным и не фильтруем по mainGoals
  const effectiveMainGoals = mainGoals.filter((g): g is Exclude<GoalKey, 'general'> => g !== 'general');
  const hasOnlyGeneral = mainGoals.length > 0 && effectiveMainGoals.length === 0;

  // ИСПРАВЛЕНО: Используем matchesTemplate как первый фильтр для базовых условий
  const matchesTemplate = (tpl: CarePlanTemplate): boolean => {
    const cond = tpl.conditions;

    if (cond.skinTypes && cond.skinTypes.length > 0) {
      if (!skinType) return false;
      if (!cond.skinTypes.includes(skinType)) return false;
    }

    // ИСПРАВЛЕНО: Если mainGoals содержит только 'general', не фильтруем по mainGoals
    if (cond.mainGoals && cond.mainGoals.length > 0 && !hasOnlyGeneral) {
      // Фильтруем 'general' из cond.mainGoals для сравнения
      const templateGoals = cond.mainGoals.filter((g): g is Exclude<GoalKey, 'general'> => g !== 'general');
      if (templateGoals.length > 0) {
        const hasAnyGoal = templateGoals.some((g) => effectiveMainGoals.includes(g));
        if (!hasAnyGoal) return false;
      }
    }

    if (cond.sensitivityLevels && cond.sensitivityLevels.length > 0) {
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

  // ИСПРАВЛЕНО: Используем matchesTemplate как первый фильтр, затем scoring как tie-breaker
  // Сначала фильтруем шаблоны по базовым условиям
  const matchingTemplates = CARE_PLAN_TEMPLATES.filter(matchesTemplate);

  if (matchingTemplates.length === 0) {
    // Если ничего не подошло, возвращаем дефолтный шаблон
    return CARE_PLAN_TEMPLATES.find((tpl) => tpl.id === 'default_balanced')!;
  }

  if (matchingTemplates.length === 1) {
    // Если подошел только один шаблон, возвращаем его
    return matchingTemplates[0];
  }

  // ИСПРАВЛЕНО: Система скоринга только для бонусов (без штрафов)
  // Используем scoring как tie-breaker между подходящими шаблонами
  const scoreTemplate = (tpl: CarePlanTemplate): number => {
    let score = 0;
    const cond = tpl.conditions;

    // Базовые условия дают базовый балл
    if (cond.skinTypes && cond.skinTypes.length > 0 && skinType) {
      score += 10;
    }

    if (cond.mainGoals && cond.mainGoals.length > 0 && !hasOnlyGeneral) {
      // Фильтруем 'general' из cond.mainGoals для сравнения
      const templateGoals = cond.mainGoals.filter((g): g is Exclude<GoalKey, 'general'> => g !== 'general');
      if (templateGoals.length > 0) {
        const hasAnyGoal = templateGoals.some((g) => effectiveMainGoals.includes(g));
        if (hasAnyGoal) score += 10;
      }
    }

    if (cond.sensitivityLevels && cond.sensitivityLevels.length > 0 && sensitivityLevel) {
      score += 8;
    }

    if (cond.routineComplexity && cond.routineComplexity.length > 0) {
      score += 5;
    }

    // ИСПРАВЛЕНО: Только бонусы за совпадение дополнительных факторов, без штрафов
    if (cond.acneLevels && cond.acneLevels.length > 0) {
      if (acneLevel !== null && acneLevel !== undefined && cond.acneLevels.includes(acneLevel)) {
        score += 15; // Высокий бонус за специфичное совпадение
      }
    }

    if (cond.dehydrationLevels && cond.dehydrationLevels.length > 0) {
      if (dehydrationLevel !== null && dehydrationLevel !== undefined && cond.dehydrationLevels.includes(dehydrationLevel)) {
        score += 12;
      }
    }

    if (cond.rosaceaRisks && cond.rosaceaRisks.length > 0) {
      if (rosaceaRisk && cond.rosaceaRisks.includes(rosaceaRisk)) {
        score += 10;
      }
    }

    if (cond.pigmentationRisks && cond.pigmentationRisks.length > 0) {
      if (pigmentationRisk && cond.pigmentationRisks.includes(pigmentationRisk)) {
        score += 10;
      }
    }

    if (cond.ageGroups && cond.ageGroups.length > 0) {
      if (ageGroup && cond.ageGroups.includes(ageGroup)) {
        score += 8;
      }
    }

    return score;
  };

  // Сортируем подходящие шаблоны по релевантности
  const scoredTemplates = matchingTemplates.map(tpl => ({
    template: tpl,
    score: scoreTemplate(tpl),
  })).sort((a, b) => b.score - a.score); // Сортируем по убыванию релевантности

  // Выбираем наиболее релевантный шаблон
  return scoredTemplates[0].template;
}


