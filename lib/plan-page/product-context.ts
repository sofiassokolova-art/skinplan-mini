// lib/plan-page/product-context.ts
// Сборка карточек продуктов для блока "Средства плана".
//
// Источник: Plan28.planData.days[].morning/evening/weekly + Product/Cart/Wishlist/ProductReplacement.
// На выходе — список ProductCard с уже посчитанными состояниями и тегами фаз.

import type { Plan28, DayStep } from '@/lib/plan-types';
import { getPhaseForDay, getPhaseLabel } from '@/lib/plan-formatters';
import type { ProductCard } from './types';

interface ProductRow {
  id: number;
  name: string;
  brand: { name: string } | null;
  price: number | null;
  imageUrl: string | null;
  description: string | null;
  descriptionUser: string | null;
}

interface BuildProductCardsInput {
  plan: Plan28;
  /** Все продукты, упомянутые в плане (включая alternatives) */
  products: ProductRow[];
  /** productId, лежащие в корзине пользователя */
  cartProductIds: Set<number>;
  /** productId, лежащие в избранном */
  wishlistProductIds: Set<number>;
  /** Карта oldProductId → newProductId (пользовательские замены) */
  replacements: Map<number, number>;
}

/**
 * Главная функция: формирует список карточек продуктов для UI.
 */
export function buildProductCards(input: BuildProductCardsInput): ProductCard[] {
  const { plan, products, cartProductIds, wishlistProductIds, replacements } = input;
  const productsById = new Map(products.map((p) => [p.id, p]));

  // 1. Соберём «оригинальные» productId для каждой phase и подсчитаем
  //    альтернативы (для индикации "Заменить").
  const phasesByProductId = new Map<number, Set<'adaptation' | 'active' | 'support'>>();
  const altsByProductId = new Map<number, Set<number>>();
  const originalProductIds = new Set<number>();

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
      originalProductIds.add(pid);

      // phase tags
      let set = phasesByProductId.get(pid);
      if (!set) {
        set = new Set();
        phasesByProductId.set(pid, set);
      }
      set.add(phase);

      // alternatives
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

  // 2. Применяем пользовательские замены: для каждого оригинала смотрим,
  //    есть ли замена. Если есть — показываем продукт-замену вместо оригинала.
  const finalProductIds: number[] = [];
  const replacedFromBy = new Map<number, number>(); // newProductId → oldProductId

  for (const origId of originalProductIds) {
    const replacedTo = replacements.get(origId);
    if (replacedTo !== undefined) {
      finalProductIds.push(replacedTo);
      replacedFromBy.set(replacedTo, origId);
      // Перенесём phase tags и alternatives на новый id
      const phases = phasesByProductId.get(origId);
      if (phases) phasesByProductId.set(replacedTo, new Set(phases));
      const alts = altsByProductId.get(origId);
      if (alts) altsByProductId.set(replacedTo, new Set(alts));
    } else {
      finalProductIds.push(origId);
    }
  }

  // 3. Дедуп + соберём финальные карточки в стабильном порядке.
  const seen = new Set<number>();
  const cards: ProductCard[] = [];

  for (const pid of finalProductIds) {
    if (seen.has(pid)) continue;
    seen.add(pid);

    const product = productsById.get(pid);
    if (!product) continue;

    cards.push(buildSingleCard({
      product,
      phases: phasesByProductId.get(pid) ?? new Set(),
      replacementsCount: (altsByProductId.get(pid) ?? new Set()).size,
      inCart: cartProductIds.has(pid),
      inWishlist: wishlistProductIds.has(pid),
      replacedFrom: replacedFromBy.has(pid),
    }));
  }

  return cards;
}

function buildSingleCard(args: {
  product: ProductRow;
  phases: Set<'adaptation' | 'active' | 'support'>;
  replacementsCount: number;
  inCart: boolean;
  inWishlist: boolean;
  replacedFrom: boolean;
}): ProductCard {
  const { product, phases, replacementsCount, inCart, inWishlist } = args;

  const phaseTags = phasesToTags(phases);
  const shortDescription = product.descriptionUser ?? truncate(product.description, 80);

  return {
    id: product.id,
    name: product.name,
    brand: product.brand?.name ?? '',
    shortDescription,
    price: product.price ?? null,
    imageUrl: product.imageUrl ?? null,
    phaseTags,
    state: {
      inCart,
      inWishlist,
      replacedByProductId: null, // здесь карточка уже самой замены, не оригинала
    },
    replacementsCount,
  };
}

function phasesToTags(phases: Set<'adaptation' | 'active' | 'support'>): string[] {
  if (phases.size === 3) return ['Все фазы'];
  return Array.from(phases).map((p) => getPhaseLabel(p));
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
