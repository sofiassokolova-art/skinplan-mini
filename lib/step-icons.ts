// lib/step-icons.ts
// Маппинг stepCategory → иконка в /public/icons/

export function getStepCategoryIcon(category: string): string | null {
  const normalized = String(category || '').trim().toLowerCase();

  if (!normalized) return '/icons/treatment_true.png';
  if (normalized === 'cleanser_oil' || normalized.includes('oil')) return '/icons/oil_green.png';
  if (normalized.startsWith('cleanser') || normalized.includes('cleansing')) return '/icons/cleanser_true.png';
  if (normalized.startsWith('toner') || normalized.includes('essence')) return '/icons/toner_true.png';
  if (normalized.startsWith('serum') || normalized.includes('ampoule')) return '/icons/serum_true.png';
  if (normalized === 'lip_care' || normalized === 'balm_barrier_repair' || normalized.includes('lip')) return '/icons/lipbalm_true.png';
  if (
    normalized.startsWith('moisturizer') ||
    normalized.startsWith('eye_cream') ||
    normalized.includes('cream') ||
    normalized.includes('barrier')
  ) return '/icons/cream_true.png';
  if (normalized.startsWith('spf') || normalized.includes('sunscreen')) return '/icons/spf_true.png';
  if (normalized.startsWith('mask') || normalized.includes('clay') || normalized.includes('peel')) return '/icons/mask_green.png';
  if (
    normalized.startsWith('treatment') ||
    normalized.includes('treatment') ||
    normalized.includes('acid') ||
    normalized.includes('exfoliant') ||
    normalized.includes('retinol') ||
    normalized.includes('retinoid') ||
    normalized === 'spot_treatment'
  ) return '/icons/treatment_true.png';

  return '/icons/treatment_true.png';
}

// Базовые категории → иконка (для заголовков групп)
export function getBaseCategoryIcon(baseCategoryName: string): string | null {
  switch (baseCategoryName) {
    case 'Очищение': return '/icons/cleanser_true.png';
    case 'Тоник': return '/icons/toner_true.png';
    case 'Сыворотка': return '/icons/serum_true.png';
    case 'Увлажнение': return '/icons/cream_true.png';
    case 'Крем для глаз': return '/icons/cream_true.png';
    case 'SPF защита': return '/icons/spf_true.png';
    case 'Маски': return '/icons/mask_green.png';
    case 'Уход за губами': return '/icons/lipbalm_true.png';
    case 'Бальзам': return '/icons/lipbalm_true.png';
    case 'Лечение': return '/icons/treatment_true.png';
    case 'Точечное лечение': return '/icons/treatment_true.png';
    default: return '/icons/treatment_true.png';
  }
}
