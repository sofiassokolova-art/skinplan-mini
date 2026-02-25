// lib/payment-helpers.ts
// Общие хелперы для платежной логики.
// Единый источник истины для маппинга productCode -> entitlementCode и расчёта validUntil.

/**
 * Возвращает код entitlement для продукта.
 * Единая функция — используется в create, webhook и test-webhook.
 */
export function entitlementCodeForProduct(productCode: string): string {
  switch (productCode) {
    case 'plan_access':
      return 'paid_access';
    case 'retake_topic':
      return 'retake_topic_access';
    case 'retake_full':
      return 'retake_full_access';
    case 'subscription_month':
      return 'subscription_active';
    default:
      return 'paid_access';
  }
}

/**
 * Рассчитывает дату окончания доступа на основе productCode.
 * Возвращает Date (от «сейчас» + длительность).
 */
export function calculateValidUntil(productCode: string): Date {
  const validUntil = new Date();

  switch (productCode) {
    case 'subscription_month':
      validUntil.setMonth(validUntil.getMonth() + 1);
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
