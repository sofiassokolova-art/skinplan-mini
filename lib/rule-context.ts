// lib/rule-context.ts
// Типизированный RuleContext для нормализации полей профиля для правил рекомендаций
// Обеспечивает единую точку маппинга полей (age_group vs ageGroup, skin_type vs skinType, etc.)

import type { SkinProfile } from '@prisma/client';

export interface RuleContext {
  // Основные поля профиля
  skinType: string | null;
  skin_type: string | null; // Алиас для совместимости
  sensitivity: string | null;
  sensitivityLevel: string | null;
  sensitivity_level: string | null; // Алиас для совместимости
  ageGroup: string | null;
  age_group: string | null; // Алиас для совместимости
  age: string | null; // Алиас для совместимости
  
  // Вычисленные оси кожи
  inflammation: number;
  oiliness: number;
  hydration: number;
  barrier: number;
  pigmentation: number;
  photoaging: number;
  
  // Медицинские маркеры
  diagnoses: string[]; // ИСПРАВЛЕНО: Всегда на корневом уровне для консистентности
  allergies?: string[];
  contraindications?: string[];
  
  // Дополнительные поля
  hasPregnancy?: boolean;
  pregnant?: boolean;
}

/**
 * Создает нормализованный RuleContext из профиля и вычисленных scores
 * ИСПРАВЛЕНО: Единая точка маппинга полей для всех правил
 */
export function buildRuleContext(
  profile: SkinProfile & { medicalMarkers?: any },
  skinScores: Array<{ axis: string; value: number }>,
  normalizedSkinType: string | null,
  normalizedSensitivity: string | null
): RuleContext {
  const medicalMarkers = (profile.medicalMarkers as Record<string, any> | null) || {};
  
  // ИСПРАВЛЕНО: Нормализуем diagnoses - всегда на корневом уровне
  const diagnoses = Array.isArray(medicalMarkers.diagnoses) ? medicalMarkers.diagnoses : [];
  
  return {
    // Основные поля с алиасами для совместимости
    skinType: normalizedSkinType || null,
    skin_type: normalizedSkinType || null,
    sensitivity: normalizedSensitivity || null,
    sensitivityLevel: normalizedSensitivity || null,
    sensitivity_level: normalizedSensitivity || null,
    ageGroup: profile.ageGroup || null,
    age_group: profile.ageGroup || null,
    age: profile.ageGroup || null,
    
    // Вычисленные оси кожи
    inflammation: skinScores.find(s => s.axis === 'inflammation')?.value || 0,
    oiliness: skinScores.find(s => s.axis === 'oiliness')?.value || 0,
    hydration: skinScores.find(s => s.axis === 'hydration')?.value || 0,
    barrier: skinScores.find(s => s.axis === 'barrier')?.value || 0,
    pigmentation: skinScores.find(s => s.axis === 'pigmentation')?.value || 0,
    photoaging: skinScores.find(s => s.axis === 'photoaging')?.value || 0,
    
    // Медицинские маркеры - всегда на корневом уровне
    diagnoses: diagnoses,
    allergies: Array.isArray(medicalMarkers.allergies) ? medicalMarkers.allergies : undefined,
    contraindications: Array.isArray(medicalMarkers.contraindications) ? medicalMarkers.contraindications : undefined,
    
    // Дополнительные поля
    hasPregnancy: profile.hasPregnancy || false,
    pregnant: profile.hasPregnancy || false,
  };
}

