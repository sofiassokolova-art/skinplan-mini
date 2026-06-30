// lib/profile-calculator.ts
// Логика расчета профиля кожи на основе ответов анкеты

import { Prisma } from '@prisma/client';
import { normalizeSkinTypeForRules, type SkinTypeKey } from './skin-type-normalizer';

interface AnswerScore {
  [key: string]: number | string | boolean | string[];
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

const EMPTY_SCORE_KEYS = 0;

function hasScoreValues(scoreJson: Prisma.JsonValue | null): scoreJson is Prisma.JsonObject {
  return !!scoreJson &&
    typeof scoreJson === 'object' &&
    !Array.isArray(scoreJson) &&
    Object.keys(scoreJson).length > EMPTY_SCORE_KEYS;
}

/**
 * Fallback scoring for legacy/current DB rows where answer_options.score_json is {}.
 * Keep this in sync with questionnaire seed scripts; scoreJson remains the source of
 * truth, but medical/sensitivity signals must not disappear if the DB was seeded before
 * those fields were populated.
 */
export function inferAnswerScore(questionCode: string, optionLabel: string): AnswerScore {
  const code = questionCode.toLowerCase();
  const label = optionLabel.toLowerCase();

  if (code === 'skin_type') {
    if ((label.includes('тип 1') || label.includes('сухая')) && !label.includes('комбинированная')) {
      return { oiliness: 0, dehydration: 5 };
    }
    if (label.includes('тип 2') || label.includes('комбинированная (сухая)')) {
      return { oiliness: 2, dehydration: 3 };
    }
    if ((label.includes('тип 3') || label.includes('нормальная')) && !label.includes('жирная')) {
      return { oiliness: 1, dehydration: 1 };
    }
    if (label.includes('комбинированная (жирная)') || label.includes('тип 4')) {
      return { oiliness: 3, dehydration: 1 };
    }
    if (label.includes('жирная') || label.includes('тип 5')) {
      return { oiliness: 5, dehydration: 0 };
    }
  }

  if (code === 'skin_concerns' || code === 'current_concerns') {
    if (label.includes('постакне') || label.includes('следы от акне')) {
      return { pigmentation: 1, concerns: ['postacne_scars'] };
    }
    if (label.includes('акне') || label.includes('высыпан')) {
      return { acne: 3, concerns: ['acne'] };
    }
    if (label.includes('жирность') || label.includes('блеск') || label.includes('пор')) {
      return { oiliness: 2 };
    }
    if (label.includes('сухость') || label.includes('стянутость')) {
      return { dehydration: 3 };
    }
    if (label.includes('пигментац') || label.includes('неровный тон')) {
      return { pigmentation: 2, pigmentationRisk: 'medium' };
    }
    if (label.includes('чувствительн') || label.includes('покраснен')) {
      return { sensitivity: 3 };
    }
    if (label.includes('розацеа')) {
      return { rosacea: 2, rosaceaRisk: 'medium' };
    }
    if (label.includes('морщин') || label.includes('возраст')) {
      return { aging: 2 };
    }
  }

  if (code === 'skin_sensitivity' || code === 'sensitivity') {
    if (label.includes('практически никогда') || label === 'нет' || label.includes('устойчивая')) {
      return { sensitivity: 0 };
    }
    if (label.includes('легк') || label.includes('низк')) {
      return { sensitivity: 1 };
    }
    if (label.includes('заметн') || label.includes('средн') || label.includes('дискомфорт')) {
      return { sensitivity: 2 };
    }
    if (label.includes('сильн') || label.includes('стойк') || label.includes('высок')) {
      return { sensitivity: 4, rosacea: 2 };
    }
  }

  if (code === 'medical_diagnoses' || code === 'diagnoses') {
    if (label === 'нет' || label.includes('нет')) {
      return {};
    }
    if (label.includes('розацеа') || label.includes('rosacea')) {
      return { rosacea: 3, sensitivity: 4 };
    }
    if (label.includes('атоп') || label.includes('atopic')) {
      return { sensitivity: 4, dehydration: 3 };
    }
    if (label.includes('себор') || label.includes('seborr')) {
      return { sensitivity: 4, oiliness: 1 };
    }
    if (label.includes('акне') || label.includes('acne')) {
      return { acne: 3 };
    }
    if (label.includes('мелазм') || label.includes('melasma') || label.includes('пигментац')) {
      return { pigmentation: 3, pigmentationRisk: 'high' };
    }
  }

  if (code === 'age') {
    if (label.includes('до 18')) return { age_group: '18_25' };
    if (label.includes('18–24') || label.includes('18-24')) return { age_group: '18_25' };
    if (label.includes('25–34') || label.includes('25-34')) return { age_group: '26_30' };
    if (label.includes('35–44') || label.includes('35-44')) return { age_group: '31_40' };
    if (label.includes('45+')) return { age_group: '41_50' };
  }

  if (code === 'pregnancy_breastfeeding' || code === 'pregnancy_status' || code === 'pregnancy') {
    if (label.includes('беремен') || label.includes('корм')) {
      return { has_pregnancy: true };
    }
    if (label.includes('нет')) {
      return { has_pregnancy: false };
    }
  }

  return {};
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
        label?: string;
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
      if (option) {
        const score = hasScoreValues(option.scoreJson)
          ? option.scoreJson as AnswerScore
          : inferAnswerScore(question.code, option.label || option.value);
        if (Object.keys(score).length > 0) {
          answerScores.push(score);
        }
      }
    } else if (Array.isArray(answer.answerValues) && answer.answerValues.length > 0) {
      // Multi-choice: обрабатываем ВСЕ выбранные опции
      for (const optionValue of answer.answerValues) {
        const option = question.answerOptions.find(opt => opt.value === optionValue);
        if (option) {
          const score = hasScoreValues(option.scoreJson)
            ? option.scoreJson as AnswerScore
            : inferAnswerScore(question.code, option.label || option.value);
          if (Object.keys(score).length > 0) {
            answerScores.push(score);
          }
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

  // Определяем риски.
  // P1.3: medium-порог поднят с >=1 до >=2. Текущая анкета даёт rosacea/pigmentation=2
  // только при ЯВНОМ выборе соответствующей проблемы пользователем, поэтому поведение
  // сегодня не меняется, но один случайный слабый сигнал (=1) из будущих вопросов больше
  // не переведёт пользователя в самый строгий протокол розацеа (полный запрет активов).
  const rosaceaRisk = (scores.rosacea || 0) >= 3 ? 'high' :
                     (scores.rosacea || 0) >= 2 ? 'medium' : 'none';
  const pigmentationRisk = (scores.pigmentation || 0) >= 3 ? 'high' :
                          (scores.pigmentation || 0) >= 2 ? 'medium' : 'none';

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
