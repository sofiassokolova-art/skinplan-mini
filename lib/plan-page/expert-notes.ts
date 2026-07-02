// lib/plan-page/expert-notes.ts
// Выбор "Советов дерматолога" под текущую фазу + цели плана пользователя.

import type { GoalKey } from '@/lib/concern-taxonomy';
import { getPhaseForDay } from '@/lib/plan-formatters';
import { DAILY_TIPS, type DailyTip } from './daily-tips-data';
import type { ExpertNote } from './types';

/**
 * Возвращает 2 совета для текущего дня плана.
 *
 * Алгоритм (без сложной логики):
 *   1. Берём все советы для текущей фазы.
 *   2. Сначала добавляем те, у которых goalKey совпадает с любой из mainGoals.
 *   3. Потом добавляем универсальные (goalKey === null) до набора в 2.
 *   4. Чтобы один и тот же совет не показывался день за днём, выбор
 *      «детерминированный по дню»: index = currentDay % candidates.length.
 *
 * Это даёт ощущение «свежий совет каждый день», без БД и без сложного state.
 */
export function pickExpertNotes(
  currentDay: number,
  mainGoals: GoalKey[],
  planStepCategories: string[] = [],
): ExpertNote[] {
  const phase = getPhaseForDay(currentDay);

  // Совет, привязанный к средству (requiresStepPrefix), показываем только если
  // в плане реально есть такой шаг. Иначе пользователь читает совет про сыворотку/
  // ретинол, которых у него нет (частая жалоба на рассинхрон совета и плана).
  const stepMatchesPrefix = (prefix: string): boolean =>
    planStepCategories.some((s) => s.startsWith(prefix));

  const phaseTips = DAILY_TIPS.filter(
    (t) =>
      t.phase === phase &&
      (t.requiresStepPrefix === undefined || stepMatchesPrefix(t.requiresStepPrefix)),
  );

  const goalSet = new Set(mainGoals);

  const goalSpecific = phaseTips.filter(
    (t) => t.goalKey !== null && goalSet.has(t.goalKey),
  );
  const universal = phaseTips.filter((t) => t.goalKey === null);

  // Детерминированный сдвиг по дню — «свежий совет каждый день». Ротируем ВНУТРИ
  // каждой группы отдельно, а не по всему пулу: иначе при малом числе goal-specific
  // советов (напр. после фильтра по шагам плана остался один) ротация всего пула
  // выталкивала его за топ-2, и целевой совет пропадал. Сначала goal-specific, потом
  // универсальные — приоритет целевых сохраняется.
  const rotate = (arr: DailyTip[]): DailyTip[] => {
    if (arr.length === 0) return arr;
    const offset = (currentDay - 1) % arr.length;
    return [...arr.slice(offset), ...arr.slice(0, offset)];
  };

  const pool = uniqueById([...rotate(goalSpecific), ...rotate(universal)]);
  if (pool.length === 0) return [];

  return pool.slice(0, 2).map((tip, idx) => ({
    number: String(idx + 1).padStart(2, '0'),
    title: tip.title,
    text: tip.text,
  }));
}

function uniqueById(tips: DailyTip[]): DailyTip[] {
  const seen = new Set<string>();
  const out: DailyTip[] = [];
  for (const t of tips) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}
