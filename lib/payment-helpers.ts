// lib/payment-helpers.ts
// Общие хелперы для платежной логики.
// Единый источник истины для маппинга productCode -> entitlementCode и расчёта validUntil.

/**
 * Тег пользователя: ему отправлено win-back предложение продлить доступ со скидкой
 * (99₽ вместо 499₽). Ставится кроном /api/cron/winback, снимается после успешной
 * оплаты любого продления. Используется как guard для продукта plan_renewal_discount.
 */
export const WINBACK_OFFER_TAG = 'winback_offer_sent';

/** Через сколько дней ПОСЛЕ истечения доступа слать win-back предложение за 99₽. */
export const WINBACK_DELAY_DAYS = 3;

/**
 * Возвращает код entitlement для продукта.
 * Единая функция — используется в create, webhook и test-webhook.
 *
 * ВАЖНО: продление (subscription_month) и win-back (plan_renewal_discount) выдают
 * тот же код paid_access, что и первичная покупка plan_access — иначе PaymentGate,
 * который гейтит план по paid_access, не разблокировал бы доступ после оплаты.
 */
export function entitlementCodeForProduct(productCode: string): string {
  switch (productCode) {
    case 'plan_access':
    case 'subscription_month':
    case 'plan_renewal_discount':
      return 'paid_access';
    case 'retake_topic':
      return 'retake_topic_access';
    case 'retake_full':
      return 'retake_full_access';
    default:
      return 'paid_access';
  }
}

/**
 * Продукт продлевает доступ к уже сгенерированному плану (а не открывает его впервые
 * и не запускает перепрохождение). Для таких продуктов после оплаты надо сбросить
 * 28-дневный счётчик плана (plan28.createdAt = now), чтобы флаг expired снялся.
 */
export function isRenewalProduct(productCode: string): boolean {
  return productCode === 'subscription_month' || productCode === 'plan_renewal_discount';
}

/**
 * Рассчитывает дату окончания доступа на основе productCode.
 * Возвращает Date (от «сейчас» + длительность).
 */
export function calculateValidUntil(productCode: string): Date {
  const validUntil = new Date();

  switch (productCode) {
    case 'subscription_month':
      // Продление за 499₽ — на 28 дней (совпадает с длиной плана и сбросом счётчика).
      validUntil.setDate(validUntil.getDate() + 28);
      break;
    case 'plan_renewal_discount':
      // Win-back продление со скидкой (99₽) — тоже на 28 дней.
      validUntil.setDate(validUntil.getDate() + 28);
      break;
    case 'plan_access':
      validUntil.setDate(validUntil.getDate() + 28);
      break;
    case 'retake_topic':
      // «Съедается» после успешного partial-update, но даём 7 дней запаса
      validUntil.setDate(validUntil.getDate() + 7);
      break;
    case 'retake_full':
      validUntil.setDate(validUntil.getDate() + 28);
      break;
    default:
      validUntil.setFullYear(validUntil.getFullYear() + 1);
      break;
  }

  return validUntil;
}
