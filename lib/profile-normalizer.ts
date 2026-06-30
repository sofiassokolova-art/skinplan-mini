// lib/profile-normalizer.ts
// ИСПРАВЛЕНО: Обязательный normalization layer после анкеты
// Все значения из анкеты должны проходить через эту функцию перед сохранением профиля
// Гарантирует, что в профиле только канонические типы (SkinTypeKey, ConcernKey, IngredientKey)

import type { SkinProfile } from './skinprofile-types';
import { 
  normalizeSkinType, 
  normalizeSensitivity, 
  normalizeAgeGroup,
  normalizeConcerns,
  normalizeIngredients,
} from './domain-normalizers';
import type { SkinTypeKey } from './skin-type-normalizer';
import type { IngredientKey } from './ingredient-normalizer';

function normalizeDiagnosisToken(diagnosis: string): string | null {
  const normalized = diagnosis.toLowerCase().trim();
  if (!normalized || normalized === 'none' || normalized === 'нет') return null;
  if (normalized.includes('acne') || normalized.includes('акне')) return 'acne';
  if (normalized.includes('rosacea') || normalized.includes('розацеа')) return 'rosacea';
  if (normalized.includes('seborr') || normalized.includes('себор')) return 'seborrheic_dermatitis';
  if (normalized.includes('atopic') || normalized.includes('атоп')) return 'atopic_dermatitis';
  if (normalized.includes('melasma') || normalized.includes('мелазм')) return 'melasma';
  if (normalized.includes('pigment') || normalized.includes('пигментац')) return 'melasma';
  if (normalized.includes('eczema') || normalized.includes('экзема')) return 'eczema';
  if (normalized.includes('psoriasis') || normalized.includes('псориаз')) return 'psoriasis';
  return diagnosis;
}

function normalizeDiagnoses(diagnoses: string[] | string | null | undefined): string[] {
  if (!diagnoses) return [];
  const diagnosisArray = Array.isArray(diagnoses) ? diagnoses : [diagnoses];
  const normalized: string[] = [];

  for (const diagnosis of diagnosisArray) {
    const normalizedToken = normalizeDiagnosisToken(diagnosis);
    if (normalizedToken && !normalized.includes(normalizedToken)) {
      normalized.push(normalizedToken);
    }
  }

  return normalized;
}

/**
 * ИСПРАВЛЕНО: Нормализует данные профиля после анкеты
 * ОБЯЗАТЕЛЬНО вызывать перед сохранением профиля в БД
 * Гарантирует, что все значения в каноническом формате
 */
export function normalizeProfileData(rawProfile: {
  skinType?: string | null;
  sensitivityLevel?: string | null;
  ageGroup?: string | null;
  mainGoals?: string[] | null;
  secondaryGoals?: string[] | null;
  diagnoses?: string[] | null;
  contraindications?: string[] | null;
  currentTopicals?: string[] | null;
  currentOralMeds?: string[] | null;
  allergies?: string[] | null;
  [key: string]: any;
}, context?: {
  oiliness?: number;
  dehydration?: number;
  userId?: string;
}): Partial<SkinProfile> {
  const normalized: Partial<SkinProfile> = {};

  // ИСПРАВЛЕНО: Нормализуем тип кожи к SkinTypeKey
  if (rawProfile.skinType !== undefined) {
    normalized.skinType = normalizeSkinType(rawProfile.skinType, context) as SkinTypeKey | null;
  }

  // ИСПРАВЛЕНО: Нормализуем чувствительность
  if (rawProfile.sensitivityLevel !== undefined) {
    normalized.sensitivity = normalizeSensitivity(rawProfile.sensitivityLevel);
  }

  // ИСПРАВЛЕНО: Нормализуем возрастную группу
  if (rawProfile.ageGroup !== undefined) {
    const normalizedAgeGroup = normalizeAgeGroup(rawProfile.ageGroup);
    normalized.ageGroup = normalizedAgeGroup || undefined; // Преобразуем null в undefined
  }

  // ИСПРАВЛЕНО: Нормализуем mainGoals к GoalKey[] (уже через buildSkinProfileFromAnswers)
  // Но если пришло из другого источника - нормализуем
  if (rawProfile.mainGoals) {
    // mainGoals уже должны быть GoalKey[] из buildSkinProfileFromAnswers
    // Но на всякий случай проверяем
    normalized.mainGoals = rawProfile.mainGoals as any;
  }

  // ИСПРАВЛЕНО: Нормализуем secondaryGoals к GoalKey[]
  if (rawProfile.secondaryGoals) {
    normalized.secondaryGoals = rawProfile.secondaryGoals as any;
  }

  // ИСПРАВЛЕНО: Нормализуем diagnoses к медицинским токенам, не к concerns
  if (rawProfile.diagnoses) {
    normalized.diagnoses = normalizeDiagnoses(rawProfile.diagnoses);
  }

  // ИСПРАВЛЕНО: Нормализуем contraindications к ConcernKey[]
  if (rawProfile.contraindications) {
    normalized.contraindications = normalizeConcerns(rawProfile.contraindications);
  }

  // ИСПРАВЛЕНО: Нормализуем currentTopicals к IngredientKey[]
  if (rawProfile.currentTopicals) {
    normalized.currentTopicals = normalizeIngredients(rawProfile.currentTopicals);
  }

  // ИСПРАВЛЕНО: Нормализуем currentOralMeds (оставляем как string[], т.к. это не ингредиенты)
  if (rawProfile.currentOralMeds) {
    normalized.currentOralMeds = rawProfile.currentOralMeds;
  }

  // ИСПРАВЛЕНО: allergies находятся в MedicalMarkers, не в SkinProfile
  // Нормализуем их в normalizeMedicalMarkers

  return normalized;
}

/**
 * ИСПРАВЛЕНО: Нормализует medicalMarkers после анкеты
 * Гарантирует канонические типы для всех полей
 */
export function normalizeMedicalMarkers(rawMarkers: {
  diagnoses?: string[] | null;
  allergies?: string[] | null;
  mainGoals?: string[] | null;
  secondaryGoals?: string[] | null;
  [key: string]: any;
}): {
  diagnoses?: string[];
  allergies?: IngredientKey[];
  mainGoals?: string[];
  secondaryGoals?: string[];
  [key: string]: any;
} {
  const normalized: any = {};

  // ИСПРАВЛЕНО: Нормализуем diagnoses к медицинским токенам, не к concerns
  if (rawMarkers.diagnoses) {
    normalized.diagnoses = normalizeDiagnoses(rawMarkers.diagnoses);
  }

  // ИСПРАВЛЕНО: Нормализуем allergies к IngredientKey[]
  if (rawMarkers.allergies) {
    normalized.allergies = normalizeIngredients(rawMarkers.allergies);
  }

  // mainGoals и secondaryGoals уже должны быть GoalKey[] из buildSkinProfileFromAnswers
  if (rawMarkers.mainGoals) {
    normalized.mainGoals = rawMarkers.mainGoals;
  }
  if (rawMarkers.secondaryGoals) {
    normalized.secondaryGoals = rawMarkers.secondaryGoals;
  }

  // Копируем остальные поля как есть
  Object.keys(rawMarkers).forEach(key => {
    if (!['diagnoses', 'allergies', 'mainGoals', 'secondaryGoals'].includes(key)) {
      normalized[key] = rawMarkers[key];
    }
  });

  return normalized;
}
