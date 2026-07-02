// lib/plan-page/product-context.ts
// Сборка карточек продуктов для блока "Фазы и средства".
//
// Источник: Plan28.planData.days[].morning/evening/weekly + Product/Cart/Wishlist/ProductReplacement.
// На выходе — список ProductCard с уже посчитанными состояниями, тегами фаз и firstPhase.

import type { Plan28, DayStep, PlanPhases } from '@/lib/plan-types';
import { getPhaseForDay, getPhaseLabel } from '@/lib/plan-formatters';
import type { ProductCard } from './types';

interface ProductRow {
  id: number;
  name: string;
  category: string | null;
  step: string | null;
  activeIngredients: string[];
  brand: { name: string } | null;
  price: number | null;
  imageUrl: string | null;
  description: string | null;
  descriptionUser: string | null;
}

interface BuildProductCardsInput {
  plan: Plan28;
  /** Все продукты, упомянутые в плане (включая пользовательские замены) */
  products: ProductRow[];
  /** productId, лежащие в корзине пользователя */
  cartProductIds: Set<number>;
  /** productId, лежащие в избранном */
  wishlistProductIds: Set<number>;
  /** Карта oldProductId → newProductId (пользовательские замены) */
  replacements: Map<number, number>;
}

interface ProductUsage {
  phases: Set<PlanPhases>;
  stepCategories: Set<string>;
  firstDay: number;
  firstPhase: PlanPhases;
  firstStepCategory: string | null;
  hasActiveStep: boolean;
}

interface ProductDraft {
  product: ProductRow;
  phases: Set<PlanPhases>;
  firstPhase: PlanPhases;
  alternativeIds: Set<number>;
  inCart: boolean;
  inWishlist: boolean;
  replacedFrom: boolean;
  orderDay: number;
  orderIndex: number;
}

/**
 * Главная функция: формирует список карточек продуктов для UI.
 */
export function buildProductCards(input: BuildProductCardsInput): ProductCard[] {
  const { plan, products, cartProductIds, wishlistProductIds, replacements } = input;
  const productsById = new Map(products.map((p) => [p.id, p]));

  // 1. Собираем usage по оригинальным productId: фазы, первый день, stepCategory.
  //    Важно: plan28 часто содержит весь набор на каждом дне, поэтому "первый день"
  //    сам по себе не различает базовый уход и активы.
  const usageByProductId = new Map<number, ProductUsage>();
  const altsByProductId = new Map<number, Set<number>>();
  const originalProductIds: number[] = [];
  const orderByProductId = new Map<number, number>();

  for (const day of plan.days) {
    const phase = getPhaseForDay(day.dayIndex);
    const allSteps: DayStep[] = [
      ...(day.morning ?? []),
      ...(day.evening ?? []),
      ...(day.weekly ?? []),
    ];

    for (const step of allSteps) {
      const pid = toProductId(step.productId);
      if (pid === null) continue;

      if (!orderByProductId.has(pid)) {
        orderByProductId.set(pid, originalProductIds.length);
        originalProductIds.push(pid);
      }

      const stepCategory = String(step.stepCategory ?? '');
      registerUsage(usageByProductId, pid, {
        dayIndex: day.dayIndex,
        phase,
        stepCategory,
        hasActiveStep: isActivePlanStep(step),
      });

      const altIds = (step.alternatives ?? [])
        .map(toProductId)
        .filter((id): id is number => id !== null && id !== pid);
      if (altIds.length > 0) {
        let altSet = altsByProductId.get(pid);
        if (!altSet) {
          altSet = new Set();
          altsByProductId.set(pid, altSet);
        }
        altIds.forEach((id) => altSet!.add(id));
      }
    }
  }

  // 2. Применяем пользовательские замены и схлопываем phase-swap продукты одного
  //    шага (например, два cleanser_balancing в разных фазах). Карточка остаётся
  //    одна — представитель самого раннего появления этого stepCategory.
  const draftsByGroupKey = new Map<string, ProductDraft>();

  for (const origId of originalProductIds) {
    const usage = usageByProductId.get(origId);
    if (!usage) continue;

    const productId = replacements.get(origId) ?? origId;
    const product = productsById.get(productId);
    if (!product) continue;

    const groupKey = getDisplayGroupKey(usage, origId);
    const draft: ProductDraft = {
      product,
      phases: new Set(usage.phases),
      firstPhase: resolveFirstPhase(usage, product),
      alternativeIds: new Set(altsByProductId.get(origId) ?? []),
      inCart: cartProductIds.has(productId),
      inWishlist: wishlistProductIds.has(productId),
      replacedFrom: replacements.has(origId),
      orderDay: usage.firstDay,
      orderIndex: orderByProductId.get(origId) ?? Number.MAX_SAFE_INTEGER,
    };

    const existing = draftsByGroupKey.get(groupKey);
    if (!existing) {
      draftsByGroupKey.set(groupKey, draft);
      continue;
    }

    mergeDraft(existing, draft);
    if (shouldUseDraftAsRepresentative(draft, existing)) {
      draftsByGroupKey.set(groupKey, {
        ...draft,
        phases: existing.phases,
        alternativeIds: existing.alternativeIds,
      });
    }
  }

  // 3. Финальные карточки в стабильном порядке: фаза → первый день → порядок в плане.
  return Array.from(draftsByGroupKey.values())
    .sort((a, b) =>
      phaseOrder(a.firstPhase) - phaseOrder(b.firstPhase)
      || a.orderDay - b.orderDay
      || a.orderIndex - b.orderIndex,
    )
    .map((draft) => buildSingleCard({
      product: draft.product,
      phases: draft.phases,
      firstPhase: draft.firstPhase,
      replacementsCount: draft.alternativeIds.size,
      inCart: draft.inCart,
      inWishlist: draft.inWishlist,
      replacedFrom: draft.replacedFrom,
    }));
}

