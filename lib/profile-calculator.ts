// lib/profile-calculator.ts
// Логика расчета профиля кожи на основе ответов анкеты

import { Prisma } from '@prisma/client';
import { normalizeSkinTypeForRules, type SkinTypeKey } from './skin-type-normalizer';

interface AnswerScore {
  [key: string]: number | string | boolean;
}

interface AggregatedScores {
  oiliness?: number;
  sensitivity?: number;
  dehydration?: number;
  acne?: number;
  rosacea?: number;
  pigmentation?: number;
  [key: string]: number | string | boolean | undefined;
}

/**
 * Агрегирует баллы из ответов пользователя
 */
export function aggregateAnswerScores(
  answerScores: AnswerScore[]
): AggregatedScores {
  const aggregated: AggregatedScores = {};

  for (const score of answerScores) {
    for (const [key, value] of Object.entries(score)) {
      if (typeof value === 'number') {
        aggregated[key] = (aggregated[key] as number || 0) + value;
      } else if (typeof value === 'string' || typeof value === 'boolean') {
        aggregated[key] = value;
      }
    }
  }

  return aggregated;
}

/**
 * ИСПРАВЛЕНО: Определяет тип кожи на основе агрегированных баллов
 * Использует единую точку нормализации через normalizeSkinTypeForRules
 * Возвращает канонический SkinTypeKey
 */
export function determineSkinType(scores: AggregatedScores, context?: { userId?: string }): SkinTypeKey {
  const oiliness = typeof scores.oiliness === 'number' ? scores.oiliness : 0;
  const dehydration = typeof scores.dehydration === 'number' ? scores.dehydration : 0;

  // ИСПРАВЛЕНО: Определяем предварительный тип на основе баллов
  let preliminaryType: string;
  if (oiliness >= 4 && dehydration >= 3) {
    // Комбинированная: определяем направление на основе преобладающего признака
    preliminaryType = oiliness > dehydration ? 'combination_oily' : 'combination_dry';
  } else if (oiliness >= 4) {
    preliminaryType = 'oily';
  } else if (dehydration >= 4) {
    preliminaryType = 'dry';
  } else if (oiliness >= 2 || dehydration >= 2) {
    // Легкая комбинированная: определяем направление
    preliminaryType = oiliness > dehydration ? 'combination_oily' : 'combination_dry';
  } else {
    preliminaryType = 'normal';
  }

  // ИСПРАВЛЕНО: Используем единую точку нормализации
  const normalized = normalizeSkinTypeForRules(preliminaryType, {
    oiliness,
    dehydration,
    userId: context?.userId,
  });

  // Гарантируем, что возвращаем валидный SkinTypeKey (не null)
  return normalized || 'normal';
}

/**
 * Определяет уровень чувствительности
 * ВАЖНО: Всегда возвращает валидное значение ('low', 'medium', или 'high')
 */
export function determineSensitivityLevel(scores: AggregatedScores): string {
  const sensitivity = scores.sensitivity || 0;
  if (typeof sensitivity === 'number') {
    if (sensitivity >= 4) return 'high';
    if (sensitivity >= 2) return 'medium';
  }
  // Всегда возвращаем 'low' по умолчанию, даже если sensitivity отсутствует
  return 'low';
}

/**
 * Определяет уровень акне
 */
export function determineAcneLevel(scores: AggregatedScores): number {
  const acne = scores.acne || 0;
  // Нормализуем до 0-5
  return Math.min(Math.max(Math.round(acne), 0), 5);
}

/**
 * Создает профиль кожи на основе ответов
 */
