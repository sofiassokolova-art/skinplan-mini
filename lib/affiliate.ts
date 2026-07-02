// lib/affiliate.ts
// Единый источник правды для партнёрской программы Goldapple (CPA-редирект go.redav.online).
// Используется на ВСЕХ поверхностях с кнопкой «купить» (корзина, избранное),
// чтобы клики атрибутировались и сопровождались маркировкой ФЗ-38.
//
// Важно: в БД ссылки хранятся СЫРЫМИ (https://goldapple.ru/...). Партнёрский шаблон
// подставляется здесь, в момент рендера. erid LdtCKFJmG относится к рекламодателю
// ООО «Екатеринбург Яблоко» (goldapple.ru), поэтому через редирект пропускаем ТОЛЬКО
// goldapple-ссылки. Остальные магазины (Яндекс Маркет и т.п.) ведём напрямую —
// на них этот erid не распространяется.

export const AFFILIATE_ERID = 'LdtCKFJmG';
export const AFFILIATE_ADVERTISER = 'ООО «ЕКАТЕРИНБУРГ ЯБЛОКО», ИНН 6670381056';

// Шаблон из кабинета: лишние параметры (sub1..5, keyword) убраны — оставлены только erid, m, dl.
const AFFILIATE_REDIRECT = `https://go.redav.online/afa94ea7d115fbb0?erid=${AFFILIATE_ERID}&m=2&dl=`;

/** Полная маркировка ФЗ-38 (для подвала списка). */
export const AFFILIATE_DISCLOSURE = `Реклама. ${AFFILIATE_ADVERTISER}, erid: ${AFFILIATE_ERID}`;

/** Короткая пометка рядом с конкретной кнопкой «купить». */
export const AFFILIATE_AD_MARK_ERID = AFFILIATE_ERID;

export function isGoldapple(url: string): boolean {
  try {
    return new URL(url).hostname.replace(/^www\./, '').endsWith('goldapple.ru');
  } catch {
    return false;
  }
}

/**
 * Возвращает финальный href и флаг «рекламная ссылка».
 * sponsored=true → ссылка обёрнута в партнёрский редирект, нужна маркировка
 * и rel="sponsored nofollow".
 */
export function withAffiliate(url: string): { href: string; sponsored: boolean } {
  if (isGoldapple(url)) return { href: AFFILIATE_REDIRECT + url, sponsored: true };
  return { href: url, sponsored: false };
}

/** rel для тега <a> в зависимости от того, рекламная ли ссылка. */
export function affiliateRel(sponsored: boolean): string {
  return sponsored ? 'sponsored nofollow noopener noreferrer' : 'noopener noreferrer';
}
