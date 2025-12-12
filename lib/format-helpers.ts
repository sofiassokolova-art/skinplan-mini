// lib/format-helpers.ts
// Вспомогательные функции для форматирования данных для отображения

/**
 * Форматирует тип кожи для отображения
 */
export function formatSkinType(skinType: string | null | undefined): string | null {
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
 * Форматирует возрастную группу для отображения
 * Принимает строку (например, "26_30") или число (например, 28)
 */
export function formatAgeGroup(ageGroup: string | number | null | undefined): string | null {
  if (ageGroup === null || ageGroup === undefined) return null;
  
  // Если это число, преобразуем в строку с "лет"
  if (typeof ageGroup === 'number') {
    return `${ageGroup} лет`;
  }
  
  // Если уже содержит "лет", возвращаем как есть
  if (ageGroup.includes('лет')) {
    return ageGroup;
  }
  
  // Форматируем возрастные группы
  const ageLabels: Record<string, string> = {
    '18_25': '18-25 лет',
    '26_30': '26-30 лет',
    '31_40': '31-40 лет',
    '41_50': '41-50 лет',
    '50_plus': '50+ лет',
    '18_24': '18-24 лет',
    '25_34': '25-34 лет',
    '35_44': '35-44 лет',
    '45plus': '45+ лет',
    'u18': 'До 18 лет',
  };
  
  // Проверяем точное совпадение
  if (ageLabels[ageGroup]) {
    return ageLabels[ageGroup];
  }
  
  // Если формат "XX-XX" или "XX_XX", преобразуем
  if (ageGroup.includes('_')) {
    const parts = ageGroup.split('_');
    if (parts.length === 2) {
      const start = parts[0];
      const end = parts[1];
      if (end === 'plus' || end === 'plus') {
        return `${start}+ лет`;
      }
      return `${start}-${end} лет`;
    }
  }
  
  // Если формат "XX-XX", просто добавляем "лет"
  if (ageGroup.includes('-') && !ageGroup.includes('лет')) {
    return `${ageGroup} лет`;
  }
  
  return ageGroup;
}

/**
 * Форматирует основной запрос (main goal) для отображения
 */
export function formatMainGoal(goal: string | null | undefined): string | null {
  if (!goal) return null;
  
  const goalLabels: Record<string, string> = {
    acne: 'Акне',
    pores: 'Поры',
    pigmentation: 'Пигментация',
    barrier: 'Барьер',
    dehydration: 'Обезвоженность',
    wrinkles: 'Морщины',
    antiage: 'Антиэйдж',
    general: 'Общий уход',
  };
  
  return goalLabels[goal.toLowerCase()] || goal;
}

/**
 * Форматирует уровень чувствительности для отображения
 */
export function formatSensitivityLevel(level: string | null | undefined): string | null {
  if (!level) return null;
  
  const labels: Record<string, string> = {
    low: 'Низкая',
    medium: 'Средняя',
    high: 'Высокая',
    very_high: 'Очень высокая',
  };
  
  return labels[level.toLowerCase()] || level;
}
