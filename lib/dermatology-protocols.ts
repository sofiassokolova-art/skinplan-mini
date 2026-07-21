// lib/dermatology-protocols.ts
// Дерматологические протоколы для различных состояний кожи

import type { StepCategory } from './step-category-rules';
import type { ActiveIngredient } from './ingredient-compatibility';
import { extractActiveIngredients } from './ingredient-compatibility';

export type SkinCondition = 'acne' | 'rosacea' | 'atopic_dermatitis' | 'pigmentation' | 'on_isotretinoin' | 'normal';

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
    // P0.2: sulfur и мягкие брайтенеры (для постакне-пигментации) явно разрешены.
    allowedIngredients: ['bha', 'azelaic_acid', 'adapalene', 'niacinamide', 'benzoyl_peroxide', 'sulfur', 'tranexamic_acid', 'arbutin', 'kojic_acid'],
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
      {
        // Явная запись на конкретную кислоту: у продукта в activeIngredients обычно
        // указана `salicylic acid`, а не ярлык `bha`. Без этой записи салициловая
        // ушла бы в общий тир («допустимо ежедневно») и рампа BHA при акне сломалась бы.
        // Держать синхронно с записью `bha` выше.
        ingredient: 'salicylic_acid',
        week1: 2,
        week2: 3,
        week3: 4,
        week4: 5,
      },
    ],
    // P2.7: фиксированные дни [2,5] для BHA убраны — они перекрывали titrationSchedule
    // и BHA навсегда оставался 2x/нед, не наращиваясь до 3→4→5. Теперь частоту BHA задаёт
    // titrationSchedule (постепенный рост), а cyclingRules оставляем только для azelaic (ежедневно).
    cyclingRules: [
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
    // P0.2: sulfur, транексамовая кислота и мягкие брайтенеры безопасны/применяются при розацеа
    // (allowlist здесь жёсткий, поэтому без них продукты ошибочно отсекались).
    allowedIngredients: ['azelaic_acid', 'niacinamide', 'ceramides', 'peptides', 'hyaluronic_acid', 'sulfur', 'tranexamic_acid', 'arbutin', 'kojic_acid'],
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
    // P0.2: ключевые брайтенеры для пигментации — отдельные категории.
    allowedIngredients: ['vitamin_c', 'niacinamide', 'azelaic_acid', 'retinol', 'tranexamic_acid', 'arbutin', 'kojic_acid'],
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
  // P0: Пациент на системном изотретиноине (Аккутан/Роаккутан и аналоги).
  // Кожа уже резко сухая, барьер истончён; кислоты, ретиноиды наружные, бензоил пероксид
  // и витамин C усиливают раздражение, хейлит, могут вызвать шелушение и пигментацию.
  // Безопасны только мягкое очищение, церамиды, гиалуроновая кислота, ниацинамид, минеральный SPF.
  on_isotretinoin: {
    condition: 'on_isotretinoin',
    name: 'Поддерживающий уход на изотретиноине',
    description: 'Минимальный, барьерный уход во время системной терапии изотретиноином',
    // panthenol намеренно не включён в allowlist enum (нет в ActiveIngredient),
    // но он не входит и в forbiddenIngredients — продукты с панthenol проходят через soft-check.
    allowedIngredients: ['ceramides', 'hyaluronic_acid', 'niacinamide', 'peptides'],
    forbiddenIngredients: [
      'retinol', 'retinoid', 'adapalene', 'tretinoin',
      'aha', 'bha',
      'vitamin_c', 'ascorbic_acid',
      'benzoyl_peroxide',
      'azelaic_acid',
    ],
    allowedSteps: [
      'cleanser_gentle',
      'toner_hydrating',
      'serum_hydrating',
      'moisturizer_barrier',
      'moisturizer_soothing',
      'spf_50_sensitive',
      'spf_50_face',
    ],
    forbiddenSteps: [
      'cleanser_deep',
      'cleanser_balancing',
      'serum_vitc',
      'treatment_exfoliant_mild',
      'treatment_exfoliant_strong',
      'treatment_acne_azelaic',
      'treatment_acne_bpo',
      'treatment_antiage',
      'mask_acid',
    ],
    routineTemplate: {
      morning: ['cleanser_gentle', 'serum_hydrating', 'moisturizer_barrier', 'spf_50_sensitive'],
      evening: ['cleanser_gentle', 'moisturizer_soothing', 'moisturizer_barrier'],
    },
    cyclingRules: [],
    warnings: [
      'Вы на системном изотретиноине — наружные ретиноиды, кислоты, бензоилпероксид и витамин C исключены',
      'Обязательно ежедневный SPF 50+ (минеральный) и бальзам для губ',
      'Любые изменения ухода — только после согласования с дерматологом',
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
    // P0.3: Default titration для retinol и AHA вне медпротокола.
    // Пользователи без диагноза, которым впервые назначен ретинол, должны нарастать постепенно,
    // иначе гарантированный «retinoid uglies» через 7-10 дней.
    titrationSchedule: [
      {
        ingredient: 'retinol',
        week1: 1,
        week2: 2,
        week3: 3,
        week4: 4,
      },
      {
        ingredient: 'aha',
        week1: 1,
        week2: 2,
        week3: 2,
        week4: 3,
      },
    ],
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
 * P1.4: Возвращает клон протокола с разрешённым витамином C и брайтенерами
 * для случая коморбидности с пигментацией. Не мутирует исходную константу.
 */
function adjustProtocolForPigmentation(base: DermatologyProtocol): DermatologyProtocol {
  const brighteners: ActiveIngredient[] = ['vitamin_c', 'tranexamic_acid', 'arbutin', 'kojic_acid'];
  return {
    ...base,
    name: `${base.name} + пигментация`,
    description: `${base.description}. Учтена постакне-пигментация (ПИВ): разрешён витамин C и мягкие брайтенеры.`,
    allowedIngredients: Array.from(new Set([...base.allowedIngredients, ...brighteners])),
    forbiddenIngredients: base.forbiddenIngredients.filter(i => !brighteners.includes(i)),
    allowedSteps: Array.from(new Set([...base.allowedSteps, 'serum_vitc' as StepCategory])),
    forbiddenSteps: base.forbiddenSteps.filter(s => s !== 'serum_vitc'),
  };
}

/**
 * P2.9: Для тёмного фототипа (V–VI по Фитцпатрику) агрессивные кислоты повышают риск
 * пост-воспалительной гиперпигментации (ПИВ). Возвращает клон протокола с запретом
 * AHA/BHA и сильных эксфолиантов. Для I–IV возвращает протокол без изменений.
 */
function applyFitzpatrickRestriction(
  protocol: DermatologyProtocol,
  fitzpatrickType?: 'I_II' | 'III_IV' | 'V_VI'
): DermatologyProtocol {
  if (fitzpatrickType !== 'V_VI') return protocol;
  const acids: ActiveIngredient[] = ['aha', 'bha', 'glycolic_acid', 'lactic_acid', 'salicylic_acid'];
  const harshSteps: StepCategory[] = ['treatment_exfoliant_strong', 'mask_acid'];
  return {
    ...protocol,
    forbiddenIngredients: Array.from(new Set([...protocol.forbiddenIngredients, ...acids])),
    allowedIngredients: protocol.allowedIngredients.filter(i => !acids.includes(i)),
    forbiddenSteps: Array.from(new Set([...protocol.forbiddenSteps, ...harshSteps])),
    allowedSteps: protocol.allowedSteps.filter(s => !harshSteps.includes(s)),
    warnings: [
      ...protocol.warnings,
      'Тёмный фототип (V–VI): сильные кислоты исключены из-за риска пост-воспалительной гиперпигментации',
    ],
  };
}

/**
 * Определяет протокол на основе профиля кожи
 */
export function determineProtocol(profile: {
  diagnoses?: string[];
  concerns?: string[];
  skinType?: string;
  sensitivityLevel?: string;
  rosaceaRisk?: string | null;
  onIsotretinoin?: boolean;
  currentOralMeds?: string[];
  fitzpatrickType?: 'I_II' | 'III_IV' | 'V_VI';
}): DermatologyProtocol {
  const diagnoses = profile.diagnoses || [];
  const concerns = profile.concerns || [];
  const sensitivity = profile.sensitivityLevel || 'medium';
  const rosaceaRisk = (profile.rosaceaRisk || '').toLowerCase();

  // P0: Высший приоритет — системный изотретиноин. Перебивает любой диагноз/протокол,
  // потому что фармакологически уход на изотретиноине должен быть строго барьерным:
  // кожа уже резко сухая, барьер истончён, активы только усугубят раздражение.
  const onIsotretinoin =
    profile.onIsotretinoin === true ||
    (profile.currentOralMeds || []).some(m => (m || '').toLowerCase().includes('isotretinoin'));
  if (onIsotretinoin) {
    return DERMATOLOGY_PROTOCOLS.on_isotretinoin;
  }

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

  // Акне / пигментация — определяем оба признака заранее для учёта коморбидности
  const hasAcne =
    concerns.some(c => {
      const cLower = c.toLowerCase();
      return cLower.includes('акне') || cLower.includes('acne') ||
             cLower.includes('высыпания') || cLower.includes('прыщи');
    }) ||
    diagnoses.some(d => {
      const dLower = d.toLowerCase();
      return dLower.includes('акне') || dLower.includes('acne') ||
             dLower.includes('угревая') || dLower.includes('комедоны');
    });

  const hasPigmentation =
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
    });

  // Акне
  if (hasAcne) {
    // P1.4: коморбидность акне + пигментация (постакне/ПИВ) — очень частый случай.
    // Базовый протокол акне запрещает vitamin C, что лишает пациента ключевого средства
    // от ПИВ. При сочетании разрешаем витамин C (azelaic уже разрешён; оба безопасны при акне),
    // не мутируя общую константу — возвращаем скорректированный клон.
    if (hasPigmentation) {
      return applyFitzpatrickRestriction(
        adjustProtocolForPigmentation(DERMATOLOGY_PROTOCOLS.acne),
        profile.fitzpatrickType
      );
    }
    return DERMATOLOGY_PROTOCOLS.acne;
  }

  // Пигментация (включая мелазму, PIH, постакне)
  if (hasPigmentation) {
    return applyFitzpatrickRestriction(DERMATOLOGY_PROTOCOLS.pigmentation, profile.fitzpatrickType);
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
/**
 * Частотные тиры конкретных кислот для leave-on применения (недели 1-4, дней/нед).
 *
 * Зачем: протоколы расписывают только «зонтичные» `aha`/`bha`, поэтому у продукта с
 * `glycolic_acid`/`lactic_acid`/`pha` расписания не находилось вовсе → frequency: null →
 * кислота вставала ежедневно. Кислоты переносятся по-разному, поэтому тир per-ingredient,
 * а не общий плоский кап.
 *
 * `null` = ограничений нет (допустимо ежедневно).
 * ВАЖНО: концентрация и pH в модели Product отсутствуют, поэтому тир задан для типичного
 * потребительского процента. 10% гликолевый раствор и 2% BHA-тоник структурно неразличимы —
 * различать их можно только после миграции схемы (см. решение по scope).
 */
type AcidTier = { week1: number; week2: number; week3: number; week4: number } | null;

const ACID_TITRATION_TIERS: Partial<Record<ActiveIngredient, AcidTier>> = {
  // Гликолевая — самая мелкая молекула, самая агрессивная: старт 2/нед с рампом вверх.
  glycolic_acid: { week1: 2, week2: 2, week3: 3, week4: 3 },
  // Молочная — крупнее и увлажняет, переносится лучше: потолок выше.
  lactic_acid: { week1: 3, week2: 3, week3: 4, week4: 4 },
  // Миндальная — самая крупная молекула, самая мягкая AHA.
  mandelic_acid: { week1: 3, week2: 4, week3: 4, week4: 5 },
  // PHA (глюконолактон, лактобионовая) — не проникают глубоко, допустимы ежедневно,
  // в т.ч. при чувствительной коже (для неё тир задан ниже отдельно).
  pha: null,
  // Салициловая в потребительском проценте — допустима ежедневно, особенно жирной/акне-коже.
  // Если протокол (акне) расписывает BHA — протокольная запись строже и выигрывает.
  salicylic_acid: null,
};

/** Более строгие тиры для чувствительной кожи (sensitivityLevel high/very_high). */
const ACID_TITRATION_TIERS_SENSITIVE: Partial<Record<ActiveIngredient, AcidTier>> = {
  glycolic_acid: { week1: 1, week2: 1, week3: 2, week4: 2 },
  lactic_acid: { week1: 1, week2: 2, week3: 2, week4: 3 },
  mandelic_acid: { week1: 2, week2: 2, week3: 3, week4: 3 },
  // PHA остаётся ежедневным даже для чувствительной кожи — это его клиническая ниша.
  pha: null,
  salicylic_acid: { week1: 2, week2: 3, week3: 3, week4: 4 },
};

/** Прецедент маппинга — `['high','very_high'].includes(...)` в findFallbackProduct. */
export function isHighSensitivity(sensitivityLevel?: string | null): boolean {
  return ['high', 'very_high'].includes(String(sensitivityLevel || '').toLowerCase());
}

/** Отшелушивающие кислоты. Азелаиновая/транексамовая/койевая — брайтенеры, сюда не входят. */
export const EXFOLIATING_ACIDS: ActiveIngredient[] = [
  'aha', 'bha', 'pha',
  'glycolic_acid', 'lactic_acid', 'salicylic_acid', 'mandelic_acid',
];

export function isExfoliatingAcid(ingredient: ActiveIngredient): boolean {
  return EXFOLIATING_ACIDS.includes(ingredient);
}

/**
 * Максимальная частота применения актива за 4 недели (дней/нед).
 * `null` = ограничений нет (допустимо ежедневно).
 *
 * Нужна для маршрутизации: кислота с потолком ≤3 дн/нед — это ПЕРИОДИЧЕСКИЙ уход,
 * его место в недельном блоке, а не в ежедневном слоте. Кислота с потолком 4-5
 * (напр. BHA при акне) — почти ежедневная, её оставляем в обычной рутине под титрацией.
 */
export function getMaxWeeklyFrequency(
  ingredient: ActiveIngredient,
  protocol: DermatologyProtocol,
  options?: { sensitivityLevel?: string | null }
): number | null {
  let max = 0;
  for (const week of [1, 2, 3, 4]) {
    const { frequency } = getEffectiveIngredientSchedule(ingredient, protocol, week, options);
    if (frequency === null || frequency === undefined) return null; // без ограничений
    max = Math.max(max, frequency);
  }
  return max;
}

/** «Зонтик» кислоты: под какую протокольную запись она подпадает. */
const ACID_UMBRELLA: Partial<Record<ActiveIngredient, ActiveIngredient>> = {
  glycolic_acid: 'aha',
  lactic_acid: 'aha',
  mandelic_acid: 'aha',
  salicylic_acid: 'bha',
};

function hasProtocolEntry(ingredient: ActiveIngredient, protocol: DermatologyProtocol): boolean {
  return Boolean(
    protocol.cyclingRules?.some(c => c.ingredient === ingredient) ||
    protocol.titrationSchedule?.some(s => s.ingredient === ingredient)
  );
}

/**
 * Расписание конкретной кислоты с учётом тиров и чувствительности.
 *
 * Приоритет (от сильного к слабому):
 *  1. явная запись протокола на САМ ингредиент (медицинский протокол — авторитет);
 *  2. тир конкретной кислоты (sensitivity-aware);
 *  3. запись протокола на «зонтик» (aha/bha);
 *  4. без ограничений.
 *
 * Такой порядок нужен, чтобы (а) acne-протокол с расписанным BHA продолжал вести
 * салициловую по своей рампе, и (б) молочная/миндальная не схлопывались до строгого
 * generic-`aha` из базового протокола, теряя смысл тиров.
 */
export function getEffectiveIngredientSchedule(
  ingredient: ActiveIngredient,
  protocol: DermatologyProtocol,
  week: number,
  options?: { sensitivityLevel?: string | null }
): { frequency: number | null; days?: number[] } {
  // 1. Явная запись протокола на сам ингредиент.
  if (hasProtocolEntry(ingredient, protocol)) {
    return getIngredientSchedule(ingredient, protocol, week);
  }

  // 2. Тир конкретной кислоты.
  const tiers = isHighSensitivity(options?.sensitivityLevel)
    ? ACID_TITRATION_TIERS_SENSITIVE
    : ACID_TITRATION_TIERS;
  if (Object.prototype.hasOwnProperty.call(tiers, ingredient)) {
    const tier = tiers[ingredient];
    if (tier === null) return { frequency: null }; // допустимо ежедневно
    const weekFreq = week === 1 ? tier!.week1 : week === 2 ? tier!.week2 : week === 3 ? tier!.week3 : tier!.week4;
    return { frequency: weekFreq };
  }

  // 3. Запись протокола на «зонтик» кислоты.
  const umbrella = ACID_UMBRELLA[ingredient];
  if (umbrella && hasProtocolEntry(umbrella, protocol)) {
    return getIngredientSchedule(umbrella, protocol, week);
  }

  // 4. Обычный путь (ретинол, витамин C и всё остальное).
  return getIngredientSchedule(ingredient, protocol, week);
}

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
    // Если есть cycling без фиксированных дней, берём минимум из cycling-частоты и titration-частоты.
    // Это обеспечивает прогрессивное увеличение (titration) с учётом верхнего предела (cycling).
    if (cycling) {
      const frequencyMap: Record<string, number> = {
        daily: 7,
        every_other_day: 3,
        '2x_week': 2,
        '1x_week': 1,
      };
      const cyclingFreq = frequencyMap[cycling.frequency];
      const effectiveFrequency = cyclingFreq != null
        ? Math.min(cyclingFreq, weekFrequency)
        : weekFrequency;
      return {
        frequency: effectiveFrequency,
        days: cycling.days,
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

