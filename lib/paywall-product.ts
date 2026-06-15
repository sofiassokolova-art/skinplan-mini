// lib/paywall-product.ts
// Единая логика выбора продукта/цены для paywall плана на всех экранах
// (home, plan). Держит в одном месте «ступеньку» цен: первая покупка / продление /
// win-back со скидкой.

export type PlanPaywallProduct = 'plan_access' | 'subscription_month' | 'plan_renewal_discount';

export interface PlanPaywallVariant {
  productCode: PlanPaywallProduct;
  /** Текущая цена в рублях. */
  price: number;
  /** Старая цена для зачёркивания (если есть). */
  originalPrice?: number;
}

/**
 * Какой продукт показать в paywall плана:
 *  - первая покупка (план не истёк): plan_access — 199₽
 *  - продление (план истёк, 29-й день+): subscription_month — 499₽
 *  - win-back (истёк + пришёл оффер из бота, ?offer=winback): plan_renewal_discount — 99₽
 *
 * winbackOffer берётся из URL и фактически honored только при истёкшем плане;
 * серверный guard (тег WINBACK_OFFER_TAG) не даёт оплатить скидку без оффера.
 */
export function resolvePlanPaywall(opts: {
  expired: boolean;
  winbackOffer: boolean;
}): PlanPaywallVariant {
  if (opts.expired) {
    if (opts.winbackOffer) {
      return { productCode: 'plan_renewal_discount', price: 99, originalPrice: 499 };
    }
    return { productCode: 'subscription_month', price: 499 };
  }
  return { productCode: 'plan_access', price: 199 };
}

/** Прочитать флаг win-back оффера из строки запроса (?offer=winback). */
export function hasWinbackOfferParam(search: string | null | undefined): boolean {
  if (!search) return false;
  try {
    return new URLSearchParams(search).get('offer') === 'winback';
  } catch {
    return false;
  }
}
