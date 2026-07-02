// lib/admin-broadcast-filters.ts
// Маппинг значений фильтра «Тип кожи» из админки (broadcast) в реальные значения
// SkinProfile в БД. В админке опции — oily/dry/combo/sensitive/normal, а в БД
// skinType хранится как combination_dry/combination_oily (не «combo»), и «sensitive»
// вообще не тип кожи, а sensitivityLevel. Из-за прямого `skinType IN [combo,sensitive]`
// комбинированные и чувствительные пользователи не попадали в выборку рассылки.

import type { Prisma } from '@prisma/client';

// UI-значение → возможные значения SkinProfile.skinType в БД.
const SKIN_TYPE_DB_MAP: Record<string, string[]> = {
  oily: ['oily'],
  dry: ['dry'],
  combo: ['combination_dry', 'combination_oily', 'combo'], // 'combo' — на случай legacy-строк
  normal: ['normal'],
};

/**
 * Строит условие для `where.skinProfiles.some` по UI-значениям типа кожи.
 * - combo → combination_dry/combination_oily;
 * - sensitive → высокая чувствительность (sensitivityLevel), т.к. это отдельная ось,
 *   а не тип кожи;
 * - несколько выбранных значений объединяются через OR.
 * Возвращает null, если фильтровать не по чему.
 */
export function buildSkinTypeProfileCondition(
  uiSkinTypes: string[] | undefined | null
): Prisma.SkinProfileWhereInput | null {
  if (!uiSkinTypes || uiSkinTypes.length === 0) return null;

  const dbTypes = new Set<string>();
  let includeSensitive = false;

  for (const t of uiSkinTypes) {
    if (t === 'sensitive') {
      includeSensitive = true;
      continue;
    }
    for (const v of SKIN_TYPE_DB_MAP[t] || [t]) dbTypes.add(v);
  }

  const or: Prisma.SkinProfileWhereInput[] = [];
  if (dbTypes.size > 0) or.push({ skinType: { in: [...dbTypes] } });
  if (includeSensitive) or.push({ sensitivityLevel: { in: ['high', 'very_high'] } });

  if (or.length === 0) return null;
  return or.length === 1 ? or[0] : { OR: or };
}
