export const PAYMENT_PRODUCT_LABELS: Record<string, string> = {
  plan_access: 'Доступ к плану ухода',
  retake_topic: 'Перепрохождение темы',
  retake_full: 'Полное перепрохождение анкеты',
  subscription_month: 'Продление доступа к плану',
  plan_renewal_discount: 'Продление доступа к плану (скидка)',
};

export const PAYMENT_PRODUCTS: Record<string, { amount: number; currency: string }> = {
  plan_access: {
    amount: 19900,
    currency: 'RUB',
  },
  retake_topic: {
    amount: 4900,
    currency: 'RUB',
  },
  retake_full: {
    amount: 9900,
    currency: 'RUB',
  },
  subscription_month: {
    amount: 49900,
    currency: 'RUB',
  },
  plan_renewal_discount: {
    amount: 9900,
    currency: 'RUB',
  },
};

