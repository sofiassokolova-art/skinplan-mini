// lib/skin-issues.ts
// Чистая функция вычисления проблем кожи, вынесенная из app/api/analysis/route.ts.
// Импортируется и из самого роута, и из plan-generator — раньше plan-generator
// тянул через '@/app/api/analysis/route' всю route.ts (GET-хэндлер, prisma,
// logger, requireTelegramAuth) в server bundle. Вынос экономит KB в worker.

import type { AnswerOption } from '@/lib/quiz/types';

export interface SkinIssue {
  id: string;
  name: string;
  severity_score: number;
  severity_label: 'критично' | 'плохо' | 'умеренно' | 'хорошо' | 'отлично';
  description: string;
  tags: string[];
  image_url?: string;
}

function answerTokens(answersMap: Record<string, any>, ...codes: string[]): string[] {
  return codes.flatMap((code) => {
    const raw = answersMap[code];
    if (Array.isArray(raw)) return raw.map(String);
    if (raw) return [String(raw)];
    return [];
  });
}

function hasToken(values: string[], fragments: string[]): boolean {
  return values.some((value) => {
    const normalized = value.toLowerCase();
    return fragments.some((fragment) => normalized.includes(fragment));
  });
}

/**
 * Вычисляет проблемы кожи на основе профиля и ответов
 */
