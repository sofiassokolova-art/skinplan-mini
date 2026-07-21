// lib/step-matching.ts
// ИСПРАВЛЕНО (P0): Единая логика маппинга product.step/category -> StepCategory[]
// Все категории нормализуются к каноническим StepCategory перед использованием
//
// ВАЖНО: В БД встречаются как "базовые" step (serum, moisturizer, spf),
// так и "детальные" stepCategory (serum_hydrating, spf_50_face, moisturizer_rich и т.п.).
// Этот маппер нужен, чтобы любой продукт можно было привязать к одному или нескольким StepCategory,
// а значит — гарантированно использовать в плане.

import type { StepCategory } from './step-category-rules';

export interface StepMatchingSignals {
  name?: string | null;
  activeIngredients?: string[] | null;
}

/**
 * ИСПРАВЛЕНО (P0): Нормализует входные строки к каноническому формату
 * Убирает пробелы, приводит к нижнему регистру, заменяет дефисы на подчеркивания
 */
function normalizeStepString(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_') // Заменяем пробелы на подчеркивания
    .replace(/-/g, '_'); // Заменяем дефисы на подчеркивания
}

function buildSignalText(
  step: string | null | undefined,
  category: string | null | undefined,
  signals?: StepMatchingSignals
): string {
  const parts = [
    step,
    category,
    signals?.name,
    ...(Array.isArray(signals?.activeIngredients) ? signals.activeIngredients : []),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function signalIncludes(signalText: string, ...needles: string[]): boolean {
  const normalizedSignal = normalizeStepString(signalText);
  return needles.some((needle) => {
    const lowerNeedle = needle.toLowerCase();
    return signalText.includes(lowerNeedle) || normalizedSignal.includes(normalizeStepString(lowerNeedle));
  });
}

export function hasSerumAntiageSignal(input: {
  step?: string | null;
  category?: string | null;
  name?: string | null;
  activeIngredients?: string[] | null;
}): boolean {
  const signalText = buildSignalText(input.step, input.category, {
    name: input.name,
    activeIngredients: input.activeIngredients,
  });

  return signalIncludes(
    signalText,
    'serum_antiage',
    'antiage',
    'anti age',
    'anti-aging',
    'anti ageing',
    'wrinkle',
    'wrinkles',
    'firming',
    'lifting',
    'морщ',
    'возраст',
    'антиэйдж',
    'лифтинг',
    'упруг',
    'peptide',
    'peptides',
    'copper peptide',
    'matrixyl',
    'argireline',
    'пептид',
    'bakuchiol',
    'бакучиол'
  );
}

export function mapStepToStepCategory(
  step: string | null | undefined,
  category: string | null | undefined,
  skinType?: string | null,
  signals?: StepMatchingSignals
): StepCategory[] {
  // ИСПРАВЛЕНО (P0): Нормализуем входные строки перед сравнением
  const stepStr = normalizeStepString(step || category);
  const categoryStr = normalizeStepString(category);
  const signalText = buildSignalText(step, category, signals);
  const categories: StepCategory[] = [];

  const isCleanserContext = stepStr.includes('cleanser') || categoryStr === 'cleanser';
  const isTonerContext = stepStr.includes('toner') || categoryStr === 'toner';
  const isSerumContext = stepStr.includes('serum') || categoryStr === 'serum';
  // Бальзам для губ. step='lip_care' иногда имеет ошибочный category='moisturizer'
  // (Mixit Lip Balm), из-за чего лип-балм просачивался в слот крема для лица и
  // вытеснял настоящий moisturizer. Шаг lip_care — приоритетнее category: если это
  // средство для губ, оно НЕ должно попадать в moisturizer-категории.
  const isLipContext = stepStr.startsWith('lip') || categoryStr === 'lip_care' || categoryStr === 'lip';
  const isMoisturizerContext =
    !isLipContext &&
    (stepStr.includes('moisturizer') ||
      stepStr.includes('cream') ||
      categoryStr === 'moisturizer' ||
      categoryStr === 'cream');

  // --- Cleanser ---
  const oilPattern = /\b(oil|масло)\b/i;
  // ВАЖНО: токен "oil" ищем строго между разделителями. Раньше стояло includes('_oil'),
  // и оно матчило "_oily" — из-за этого SPF для жирной кожи (step="spf_50_oily",
  // Eucerin Oil Control SPF50+) регистрировался как cleanser_oil/cleanser_gentle и
  // попадал в план на место вечернего умывания (кейс Галимат).
  const oilToken = /(^|_)oil(_|$)/;
  // SPF-контекст полностью исключаем из cleanser-веток: солнцезащита — не очищение.
  const isSpfProduct = /(^|_)(spf|sunscreen)(_|$|\d)/.test(stepStr) || categoryStr === 'spf';
  if (
    !isSpfProduct &&
    (stepStr === 'cleanser_oil' ||
      oilToken.test(stepStr) ||
      oilPattern.test(stepStr) ||
      categoryStr === 'oil' ||
      oilToken.test(categoryStr) ||
      oilPattern.test(categoryStr))
  ) {
    categories.push('cleanser_oil');
    categories.push('cleanser_gentle');
  } else if (
    stepStr === 'cleanser_micellar' ||
    stepStr.includes('micellar') ||
    stepStr.includes('мицелл') ||
    (isCleanserContext && (categoryStr.includes('micellar') || categoryStr.includes('мицелл')))
  ) {
    categories.push('cleanser_micellar');
    categories.push('cleanser_gentle');
  } else if (stepStr.startsWith('cleanser_gentle') || (isCleanserContext && stepStr.includes('gentle'))) {
    categories.push('cleanser_gentle');
  } else if (stepStr.startsWith('cleanser_balancing') || (isCleanserContext && stepStr.includes('balancing'))) {
    categories.push('cleanser_balancing');
  } else if (stepStr.startsWith('cleanser_deep') || (isCleanserContext && stepStr.includes('deep'))) {
    categories.push('cleanser_deep');
  } else if (stepStr.startsWith('cleanser') || categoryStr === 'cleanser' || stepStr === 'cleanser') {
    categories.push('cleanser_gentle', 'cleanser_balancing', 'cleanser_deep');
  }

  // --- Toner ---
  if (stepStr.startsWith('toner_hydrating') || (isTonerContext && stepStr.includes('hydrating'))) {
    categories.push('toner_hydrating');
  } else if (stepStr.startsWith('toner_soothing') || (isTonerContext && stepStr.includes('soothing'))) {
    categories.push('toner_soothing');
  } else if (
    stepStr.startsWith('toner_exfoliant') ||
    stepStr.startsWith('toner_acid') ||
    (isTonerContext && (stepStr.includes('exfoliant') || stepStr.includes('acid') || stepStr.includes('aha') || stepStr.includes('bha') || stepStr.includes('pha')))
  ) {
    categories.push('toner_exfoliant', 'toner_acid');
  } else if (stepStr.startsWith('toner_aha') || (isTonerContext && stepStr.includes('aha'))) {
    categories.push('toner_aha');
  } else if (stepStr.startsWith('toner_bha') || (isTonerContext && stepStr.includes('bha'))) {
    categories.push('toner_bha');
  } else if (stepStr === 'toner' || categoryStr === 'toner') {
    categories.push('toner_hydrating', 'toner_soothing', 'toner_exfoliant');
  }

  // --- Serum ---
  // ВАЖНО: vitamin c не должен попадать в serum_hydrating.
  const looksLikeVitC =
    stepStr.startsWith('serum_vitc') ||
    categoryStr === 'serum_vitc' ||
    (isSerumContext && signalIncludes(signalText, 'vitamin c', 'vitamin_c', 'vitc', 'ascorb', 'ce ferulic', 'витамин c', 'витамин с'));
  const looksLikeHydrating =
    stepStr.startsWith('serum_hydrating') ||
    categoryStr === 'serum_hydrating' ||
    (isSerumContext && signalIncludes(signalText, 'hydrating', 'hyalur', 'hyaluron', 'hyaluronic', 'гиалур', 'увлажн'));
  const looksLikePeptide =
    stepStr.startsWith('serum_peptide') ||
    categoryStr === 'serum_peptide' ||
    (isSerumContext && signalIncludes(signalText, 'peptide', 'peptides', 'copper peptide', 'matrixyl', 'argireline', 'пептид'));
  const looksLikeAntiage = isSerumContext && hasSerumAntiageSignal({
    step,
    category,
    name: signals?.name,
    activeIngredients: signals?.activeIngredients,
  });

  if (looksLikeVitC) {
    categories.push('serum_vitc');
  } else if (looksLikePeptide) {
    categories.push('serum_peptide', 'serum_antiage');
  } else if (stepStr.startsWith('serum_antiage') || categoryStr === 'serum_antiage' || looksLikeAntiage) {
    categories.push('serum_antiage');
  } else if (
    stepStr.startsWith('serum_niacinamide') ||
    categoryStr === 'serum_niacinamide' ||
    (isSerumContext && signalIncludes(signalText, 'niacinamide', 'ниацинамид'))
  ) {
    categories.push('serum_niacinamide');
  } else if (stepStr.startsWith('serum_anti_redness') || categoryStr === 'serum_anti_redness' || (isSerumContext && signalIncludes(signalText, 'anti-redness', 'anti redness'))) {
    categories.push('serum_anti_redness');
  } else if (stepStr.startsWith('serum_brightening') || categoryStr === 'serum_brightening_soft' || (isSerumContext && signalIncludes(signalText, 'brightening'))) {
    categories.push('serum_brightening_soft');
  } else if (stepStr.startsWith('serum_exfoliant') || categoryStr === 'serum_exfoliant' || (isSerumContext && signalIncludes(signalText, 'lactic', 'mandelic', 'exfoliant'))) {
    categories.push('serum_exfoliant');
  } else if (looksLikeHydrating) {
    categories.push('serum_hydrating');
  } else if (stepStr === 'serum' || categoryStr === 'serum') {
    // Generic serum is safe only as a neutral serum. Goal-specific serum slots
    // require step/category or ingredient signals above.
    categories.push('serum_hydrating');
  }

  // --- Treatment / spot ---
  if (stepStr.startsWith('treatment_acne_bpo') || stepStr.includes('benzoyl peroxide')) {
    categories.push('treatment_acne_bpo');
  } else if (stepStr.startsWith('treatment_acne_azelaic') || stepStr.includes('azelaic')) {
    categories.push('treatment_acne_azelaic');
  } else if (stepStr.startsWith('treatment_acne_local') || stepStr.includes('spot treatment')) {
    categories.push('treatment_acne_local');
  } else if (stepStr.startsWith('treatment_exfoliant_mild') || (stepStr.includes('exfoliant') && !stepStr.includes('strong'))) {
    categories.push('treatment_exfoliant_mild');
  } else if (stepStr.startsWith('treatment_exfoliant_strong') || stepStr.includes('strong exfoliant')) {
    categories.push('treatment_exfoliant_strong');
  } else if (stepStr.startsWith('treatment_pigmentation') || stepStr.includes('pigmentation')) {
    categories.push('treatment_pigmentation');
  } else if (stepStr.startsWith('treatment_antiage') || stepStr.includes('antiage') || stepStr.includes('anti-age')) {
    categories.push('treatment_antiage');
  } else if (stepStr.startsWith('treatment_acid') || (stepStr.includes('treatment') && stepStr.includes('acid'))) {
    categories.push('treatment_acid');
  } else if (stepStr.startsWith('spot_treatment') || stepStr.includes('spot treatment')) {
    categories.push('spot_treatment');
  } else if (stepStr === 'treatment' || categoryStr === 'treatment') {
    categories.push(
      'treatment_acne_azelaic',
      'treatment_acne_bpo',
      'treatment_exfoliant_mild',
      'treatment_exfoliant_strong',
      'treatment_pigmentation',
      'treatment_antiage',
      'treatment_acid'
    );
  }

  // --- Moisturizer ---
  // В проекте встречается legacy stepCategory "moisturizer_rich" (см. scripts/update-products-metadata.ts),
  // но в генераторе плана мы используем "moisturizer_barrier/soothing/light/balancing".
  // Поэтому rich маппим в более безопасные аналоги.
  if (stepStr.startsWith('moisturizer_rich') || (isMoisturizerContext && stepStr.includes('rich'))) {
    categories.push('moisturizer_barrier', 'moisturizer_soothing');
  } else if (stepStr.startsWith('moisturizer_light') || (isMoisturizerContext && stepStr.includes('light'))) {
    categories.push('moisturizer_light');
  } else if (stepStr.startsWith('moisturizer_balancing') || (isMoisturizerContext && stepStr.includes('balancing'))) {
    categories.push('moisturizer_balancing');
  } else if (stepStr.startsWith('moisturizer_barrier') || (isMoisturizerContext && stepStr.includes('barrier'))) {
    categories.push('moisturizer_barrier');
  } else if (stepStr.startsWith('moisturizer_soothing') || (isMoisturizerContext && stepStr.includes('soothing'))) {
    categories.push('moisturizer_soothing');
  } else if (!isLipContext && (stepStr === 'moisturizer' || stepStr === 'cream' || categoryStr === 'moisturizer' || categoryStr === 'cream')) {
    const normalizedSkinType = (skinType || '').toLowerCase();
    if (normalizedSkinType === 'dry' || normalizedSkinType === 'combination_dry') {
      categories.push('moisturizer_barrier', 'moisturizer_soothing', 'moisturizer_light');
    } else {
      categories.push('moisturizer_light', 'moisturizer_balancing', 'moisturizer_barrier');
    }
  }

  // --- SPF ---
  const spfPattern = /\b(spf|sunscreen|защит)\b/i;
  if (stepStr.startsWith('spf_50_sensitive') || (spfPattern.test(stepStr) && /\bsensitive\b/i.test(stepStr))) {
    categories.push('spf_50_sensitive');
  } else if (stepStr.startsWith('spf_50_oily') || (spfPattern.test(stepStr) && /\boily\b/i.test(stepStr))) {
    categories.push('spf_50_oily');
  } else if (stepStr.startsWith('spf_50_face') || stepStr === 'spf' || categoryStr === 'spf' || spfPattern.test(stepStr)) {
    categories.push('spf_50_face');
  }

  // --- Mask ---
  if (stepStr.startsWith('mask_clay') || (stepStr.includes('mask') && stepStr.includes('clay'))) {
    categories.push('mask_clay');
  } else if (stepStr.startsWith('mask_hydrating') || (stepStr.includes('mask') && stepStr.includes('hydrating'))) {
    categories.push('mask_hydrating');
  } else if (stepStr.startsWith('mask_soothing') || (stepStr.includes('mask') && stepStr.includes('soothing'))) {
    categories.push('mask_soothing');
  } else if (stepStr.startsWith('mask_sleeping') || (stepStr.includes('mask') && stepStr.includes('sleeping'))) {
    categories.push('mask_sleeping');
  } else if (stepStr.startsWith('mask_enzyme') || (stepStr.includes('mask') && (stepStr.includes('enzyme') || stepStr.includes('papain') || stepStr.includes('bromelain')))) {
    categories.push('mask_enzyme');
  } else if (stepStr.startsWith('mask_acid') || stepStr.startsWith('mask_peel') || (stepStr.includes('mask') && (stepStr.includes('acid') || stepStr.includes('peel') || stepStr.includes('lactic') || stepStr.includes('mandelic')))) {
    categories.push('mask_acid', 'mask_peel');
  } else if (stepStr === 'mask' || categoryStr === 'mask') {
    categories.push('mask_clay', 'mask_hydrating', 'mask_soothing', 'mask_sleeping', 'mask_enzyme', 'mask_acid');
  }

  // --- Extras ---
  if (stepStr.startsWith('lip_care') || stepStr.includes('lip')) {
    categories.push('lip_care');
  }
  // ВАЖНО: не считаем лип-бальзамы (lip balm) барьерным бальзамом для лица.
  if (stepStr.startsWith('balm_barrier_repair') || (!isLipContext && stepStr.includes('balm'))) {
    categories.push('balm_barrier_repair');
  }

  // Hard fallback
  if (categories.length === 0) {
    const base = stepStr || categoryStr || '';
    if (base.includes('cleanser') || base.includes('очищ')) return ['cleanser_gentle'];
    if (base.includes('toner') || base.includes('тоник')) return ['toner_hydrating'];
    if (base.includes('serum') || base.includes('сыворотк')) return ['serum_hydrating'];
    if (base.includes('treatment') || base.includes('лечени') || base.includes('активн')) return ['treatment_antiage'];
    if (base.includes('moisturizer') || base.includes('cream') || base.includes('крем') || base.includes('увлажн')) return ['moisturizer_light'];
    if (base.includes('spf') || base.includes('sunscreen') || base.includes('защит')) return ['spf_50_face'];
    if (base.includes('mask') || base.includes('маск')) return ['mask_hydrating'];
  }

  return categories;
}
