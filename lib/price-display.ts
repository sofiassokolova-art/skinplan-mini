// Показ цены в формате «от X ₽». Клиенту отдаётся не точная цена, а
// округлённый вниз до сотни индикативный минимум.

export function priceFloor(price?: number | null): number | null {
  if (!price || price <= 0) return null;
  const floored = Math.floor(price / 100) * 100;
  return floored > 0 ? floored : null;
}

export function formatPriceFrom(price?: number | null): string | null {
  const floor = priceFloor(price);
  return floor == null ? null : `от ${floor.toLocaleString('ru-RU')} ₽`;
}
