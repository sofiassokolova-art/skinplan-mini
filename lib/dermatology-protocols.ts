// lib/dermatology-protocols.ts
// Дерматологические протоколы для различных состояний кожи

import type { StepCategory } from './step-category-rules';
import type { ActiveIngredient } from './ingredient-compatibility';

export type SkinCondition = 'acne' | 'rosacea' | 'atopic_dermatitis' | 'pigmentation' | 'normal';

export interface DermatologyProtocol {
  condition: SkinCondition;
  name: string;
  description: string;
  allowedIngredients: ActiveIngredient[];
  forbiddenIngredients: ActiveIngredient[];
  allowedSteps: StepCategory[];
  forbiddenSteps: StepCategory[];
  routineTemplate: {
    morning: StepCategory[];
    evening: StepCategory[];
    weekly?: StepCategory[];
  };
  titrationSchedule?: {
    ingredient: ActiveIngredient;
    week1: number; // количество применений в неделю
    week2: number;
    week3: number;
    week4: number;
  }[];
  cyclingRules?: {
    ingredient: ActiveIngredient;
    frequency: 'daily' | 'every_other_day' | '2x_week' | '1x_week';
    days?: number[]; // конкретные дни недели (1-7)
  }[];
  warnings: string[];
}

export const DERMATOLOGY_PROTOCOLS: Record<SkinCondition, DermatologyProtocol> = {
  acne: {
    condition: 'acne',
    name: 'Протокол для акне',
    description: 'Специализированный уход для проблемной кожи с акне',
    allowedIngredients: ['bha', 'azelaic_acid', 'adapalene', 'niacinamide', 'benzoyl_peroxide'],
    forbiddenIngredients: ['aha', 'retinol', 'vitamin_c'], // кроме адапалена
    allowedSteps: [
      'cleanser_balancing',
      'cleanser_deep',
      'toner_soothing',
      'serum_niacinamide',
      'serum_anti_redness',
      'treatment_exfoliant_mild',
      'treatment_exfoliant_strong',
      'treatment_acne_azelaic',
      'moisturizer_light',
      'moisturizer_balancing',
      'spf_50_face',
    ],
    forbiddenSteps: [
      'cleanser_gentle', // слишком мягкий для акне
      'serum_vitc',
      'treatment_antiage',
    ],
    routineTemplate: {
      morning: ['cleanser_balancing', 'serum_niacinamide', 'moisturizer_light', 'spf_50_face'],
      evening: ['cleanser_deep', 'treatment_exfoliant_mild', 'treatment_acne_azelaic', 'moisturizer_balancing'],
    },
    titrationSchedule: [
      {
        ingredient: 'adapalene',
        week1: 1, // 1 раз в неделю
        week2: 2, // 2 раза в неделю
        week3: 3, // через день
        week4: 4, // почти ежедневно
      },
      {
        ingredient: 'bha',
        week1: 2,
        week2: 3,
        week3: 4,
        week4: 5,
      },
    ],
    cyclingRules: [
      {
        ingredient: 'bha',
        frequency: '2x_week',
        days: [2, 5], // вторник и пятница
      },
      {
        ingredient: 'azelaic_acid',
        frequency: 'daily',
      },
    ],
    warnings: [
      'Исключите комедогенные кремы',
      'Избегайте комбинации бензоил пероксид + ретинол вечером (кроме адапалена 0.1-0.3%)',
      'Возможна сухость в первые 7-14 дней',
      'Покраснение по ощущениям ≤ 20 минут — норма',
    ],
  },
  rosacea: {
    condition: 'rosacea',
    name: 'Протокол для розацеа',
    description: 'Щадящий уход для чувствительной кожи с розацеа',
    allowedIngredients: ['azelaic_acid', 'niacinamide', 'ceramides', 'peptides'],
    forbiddenIngredients: ['aha', 'bha', 'retinol', 'retinoid', 'vitamin_c', 'benzoyl_peroxide'],
    allowedSteps: [
      'cleanser_gentle',
      'toner_soothing',
      'toner_hydrating',
      'serum_anti_redness',
      'serum_niacinamide',
      'moisturizer_barrier',
      'moisturizer_soothing',
      'spf_50_face',
    ],
    forbiddenSteps: [
      'cleanser_deep',
      'cleanser_balancing',
      'serum_vitc',
      'treatment_exfoliant_mild',
      'treatment_exfoliant_strong',
      'treatment_antiage',
    ],
    routineTemplate: {
      morning: ['cleanser_gentle', 'serum_anti_redness', 'moisturizer_barrier', 'spf_50_face'],
      evening: ['cleanser_gentle', 'treatment_acne_azelaic', 'moisturizer_soothing'],
    },
    titrationSchedule: [
      {
        ingredient: 'azelaic_acid',
        week1: 2, // 2 раза в неделю
        week2: 3,
        week3: 4,
        week4: 5,
      },
    ],
    cyclingRules: [
      {
        ingredient: 'azelaic_acid',
        frequency: 'every_other_day',
      },
    ],
    warnings: [
      'Запрет кислот в первые 2-4 недели',
      'Запрет ретиноидов в первые 2-4 недели',
      'Избегайте температурных перепадов',
      'Используйте только мягкие очищающие средства',
    ],
  },
  atopic_dermatitis: {
    condition: 'atopic_dermatitis',
    name: 'Протокол для атопического дерматита',
    description: 'Восстановительный уход для поврежденного барьера',
    allowedIngredients: ['ceramides', 'hyaluronic_acid', 'peptides'],
    forbiddenIngredients: ['aha', 'bha', 'retinol', 'retinoid', 'vitamin_c', 'azelaic_acid', 'benzoyl_peroxide'],
    allowedSteps: [
      'cleanser_gentle',
      'toner_hydrating',
      'serum_hydrating',
      'moisturizer_barrier',
      'moisturizer_soothing',
      'spf_50_face',
    ],
    forbiddenSteps: [
      'cleanser_deep',
      'cleanser_balancing',
      'serum_vitc',
      'serum_niacinamide',
      'treatment_exfoliant_mild',
      'treatment_exfoliant_strong',
      'treatment_antiage',
      'treatment_acne_azelaic',
    ],
    routineTemplate: {
      morning: ['cleanser_gentle', 'serum_hydrating', 'moisturizer_barrier', 'spf_50_face'],
      evening: ['cleanser_gentle', 'moisturizer_soothing', 'moisturizer_barrier'],
    },
    cyclingRules: [],
    warnings: [
      'Запрет кислот, ретиноидов, витамина C',
      'Акцент на липидах и увлажнении',
      'Ежедневное восстановление барьера',
      'Избегайте агрессивных очищающих средств',
    ],
  },
  pigmentation: {
    condition: 'pigmentation',
    name: 'Протокол для пигментации',
    description: 'Осветляющий уход для выравнивания тона кожи',
    allowedIngredients: ['vitamin_c', 'niacinamide', 'azelaic_acid', 'retinol'],
    forbiddenIngredients: [],
    allowedSteps: [
      'cleanser_gentle',
      'cleanser_balancing',
      'serum_vitc',
      'serum_niacinamide',
      'treatment_acne_azelaic',
      'treatment_antiage',
      'moisturizer_light',
      'moisturizer_balancing',
      'spf_50_face',
    ],
    forbiddenSteps: [],
    routineTemplate: {
      morning: ['cleanser_gentle', 'serum_vitc', 'moisturizer_light', 'spf_50_face'],
      evening: ['cleanser_balancing', 'serum_niacinamide', 'treatment_acne_azelaic', 'treatment_antiage', 'moisturizer_balancing'],
    },
    titrationSchedule: [
      {
        ingredient: 'retinol',
        week1: 1,
        week2: 2,
        week3: 3,
        week4: 4,
      },
    ],
    cyclingRules: [
      {
        ingredient: 'vitamin_c',
        frequency: 'daily',
      },
      {
        ingredient: 'azelaic_acid',
        frequency: 'daily',
      },
    ],
    warnings: [
      'Обязательно используйте SPF 50+ ежедневно',
      'Витамин C утром, ретинол вечером',
      'Возможна сухость в первые 7-14 дней',
    ],
  },
  normal: {
    condition: 'normal',
    name: 'Базовый протокол',
    description: 'Стандартный уход для нормальной кожи',
    allowedIngredients: ['retinol', 'vitamin_c', 'niacinamide', 'aha', 'bha', 'azelaic_acid'],
    forbiddenIngredients: [],
    allowedSteps: [
      'cleanser_gentle',
      'cleanser_balancing',
      'toner_hydrating',
      'serum_vitc',
      'serum_niacinamide',
      'treatment_antiage',
      'moisturizer_light',
      'moisturizer_balancing',
      'spf_50_face',
    ],
    forbiddenSteps: [],
    routineTemplate: {
      morning: ['cleanser_gentle', 'serum_vitc', 'moisturizer_light', 'spf_50_face'],
      evening: ['cleanser_balancing', 'serum_niacinamide', 'treatment_antiage', 'moisturizer_balancing'],
    },
    cyclingRules: [
      {
        ingredient: 'retinol',
        frequency: 'every_other_day',
      },
      {
        ingredient: 'aha',
        frequency: '2x_week',
      },
    ],
    warnings: [
      'Постепенно вводите активные ингредиенты',
      'Следите за реакцией кожи',
    ],
  },
};

