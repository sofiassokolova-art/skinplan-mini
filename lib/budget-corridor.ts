// lib/budget-corridor.ts
// Единая трактовка бюджетного вопроса: выбранный вариант — это коридор цены
// одного средства, а не верхняя граница "можно дешевле".

export type BudgetLabel = 'бюджетный' | 'средний' | 'премиум' | 'любой';
export type PriceSegment = 'mass' | 'mid' | 'premium';

const BUDGET_ALIASES: Record<string, BudgetLabel> = {
  budget_1: 'бюджетный',
  budget: 'бюджетный',
  low: 'бюджетный',
  mass: 'бюджетный',
  'бюджетный': 'бюджетный',

  budget_2: 'средний',
  medium: 'средний',
  mid: 'средний',
  'средний': 'средний',

  budget_3: 'премиум',
  premium: 'премиум',
  'премиум': 'премиум',

  budget_4: 'любой',
  any: 'любой',
  'любой': 'любой',
};

export function normalizeBudgetLabel(value?: string | null): BudgetLabel | null {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  const direct = BUDGET_ALIASES[raw];
  if (direct) return direct;

  if (raw.includes('без предпочт') || raw.includes('любой')) return 'любой';
  if (raw.includes('премиум') || raw.includes('5 000+') || raw.includes('5000+')) return 'премиум';
  if (raw.includes('средн') || (raw.includes('2 000') && raw.includes('5 000'))) return 'средний';
  if (raw.includes('бюджет') || raw.includes('до 2 000') || raw.includes('до 2000')) return 'бюджетный';

  return null;
}

export function normalizePriceSegment(value?: string | null): PriceSegment | null {
  return value === 'mass' || value === 'mid' || value === 'premium' ? value : null;
}

export function inferPriceSegmentFromPrice(price?: number | null): PriceSegment | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  if (price < 2000) return 'mass';
  if (price < 5000) return 'mid';
  return 'premium';
}

export function getProductPriceSegment(product: { priceSegment?: string | null; price?: number | null }): PriceSegment | null {
  return normalizePriceSegment(product.priceSegment) ?? inferPriceSegmentFromPrice(product.price);
}

export function getBudgetCorridorSegments(budget?: string | null): PriceSegment[] | null {
  const normalizedBudget = normalizeBudgetLabel(budget);
  if (normalizedBudget === 'бюджетный') return ['mass'];
  if (normalizedBudget === 'средний') return ['mid'];
  if (normalizedBudget === 'премиум') return ['premium'];
  return null;
}

export function productMatchesBudgetCorridor(
  product: { priceSegment?: string | null; price?: number | null },
  budget?: string | null
): boolean {
  const allowedSegments = getBudgetCorridorSegments(budget);
  if (!allowedSegments) return true;
  const productSegment = getProductPriceSegment(product);
  if (!productSegment) return false;
  return allowedSegments.includes(productSegment);
}