export function createSkinProfile(
  userId: string,
  questionnaireId: number,
  userAnswers: Array<{
    questionId: number;
    answerValue: string | null;
    answerValues: Prisma.JsonValue | null;
    question: {
      code: string;
      answerOptions: Array<{
        value: string;
        scoreJson: Prisma.JsonValue | null;
      }>;
    };
  }>,
  version: number = 1
): {
  skinType: string;
  sensitivityLevel: string;
  acneLevel: number;
  dehydrationLevel: number;
  rosaceaRisk: string;
  pigmentationRisk: string;
  ageGroup: string | null;
  hasPregnancy: boolean;
  medicalMarkers: Prisma.JsonObject | null;
  notes: string;
} {
  // ИСПРАВЛЕНО: Собираем все score_json из ответов
  // Для multi-choice суммируем scoreJson по всем выбранным опциям, а не только по первой
  const answerScores: AnswerScore[] = [];

  for (const answer of userAnswers) {
    const question = answer.question;
    
    // ИСПРАВЛЕНО: Обрабатываем как single, так и multi-choice
    if (answer.answerValue) {
      // Single choice
      const option = question.answerOptions.find(opt => opt.value === answer.answerValue);
      if (option?.scoreJson) {
        answerScores.push(option.scoreJson as AnswerScore);
      }
    } else if (Array.isArray(answer.answerValues) && answer.answerValues.length > 0) {
      // Multi-choice: обрабатываем ВСЕ выбранные опции
      for (const optionValue of answer.answerValues) {
        const option = question.answerOptions.find(opt => opt.value === optionValue);
        if (option?.scoreJson) {
          answerScores.push(option.scoreJson as AnswerScore);
        }
      }
    }
  }

  // Агрегируем баллы
  const scores = aggregateAnswerScores(answerScores);

  // ИСПРАВЛЕНО: Определяем профиль с использованием единой нормализации
  const skinType = determineSkinType(scores, { userId });
  const sensitivityLevel = determineSensitivityLevel(scores);
  const acneLevel = determineAcneLevel(scores);
  const dehydrationLevel = Math.min(Math.max(Math.round(scores.dehydration || 0), 0), 5);

  // Определяем риски (можно расширить логику)
  const rosaceaRisk = (scores.rosacea || 0) >= 3 ? 'high' : 
                     (scores.rosacea || 0) >= 1 ? 'medium' : 'none';
  const pigmentationRisk = (scores.pigmentation || 0) >= 3 ? 'high' :
                          (scores.pigmentation || 0) >= 1 ? 'medium' : 'none';

  // Извлекаем возрастную группу и другие данные
  const ageGroup = scores.age_group as string || null;
  const hasPregnancy = scores.has_pregnancy === true || scores.pregnancy === true;

  // Медицинские маркеры
  const medicalMarkers: Prisma.JsonObject = {};
  if (scores.allergies) medicalMarkers.allergies = scores.allergies;
  if (scores.prescription_creams) medicalMarkers.prescriptionCreams = scores.prescription_creams;

  // Формируем текстовое резюме
  const notes = generateProfileNotes({
    skinType,
    sensitivityLevel,
    acneLevel,
    dehydrationLevel,
    rosaceaRisk,
    pigmentationRisk,
    ageGroup,
  });

  return {
    skinType,
    sensitivityLevel,
    acneLevel,
    dehydrationLevel,
    rosaceaRisk,
    pigmentationRisk,
    ageGroup,
    hasPregnancy,
    medicalMarkers: Object.keys(medicalMarkers).length > 0 ? medicalMarkers : null,
    notes,
  };
}

/**
 * Генерирует текстовое резюме профиля
 */
function generateProfileNotes(profile: {
  skinType: string;
  sensitivityLevel: string;
  acneLevel: number;
  dehydrationLevel: number;
  rosaceaRisk: string;
  pigmentationRisk: string;
  ageGroup: string | null;
}): string {
  const parts: string[] = [];

  parts.push(`Тип кожи: ${getSkinTypeLabel(profile.skinType)}`);
  parts.push(`Чувствительность: ${profile.sensitivityLevel}`);
  
  if (profile.acneLevel > 0) {
    parts.push(`Акне: уровень ${profile.acneLevel}/5`);
  }
  
  if (profile.dehydrationLevel > 0) {
    parts.push(`Обезвоженность: уровень ${profile.dehydrationLevel}/5`);
  }

  if (profile.rosaceaRisk !== 'none') {
    parts.push(`Риск розацеа: ${profile.rosaceaRisk}`);
  }

  if (profile.pigmentationRisk !== 'none') {
    parts.push(`Риск пигментации: ${profile.pigmentationRisk}`);
  }

  return parts.join('. ') + '.';
}

function getSkinTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    dry: 'Сухая',
    oily: 'Жирная',
    combo: 'Комбинированная',
    combination_dry: 'Комбинированная (сухая)',
    combination_oily: 'Комбинированная (жирная)',
    normal: 'Нормальная',
    sensitive: 'Чувствительная',
  };
  return labels[type] || type;
}
