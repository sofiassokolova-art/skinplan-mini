// lib/dermatology-protocols.ts
// Дерматологические протоколы для различных состояний кожи

import type { StepCategory } from './step-category-rules';
import type { ActiveIngredient } from './ingredient-compatibility';
import { extractActiveIngredients } from './ingredient-compatibility';

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
    // ИСПРАВЛЕНО (P0): Добавлены недостающие ингредиенты
    allowedIngredients: ['azelaic_acid', 'niacinamide', 'ceramides', 'peptides', 'hyaluronic_acid'],
    forbiddenIngredients: ['aha', 'bha', 'retinol', 'retinoid', 'vitamin_c', 'benzoyl_peroxide'],
    // ИСПРАВЛЕНО (P0): Добавлен treatment_acne_azelaic, который есть в routineTemplate
    allowedSteps: [
      'cleanser_gentle',
      'toner_soothing',
      'toner_hydrating',
      'serum_anti_redness',
      'serum_niacinamide',
      'treatment_acne_azelaic', // ИСПРАВЛЕНО: добавлен для консистентности с routineTemplate
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
    // ИСПРАВЛЕНО (P0): Добавлен niacinamide (мягкий, помогает барьеру) и ceramides уже был
    allowedIngredients: ['ceramides', 'hyaluronic_acid', 'peptides', 'niacinamide'],
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
    // ИСПРАВЛЕНО (P0): Добавлен pha (если поддерживается)
    allowedIngredients: ['retinol', 'vitamin_c', 'niacinamide', 'aha', 'bha', 'pha', 'azelaic_acid'],
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
  rosaceaRisk?: string | null;
}): DermatologyProtocol {
  const diagnoses = profile.diagnoses || [];
  const concerns = profile.concerns || [];
  const sensitivity = profile.sensitivityLevel || 'medium';
  const rosaceaRisk = (profile.rosaceaRisk || '').toLowerCase();

  // ИСПРАВЛЕНО (P1): Расширен список вариантов диагнозов для лучшего определения
  // Приоритет: диагнозы > rosaceaRisk > проблемы > тип кожи
  
  // Розацеа (высший приоритет по безопасности) — диагноз или риск
  const hasRosaceaDiagnosis = diagnoses.some(d => {
    const dLower = d.toLowerCase();
    return dLower.includes('розацеа') || dLower.includes('rosacea') || 
           dLower.includes('розаце') || dLower.includes('купероз');
  });
  const hasRosaceaRisk = ['medium', 'high', 'critical'].includes(rosaceaRisk);
  if (hasRosaceaDiagnosis || hasRosaceaRisk) {
    return DERMATOLOGY_PROTOCOLS.rosacea;
  }

  // Атопический дерматит (высший приоритет по безопасности)
  if (diagnoses.some(d => {
    const dLower = d.toLowerCase();
    return dLower.includes('атопический') || dLower.includes('атопия') || 
           dLower.includes('atopic') || dLower.includes('экзема') ||
           dLower.includes('eczema') || dLower.includes('дерматит');
  })) {
    return DERMATOLOGY_PROTOCOLS.atopic_dermatitis;
  }

  // Акне
  if (
    concerns.some(c => {
      const cLower = c.toLowerCase();
      return cLower.includes('акне') || cLower.includes('acne') || 
             cLower.includes('высыпания') || cLower.includes('прыщи');
    }) ||
    diagnoses.some(d => {
      const dLower = d.toLowerCase();
      return dLower.includes('акне') || dLower.includes('acne') || 
             dLower.includes('угревая') || dLower.includes('комедоны');
    })
  ) {
    return DERMATOLOGY_PROTOCOLS.acne;
  }

  // Пигментация (включая мелазму, PIH, постакне)
  if (
    concerns.some(c => {
      const cLower = c.toLowerCase();
      return cLower.includes('пигментация') || cLower.includes('пигмент') || 
             cLower.includes('пятна') || cLower.includes('мелазма') ||
             cLower.includes('melasma') || cLower.includes('постакне') ||
             cLower.includes('post-inflammatory');
    }) ||
    diagnoses.some(d => {
      const dLower = d.toLowerCase();
      return dLower.includes('мелазма') || dLower.includes('melasma') ||
             dLower.includes('пигментация') || dLower.includes('pih') ||
             dLower.includes('post-inflammatory hyperpigmentation');
    })
  ) {
    return DERMATOLOGY_PROTOCOLS.pigmentation;
  }

  return DERMATOLOGY_PROTOCOLS.normal;
}

/**
 * Проверяет, соответствует ли продукт протоколу
 * ИСПРАВЛЕНО (P0): 
 * - Использует нормализованные ингредиенты через extractActiveIngredients
 * - Проверяет allowlist (allowedIngredients/allowedSteps) для безопасности
 * - Для rosacea/atopic_dermatitis allowlist = hard, для остальных = soft (prefer)
 */
