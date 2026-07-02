// lib/seasonality.ts
// P1.2: Сезонная адаптация плана.
//
// До этого `seasonal_changes` собирался из анкеты, но в downstream он не влиял на шаги:
// зимой и летом план был идентичным. На массе с разнообразной географией это создавало
// два регрессных сценария:
//  - зимой пользователь с сухой/чувствительной кожей получал moisturizer_light + кислоты
//    как «адаптация», что усугубляло шелушение и нарушение барьера;
//  - летом пользователь с жирной кожей получал moisturizer_barrier и плотные текстуры,
//    что вело к комедонам.
//
// Этот модуль преобразует список StepCategory в сезонно-адаптированный, не меняя
// общую структуру рутины (порядок, количество шагов).

import type { StepCategory } from './step-category-rules';

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

/**
 * Флаги сезонной реакции кожи. Вопрос `seasonal_changes` стал multi_choice:
 * «летом жирнее» и «зимой суше» — НЕ взаимоисключающие (самый частый кейс).
 * Поэтому храним оба флага и применяем нужный по текущему сезону, а не сводим
 * к одному enum (раньше комбо терялось — оставался только первый выбор).
 */
export interface SeasonalProfileFlags {
  summerOilier: boolean;
  winterDrier: boolean;
  stable: boolean;
}

/** Текущий сезон в северном полушарии (RU/EU/US). */
export function currentSeason(date: Date = new Date()): Season {
  const m = date.getMonth(); // 0-11
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

/**
 * Нормализует ответ анкеты (строка ИЛИ массив для multi_choice) в флаги.
 * Принимает как коды (`summer_oilier`), так и русские лейблы («Летом жирнее»).
 */
export function normalizeSeasonalProfile(raw: unknown): SeasonalProfileFlags {
  const items: string[] = Array.isArray(raw)
    ? raw.map((v) => String(v))
    : raw == null ? [] : [String(raw)];
  const flags: SeasonalProfileFlags = { summerOilier: false, winterDrier: false, stable: false };
  for (const item of items) {
    const s = item.toLowerCase().trim();
    if (!s) continue;
    if (s.includes('winter_drier') || s.includes('зимой') || s.includes('сух')) flags.winterDrier = true;
    if (s.includes('summer_oilier') || s.includes('летом') || s.includes('жирн')) flags.summerOilier = true;
    if (s.includes('stable') || s.includes('стабил') || s.includes('одинаков') || s.includes('не меняется')) flags.stable = true;
  }
  return flags;
}

interface SeasonAdjustment {
  // Что заменяем: StepCategory или его префикс.
  matches: (step: StepCategory) => boolean;
  // Возвращает заменённый StepCategory (или тот же — если замена не нужна).
  replace: (step: StepCategory) => StepCategory;
  // Текстовое описание для логов/UI.
  reason: string;
}

const WINTER_ADJUSTMENTS: SeasonAdjustment[] = [
  {
    matches: s => s === 'moisturizer_light',
    replace: () => 'moisturizer_barrier' as StepCategory,
    reason: 'Зимой барьер сильнее теряет влагу — используем более плотный увлажняющий',
  },
  {
    matches: s => s === 'moisturizer_balancing',
    replace: () => 'moisturizer_barrier' as StepCategory,
    reason: 'Зимой смещаемся к барьерному уходу',
  },
];

const SUMMER_ADJUSTMENTS: SeasonAdjustment[] = [
  {
    matches: s => s === 'moisturizer_barrier',
    replace: () => 'moisturizer_light' as StepCategory,
    reason: 'Летом — лёгкая текстура, чтобы не провоцировать комедоны',
  },
];

/**
 * Применяет сезонную корректировку к списку шагов рутины.
 * Не меняет длину массива и порядок шагов — только подменяет конкретные StepCategory.
 *
 * @param steps - исходные шаги
 * @param seasonalProfile - как кожа меняется по сезонам (из анкеты)
 * @param now - текущая дата (для определения календарного сезона)
 * @returns шаги после адаптации + список применённых причин (для warnings)
 */
export function applySeasonalAdjustment(
  steps: StepCategory[],
  seasonalProfile: SeasonalProfileFlags,
  now: Date = new Date(),
): { steps: StepCategory[]; appliedReasons: string[] } {
  const season = currentSeason(now);
  const appliedReasons: string[] = [];

  // Нет явного сигнала (ничего не выбрано) — безопасный дефолт: зимой уплотняем уход.
  const noSignal = !seasonalProfile.summerOilier && !seasonalProfile.winterDrier && !seasonalProfile.stable;
  // Зимняя адаптация: сейчас зима И (кожа «зимой суше» ИЛИ сигнала нет).
  const useWinter = season === 'winter' && (seasonalProfile.winterDrier || noSignal);
  // Летняя адаптация: сейчас лето И кожа «летом жирнее».
  const useSummer = season === 'summer' && seasonalProfile.summerOilier;

  if (!useWinter && !useSummer) {
    return { steps, appliedReasons };
  }

  const adjustments = useWinter ? WINTER_ADJUSTMENTS : SUMMER_ADJUSTMENTS;

  const adjusted = steps.map(step => {
    for (const adj of adjustments) {
      if (adj.matches(step)) {
        const next = adj.replace(step);
        if (next !== step) {
          appliedReasons.push(adj.reason);
        }
        return next;
      }
    }
    return step;
  });

  return { steps: adjusted, appliedReasons: Array.from(new Set(appliedReasons)) };
}
