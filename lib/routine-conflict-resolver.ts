// lib/routine-conflict-resolver.ts
// P1: разведение несовместимых активов внутри одной рутины (один и тот же прием).

import {
  checkProductCompatibility,
  extractActiveIngredients,
  type ActiveIngredient,
  type IngredientConflict,
} from './ingredient-compatibility';
import type { DayStep, Plan28 } from './plan-types';
import { getInvariantBase, type PlanInvariantProduct } from './plan-invariants';

export type ConflictRoutine = 'morning' | 'evening';

export interface RoutineConflictResolution {
  dayIndex: number;
  routine: ConflictRoutine;
  action: 'replaced' | 'removed' | 'unresolved';
  stepCategory: string;
  removedProductId?: string;
  removedProductName?: string;
  replacementProductId?: string;
  keptProductId?: string;
  keptProductName?: string;
  reason: string;
}

export interface ResolveRoutineConflictsResult {
  resolutions: RoutineConflictResolution[];
  warnings: string[];
  mediumConflicts: string[];
}

const ACTIVE_PRIORITY: Partial<Record<ActiveIngredient, number>> = {
  tretinoin: 100,
  adapalene: 95,
  retinoid: 90,
  retinol: 90,
  benzoyl_peroxide: 70,
  ascorbic_acid: 60,
  vitamin_c: 60,
  azelaic_acid: 55,
  bha: 45,
  salicylic_acid: 45,
  aha: 40,
  glycolic_acid: 40,
  lactic_acid: 38,
  mandelic_acid: 36,
  pha: 30,
  niacinamide: 25,
  tranexamic_acid: 25,
  arbutin: 22,
  kojic_acid: 22,
  sulfur: 20,
  peptides: 15,
  ceramides: 10,
  hyaluronic_acid: 10,
};

const PROTECTED_BASES = new Set(['cleanser', 'moisturizer', 'spf']);

const SLOT_KEEP_RANK: Record<string, number> = {
  serum: 3,
  treatment: 3,
  spot_treatment: 3,
  eye_cream: 2,
  toner: 1,
  mask: 0,
};

function slotKeepRank(stepCategory: string): number {
  const base = getInvariantBase(stepCategory);
  if (base && base in SLOT_KEEP_RANK) return SLOT_KEEP_RANK[base];
  return 1;
}

function isProtectedStep(stepCategory: string): boolean {
  const base = getInvariantBase(stepCategory);
  return base !== null && PROTECTED_BASES.has(base);
}

function productPriority(product: PlanInvariantProduct): number {
  const ingredients = extractActiveIngredients({
    activeIngredients: product.activeIngredients ?? undefined,
  });
  let max = 0;
  for (const ing of ingredients) {
    max = Math.max(max, ACTIVE_PRIORITY[ing] ?? 0);
  }
  return max;
}

interface SlotEntry {
  step: DayStep;
  index: number;
  productId: string;
  product: PlanInvariantProduct;
}

function collectEntries(
  steps: DayStep[],
  productsMap: Map<string, PlanInvariantProduct>
): SlotEntry[] {
  const entries: SlotEntry[] = [];
  steps.forEach((step, index) => {
    if (!step?.productId) return;
    const productId = String(step.productId);
    const product = productsMap.get(productId);
    if (!product) return;
    entries.push({ step, index, productId, product });
  });
  return entries;
}

function toCompatInput(product: PlanInvariantProduct) {
  return { activeIngredients: product.activeIngredients ?? undefined };
}

function findConflictPair(
  entries: SlotEntry[],
  severity: IngredientConflict['severity']
): { a: SlotEntry; b: SlotEntry; conflict: IngredientConflict } | null {
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].productId === entries[j].productId) continue;
      const conflict = checkProductCompatibility(
        toCompatInput(entries[i].product),
        toCompatInput(entries[j].product)
      );
      if (conflict && conflict.severity === severity) {
        return { a: entries[i], b: entries[j], conflict };
      }
    }
  }
  return null;
}

function pickVictim(a: SlotEntry, b: SlotEntry): { victim: SlotEntry; kept: SlotEntry } | null {
  const aProtected = isProtectedStep(a.step.stepCategory);
  const bProtected = isProtectedStep(b.step.stepCategory);
  if (aProtected && bProtected) return null;
  if (aProtected) return { victim: b, kept: a };
  if (bProtected) return { victim: a, kept: b };

  const aPriority = productPriority(a.product);
  const bPriority = productPriority(b.product);
  if (aPriority !== bPriority) {
    return aPriority < bPriority ? { victim: a, kept: b } : { victim: b, kept: a };
  }

  const aRank = slotKeepRank(a.step.stepCategory);
  const bRank = slotKeepRank(b.step.stepCategory);
  if (aRank !== bRank) {
    return aRank < bRank ? { victim: a, kept: b } : { victim: b, kept: a };
  }

  return a.index > b.index ? { victim: a, kept: b } : { victim: b, kept: a };
}

function normalizeAlternativeId(raw: unknown): string {
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
  if (!raw || typeof raw !== 'object') return '';
  const value = raw as { productId?: unknown; id?: unknown };
  return String(value.productId ?? value.id ?? '');
}

