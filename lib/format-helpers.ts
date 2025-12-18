// lib/format-helpers.ts
// ИСПРАВЛЕНО: DEPRECATED - используйте ui-formatters.ts для UI и domain-normalizers.ts для бизнес-логики
// Этот файл оставлен для обратной совместимости, но перенаправляет на новые функции

import { 
  formatSkinTypeLabel, 
  formatAgeGroupLabel, 
  formatSensitivityLabel,
  formatConcerns 
} from './ui-formatters';

/**
 * @deprecated Используйте formatSkinTypeLabel из ui-formatters.ts
 * Форматирует тип кожи для отображения
 */
export function formatSkinType(skinType: string | null | undefined): string | null {
  return formatSkinTypeLabel(skinType);
}

/**
 * @deprecated Используйте formatAgeGroupLabel из ui-formatters.ts
 * Форматирует возрастную группу для отображения
 */
export function formatAgeGroup(ageGroup: string | number | null | undefined): string | null {
  return formatAgeGroupLabel(ageGroup);
}

/**
 * Форматирует основной запрос (main goal) для отображения
 * ИСПРАВЛЕНО: Оставлено здесь, так как это специфичная функция для UI
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
 * @deprecated Используйте formatSensitivityLabel из ui-formatters.ts
 * Форматирует уровень чувствительности для отображения
 */
export function formatSensitivityLevel(level: string | null | undefined): string | null {
  return formatSensitivityLabel(level);
}


