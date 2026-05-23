// lib/step-icons.ts
// Маппинг stepCategory → иконка в /public/icons/

export function getStepCategoryIcon(category: string): string | null {
  if (category === 'cleanser_oil') return '/icons/oil_true.png';
  if (category.startsWith('cleanser')) return '/icons/cleanser_true.png';
  if (category.startsWith('toner')) return '/icons/toner_true.png';
  if (category.startsWith('serum')) return '/icons/serum_true.png';
  if (category.startsWith('moisturizer') || category.startsWith('eye_cream')) return '/icons/cream_true.png';
  if (category.startsWith('spf')) return '/icons/spf_true.png';
  if (category.startsWith('mask')) return '/icons/claymask_true.png';
  if (category === 'lip_care' || category === 'balm_barrier_repair') return '/icons/lipbalm_true.png';
  if (category.startsWith('treatment') || category === 'spot_treatment') return '/icons/treatment_true.png';
  return null;
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
    case 'Маски': return '/icons/claymask_true.png';
    case 'Уход за губами': return '/icons/lipbalm_true.png';
    case 'Бальзам': return '/icons/lipbalm_true.png';
    case 'Лечение': return '/icons/treatment_true.png';
    case 'Точечное лечение': return '/icons/treatment_true.png';
    default: return null;
  }
}
