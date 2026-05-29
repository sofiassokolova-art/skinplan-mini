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
export type SeasonalProfile = 'summer_oilier' | 'winter_drier' | 'stable' | null;

/** Текущий сезон в северном полушарии (RU/EU/US). */
export function currentSeason(date: Date = new Date()): Season {
  const m = date.getMonth(); // 0-11
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

/** Нормализует свободный ответ анкеты на тип реакции кожи к сезонам. */
export function normalizeSeasonalProfile(raw: unknown): SeasonalProfile {
  if (!raw) return null;
  const s = String(raw).toLowerCase().trim();
  if (s.includes('winter_drier') || s.includes('зимой') || s.includes('сух')) return 'winter_drier';
  if (s.includes('summer_oilier') || s.includes('летом') || s.includes('жирн')) return 'summer_oilier';
  if (s.includes('stable') || s.includes('стабил') || s.includes('не меняется')) return 'stable';
  return null;
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
  seasonalProfile: SeasonalProfile,
  now: Date = new Date(),
): { steps: StepCategory[]; appliedReasons: string[] } {
  const season = currentSeason(now);
  const appliedReasons: string[] = [];

  // Применяем зимнюю адаптацию, если: сейчас зима И профиль winter_drier (или null — берём как safe default).
  const useWinter = season === 'winter' && (seasonalProfile === 'winter_drier' || seasonalProfile === null);
  // Летнюю адаптацию, если сейчас лето И профиль summer_oilier.
  const useSummer = season === 'summer' && seasonalProfile === 'summer_oilier';

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
