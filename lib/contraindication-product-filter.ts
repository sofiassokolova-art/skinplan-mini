// lib/contraindication-product-filter.ts
// Продуктовый фильтр по противопоказаниям пользователя (medicalMarkers.contraindications).
//
// Зачем: гейты в step-category-rules блокируют ШАГИ (toner_acid, treatment_exfoliant...),
// но не сами ПРОДУКТЫ. Продукт с салициловой кислотой в «нейтральном» слоте
// (cleanser_gentle, spf_50_face) проходил мимо контра-флага no_strong_acids —
// пользователь, попросивший «без кислот» (например, на Эффезеле), получал кислоту
// в плане без возможности замены. Этот модуль отсеивает такие продукты по их
// active_ingredients на любом этапе подбора (карта шагов + DB-фолбэки).

/**
 * Карта: контра-флаг → семейства токенов активов, которые он запрещает.
 * Токены сверяются с нормализованными active_ingredients продукта.
 *
 * ВАЖНО: no_strong_acids намеренно НЕ включает azelaic (азелаиновая кислота —
 * не AHA/BHA, разрешена дерм-протоколами) и hyaluronic/tranexamic (не эксфолианты).
 */
const CONTRA_INGREDIENT_FAMILIES: Record<string, string[]> = {
  no_strong_acids: ['aha', 'bha', 'pha', 'lha', 'salicylic', 'glycolic', 'lactic', 'mandelic', 'polyhydroxy'],
  no_retinol: ['retinol', 'retinal', 'retinoid', 'retinyl', 'tretinoin', 'adapalene'],
  no_vitc: ['vitamin_c', 'ascorbic', 'ascorbyl'],
  no_niacinamide: ['niacinamide'],
  no_hyaluronic: ['hyaluronic'],
};

function normalizeIngredient(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

/** Токен матчится строго по границам "_" (чтобы 'aha' не находился внутри слов),
 *  с допуском числового суффикса без разделителя ('vitamin_c10', 'bha2'). */
function ingredientMatchesFamily(ingredient: string, family: string): boolean {
  if (family.includes('_')) {
    // Составной токен ('vitamin_c'): матч по префиксу с границей или числовым хвостом
    if (ingredient === family) return true;
    if (ingredient.startsWith(family)) {
      const rest = ingredient.slice(family.length);
      return rest.startsWith('_') || /^\d/.test(rest);
    }
    return false;
  }
  const tokens = ingredient.split('_');
  return tokens.some((t) => t === family || (t.startsWith(family) && /^\d+$/.test(t.slice(family.length))));
}

/**
 * true, если продукт содержит актив, запрещённый противопоказаниями пользователя.
 * Продукты без размеченных active_ingredients не блокируем (нет данных — нет матча).
 */
export function productViolatesContraindications(
  product: { activeIngredients?: string[] | null },
  contraindications: string[] | null | undefined
): boolean {
  if (!contraindications || contraindications.length === 0) return false;
  const actives = (product.activeIngredients || []).map(normalizeIngredient).filter(Boolean);
  if (actives.length === 0) return false;

  for (const contra of contraindications) {
    const families = CONTRA_INGREDIENT_FAMILIES[contra];
    if (!families) continue;
    for (const ingredient of actives) {
      if (families.some((family) => ingredientMatchesFamily(ingredient, family))) {
        return true;
      }
    }
  }
  return false;
}

/** Отсеивает продукты, нарушающие противопоказания. */
export function filterProductsByContraindications<T extends { activeIngredients?: string[] | null }>(
  products: T[],
  contraindications: string[] | null | undefined
): T[] {
  if (!contraindications || contraindications.length === 0) return products;
  return products.filter((p) => !productViolatesContraindications(p, contraindications));
}
