// lib/step-matching.ts
// ИСПРАВЛЕНО (P0): Единая логика маппинга product.step/category -> StepCategory[]
// Все категории нормализуются к каноническим StepCategory перед использованием
//
// ВАЖНО: В БД встречаются как "базовые" step (serum, moisturizer, spf),
// так и "детальные" stepCategory (serum_hydrating, spf_50_face, moisturizer_rich и т.п.).
// Этот маппер нужен, чтобы любой продукт можно было привязать к одному или нескольким StepCategory,
// а значит — гарантированно использовать в плане.

import type { StepCategory } from './step-category-rules';

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

export function mapStepToStepCategory(
  step: string | null | undefined,
  category: string | null | undefined,
  skinType?: string | null
): StepCategory[] {
  // ИСПРАВЛЕНО (P0): Нормализуем входные строки перед сравнением
  const stepStr = normalizeStepString(step || category);
  const categoryStr = normalizeStepString(category);
  const categories: StepCategory[] = [];

  const isCleanserContext = stepStr.includes('cleanser') || categoryStr === 'cleanser';
  const isTonerContext = stepStr.includes('toner') || categoryStr === 'toner';
  const isSerumContext = stepStr.includes('serum') || categoryStr === 'serum';
  const isMoisturizerContext =
    stepStr.includes('moisturizer') ||
    stepStr.includes('cream') ||
    categoryStr === 'moisturizer' ||
    categoryStr === 'cream';

  // --- Cleanser ---
  const oilPattern = /\b(oil|масло)\b/i;
  if (
    stepStr === 'cleanser_oil' ||
    stepStr.includes('_oil') ||
    oilPattern.test(stepStr) ||
    categoryStr === 'oil' ||
    categoryStr.includes('_oil') ||
    oilPattern.test(categoryStr)
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
    (isSerumContext && (stepStr.includes('vitamin c') || stepStr.includes('vitc') || stepStr.includes('ascorb') || stepStr.includes('ce ferulic')));
  const looksLikeHydrating =
    stepStr.startsWith('serum_hydrating') ||
    (isSerumContext && (stepStr.includes('hydrating') || stepStr.includes('hyalur') || stepStr.includes('hyaluron') || stepStr.includes('ha ')));

  if (looksLikeVitC) {
    categories.push('serum_vitc');
  } else if (looksLikeHydrating) {
    categories.push('serum_hydrating');
  } else if (stepStr.startsWith('serum_niacinamide') || (isSerumContext && stepStr.includes('niacinamide'))) {
    categories.push('serum_niacinamide');
  } else if (stepStr.startsWith('serum_anti_redness') || (isSerumContext && stepStr.includes('anti-redness'))) {
    categories.push('serum_anti_redness');
  } else if (stepStr.startsWith('serum_brightening') || (isSerumContext && stepStr.includes('brightening'))) {
    categories.push('serum_brightening_soft');
  } else if (stepStr.startsWith('serum_peptide') || (isSerumContext && (stepStr.includes('peptide') || stepStr.includes('copper peptide')))) {
    categories.push('serum_peptide');
  } else if (stepStr.startsWith('serum_antiage') || (isSerumContext && (stepStr.includes('antiage') || stepStr.includes('anti-age')))) {
    categories.push('serum_antiage');
  } else if (stepStr.startsWith('serum_exfoliant') || (isSerumContext && (stepStr.includes('lactic') || stepStr.includes('mandelic') || stepStr.includes('exfoliant')))) {
    categories.push('serum_exfoliant');
  } else if (stepStr === 'serum' || categoryStr === 'serum') {
    categories.push('serum_hydrating', 'serum_niacinamide', 'serum_vitc', 'serum_brightening_soft', 'serum_peptide', 'serum_antiage');
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
  } else if (stepStr === 'moisturizer' || stepStr === 'cream' || categoryStr === 'moisturizer' || categoryStr === 'cream') {
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
  if (stepStr.startsWith('balm_barrier_repair') || stepStr.includes('balm')) {
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

export interface ProductStepMappingInput {
  step?: string | null;
  category?: string | null;
  name?: string | null;
  activeIngredients?: string[] | null;
  concerns?: string[] | null;
}

function uniqStepCategories(categories: StepCategory[]): StepCategory[] {
  return Array.from(new Set(categories));
}

function productSearchText(product: ProductStepMappingInput): string {
  return [
    product.step,
    product.category,
    product.name,
    ...(product.activeIngredients || []),
    ...(product.concerns || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const AHA_PATTERNS = [/aha\b/i, /glycolic|гликолев/i, /lactic|молочн/i, /mandelic|миндальн/i];
const BHA_PATTERNS = [/bha\b/i, /salicylic|салицил/i];
const ACID_PATTERNS = [
  ...AHA_PATTERNS,
  ...BHA_PATTERNS,
  /pha\b/i,
  /acid|кислот/i,
  /exfoliant|exfoliat|пилинг|peel/i,
];
const STRONG_EXFOLIANT_PATTERNS = [/30%|20%|peel|пилинг|strong/i];
const BPO_PATTERNS = [/benzoyl|benzoyl[_\s-]?peroxide|bpo|бензоил/i];
const AZELAIC_PATTERNS = [/azelaic|азелаин/i];
const RETINOID_PATTERNS = [/retinol|retinoid|retinal|adapalene|tretinoin|ретинол|ретиноид|адапален/i];
const HYDRATING_PATTERNS = [/hyalur|гиалурон/i, /glycerin|глицерин/i, /squalane|сквалан/i, /hydrating|увлажн/i];
const SOOTHING_PATTERNS = [/centella|центелл/i, /panthenol|пантенол/i, /allantoin|аллантоин/i, /soothing|успока/i, /ceramide|церамид/i];
const NIACINAMIDE_PATTERNS = [/niacinamide|ниацинамид/i];
const VITC_PATTERNS = [/vitamin\s*c|vitamin_c|vitc|ascorb|аскорбин/i];
const PEPTIDE_PATTERNS = [/peptide|пептид/i];
const BRIGHTENING_PATTERNS = [/tranexamic|транексам/i, /arbutin|арбутин/i, /hydroquinone|гидрохинон/i, /brightening|осветл/i];
const CLAY_PATTERNS = [/clay|каолин|глин/i];
const ENZYME_PATTERNS = [/enzyme|papain|bromelain|энзим|папаин|бромелайн/i];
const SLEEPING_MASK_PATTERNS = [/sleeping|ночн/i];

/**
 * Product-aware mapping for assigning catalogue products to plan step categories.
 *
 * `mapStepToStepCategory()` intentionally keeps broad legacy behaviour for old
 * imports. This helper narrows generic catalogue rows using product metadata so
 * active products cannot masquerade as gentle hydration/soothing steps.
 */
export function mapProductToStepCategories(
  product: ProductStepMappingInput,
  skinType?: string | null
): StepCategory[] {
  const fallback = mapStepToStepCategory(product.step, product.category, skinType);
  const text = productSearchText(product);
  const stepStr = normalizeStepString(product.step);
  const categoryStr = normalizeStepString(product.category);

  const isToner = stepStr.startsWith('toner') || categoryStr === 'toner';
  if (isToner) {
    if (hasAny(text, ACID_PATTERNS)) {
      const acidSteps: StepCategory[] = ['toner_exfoliant', 'toner_acid'];
      if (hasAny(text, AHA_PATTERNS)) acidSteps.push('toner_aha');
      if (hasAny(text, BHA_PATTERNS)) acidSteps.push('toner_bha');
      return uniqStepCategories(acidSteps);
    }

    if (hasAny(text, SOOTHING_PATTERNS)) {
      return uniqStepCategories(['toner_soothing', 'toner_hydrating']);
    }

    if (hasAny(text, HYDRATING_PATTERNS) || stepStr === 'toner' || categoryStr === 'toner') {
      return uniqStepCategories(['toner_hydrating', 'toner_soothing']);
    }
  }

  const isTreatment = stepStr.startsWith('treatment') || categoryStr === 'treatment';
  if (isTreatment) {
    if (hasAny(text, BPO_PATTERNS)) return ['treatment_acne_bpo'];
    if (hasAny(text, AZELAIC_PATTERNS)) return ['treatment_acne_azelaic'];
    if (hasAny(text, RETINOID_PATTERNS)) return ['treatment_antiage'];
    if (hasAny(text, BRIGHTENING_PATTERNS)) return ['treatment_pigmentation'];
    if (hasAny(text, ACID_PATTERNS)) {
      return uniqStepCategories([
        hasAny(text, STRONG_EXFOLIANT_PATTERNS) ? 'treatment_exfoliant_strong' : 'treatment_exfoliant_mild',
        'treatment_acid',
      ]);
    }

    if (stepStr === 'treatment' || categoryStr === 'treatment') {
      return ['treatment_acne_local'];
    }
  }

  const isSerum = stepStr.startsWith('serum') || categoryStr === 'serum';
  if (isSerum) {
    if (hasAny(text, NIACINAMIDE_PATTERNS)) return ['serum_niacinamide'];
    if (hasAny(text, VITC_PATTERNS)) return ['serum_vitc'];
    if (hasAny(text, ACID_PATTERNS)) return ['serum_exfoliant'];
    if (hasAny(text, PEPTIDE_PATTERNS)) return ['serum_peptide'];
    if (hasAny(text, RETINOID_PATTERNS)) return ['serum_antiage'];
    if (hasAny(text, BRIGHTENING_PATTERNS)) return ['serum_brightening_soft'];
    if (hasAny(text, SOOTHING_PATTERNS)) return ['serum_anti_redness', 'serum_hydrating'];
    if (hasAny(text, HYDRATING_PATTERNS) || stepStr === 'serum' || categoryStr === 'serum') {
      return ['serum_hydrating'];
    }
  }

  const isMask = stepStr.startsWith('mask') || categoryStr === 'mask';
  if (isMask) {
    if (hasAny(text, CLAY_PATTERNS)) return ['mask_clay'];
    if (hasAny(text, ACID_PATTERNS)) {
      return uniqStepCategories([
        hasAny(text, STRONG_EXFOLIANT_PATTERNS) ? 'mask_peel' : 'mask_acid',
        'mask_acid',
      ]);
    }
    if (hasAny(text, ENZYME_PATTERNS)) return ['mask_enzyme'];
    if (hasAny(text, SLEEPING_MASK_PATTERNS)) return ['mask_sleeping'];
    if (hasAny(text, SOOTHING_PATTERNS)) return ['mask_soothing'];
    if (hasAny(text, HYDRATING_PATTERNS) || stepStr === 'mask' || categoryStr === 'mask') {
      return ['mask_hydrating'];
    }
  }

  return fallback;
}

export function areStepCategoriesCompatibleForFallback(
  requestedStep: StepCategory,
  candidateStep: StepCategory
): boolean {
  if (requestedStep === candidateStep) return true;

  const isTreatmentLike = (step: StepCategory) => step.startsWith('treatment_') || step === 'spot_treatment';
  if (isTreatmentLike(requestedStep) && isTreatmentLike(candidateStep)) {
    const groups: StepCategory[][] = [
      ['treatment_acne_bpo'],
      ['treatment_acne_azelaic'],
      ['treatment_acne_local', 'spot_treatment'],
      ['treatment_exfoliant_mild', 'treatment_exfoliant_strong', 'treatment_acid'],
      ['treatment_pigmentation'],
      ['treatment_antiage'],
    ];

    const group = groups.find((steps) => steps.includes(requestedStep));
    return group ? group.includes(candidateStep) : false;
  }

  const requestedBase = requestedStep.split('_')[0];
  const candidateBase = candidateStep.split('_')[0];
  if (requestedBase !== candidateBase) return false;

  if (requestedBase === 'toner') {
    const gentleToners = new Set<StepCategory>(['toner_hydrating', 'toner_soothing']);
    const acidToners = new Set<StepCategory>(['toner_exfoliant', 'toner_acid', 'toner_aha', 'toner_bha']);

    if (gentleToners.has(requestedStep)) return gentleToners.has(candidateStep);
    if (acidToners.has(requestedStep)) return acidToners.has(candidateStep);
    return false;
  }

  if (requestedBase === 'serum') {
    const groups: StepCategory[][] = [
      ['serum_hydrating', 'serum_anti_redness', 'serum_niacinamide'],
      ['serum_vitc'],
      ['serum_brightening_soft'],
      ['serum_peptide'],
      ['serum_antiage'],
      ['serum_exfoliant'],
    ];

    const group = groups.find((steps) => steps.includes(requestedStep));
    return group ? group.includes(candidateStep) : false;
  }

  if (requestedBase === 'mask') {
    const groups: StepCategory[][] = [
      ['mask_clay'],
      ['mask_hydrating', 'mask_soothing', 'mask_sleeping'],
      ['mask_acid', 'mask_peel'],
      ['mask_enzyme'],
    ];

    const group = groups.find((steps) => steps.includes(requestedStep));
    return group ? group.includes(candidateStep) : false;
  }

  return true;
}
