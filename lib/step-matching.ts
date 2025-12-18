// lib/step-matching.ts
// Единая логика маппинга product.step/category -> StepCategory[]
//
// ВАЖНО: В БД встречаются как "базовые" step (serum, moisturizer, spf),
// так и "детальные" stepCategory (serum_hydrating, spf_50_face, moisturizer_rich и т.п.).
// Этот маппер нужен, чтобы любой продукт можно было привязать к одному или нескольким StepCategory,
// а значит — гарантированно использовать в плане.

import type { StepCategory } from './step-category-rules';

export function mapStepToStepCategory(
  step: string | null | undefined,
  category: string | null | undefined,
  skinType?: string | null
): StepCategory[] {
  const stepStr = (step || category || '').toLowerCase();
  const categoryStr = (category || '').toLowerCase();
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