function registerUsage(
  usageByProductId: Map<number, ProductUsage>,
  productId: number,
  occurrence: {
    dayIndex: number;
    phase: PlanPhases;
    stepCategory: string;
    hasActiveStep: boolean;
  },
): void {
  let usage = usageByProductId.get(productId);
  if (!usage) {
    usage = {
      phases: new Set(),
      stepCategories: new Set(),
      firstDay: occurrence.dayIndex,
      firstPhase: occurrence.phase,
      firstStepCategory: occurrence.stepCategory || null,
      hasActiveStep: occurrence.hasActiveStep,
    };
    usageByProductId.set(productId, usage);
  }

  usage.phases.add(occurrence.phase);
  if (occurrence.stepCategory) {
    usage.stepCategories.add(occurrence.stepCategory);
  }
  usage.hasActiveStep = usage.hasActiveStep || occurrence.hasActiveStep;

  if (occurrence.dayIndex < usage.firstDay) {
    usage.firstDay = occurrence.dayIndex;
    usage.firstPhase = occurrence.phase;
    usage.firstStepCategory = occurrence.stepCategory || null;
  }
}

function mergeDraft(target: ProductDraft, source: ProductDraft): void {
  source.phases.forEach((phase) => target.phases.add(phase));
  source.alternativeIds.forEach((id) => target.alternativeIds.add(id));
}

function shouldUseDraftAsRepresentative(candidate: ProductDraft, current: ProductDraft): boolean {
  if (candidate.orderDay !== current.orderDay) return candidate.orderDay < current.orderDay;
  return candidate.orderIndex < current.orderIndex;
}

function buildSingleCard(args: {
  product: ProductRow;
  phases: Set<PlanPhases>;
  firstPhase: PlanPhases;
  replacementsCount: number;
  inCart: boolean;
  inWishlist: boolean;
  replacedFrom: boolean;
}): ProductCard {
  const { product, phases, firstPhase, replacementsCount, inCart, inWishlist } = args;

  const phaseTags = phasesToTags(phases);
  const shortDescription = product.descriptionUser ?? truncate(product.description, 80);

  return {
    id: product.id,
    name: product.name,
    category: product.category ?? null,
    brand: product.brand?.name ?? '',
    shortDescription,
    price: product.price ?? null,
    imageUrl: product.imageUrl ?? null,
    firstPhase,
    phaseTags,
    state: {
      inCart,
      inWishlist,
      replacedByProductId: null, // здесь карточка уже самой замены, не оригинала
    },
    replacementsCount,
  };
}

function getDisplayGroupKey(usage: ProductUsage, productId: number): string {
  const primaryStep = usage.firstStepCategory ?? Array.from(usage.stepCategories)[0];
  return primaryStep ? `step:${primaryStep}` : `product:${productId}`;
}

