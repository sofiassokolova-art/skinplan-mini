// lib/plan-invariants.ts
// Детекция инвариантов «слот ↔ продукт» в готовом plan28.
//
// Прод-аудит 20.07.2026 выявил класс багов, которые не были видны без ручного
// разбора данных: сыворотки в слоте balm_barrier_repair, SPF в слоте очищения,
// кислотный тонер в toner_hydrating/toner_soothing, один продукт дважды в одной
// рутине. Этот модуль — систематический маяк: проверяет ФИНАЛЬНЫЙ план перед
// возвратом из генератора и отдаёт список нарушений. Нарушения НЕ блокируют
// выдачу плана — генератор логирует их warn'ом с saveToDb, чтобы новые баги
// подбора были видны в client_logs сразу, а не через месяцы.
//
// ВАЖНО: та же логика продублирована в SQL в scripts/audit-plan-invariants.ts
// (периодический прогон по всем планам в проде). При изменении правил здесь —
// синхронизировать regex'ы/CASE там.

import type { Plan28 } from './plan-types';

export type PlanInvariantIssue =
  | 'base_mismatch'      // базовый тип слота != базовый тип продукта (serum в balm-слоте, SPF в cleanser)
  | 'acid_in_soft_slot'  // кислота/эксфолиант/ретиноид в soothing/hydrating/barrier/gentle-слоте
  | 'dup_in_routine'     // один productId дважды внутри morning/evening/weekly одного дня
  | 'empty_step';        // шаг без productId и без manualLabel — юзер видит пустую строку

export interface PlanInvariantProduct {
  id: number | string;
  name?: string | null;
  step?: string | null;
  activeIngredients?: string[] | null;
}

export interface PlanInvariantViolation {
  issue: PlanInvariantIssue;
  dayIndex: number;
  routine: 'morning' | 'evening' | 'weekly';
  stepCategory: string;
  productId?: string;
  productName?: string;
  productStep?: string;
  detail: string;
}

// Базовые типы в порядке проверки префиксов. eye_cream/spot_treatment/lip_care —
// до односложных, чтобы 'eye_cream_basic' не провалился в общий fallback.
// НЕ используем getStepTypeFromCategory: её дефолт (unknown → SERUM) маскирует
// ровно тот баг, который ищем (balm_barrier_repair → SERUM → serum-продукт
// в balm-слоте выглядел бы «валидным»).
const KNOWN_BASES = [
  'eye_cream',
  'spot_treatment',
  'lip_care',
  'cleanser',
  'toner',
  'serum',
  'treatment',
  'moisturizer',
  'spf',
  'mask',
  'balm',
] as const;

// Пары «слот ← продукт другого базового типа», которые НЕ считаем нарушением:
// - balm ↔ moisturizer: barrier-кремы и бальзамы взаимозаменяемы (isMoisturizerStep
//   в plan-helpers.ts тоже считает balm_ увлажнением);
// - treatment ← serum/spot_treatment: mapStepToStepCategory сознательно маппит
//   serum_exfoliant и spot-средства в treatment-категории;
// - mask ← treatment: пилинги-treatment легитимно закрывают weekly-слоты масок.
const ALLOWED_CROSS_BASE: Partial<Record<string, readonly string[]>> = {
  balm: ['moisturizer'],
  moisturizer: ['balm'],
  treatment: ['serum', 'spot_treatment'],
  spot_treatment: ['treatment'],
  mask: ['treatment'],
};

// «Мягкие» слоты, куда не должны попадать кислоты/эксфолианты/ретиноиды.
const SOFT_SLOT_RE = /(soothing|hydrating|barrier|gentle)/;

// Кислотность по step продукта (после normalizeBaseInput): токен в начале сегмента,
// чтобы не матчить случайные вхождения.
const ACID_STEP_RE = /(^|_)(aha|bha|pha|acid|exfoliant|peel|retin)/;

// Кислотность по activeIngredients. Подстроки без границ — только однозначные
// (glycolic не встретится внутри безобидного слова); aha/bha/pha/lactic —
// строго как отдельный токен, иначе матчатся hyaluronic/alpha-arbutin и т.п.
const ACID_INGREDIENT_RE =
  /(glycolic|гликол|salicyl|салицил|mandelic|миндал|tretinoin|третиноин|adapalene|адапален|retinoid|retinol|retinal|ретин)/i;
const ACID_INGREDIENT_TOKEN_RE = /(^|[^a-zа-яё])(aha|bha|pha|lactic|молочная)([^a-zа-яё]|$)/i;

function normalizeBaseInput(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw).toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
}

/**
 * Базовый тип слота/продукта по префиксу строки (stepCategory или product.step).
 * null = не удалось определить (проверка base_mismatch тогда пропускается).
 */