/**
 * Определяет протокол на основе профиля кожи
 */
export function determineProtocol(profile: {
  diagnoses?: string[];
  concerns?: string[];
  skinType?: string;
  sensitivityLevel?: string;
}): DermatologyProtocol {
  const diagnoses = profile.diagnoses || [];
  const concerns = profile.concerns || [];
  const sensitivity = profile.sensitivityLevel || 'medium';

  // Приоритет: диагнозы > проблемы > тип кожи
  if (diagnoses.some(d => d.toLowerCase().includes('розацеа') || d.toLowerCase().includes('rosacea'))) {
    return DERMATOLOGY_PROTOCOLS.rosacea;
  }

  if (diagnoses.some(d => d.toLowerCase().includes('атопический') || d.toLowerCase().includes('атопия') || d.toLowerCase().includes('atopic'))) {
    return DERMATOLOGY_PROTOCOLS.atopic_dermatitis;
  }

  if (
    concerns.some(c => c.toLowerCase().includes('акне') || c.toLowerCase().includes('acne') || c.toLowerCase().includes('высыпания')) ||
    diagnoses.some(d => d.toLowerCase().includes('акне') || d.toLowerCase().includes('acne'))
  ) {
    return DERMATOLOGY_PROTOCOLS.acne;
  }

  if (
    concerns.some(c => c.toLowerCase().includes('пигментация') || c.toLowerCase().includes('пигмент') || c.toLowerCase().includes('пятна')) ||
    diagnoses.some(d => d.toLowerCase().includes('мелазма') || d.toLowerCase().includes('melasma'))
  ) {
    return DERMATOLOGY_PROTOCOLS.pigmentation;
  }

  return DERMATOLOGY_PROTOCOLS.normal;
}

