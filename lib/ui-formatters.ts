// lib/ui-formatters.ts
// ИСПРАВЛЕНО: UI formatters ТОЛЬКО для отображения
// Эти функции форматируют значения для UI (текст, лейблы)
// НЕ для бизнес-логики - используйте domain-normalizers для правил/фильтров

/**
 * Форматирует тип кожи для отображения в UI
 * ИСПРАВЛЕНО: Только для отображения, не для бизнес-логики
 */
export function formatSkinTypeLabel(skinType: string | null | undefined): string | null {
  if (!skinType) return null;
  
  const labels: Record<string, string> = {
    dry: 'Сухая',
    oily: 'Жирная',
    combo: 'Комбинированная',
    normal: 'Нормальная',
    sensitive: 'Чувствительная',
    combination_dry: 'Комбинированная (сухая)',
    combination_oily: 'Комбинированная (жирная)',
  };
  
  return labels[skinType.toLowerCase()] || skinType;
}

/**
 * Форматирует уровень чувствительности для отображения в UI
 * ИСПРАВЛЕНО: Только для отображения, не для бизнес-логики
 */
export function formatSensitivityLabel(sensitivity: string | null | undefined): string | null {
  if (!sensitivity) return null;
  
  const labels: Record<string, string> = {
    low: 'Низкая',
    medium: 'Средняя',
    high: 'Высокая',
    very_high: 'Очень высокая',
  };
  
  return labels[sensitivity.toLowerCase()] || sensitivity;
}

/**
 * Форматирует возрастную группу для отображения в UI
 * ИСПРАВЛЕНО: Только для отображения, не для бизнес-логики
 * Принимает строку (например, "26_30") или число (например, 28)
 */
export function formatAgeGroupLabel(age: string | number | null | undefined): string | null {
  if (!age) return null;
  
  // Если это число
  if (typeof age === 'number') {
    return `${age} лет`;
  }
  
  // Если это строка в каноническом формате
  const ageStr = String(age).toLowerCase().trim();
  const labels: Record<string, string> = {
    u18: 'До 18 лет',
    '18_24': '18-24 лет',
    '25_34': '25-34 лет',
    '35_44': '35-44 лет',
    '45plus': '45+ лет',
  };
  
  if (labels[ageStr]) {
    return labels[ageStr];
  }
  
  // Если это диапазон в формате "26_30" или "25-34"
  if (ageStr.includes('_')) {
    const parts = ageStr.split('_');
    const min = parts[0] || '';
    const max = parts[1] || '';
    if (min && max) {
      return `${min}-${max} лет`;
    }
  }
  
  if (ageStr.includes('-')) {
    return `${ageStr} лет`;
  }
  
  return ageStr;
}

/**
 * Форматирует concerns для отображения в UI
 * ИСПРАВЛЕНО: Только для отображения, не для бизнес-логики
 */
export function formatConcerns(concerns: string[] | null | undefined): string[] {
  if (!concerns || !Array.isArray(concerns)) return [];
  
  // Маппинг concern ключей на читаемые лейблы
  const labels: Record<string, string> = {
    acne: 'Акне',
    pigmentation: 'Пигментация',
    wrinkles: 'Морщины',
    pores: 'Расширенные поры',
    oiliness: 'Жирность',
    dryness: 'Сухость',
    sensitivity: 'Чувствительность',
    redness: 'Покраснения',
  };
  
  return concerns.map(concern => labels[concern.toLowerCase()] || concern);
}

