// lib/plan-types.ts
// Типы для структуры 28-дневного плана ухода

import type { StepCategory } from './step-category-rules';
import { formatMainGoal } from './format-helpers';

export type PlanPhases = "adaptation" | "active" | "support";

export interface DayStep {
  stepCategory: StepCategory;
  productId: string | null;       // рекомендованный продукт
  alternatives: string[];         // ids возможных замен
}

export interface DayRoutine {
  morning: DayStep[];
  evening: DayStep[];
  weekly: DayStep[];              // шаги, которые в этот день должны быть (маски/пилинги)
}

export interface DayMeta {
  dayIndex: number;        // 1..28
  phase: PlanPhases;
  isWeeklyFocusDay: boolean; // день маски/пилинга
}

export interface DayPlan extends DayMeta, DayRoutine {}

export interface Plan28 {
  userId: string;
  skinProfileId: string;
  days: DayPlan[];       // 28 элементов
  mainGoals: string[];   // из SkinProfile
}

// Нормализованный тип продукта для DomainContext (обёртка над ProductWithBrand)
export type Product = import('./product-fallback').ProductWithBrand;

// Типы для инфографики прогресса по целям
export interface GoalProgressPoint {
  day: number;
  relativeLevel: number; // 0..100
}

export interface GoalProgressCurve {
  goalKey: "acne" | "pores" | "pigmentation" | "barrier" | "hydration" | "wrinkles" | "redness";
  points: GoalProgressPoint[];
}

// Вспомогательные функции
export function getPhaseForDay(dayIndex: number): PlanPhases {
  if (dayIndex >= 1 && dayIndex <= 7) return "adaptation";
  if (dayIndex >= 8 && dayIndex <= 21) return "active";
  return "support";
}

export function getPhaseLabel(phase: PlanPhases): string {
  switch (phase) {
    case "adaptation":
      return "Адаптация";
    case "active":
      return "Активная фаза";
    case "support":
      return "Поддержка";
  }
}

export function getPhaseDescription(phase: PlanPhases, goals: string[]): string {
  // ИСПРАВЛЕНО: Используем formatMainGoal для перевода целей на русский
  const goalLabels: Record<string, string> = {
    acne: 'Акне',
    pores: 'Поры',
    pigmentation: 'Пигментация',
    barrier: 'Барьер',
    dehydration: 'Обезвоженность',
    wrinkles: 'Морщины',
    antiage: 'Антиэйдж',
    general: 'Общий уход',
  };
  
  const translatedGoals = goals.length > 0 
    ? goals.map(goal => formatMainGoal(goal) || goalLabels[goal] || goal).filter(Boolean).join(", ")
    : "улучшение состояния кожи";
  
  switch (phase) {
    case "adaptation":
      return `Мягкое внедрение ухода. Мы постепенно знакомим кожу с новыми средствами, минимизируя раздражение. Фокус на ${translatedGoals}.`;
    case "active":
      return `Активная фаза работы. Подключаем активные ингредиенты для решения задач: ${translatedGoals}.`;
    case "support":
      return `Фаза закрепления результатов. Поддерживаем достигнутый прогресс и укрепляем барьер кожи.`;
  }
}

// Функция для определения, является ли день недельным фокусом (маска/пилинг)
export function isWeeklyFocusDay(
  dayIndex: number, 
  weeklySteps: StepCategory[],
  routineComplexity: 'minimal' | 'medium' | 'maximal' | 'any' = 'medium'
): boolean {
  if (weeklySteps.length === 0) return false;
  
  // Распределяем недельные шаги в зависимости от сложности рутины
  let weeklyDays: number[] = [];
  
  switch (routineComplexity) {
    case 'minimal':
      // 1 раз в неделю: дни 4, 11, 18, 25
      weeklyDays = [4, 11, 18, 25];
      break;
    case 'medium':
      // 2 раза в неделю: дни 3, 7, 10, 14, 17, 21, 24, 28
      weeklyDays = [3, 7, 10, 14, 17, 21, 24, 28];
      break;
    case 'maximal':
      // 3-4 раза в неделю: дни 2, 5, 8, 11, 14, 17, 20, 23, 26
      weeklyDays = [2, 5, 8, 11, 14, 17, 20, 23, 26];
      break;
    default:
      // По умолчанию: 2 раза в неделю
      weeklyDays = [3, 10, 17, 24];
  }
  
  return weeklyDays.includes(dayIndex);
}