export function calculateSkinIssues(
  profile: any,
  userAnswers: any[],
  skinScores: any[]
): SkinIssue[] {
  const issues: SkinIssue[] = [];

  // Получаем ответы в удобном формате
  const answersMap: Record<string, any> = {};
  for (const answer of userAnswers) {
    const questionCode = answer.question?.code || '';

    // Для multi-choice вопросов берем лейблы опций, для single-choice - лейбл опции
    if (answer.answerValues && Array.isArray(answer.answerValues) && answer.answerValues.length > 0) {
      // Для multi-choice - массив лейблов опций
      const labels: string[] = [];
      for (const value of answer.answerValues) {
        const option = answer.question?.answerOptions?.find((opt: AnswerOption) => opt.value === value);
        if (option?.label) {
          labels.push(option.label);
        } else {
          // Fallback на value, если лейбл не найден
          labels.push(String(value));
        }
      }
      answersMap[questionCode] = labels;
    } else if (answer.answerValue) {
      // Для single-choice - лейбл опции или само значение
      const option = answer.question?.answerOptions?.find((opt: AnswerOption) => opt.value === answer.answerValue);
      answersMap[questionCode] = option?.label || answer.answerValue;
    }
  }

  const diagnosisAnswers = answerTokens(answersMap, 'medical_diagnoses', 'diagnoses');
  const oralMedicationAnswers = answerTokens(answersMap, 'oral_medications', 'current_medications');

  // 1. Акне / высыпания (согласно ТЗ)
  const acneConcern = answersMap.skin_concerns?.some((c: string) =>
    c.includes('Акне') || c.includes('высыпания') || c.includes('acne') || c.includes('акне')
  );
  const acneDiagnosis = hasToken(diagnosisAnswers, ['acne', 'акне']);
  const hasIsotretinoin = hasToken(oralMedicationAnswers, ['isotretinoin', 'изотретиноин']);
  const acneLevel = profile.acneLevel || 0;
  const hasActiveInflammations = acneLevel >= 4;

  // Добавляем проблему акне согласно ТЗ
  if (acneConcern || acneDiagnosis || acneLevel >= 3 || hasIsotretinoin) {
    let severityLabel: string;
    let description: string;
    let tags: string[] = [];

    if (hasIsotretinoin || acneDiagnosis) {
      severityLabel = 'критично';
      description = 'Диагноз акне или применение изотретиноина требует особого подхода к уходу';
      tags = ['воспаления', 'постакне'];
    } else if (hasActiveInflammations && acneConcern) {
      severityLabel = 'плохо';
      description = 'Активные воспаления требуют специального ухода и лечения';
      tags = ['воспаления', 'постакне'];
    } else if (acneConcern) {
      severityLabel = 'умеренно';
      description = 'Умеренные высыпания, требующие внимательного подхода';
      tags = ['акне'];
    } else {
      severityLabel = 'хорошо';
      description = 'Минимальные проявления акне';
      tags = [];
    }

    issues.push({
      id: 'acne',
      name: 'Акне / высыпания',
      severity_score: hasIsotretinoin ? 95 :
                     (acneDiagnosis ? 90 :
                     (hasActiveInflammations ? 75 :
                     (acneLevel >= 3 ? 60 : 40))),
      severity_label: severityLabel as any,
      description,
      tags,
    });
  }

  // 2. Жирность и блеск кожи (согласно ТЗ)
  const oilinessScore = skinScores.find(s => s.axis === 'oiliness')?.value ?? 50;
  // Нет прямого вопроса о времени блеска, используем тип кожи
  const shineTime = answersMap.skin_type === 'oily' || answersMap.skin_type === 'combination_oily' ? '2-3_hours' : null;

  if (oilinessScore >= 60) {
    let severityLabel: string;
    if (shineTime === '2-3_hours' || shineTime === '2–3 часа') {
      severityLabel = 'плохо';
    } else if (shineTime === 'evening' || shineTime === 'к вечеру') {
      severityLabel = 'умеренно';
    } else {
      severityLabel = 'хорошо';
    }

    issues.push({
      id: 'oiliness',
      name: 'Жирность и блеск кожи',
      severity_score: oilinessScore,
      severity_label: severityLabel as any,
      description: shineTime === '2-3_hours' || shineTime === '2–3 часа'
        ? 'Блеск появляется через 2–3 часа, требуется контроль себума'
        : 'Избыточное выделение кожного сала',
      tags: ['Т-зона', 'блеск'],
    });
  }

  // 3. Сухость/стянутость
  const hydrationScore = skinScores.find(s => s.axis === 'hydration')?.value ?? 100;
  if (hydrationScore <= 60) {
    const hasAtopic = hasToken(diagnosisAnswers, ['atopic_dermatitis', 'атоп']);
    const hasTightness = answersMap.skin_concerns?.some((c: string) =>
      c.includes('Сухость') || c.includes('стянутость') || c.includes('dehydration') || c.includes('обезвоженность')
    ) || answersMap.skin_type === 'dry' || answersMap.skin_type === 'combination_dry';

    issues.push({
      id: 'dryness',
      name: 'Сухость/стянутость',
      severity_score: 100 - hydrationScore,
      severity_label: hasAtopic ? 'критично' :
                     (hasTightness && hydrationScore <= 40) ? 'плохо' : 'умеренно',
      description: hasAtopic
        ? 'Атопический дерматит требует особого ухода'
        : 'Кожа нуждается в дополнительном увлажнении',
      tags: ['сухость', hasAtopic ? 'атопия' : 'обезвоженность'],
    });
  }

  // 4. Неровный тон / пигментация
  const pigmentationScore = skinScores.find(s => s.axis === 'pigmentation')?.value ?? 50;
  const spfFrequency = answersMap.spf_frequency;
  const sunExposure = answersMap.sun_exposure;
  if (pigmentationScore >= 40 || (spfFrequency === 'never' && sunExposure === 'more_than_3_hours')) {
    issues.push({
      id: 'pigmentation',
      name: 'Неровный тон / пигментация',
      severity_score: pigmentationScore,
      severity_label: pigmentationScore >= 60 ? 'плохо' : 'умеренно',
      description: 'Неравномерная пигментация требует защиты от УФ и осветляющих средств',
      tags: ['пигментация', 'SPF'],
    });
  }

  // 5. Морщины (согласно ТЗ: возраст + жалоба)
  const ageGroup = profile.ageGroup || '';
  const photoagingScore = skinScores.find(s => s.axis === 'photoaging')?.value ?? 0;
  const hasWrinkleConcern = answersMap.skin_concerns?.some((c: string) =>
    c.includes('Морщины') || c.includes('wrinkles') || c.includes('морщины')
  );

  // Добавляем проблему морщин, если есть возраст + жалоба (согласно ТЗ)
  if (hasWrinkleConcern) {
    // Возрастные группы хранятся как "35_44"/"41_50" — точное сравнение подстрок
    // ('40'/'45'/'50') не ловило "35_44". Парсим максимальный возраст по числам.
    const maxAge = Math.max(0, ...(ageGroup.match(/\d{1,3}/g) ?? []).map((n: string) => parseInt(n, 10)));
    const isOlderAge = maxAge >= 40 || ageGroup.includes('+');
    issues.push({
      id: 'wrinkles',
      name: 'Морщины',
      severity_score: Math.max(photoagingScore, isOlderAge ? 70 : 50),
      // Возрастная кожа с явной жалобой на морщины — это значимая проблема (а не
      // «умеренно»): иначе она отсеивалась из keyProblems и план её игнорировал.
      severity_label: (isOlderAge || photoagingScore >= 60) ? 'плохо' : 'умеренно',
      description: isOlderAge
        ? 'Признаки старения требуют интенсивного антивозрастного ухода'
        : 'Признаки старения требуют антивозрастного ухода',
      tags: ['старение', 'антивозрастной уход'],
    });
  }

  // 6. Краснота, раздражение, чувствительность
  const sensitivityLevel = profile.sensitivityLevel || 'low';
  const rednessScore = skinScores.find(s => s.axis === 'redness')?.value ?? 50;
  const hasRosacea = hasToken(diagnosisAnswers, ['rosacea', 'розацеа', 'купероз']);
  const hasDermatitis = hasToken(diagnosisAnswers, ['dermatitis', 'дерматит', 'атоп', 'себор']);

  if (sensitivityLevel === 'high' || sensitivityLevel === 'very_high' ||
      rednessScore >= 50 || hasRosacea || hasDermatitis) {
    issues.push({
      id: 'sensitivity',
      name: 'Краснота, раздражение, чувствительность',
      severity_score: Math.max(rednessScore, hasRosacea || hasDermatitis ? 80 : 60),
      severity_label: (hasRosacea || hasDermatitis) ? 'критично' :
                     (sensitivityLevel === 'high' || sensitivityLevel === 'very_high') ? 'плохо' : 'умеренно',
      description: 'Повышенная чувствительность кожи требует мягкого ухода',
      tags: ['раздражение', hasRosacea ? 'розацеа' : 'чувствительность'],
    });
  }

  // 7. Расширенные поры
  if (oilinessScore >= 50) {
    issues.push({
      id: 'pores',
      name: 'Расширенные поры',
      severity_score: oilinessScore,
      severity_label: oilinessScore >= 70 ? 'плохо' : 'умеренно',
      description: 'Расширенные поры связаны с избыточной жирностью',
      tags: ['поры', 'Т-зона'],
    });
  }

  // 8. Зона под глазами
  const sleepHabits = answersMap.lifestyle_habits || [];
  const hasSleepIssue = Array.isArray(sleepHabits) &&
                       sleepHabits.some((h: string) => h.includes('недосып') || h.includes('мало сплю'));
  // Лейбл опции анкеты — «Проблемы вокруг глаз (отёки, круги)», поэтому матчим
  // по подстрокам «вокруг глаз»/«круг», а не по несуществующему «темные круги».
  const hasDarkCircles = answersMap.skin_concerns?.some((c: string) => {
    const l = c.toLowerCase();
    return l.includes('вокруг глаз') || l.includes('круг') || l.includes('dark_circles') || l.includes('dark circles');
  });

  if (hasSleepIssue || hasDarkCircles) {
    issues.push({
      id: 'eye_area',
      name: 'Зона под глазами',
      severity_score: (hasSleepIssue ? 50 : 0) + (hasDarkCircles ? 50 : 0),
      severity_label: (hasSleepIssue && hasDarkCircles) ? 'плохо' : 'умеренно',
      description: 'Темные круги и отеки требуют специального ухода',
      tags: ['темные круги', 'отеки'],
    });
  }

  // 9. Защитный барьер кожи
  const barrierScore = skinScores.find(s => s.axis === 'barrier')?.value ?? 100;
  if (barrierScore <= 60) {
    issues.push({
      id: 'barrier',
      name: 'Защитный барьер кожи',
      severity_score: 100 - barrierScore,
      severity_label: barrierScore <= 40 ? 'плохо' : 'умеренно',
      description: 'Нарушение защитного барьера требует восстановительного ухода',
      tags: ['барьер', 'восстановление'],
    });
  }

  // 10. UV-риск
  if (spfFrequency === 'never' && sunExposure === 'more_than_3_hours') {
    issues.push({
      id: 'uv_risk',
      name: 'UV-риск',
      severity_score: 80,
      severity_label: 'критично',
      description: 'Отсутствие защиты от УФ-излучения повышает риск фотостарения и пигментации',
      tags: ['SPF', 'фотостарение'],
    });
  }

  // Сортируем проблемы по приоритету согласно ТЗ:
  // 1. Сначала критичные проблемы (критично/плохо)
  // 2. Затем умеренные (умеренно)
  // 3. В конце те, что в норме (хорошо/отлично)
  const severityOrder: Record<string, number> = {
    'критично': 0,
    'плохо': 1,
    'умеренно': 2,
    'хорошо': 3,
    'отлично': 4,
  };

  return issues.sort((a, b) => {
    const orderA = severityOrder[a.severity_label] ?? 5;
    const orderB = severityOrder[b.severity_label] ?? 5;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    // Если severity одинаковый, сортируем по score (выше = важнее)
    return b.severity_score - a.severity_score;
  });
}