/**
 * Проверяет, соответствует ли продукт протоколу
 */
export function isProductAllowedByProtocol(
  product: { activeIngredients?: string[]; step?: string; category?: string },
  protocol: DermatologyProtocol
): { allowed: boolean; reason?: string } {
  const ingredients = product.activeIngredients || [];
  const step = product.step || product.category || '';

  // Проверка запрещенных ингредиентов
  for (const ingredient of ingredients) {
    const ingredientLower = ingredient.toLowerCase();
    for (const forbidden of protocol.forbiddenIngredients) {
      if (ingredientLower.includes(forbidden.replace('_', ' ')) || ingredientLower.includes(forbidden)) {
        return {
          allowed: false,
          reason: `Ингредиент ${ingredient} запрещен в протоколе ${protocol.name}`,
        };
      }
    }
  }

  // Проверка запрещенных шагов
  for (const forbiddenStep of protocol.forbiddenSteps) {
    if (step.includes(forbiddenStep.replace('_', ' ')) || step === forbiddenStep) {
      return {
        allowed: false,
        reason: `Шаг ${step} запрещен в протоколе ${protocol.name}`,
      };
      }
  }

  return { allowed: true };
}

/**
 * Получает расписание применения ингредиента для конкретной недели
 */
export function getIngredientSchedule(
  ingredient: ActiveIngredient,
  protocol: DermatologyProtocol,
  week: number
): { frequency: number; days?: number[] } {
  const schedule = protocol.titrationSchedule?.find(s => s.ingredient === ingredient);
  if (!schedule) {
    // Если нет расписания, проверяем циклирование
    const cycling = protocol.cyclingRules?.find(c => c.ingredient === ingredient);
    if (cycling) {
      const frequencyMap: Record<string, number> = {
        daily: 7,
        every_other_day: 3,
        '2x_week': 2,
        '1x_week': 1,
      };
      return {
        frequency: frequencyMap[cycling.frequency] || 0,
        days: cycling.days,
      };
    }
    return { frequency: 0 };
  }

  const weekFrequency = week === 1 ? schedule.week1 : week === 2 ? schedule.week2 : week === 3 ? schedule.week3 : schedule.week4;
  return { frequency: weekFrequency };
}

