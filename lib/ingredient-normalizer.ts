// lib/ingredient-normalizer.ts
// Нормализация названий ингредиентов для сопоставления

/**
 * Нормализует название ингредиента для сопоставления
 * Убирает проценты, диапазоны, дополнительные слова
 * 
 * @param ing - Название ингредиента (например, "транексамовая кислота 5–10%")
 * @returns Массив нормализованных вариантов (например, ["tranexamic_acid", "tranexamicacid"])
 */
export function normalizeIngredient(ing: string): string[] {
  // Убираем проценты и диапазоны (например, "5–10%", "5%", "10%+")
  let normalized = ing.replace(/\s*\d+[–\-]\d+\s*%/gi, '');
  normalized = normalized.replace(/\s*\d+\s*%/gi, '');
  normalized = normalized.replace(/\s*%\s*/gi, '');
  
  // Убираем дополнительные слова в скобках и после запятых
  normalized = normalized.split('(')[0].split(',')[0].trim();
  
  // Убираем лишние пробелы и приводим к нижнему регистру
  normalized = normalized.toLowerCase().trim();
  
  // Возвращаем массив возможных вариантов
  const variants = [normalized];
  
  // Если есть подчеркивания, добавляем вариант без них
  if (normalized.includes('_')) {
    variants.push(normalized.replace(/_/g, ''));
  }
  
  return variants;
}

/**
 * Нормализует название ингредиента для простого сравнения (без вариантов)
 * Используется для фильтрации в памяти
 * 
 * @param ing - Название ингредиента
 * @returns Нормализованная строка
 */
export function normalizeIngredientSimple(ing: string): string {
  let normalized = ing.replace(/\s*\d+[–\-]\d+\s*%/gi, '');
  normalized = normalized.replace(/\s*\d+\s*%/gi, '');
  normalized = normalized.replace(/\s*%\s*/gi, '');
  normalized = normalized.split('(')[0].split(',')[0].trim();
  return normalized.toLowerCase().trim();
}

