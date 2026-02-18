// lib/ingredient-normalizer.ts
// ИСПРАВЛЕНО: Нормализация названий ингредиентов с возвратом канонических типов

import type { ActiveIngredient } from './ingredient-compatibility';

/**
 * ИСПРАВЛЕНО: Канонический тип ингредиента - единый источник правды
 * Используется везде вместо string для типобезопасности
 */
export type IngredientKey = ActiveIngredient;

/**
 * ИСПРАВЛЕНО: Нормализует название ингредиента к каноническому ключу
 * Возвращает IngredientKey | null вместо string | null
 * 
 * @param ing - Название ингредиента (например, "транексамовая кислота 5–10%")
 * @returns Канонический ключ ингредиента или null
 */
export function normalizeIngredientName(ing: string | null | undefined): IngredientKey | null {
  if (!ing) return null;
  
  const normalized = normalizeIngredientSimple(ing);
  
  // ИСПРАВЛЕНО: Маппинг на канонические ключи из ingredient-compatibility
  const ingredientMap: Record<string, IngredientKey> = {
    'retinol': 'retinol',
    'retinoid': 'retinoid',
    'adapalene': 'adapalene',
    'tretinoin': 'tretinoin',
    'vitamin_c': 'vitamin_c',
    'vitaminc': 'vitamin_c',
    'ascorbic_acid': 'ascorbic_acid',
    'ascorbicacid': 'ascorbic_acid',
    'niacinamide': 'niacinamide',
    'aha': 'aha',
    'bha': 'bha',
    'pha': 'pha',
    'salicylic_acid': 'salicylic_acid',
    'salicylicacid': 'salicylic_acid',
    'glycolic_acid': 'glycolic_acid',
    'glycolicacid': 'glycolic_acid',
    'lactic_acid': 'lactic_acid',
    'lacticacid': 'lactic_acid',
    'azelaic_acid': 'azelaic_acid',
    'azelaicacid': 'azelaic_acid',
    'benzoyl_peroxide': 'benzoyl_peroxide',
    'benzoylperoxide': 'benzoyl_peroxide',
    'peptides': 'peptides',
    'ceramides': 'ceramides',
    'hyaluronic_acid': 'hyaluronic_acid',
    'hyaluronicacid': 'hyaluronic_acid',
    'tranexamic_acid': 'azelaic_acid', // Транексамовая кислота маппится к azelaic_acid
    'tranexamicacid': 'azelaic_acid',
  };
  
  return ingredientMap[normalized] || null;
}

/**
 * Нормализует название ингредиента для сопоставления (старая версия для обратной совместимости)
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

