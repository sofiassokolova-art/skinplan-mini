// lib/profile-validator.ts
// ИСПРАВЛЕНО: Валидация профиля после rules-engine

import type { SkinProfile } from './skinprofile-types';

export interface ProfileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Валидирует профиль после сборки из rules-engine
 * ИСПРАВЛЕНО: Проверяет консистентность профиля
 */
export function validateSkinProfile(profile: Partial<SkinProfile>): ProfileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Проверка обязательных полей
  if (!profile.skinType) {
    warnings.push('PROFILE_MISSING_SKIN_TYPE');
  }

  if (!profile.sensitivity) {
    warnings.push('PROFILE_MISSING_SENSITIVITY');
  }

  if (!profile.mainGoals || profile.mainGoals.length === 0) {
    warnings.push('PROFILE_MISSING_MAIN_GOALS');
  }

  // Проверка консистентности
  if (profile.pregnancyStatus === 'pregnant' || profile.pregnancyStatus === 'breastfeeding') {
    // Проверяем, что противопоказания содержат ретиноиды/кислоты
    const contraindications = profile.contraindications || [];
    const hasRetinoids = contraindications.some(c => 
      c.toLowerCase().includes('retinol') || 
      c.toLowerCase().includes('retinoid') ||
      c.toLowerCase().includes('tretinoin')
    );
    const hasAcids = contraindications.some(c =>
      c.toLowerCase().includes('acid') ||
      c.toLowerCase().includes('aha') ||
      c.toLowerCase().includes('bha')
    );

    if (!hasRetinoids && !hasAcids) {
      warnings.push('PROFILE_PREGNANCY_MISSING_CONTRANDICATIONS');
    }
  }

  // Проверка на пустые массивы (могут быть валидными, но стоит предупредить)
  if (profile.mainGoals && profile.mainGoals.length === 0) {
    errors.push('PROFILE_EMPTY_MAIN_GOALS');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