// Создаем пустой SkinProfile для инициализации
export function createEmptySkinProfile() {
  return {
    skinType: null,
    sensitivity: 'low' as const,
    mainGoals: [],
    secondaryGoals: [],
    diagnoses: [],
    seasonality: null,
    pregnancyStatus: null,
    contraindications: [],
    currentTopicals: [],
    currentOralMeds: [],
    spfHabit: 'never' as const,
    makeupFrequency: 'rarely' as const,
    lifestyleFactors: [],
    carePreference: 'any' as const,
    routineComplexity: 'any' as const,
    budgetSegment: 'any' as const,
  };
}

// Профессиональные описания шагов для дерматологического плана
export interface StepDescription {
  name: string;
  subtitle: string; // Подзаголовок (зачем нужен шаг)
  tags: string[]; // Теги шага (например, "подходит при акне", "уменьшает воспаления")
}

export function getStepDescription(stepCategory: StepCategory, skinIssues?: string[]): StepDescription {
  const hasAcne = skinIssues?.includes('acne') || false;
  const hasSensitivity = skinIssues?.includes('sensitivity') || false;
  const hasPigmentation = skinIssues?.includes('pigmentation') || false;
  const hasBarrier = skinIssues?.includes('barrier') || false;
  
  const baseDescriptions: Record<StepCategory, { name: string; subtitle: string; defaultTags: string[] }> = {
    // Очищение
    cleanser_oil: {
      name: "Гидрофильное масло",
      subtitle: "Первое очищение для снятия макияжа",
      defaultTags: ["очищение", "масло", "макияж"],
    },
    cleanser_gentle: {
      name: "Очищение (мягкое)",
      subtitle: "Удаляет загрязнения и макияж, не нарушая защитный барьер кожи",
      defaultTags: ["подходит при акне", "для чувствительной кожи", "не сушит"],
    },
    cleanser_balancing: {
      name: "Очищение (балансирующее)",
      subtitle: "Контролирует жирность Т-зоны, не пересушивая щеки",
      defaultTags: ["для комбинированной кожи", "регулирует себум"],
    },
    cleanser_deep: {
      name: "Очищение (глубокое)",
      subtitle: "Эффективно очищает поры от избыточного кожного сала и загрязнений",
      defaultTags: ["для жирной кожи", "очищает поры", "уменьшает блеск"],
    },
    // Тоник
    toner_hydrating: {
      name: "Тоник (увлажняющий)",
      subtitle: "Восстанавливает уровень pH и подготавливает кожу к следующим этапам ухода",
      defaultTags: ["увлажняет", "восстанавливает pH", "улучшает впитывание"],
    },
    toner_soothing: {
      name: "Тоник (успокаивающий)",
      subtitle: "Снимает покраснения и раздражения, укрепляет защитный барьер",
      defaultTags: ["успокаивает", "снимает покраснения", "для чувствительной кожи"],
    },
    toner_exfoliant: {
      name: "Тоник (эксфолиант)",
      subtitle: "Кислоты мягко отшелушивают и улучшают текстуру кожи",
      defaultTags: ["эксфолиация", "кислоты", "текстура"],
    },
    toner_acid: {
      name: "Тоник с кислотами",
      subtitle: "Сочетание кислот помогает при акне и пигментации",
      defaultTags: ["кислоты", "при акне", "пигментация"],
    },
    toner_aha: {
      name: "Тоник с AHA",
      subtitle: "AHA-кислоты осветляют тон и выравнивают поверхность кожи",
      defaultTags: ["AHA", "осветляет", "выравнивает тон"],
    },
    toner_bha: {
      name: "Тоник с BHA",
      subtitle: "BHA проникают в поры, уменьшая воспаления и очищая себум",
      defaultTags: ["BHA", "при акне", "очищает поры"],
    },
    // Сыворотки
    serum_hydrating: {
      name: "Сыворотка (увлажняющая)",
      subtitle: "Интенсивно увлажняет кожу и предотвращает обезвоживание",
      defaultTags: ["интенсивное увлажнение", "для сухой кожи"],
    },
    serum_niacinamide: {
      name: "Сыворотка (ниацинамид)",
      subtitle: "Регулирует выработку кожного сала, уменьшает воспаления и сужает поры",
      defaultTags: ["подходит при акне", "уменьшает воспаления", "сужает поры"],
    },
    serum_vitc: {
      name: "Сыворотка (витамин C)",
      subtitle: "Защищает от свободных радикалов, осветляет пигментацию и выравнивает тон",
      defaultTags: ["антиоксидант", "осветляет пигментацию", "защита от УФ"],
    },
    serum_anti_redness: {
      name: "Сыворотка (против покраснений)",
      subtitle: "Снимает воспаления и покраснения, успокаивает раздраженную кожу",
      defaultTags: ["для чувствительной кожи", "снимает покраснения", "при розацеа"],
    },
    serum_brightening_soft: {
      name: "Сыворотка (осветляющая)",
      subtitle: "Мягко осветляет пигментные пятна и выравнивает тон кожи",
      defaultTags: ["осветляет пигментацию", "выравнивает тон", "для чувствительной кожи"],
    },
    serum_peptide: {
      name: "Сыворотка (пептиды)",
      subtitle: "Пептиды поддерживают упругость и восстановление кожи",
      defaultTags: ["антиэйдж", "упругость", "восстановление"],
    },
    serum_antiage: {
      name: "Сыворотка (anti-age)",
      subtitle: "Активы против морщин и для повышения плотности кожи",
      defaultTags: ["антиэйдж", "морщины", "упругость"],
    },
    serum_exfoliant: {
      name: "Сыворотка (эксфолиант)",
      subtitle: "Кислоты в сыворотке выравнивают текстуру и уменьшают высыпания",
      defaultTags: ["кислоты", "при акне", "текстура"],
    },
    // Лечение
    treatment_acne_bpo: {
      name: "Лечение акне (BPO)",
      subtitle: "Бензоил пероксид уничтожает бактерии, вызывающие акне",
      defaultTags: ["при акне", "антибактериальное действие", "требует SPF"],
    },
    treatment_acne_azelaic: {
      name: "Лечение акне (азелаиновая кислота)",
      subtitle: "Снижает воспаления, осветляет постакне и предотвращает новые высыпания",
      defaultTags: ["подходит при акне", "осветляет постакне", "снижает воспаления"],
    },
    treatment_acne_local: {
      name: "Лечение акне (точечное)",
      subtitle: "Применяется локально на воспаления для быстрого их устранения",
      defaultTags: ["точечное применение", "при акне", "быстрое действие"],
    },
    treatment_exfoliant_mild: {
      name: "Эксфолиант (мягкий)",
      subtitle: "Мягко отшелушивает омертвевшие клетки, не раздражая кожу",
      defaultTags: ["мягкое отшелушивание", "для чувствительной кожи"],
    },
    treatment_exfoliant_strong: {
      name: "Эксфолиант (сильный)",
      subtitle: "Глубоко очищает поры и выравнивает текстуру кожи",
      defaultTags: ["для жирной кожи", "глубокое очищение", "выравнивает текстуру"],
    },
    treatment_acid: {
      name: "Кислотный уход",
      subtitle: "Кислоты контролируют акне, пигментацию и улучшают текстуру",
      defaultTags: ["кислоты", "при акне", "пигментация"],
    },
    treatment_pigmentation: {
      name: "Лечение пигментации",
      subtitle: "Осветляет пигментные пятна и предотвращает появление новых",
      defaultTags: ["осветляет пигментацию", "требует SPF"],
    },
    treatment_antiage: {
      name: "Антиэйдж",
      subtitle: "Стимулирует выработку коллагена, разглаживает морщины",
      defaultTags: ["антивозрастной уход", "разглаживает морщины"],
    },
    // Увлажнение
    moisturizer_light: {
      name: "Увлажнение (легкое)",
      subtitle: "Легкая текстура для жирной и комбинированной кожи",
      defaultTags: ["для жирной кожи", "некомедогенно", "легкая текстура"],
    },
    moisturizer_balancing: {
      name: "Увлажнение (балансирующее)",
      subtitle: "Увлажняет сухие зоны, не перегружая жирные",
      defaultTags: ["для комбинированной кожи", "балансирует"],
    },
    moisturizer_barrier: {
      name: "Увлажнение (барьерное)",
      subtitle: "Восстанавливает защитный барьер кожи с помощью церамидов и липидов",
      defaultTags: ["восстанавливает барьер", "для чувствительной кожи", "церамиды"],
    },
    moisturizer_soothing: {
      name: "Увлажнение (успокаивающее)",
      subtitle: "Успокаивает раздраженную кожу и снимает покраснения",
      defaultTags: ["успокаивает", "для чувствительной кожи", "снимает покраснения"],
    },
    // Крем для век
    eye_cream_basic: {
      name: "Крем для век",
      subtitle: "Увлажняет нежную кожу вокруг глаз и предотвращает появление морщин",
      defaultTags: ["для век", "увлажнение"],
    },
    eye_cream_dark_circles: {
      name: "Крем для век (темные круги)",
      subtitle: "Осветляет темные круги и улучшает микроциркуляцию",
      defaultTags: ["осветляет круги", "улучшает микроциркуляцию"],
    },
    eye_cream_puffiness: {
      name: "Крем для век (отеки)",
      subtitle: "Снимает отеки и уменьшает припухлости под глазами",
      defaultTags: ["снимает отеки", "дренажный эффект"],
    },
    // SPF
    spf_50_face: {
      name: "SPF 50",
      subtitle: "Защищает от УФ-излучения и предотвращает фотостарение",
      defaultTags: ["защита от УФ", "предотвращает фотостарение", "обязательно"],
    },
    spf_50_oily: {
      name: "SPF 50 (для жирной кожи)",
      subtitle: "Легкая текстура для жирной кожи, не закупоривает поры",
      defaultTags: ["для жирной кожи", "некомедогенно", "матовый эффект"],
    },
    spf_50_sensitive: {
      name: "SPF 50 (для чувствительной кожи)",
      subtitle: "Минеральная защита без химических фильтров",
      defaultTags: ["для чувствительной кожи", "минеральный фильтр"],
    },
    // Маски
    mask_clay: {
      name: "Маска (глиняная)",
      subtitle: "Очищает поры и регулирует выработку кожного сала",
      defaultTags: ["для жирной кожи", "очищает поры", "1-2 раза в неделю"],
    },
    mask_hydrating: {
      name: "Маска (увлажняющая)",
      subtitle: "Интенсивно увлажняет и насыщает кожу влагой",
      defaultTags: ["для сухой кожи", "интенсивное увлажнение"],
    },
    mask_soothing: {
      name: "Маска (успокаивающая)",
      subtitle: "Успокаивает раздраженную кожу и снимает покраснения",
      defaultTags: ["для чувствительной кожи", "успокаивает"],
    },
    mask_sleeping: {
      name: "Маска (ночная)",
      subtitle: "Работает всю ночь, восстанавливая и увлажняя кожу",
      defaultTags: ["ночное восстановление", "интенсивный уход"],
    },
    mask_enzyme: {
      name: "Маска (энзимная)",
      subtitle: "Энзимы мягко растворяют ороговевший слой без раздражения",
      defaultTags: ["энзимы", "мягкое отшелушивание", "для чувствительной кожи"],
    },
    mask_acid: {
      name: "Маска с кислотами",
      subtitle: "Кислотный пилинг для выравнивания текстуры и тона",
      defaultTags: ["кислоты", "пилинг", "текстура"],
    },
    mask_peel: {
      name: "Пилинг-маска",
      subtitle: "Интенсивное отшелушивание для гладкости и сияния кожи",
      defaultTags: ["пилинг", "гладкость", "сияние"],
    },
    // Доп. уход
    spot_treatment: {
      name: "Точечное лечение",
      subtitle: "Применяется локально на воспаления для их быстрого устранения",
      defaultTags: ["точечное применение", "при акне"],
    },
    lip_care: {
      name: "Уход за губами",
      subtitle: "Увлажняет и защищает нежную кожу губ",
      defaultTags: ["для губ", "увлажнение"],
    },
    balm_barrier_repair: {
      name: "Бальзам (восстановление барьера)",
      subtitle: "Восстанавливает поврежденный защитный барьер кожи",
      defaultTags: ["восстанавливает барьер", "для чувствительной кожи", "церамиды"],
    },
  };

  // Функция для получения базового имени шага (без циклической зависимости)
  const getBasicStepName = (cat: StepCategory): string => {
    const basicLabels: Record<string, string> = {
      cleanser_gentle: "Очищение (мягкое)",
      cleanser_balancing: "Очищение (балансирующее)",
      cleanser_deep: "Очищение (глубокое)",
      toner_hydrating: "Тоник (увлажняющий)",
      toner_soothing: "Тоник (успокаивающий)",
      toner_exfoliant: "Тоник (эксфолиант)",
      toner_acid: "Тоник с кислотами",
      toner_aha: "Тоник с AHA",
      toner_bha: "Тоник с BHA",
      serum_hydrating: "Сыворотка (увлажняющая)",
      serum_niacinamide: "Сыворотка (ниацинамид)",
      serum_vitc: "Сыворотка (витамин C)",
      serum_anti_redness: "Сыворотка (против покраснений)",
      serum_brightening_soft: "Сыворотка (осветляющая)",
      serum_peptide: "Сыворотка (пептиды)",
      serum_antiage: "Сыворотка (anti-age)",
      serum_exfoliant: "Сыворотка (эксфолиант)",
      treatment_acne_bpo: "Лечение акне (BPO)",
      treatment_acne_azelaic: "Лечение акне (азелаиновая кислота)",
      treatment_acne_local: "Лечение акне (точечное)",
      treatment_exfoliant_mild: "Эксфолиант (мягкий)",
      treatment_exfoliant_strong: "Эксфолиант (сильный)",
      treatment_acid: "Кислотный уход",
      treatment_pigmentation: "Лечение пигментации",
      treatment_antiage: "Антиэйдж",
      moisturizer_light: "Увлажнение (легкое)",
      moisturizer_balancing: "Увлажнение (балансирующее)",
      moisturizer_barrier: "Увлажнение (барьерное)",
      moisturizer_soothing: "Увлажнение (успокаивающее)",
      eye_cream_basic: "Крем для век",
      eye_cream_dark_circles: "Крем для век (темные круги)",
      eye_cream_puffiness: "Крем для век (отеки)",
      spf_50_face: "SPF 50",
      spf_50_oily: "SPF 50 (для жирной кожи)",
      spf_50_sensitive: "SPF 50 (для чувствительной кожи)",
      mask_clay: "Маска (глиняная)",
      mask_hydrating: "Маска (увлажняющая)",
      mask_soothing: "Маска (успокаивающая)",
      mask_sleeping: "Маска (ночная)",
      mask_enzyme: "Маска (энзимная)",
      mask_acid: "Маска с кислотами",
      mask_peel: "Пилинг-маска",
      spot_treatment: "Точечное лечение",
      lip_care: "Уход за губами",
      balm_barrier_repair: "Бальзам (восстановление барьера)",
    };
    return basicLabels[cat] || cat;
  };

  const base = baseDescriptions[stepCategory] || {
    name: getBasicStepName(stepCategory),
    subtitle: "Важный этап ухода за кожей",
    defaultTags: [],
  };

  // Динамически добавляем теги на основе проблем кожи
  const tags = [...base.defaultTags];
  if (hasAcne && !tags.some(t => t.includes('акне'))) {
    if (stepCategory.includes('cleanser') || stepCategory.includes('toner') || stepCategory.includes('serum')) {
      tags.push("подходит при акне");
    }
  }
  if (hasSensitivity && (stepCategory.includes('gentle') || stepCategory.includes('soothing'))) {
    if (!tags.some(t => t.includes('чувствительной'))) {
      tags.push("для чувствительной кожи");
    }
  }

  return {
    name: base.name,
    subtitle: base.subtitle,
    tags: tags.slice(0, 3), // Максимум 3 тега
  };
}

// Функция для получения человекочитаемого названия шага
export function getStepCategoryLabel(stepCategory: StepCategory): string {
  // Используем getStepDescription для совместимости, но возвращаем только имя
  return getStepDescription(stepCategory).name;
}
