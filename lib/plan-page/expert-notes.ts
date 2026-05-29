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
): ExpertNote[] {
  const phase = getPhaseForDay(currentDay);
  const phaseTips = DAILY_TIPS.filter((t) => t.phase === phase);

  const goalSet = new Set(mainGoals);

  const goalSpecific = phaseTips.filter(
    (t) => t.goalKey !== null && goalSet.has(t.goalKey),
  );
  const universal = phaseTips.filter((t) => t.goalKey === null);

  // Объединяем приоритезированно. Дедупликация по id.
  const pool = uniqueById([...goalSpecific, ...universal]);
  if (pool.length === 0) return [];

  // Детерминированный сдвиг по дню — каждый день первый виден другой совет.
  const offset = (currentDay - 1) % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];

  return rotated.slice(0, 2).map((tip, idx) => ({
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