function findSafeAlternative(
  victim: SlotEntry,
  others: SlotEntry[],
  productsMap: Map<string, PlanInvariantProduct>
): string | null {
  const alternatives = Array.isArray(victim.step.alternatives) ? victim.step.alternatives : [];
  const usedIds = new Set(others.map((e) => e.productId));

  for (const raw of alternatives) {
    const altId = normalizeAlternativeId(raw);
    if (!altId || altId === victim.productId || usedIds.has(altId)) continue;
    const altProduct = productsMap.get(altId);
    if (!altProduct) continue;

    const hasConflict = others.some((other) => {
      const conflict = checkProductCompatibility(
        toCompatInput(altProduct),
        toCompatInput(other.product)
      );
      return conflict?.severity === 'high';
    });
    if (!hasConflict) return altId;
  }

  return null;
}

export function resolveIntraRoutineConflicts(
  plan: Plan28,
  productsMap: Map<string, PlanInvariantProduct>
): ResolveRoutineConflictsResult {
  const resolutions: RoutineConflictResolution[] = [];
  const warnings: string[] = [];
  const mediumConflicts: string[] = [];
  const routines: ConflictRoutine[] = ['morning', 'evening'];

  for (const day of plan.days ?? []) {
    for (const routine of routines) {
      const steps = Array.isArray(day[routine]) ? day[routine] : [];
      if (steps.length < 2) continue;

      const maxIterations = steps.length * 4;
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const entries = collectEntries(day[routine], productsMap);
        const pair = findConflictPair(entries, 'high');
        if (!pair) break;

        const { a, b, conflict } = pair;
        const picked = pickVictim(a, b);
        if (!picked) {
          const message =
            `Day ${day.dayIndex} (${routine}): неразрешимый конфликт активов между ` +
            `"${a.product.name ?? a.productId}" и "${b.product.name ?? b.productId}" ` +
            `(оба в защищенных базовых шагах): ${conflict.reason}`;
          resolutions.push({
            dayIndex: day.dayIndex,
            routine,
            action: 'unresolved',
            stepCategory: `${a.step.stepCategory}+${b.step.stepCategory}`,
            reason: conflict.reason,
          });
          warnings.push(message);
          break;
        }

        const { victim, kept } = picked;
        const others = entries.filter((e) => e !== victim);
        const replacementId = findSafeAlternative(victim, others, productsMap);

        if (replacementId) {
          victim.step.productId = replacementId;
          resolutions.push({
            dayIndex: day.dayIndex,
            routine,
            action: 'replaced',
            stepCategory: String(victim.step.stepCategory),
            removedProductId: victim.productId,
            removedProductName: victim.product.name ?? undefined,
            replacementProductId: replacementId,
            keptProductId: kept.productId,
            keptProductName: kept.product.name ?? undefined,
            reason: conflict.reason,
          });
          warnings.push(
            `Day ${day.dayIndex} (${routine}): конфликт активов - ` +
              `"${victim.product.name ?? victim.productId}" заменен на альтернативу ` +
              `#${replacementId} рядом с "${kept.product.name ?? kept.productId}" (${conflict.reason})`
          );
          continue;
        }

        const list = day[routine] as DayStep[];
        const position = list.indexOf(victim.step);
        if (position >= 0) list.splice(position, 1);

        resolutions.push({
          dayIndex: day.dayIndex,
          routine,
          action: 'removed',
          stepCategory: String(victim.step.stepCategory),
          removedProductId: victim.productId,
          removedProductName: victim.product.name ?? undefined,
          keptProductId: kept.productId,
          keptProductName: kept.product.name ?? undefined,
          reason: conflict.reason,
        });
        warnings.push(
          `Day ${day.dayIndex} (${routine}): конфликт активов - шаг ${victim.step.stepCategory} ` +
            `("${victim.product.name ?? victim.productId}") убран из дня, оставлен ` +
            `"${kept.product.name ?? kept.productId}" (${conflict.reason})`
        );
      }

      const mediumPair = findConflictPair(collectEntries(day[routine], productsMap), 'medium');
      if (mediumPair) {
        mediumConflicts.push(
          `Day ${day.dayIndex} (${routine}): MEDIUM конфликт между ` +
            `"${mediumPair.a.product.name ?? mediumPair.a.productId}" и ` +
            `"${mediumPair.b.product.name ?? mediumPair.b.productId}": ${mediumPair.conflict.reason}`
        );
      }
    }
  }

  return { resolutions, warnings, mediumConflicts };
}

export function findIntraRoutineConflicts(
  plan: Plan28,
  productsMap: Map<string, PlanInvariantProduct>
): Array<{ dayIndex: number; routine: ConflictRoutine; message: string }> {
  const found: Array<{ dayIndex: number; routine: ConflictRoutine; message: string }> = [];
  const routines: ConflictRoutine[] = ['morning', 'evening'];

  for (const day of plan.days ?? []) {
    for (const routine of routines) {
      const entries = collectEntries(
        Array.isArray(day[routine]) ? day[routine] : [],
        productsMap
      );
      const pair = findConflictPair(entries, 'high');
      if (!pair) continue;
      found.push({
        dayIndex: day.dayIndex,
        routine,
        message:
          `Day ${day.dayIndex} (${routine}): high-severity ingredient conflict in the same routine ` +
          `between "${pair.a.product.name ?? pair.a.productId}" and ` +
          `"${pair.b.product.name ?? pair.b.productId}": ${pair.conflict.reason}`,
      });
    }
  }

  return found;
}
