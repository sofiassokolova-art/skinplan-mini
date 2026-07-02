// lib/price-display.ts
// Показ цены в формате «от X ₽». Чтобы не фиксировать точную сумму (цена в магазине
// может отличаться от снимка верификации), на клиент отдаётся НЕ точная цена, а
// округлённый вниз до сотни «пол» (priceFloor) — индикативный минимум. Точная цена
// из БД клиент не покидает (политика «client must never see exact product price»).

/** Округляет цену вниз до сотни — индикативный «пол» для «от X ₽». null если цены нет. */
export function priceFloor(price?: number | null): number | null {
  if (!price || price <= 0) return null;
  return Math.floor(price / 100) * 100;
}

/** «от 1 200 ₽» или null. Принимает как уже округлённый floor, так и сырую цену (доокруглит). */
export function formatPriceFrom(price?: number | null): string | null {
  const f = priceFloor(price);
  return f == null ? null : `от ${f.toLocaleString('ru-RU')} ₽`;
}