function resolveFirstPhase(usage: ProductUsage, product: ProductRow): PlanPhases {
  if (isBaseOnlyUsage(usage, product)) {
    return usage.firstPhase;
  }
  if (usage.hasActiveStep || hasStrongActiveIngredient(product.activeIngredients)) {
    return 'active';
  }
  return usage.firstPhase;
}

function isActivePlanStep(step: DayStep): boolean {
  const stepCategory = String(step.stepCategory ?? '').toLowerCase();
  if (step.requiresPatchTest) return true;
  return isActiveStepCategory(stepCategory);
}

function isActiveStepCategory(stepCategory: string): boolean {
  return ACTIVE_STEP_PREFIXES.some((prefix) => stepCategory.startsWith(prefix));
}

function isBaseOnlyUsage(usage: ProductUsage, product: ProductRow): boolean {
  const steps = usage.stepCategories.size > 0
    ? Array.from(usage.stepCategories)
    : [product.step, product.category].filter(Boolean).map(String);

  return steps.length > 0 && steps.every(isBaseStepCategory);
}

function isBaseStepCategory(stepCategory: string): boolean {
  const normalized = stepCategory.toLowerCase();
  if (ACTIVE_STEP_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  return BASE_STEP_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function hasStrongActiveIngredient(activeIngredients: string[]): boolean {
  const text = activeIngredients.join(' ').toLowerCase();
  if (!text) return false;
  return STRONG_ACTIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function phasesToTags(phases: Set<PlanPhases>): string[] {
  if (phases.size === 3) return ['Все фазы'];
  return Array.from(phases).map((p) => getPhaseLabel(p));
}

function phaseOrder(phase: PlanPhases): number {
  switch (phase) {
    case 'adaptation': return 0;
    case 'active': return 1;
    case 'support': return 2;
  }
}

function truncate(text: string | null, max: number): string | null {
  if (!text) return null;
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trim() + '…';
}

function toProductId(id: string | number | null | undefined): number | null {
  if (id === null || id === undefined) return null;
  if (typeof id === 'number') return Number.isFinite(id) ? id : null;
  const parsed = parseInt(String(id), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const ACTIVE_STEP_PREFIXES = [
  'treatment_',
  'spot_treatment',
  'serum_vitc',
  'serum_exfoliant',
  'toner_exfoliant',
  'toner_acid',
  'toner_aha',
  'toner_bha',
  'mask_acid',
  'mask_peel',
  'mask_enzyme',
];

const BASE_STEP_PREFIXES = [
  'cleanser_',
  'moisturizer_',
  'eye_cream_',
  'spf_',
  'lip_care',
  'balm_barrier_repair',
  'serum_hydrating',
  'serum_niacinamide',
  'serum_anti_redness',
  'mask_clay',
  'mask_hydrating',
  'mask_soothing',
  'mask_sleeping',
];

const STRONG_ACTIVE_PATTERNS = [
  /\baha\b/,
  /\bbha\b/,
  /\bpha\b/,
  /ретин/,
  /retin/,
  /adapalene/,
  /tretinoin/,
  /benzoyl/,
  /бензоил/,
  /\bbpo\b/,
  /azelaic/,
  /азелаин/,
  /glycolic/,
  /гликол/,
  /lactic/,
  /молочн/,
  /mandelic/,
  /миндаль/,
  /salicylic/,
  /салицил/,
  /ascorb/,
  /аскорб/,
  /vitamin\s*c/,
  /витамин\s*c/,
  /tranexamic/,
  /транексам/,
];

/**
 * Извлекает все productId, которые надо подгрузить из БД для построения карточек.
 * Включает оригинальные id из плана + id-замены пользователя.
 */
export function collectAllReferencedProductIds(
  plan: Plan28,
  replacements: Map<number, number>,
): number[] {
  const ids = new Set<number>();

  for (const day of plan.days) {
    const allSteps: DayStep[] = [
      ...(day.morning ?? []),
      ...(day.evening ?? []),
      ...(day.weekly ?? []),
    ];
    for (const step of allSteps) {
      const pid = toProductId(step.productId);
      if (pid !== null) ids.add(pid);
    }
  }

  for (const newId of replacements.values()) {
    ids.add(newId);
  }

  return Array.from(ids);
}