export function isProductAllowedByProtocol(
  product: { activeIngredients?: string[]; step?: string; category?: string; stepCategory?: StepCategory },
  protocol: DermatologyProtocol
): { allowed: boolean; reason?: string; warning?: string } {
  // ИСПРАВЛЕНО (P0): Используем нормализованные ингредиенты вместо строкового сравнения
  const extractedIngredients = extractActiveIngredients({
    activeIngredients: product.activeIngredients || [],
    composition: undefined,
  });
  
  // Определяем stepCategory из product или из step/category
  let stepCategory: StepCategory | undefined = product.stepCategory;
  if (!stepCategory && product.step) {
    // Пытаемся определить stepCategory из step/category (упрощенная логика)
    const stepLower = (product.step || '').toLowerCase();
    const categoryLower = (product.category || '').toLowerCase();
    const stepStr = `${stepLower} ${categoryLower}`.trim();
    
    // Базовый маппинг (можно расширить)
    if (stepStr.includes('treatment_acne_azelaic') || stepStr.includes('azelaic')) {
      stepCategory = 'treatment_acne_azelaic' as StepCategory;
    } else if (stepStr.includes('treatment_antiage') || stepStr.includes('retinol')) {
      stepCategory = 'treatment_antiage' as StepCategory;
    } else if (stepStr.includes('serum_vitc') || stepStr.includes('vitamin c')) {
      stepCategory = 'serum_vitc' as StepCategory;
    } else if (stepStr.includes('serum_niacinamide') || stepStr.includes('niacinamide')) {
      stepCategory = 'serum_niacinamide' as StepCategory;
    }
  }

  // ИСПРАВЛЕНО (P0): Проверка запрещенных ингредиентов по нормализованным типам
  for (const extractedIng of extractedIngredients) {
    if (protocol.forbiddenIngredients.includes(extractedIng)) {
      return {
        allowed: false,
        reason: `Ингредиент ${extractedIng} запрещен в протоколе ${protocol.name}`,
      };
    }
  }

  // ИСПРАВЛЕНО (P0): Проверка запрещенных шагов по StepCategory
  if (stepCategory && protocol.forbiddenSteps.includes(stepCategory)) {
    return {
      allowed: false,
      reason: `Шаг ${stepCategory} запрещен в протоколе ${protocol.name}`,
    };
  }

  // ИСПРАВЛЕНО (P0): Проверка allowlist для безопасности (hard для rosacea/atopic, soft для остальных)
  const isStrictProtocol = protocol.condition === 'rosacea' || protocol.condition === 'atopic_dermatitis';
  
  // Проверка allowedIngredients
  if (protocol.allowedIngredients.length > 0) {
    const hasAllowedIngredient = extractedIngredients.some(ing => protocol.allowedIngredients.includes(ing));
    const hasForbiddenIngredient = extractedIngredients.some(ing => protocol.forbiddenIngredients.includes(ing));
    
    if (!hasAllowedIngredient && extractedIngredients.length > 0 && !hasForbiddenIngredient) {
      // Если есть активы, но они не в allowlist
      if (isStrictProtocol) {
        return {
          allowed: false,
          reason: `Продукт содержит ингредиенты, не разрешенные в протоколе ${protocol.name}. Разрешены: ${protocol.allowedIngredients.join(', ')}`,
        };
      } else {
        // Soft: разрешаем, но предупреждаем
        return {
          allowed: true,
          warning: `Продукт содержит ингредиенты, не входящие в рекомендуемый список для протокола ${protocol.name}`,
        };
      }
    }
  }

  // Проверка allowedSteps
  if (stepCategory && protocol.allowedSteps.length > 0) {
    if (!protocol.allowedSteps.includes(stepCategory)) {
      if (isStrictProtocol) {
        return {
          allowed: false,
          reason: `Шаг ${stepCategory} не разрешен в протоколе ${protocol.name}. Разрешены: ${protocol.allowedSteps.join(', ')}`,
        };
      } else {
        // Soft: разрешаем, но предупреждаем
        return {
          allowed: true,
          warning: `Шаг ${stepCategory} не входит в рекомендуемый список для протокола ${protocol.name}`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Получает расписание применения ингредиента для конкретной недели
 * ИСПРАВЛЕНО (P1): Возвращает frequency: null для "нет ограничений" вместо 0
 * ИСПРАВЛЕНО (P0): Приоритет cyclingRules.days над titrationSchedule для точных дней
 */
export function getIngredientSchedule(
  ingredient: ActiveIngredient,
  protocol: DermatologyProtocol,
  week: number
): { frequency: number | null; days?: number[] } {
  // ИСПРАВЛЕНО (P0): Проверяем cyclingRules первым, если есть фиксированные дни
  const cycling = protocol.cyclingRules?.find(c => c.ingredient === ingredient);
  if (cycling && cycling.days && cycling.days.length > 0) {
    // Если есть фиксированные дни - используем их (это приоритетнее титрации)
    const frequencyMap: Record<string, number> = {
      daily: 7,
      every_other_day: 3,
      '2x_week': 2,
      '1x_week': 1,
    };
    return {
      frequency: frequencyMap[cycling.frequency] || cycling.days.length,
      days: cycling.days,
    };
  }
  
  // Проверяем titrationSchedule
  const schedule = protocol.titrationSchedule?.find(s => s.ingredient === ingredient);
  if (schedule) {
    const weekFrequency = week === 1 ? schedule.week1 : week === 2 ? schedule.week2 : week === 3 ? schedule.week3 : schedule.week4;
    // Если есть cycling без фиксированных дней, используем его frequency
    if (cycling) {
      const frequencyMap: Record<string, number> = {
        daily: 7,
        every_other_day: 3,
        '2x_week': 2,
        '1x_week': 1,
      };
      return {
        frequency: frequencyMap[cycling.frequency] || weekFrequency,
        days: cycling.days, // может быть undefined
      };
    }
    return { frequency: weekFrequency };
  }
  
  // Если есть cycling без titrationSchedule
  if (cycling) {
    const frequencyMap: Record<string, number> = {
      daily: 7,
      every_other_day: 3,
      '2x_week': 2,
      '1x_week': 1,
    };
    return {
      frequency: frequencyMap[cycling.frequency] || null,
      days: cycling.days,
    };
  }
  
  // ИСПРАВЛЕНО (P1): Если нет ограничений - возвращаем null (нет ограничений), а не 0 (запрещено)
  return { frequency: null };
}