export function getInvariantBase(raw: string | null | undefined): string | null {
  const s = normalizeBaseInput(raw);
  if (!s) return null;
  for (const base of KNOWN_BASES) {
    if (s === base || s.startsWith(base + '_')) return base;
  }
  // Синонимы из БД: step бывает 'cream', 'sunscreen', 'lip', 'eye'
  if (/(^|_)(sunscreen)(_|$)/.test(s)) return 'spf';
  if (/(^|_)(cream)(_|$)/.test(s) || s.includes('cream')) return 'moisturizer';
  if (s.startsWith('lip')) return 'lip_care';
  if (s.startsWith('eye')) return 'eye_cream';
  return null;
}

function isAcidProduct(product: PlanInvariantProduct): boolean {
  if (ACID_STEP_RE.test(normalizeBaseInput(product.step))) return true;
  const ingredients = product.activeIngredients ?? [];
  return ingredients.some(
    (ai) => ACID_INGREDIENT_RE.test(ai) || ACID_INGREDIENT_TOKEN_RE.test(ai)
  );
}

function isCrossBaseAllowed(slotBase: string, productBase: string): boolean {
  if (slotBase === productBase) return true;
  return (ALLOWED_CROSS_BASE[slotBase] ?? []).includes(productBase);
}

/**
 * Проверяет финальный plan28 на инварианты «слот ↔ продукт».
 * Возвращает список нарушений; ничего не мутирует и не бросает.
 */
export function validatePlanInvariants(
  plan: Plan28,
  productsMap: Map<string, PlanInvariantProduct>
): PlanInvariantViolation[] {
  const violations: PlanInvariantViolation[] = [];
  const routines = ['morning', 'evening', 'weekly'] as const;

  for (const day of plan.days ?? []) {
    for (const routine of routines) {
      const steps = Array.isArray(day[routine]) ? day[routine] : [];
      const productIdCounts = new Map<string, string[]>(); // productId → stepCategories

      for (const step of steps) {
        const stepCategory = String(step.stepCategory ?? '');
        const productId = step.productId ? String(step.productId) : null;

        if (!productId) {
          if (!step.manualLabel) {
            violations.push({
              issue: 'empty_step',
              dayIndex: day.dayIndex,
              routine,
              stepCategory,
              detail: `шаг без productId и без manualLabel`,
            });
          }
          continue;
        }

        const cats = productIdCounts.get(productId) ?? [];
        cats.push(stepCategory);
        productIdCounts.set(productId, cats);

        const product = productsMap.get(productId);
        if (!product) continue; // нет данных о продукте — base/acid проверки невозможны

        const slotBase = getInvariantBase(stepCategory);
        const productBase = getInvariantBase(product.step);
        if (slotBase && productBase && !isCrossBaseAllowed(slotBase, productBase)) {
          violations.push({
            issue: 'base_mismatch',
            dayIndex: day.dayIndex,
            routine,
            stepCategory,
            productId,
            productName: product.name ?? undefined,
            productStep: product.step ?? undefined,
            detail: `слот ${slotBase} ← продукт ${productBase}`,
          });
        }

        if (SOFT_SLOT_RE.test(stepCategory) && isAcidProduct(product)) {
          violations.push({
            issue: 'acid_in_soft_slot',
            dayIndex: day.dayIndex,
            routine,
            stepCategory,
            productId,
            productName: product.name ?? undefined,
            productStep: product.step ?? undefined,
            detail: `кислота/эксфолиант в мягком слоте`,
          });
        }
      }

      for (const [productId, cats] of productIdCounts) {
        if (cats.length > 1) {
          const product = productsMap.get(productId);
          violations.push({
            issue: 'dup_in_routine',
            dayIndex: day.dayIndex,
            routine,
            stepCategory: cats.join('+'),
            productId,
            productName: product?.name ?? undefined,
            productStep: product?.step ?? undefined,
            detail: `продукт ${cats.length} раза в одной рутине`,
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Компактная сводка для лога: группировка по (issue, слот, продукт) с числом дней.
 * 28 одинаковых нарушений по дням схлопываются в одну строку с days=28.
 */
export function summarizePlanInvariantViolations(
  violations: PlanInvariantViolation[]
): Array<{ issue: PlanInvariantIssue; pattern: string; days: number }> {
  const groups = new Map<string, { issue: PlanInvariantIssue; pattern: string; days: Set<number> }>();
  for (const v of violations) {
    const pattern = `${v.routine}/${v.stepCategory} ← ${v.productStep ?? '?'} #${v.productId ?? '-'}${v.productName ? ` (${v.productName})` : ''}`;
    const key = `${v.issue}|${pattern}`;
    const g = groups.get(key) ?? { issue: v.issue, pattern, days: new Set<number>() };
    g.days.add(v.dayIndex);
    groups.set(key, g);
  }
  return Array.from(groups.values())
    .map((g) => ({ issue: g.issue, pattern: g.pattern, days: g.days.size }))
    .sort((a, b) => b.days - a.days);
}
