// lib/focus-keys.ts
// Нормализация человекочитаемых лейблов целей/беспокойств анкеты в канонические
// «фокусы», и маппинг фокусов в mainGoals (GoalKey).
//
// Зачем: answers.skin_goals/skin_concerns хранятся КОДАМИ опций ("skin_concerns_5"),
// а исходная логика матчила по русским ЛЕЙБЛАМ точным includes() — сигналы (особенно
// возрастные) молча терялись. Здесь матчинг терпимый (подстроки/регистр) и покрыт
// юнит-тестами (tests/focus-keys.test.ts), чтобы зафиксировать поведение регрессией.

import type { GoalKey } from './concern-taxonomy';

/** Канонические фокусы, выводимые из лейблов целей/беспокойств. */
export type FocusKey =
  | 'acne'
  | 'pores'
  | 'oiliness'
  | 'pigmentation'
  | 'wrinkles'
  | 'dehydration'
  | 'barrier'
  | 'dark_circles';

/**
 * Сопоставляет лейблы целей/беспокойств с каноническими фокусами.
 * Терпимо к фразам («Сократить морщины и мелкие линии», «Сделать поры менее заметными»)
 * и регистру. Возвращает Set<string> (а не Set<FocusKey>) для удобной интеграции с
 * местами, где ключи приходят как строки.
 */
export function deriveFocusKeys(labels: Array<string | null | undefined>): Set<string> {
  const keys = new Set<string>();
  for (const raw of labels) {
    const l = String(raw ?? '').toLowerCase();
    if (/акне|высыпан|прыщ|acne/.test(l)) keys.add('acne');
    if (/пор[ыа]|менее заметн|pores/.test(l)) keys.add('pores');
    if (/жирн|блеск|сальн|oili/.test(l)) keys.add('oiliness');
    if (/пигмент|неровн|выровнять тон|пятн|pigment/.test(l)) keys.add('pigmentation');
    if (/морщин|возраст|старени|мелкие лини|antiage|wrinkle/.test(l)) keys.add('wrinkles');
    if (/сухост|стянут|обезвож|dry|dehydr/.test(l)) keys.add('dehydration');
    if (/чувствит|покраснен|раздраж|барьер|sensitiv|redness|barrier/.test(l)) keys.add('barrier');
    if (/вокруг глаз|тёмные круг|темные круг|круги|dark circ/.test(l)) keys.add('dark_circles');
  }
  return keys;
}

/**
 * Маппинг фокуса → mainGoal. `oiliness` намеренно не имеет цели (жирность лечится
 * через тип кожи/шаблон, а не отдельной целью плана).
 */
export const FOCUS_TO_GOAL: Record<string, GoalKey> = {
  acne: 'acne',
  pores: 'pores',
  pigmentation: 'pigmentation',
  wrinkles: 'antiage',
  dehydration: 'dehydration',
  barrier: 'barrier',
  dark_circles: 'dark_circles',
};

/**
 * Возвращает цели, которых ещё нет в `existing`, выведенные из focusKeys.
 * Аддитивно: ничего не убирает, только добавляет недостающее (стабильный порядок,
 * без дублей). Логирование оставлено вызывающей стороне.
 */
export function goalsFromFocusKeys(focusKeys: Set<string>, existing: GoalKey[]): GoalKey[] {
  const added: GoalKey[] = [];
  for (const key of focusKeys) {
    const goal = FOCUS_TO_GOAL[key];
    if (goal && !existing.includes(goal) && !added.includes(goal)) {
      added.push(goal);
    }
  }
  return added;
}
