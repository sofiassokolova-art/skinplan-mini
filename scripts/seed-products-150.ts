// scripts/seed-products-150.ts
// Скрипт для очистки и загрузки 150 продуктов SkinIQ Russia Market

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Функция для создания slug
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

// Маппинг stepCategory на базовый step
function mapStepCategoryToStep(stepCategory: string): string {
  if (stepCategory.startsWith('cleanser_')) return 'cleanser';
  if (stepCategory.startsWith('toner_')) return 'toner';
  if (stepCategory.startsWith('serum_')) return 'serum';
  if (stepCategory.startsWith('treatment_')) return 'treatment';
  if (stepCategory.startsWith('moisturizer_')) return 'moisturizer';
  if (stepCategory.startsWith('eye_cream_')) return 'moisturizer'; // eye cream -> moisturizer
  if (stepCategory.startsWith('spf_')) return 'spf';
  if (stepCategory.startsWith('mask_')) return 'mask';
  if (stepCategory === 'spot_treatment') return 'treatment';
  if (stepCategory === 'lip_care') return 'moisturizer';
  if (stepCategory === 'balm_barrier_repair') return 'moisturizer';
  return 'moisturizer'; // fallback
}

// Маппинг segment на priceSegment
function mapSegmentToPriceSegment(segment: string): string {
  if (segment === 'budget') return 'mass';
  if (segment === 'mid') return 'mid';
  if (segment === 'premium') return 'premium';
  return 'mid'; // fallback
}

// Маппинг skinTypes (может быть "any" или массив)
function mapSkinTypes(skinTypes: string[]): string[] {
  if (skinTypes.includes('any')) return ['dry', 'normal', 'combination_dry', 'combination_oily', 'oily'];
  return skinTypes.map(t => {
    // Нормализация названий
    if (t === 'combo') return 'combination_oily';
    if (t === 'combination_dry') return 'combination_dry';
    if (t === 'combination_oily') return 'combination_oily';
    return t;
  });
}

// Данные продуктов
const productsData = [
  // 1. ОЧИЩЕНИЕ — GENTLE (12 средств)
  { id: "cerave_hydrating", brand: "CeraVe", name: "Hydrating Cleanser", segment: "budget", skinTypes: ["dry", "normal", "combination_dry"], stepCategory: "cleanser_gentle" },
  { id: "cerave_hydrating_cream_to_foam", brand: "CeraVe", name: "Cream-to-Foam Cleanser", segment: "budget", skinTypes: ["dry", "normal"], stepCategory: "cleanser_gentle" },
  { id: "laroche_toleriane_gel", brand: "La Roche-Posay", name: "Toleriane Dermo Cleanser", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "cleanser_gentle" },
  { id: "bioderma_sensibio_gel", brand: "Bioderma", name: "Sensibio Gel Moussant", segment: "mid", skinTypes: ["dry", "normal", "combination_dry"], stepCategory: "cleanser_gentle" },
  { id: "uriage_xemose_oil", brand: "Uriage", name: "Xémose Cleansing Soothing Oil", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "cleanser_gentle" },
  { id: "avene_tolerance_gel", brand: "Avene", name: "Tolerance Extremely Gentle Cleanser", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "cleanser_gentle" },
  { id: "iq_derma_soft_gel", brand: "IQ Derma", name: "Soft Cleansing Gel", segment: "budget", skinTypes: ["dry", "normal"], stepCategory: "cleanser_gentle" },
  { id: "for_me_gentle_gel", brand: "For Me", name: "Gentle Gel Cleanser", segment: "budget", skinTypes: ["dry", "normal"], stepCategory: "cleanser_gentle" },
  { id: "bioderma_atoderm_gel", brand: "Bioderma", name: "Atoderm Shower/Cleanser Gel", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "cleanser_gentle" },
  { id: "eucerin_ultra_sensitive", brand: "Eucerin", name: "Ultra Sensitive Cleanser", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "cleanser_gentle" },
  { id: "clinique_rinse_off", brand: "Clinique", name: "Rinse-Off Foaming Cleanser", segment: "premium", skinTypes: ["dry", "normal"], stepCategory: "cleanser_gentle" },
  { id: "shiseido_gentle_foam", brand: "Shiseido", name: "Gentle Cleanser", segment: "premium", skinTypes: ["dry", "normal"], stepCategory: "cleanser_gentle" },

  // 2. ОЧИЩЕНИЕ — BALANCING (10 средств)
  { id: "laroche_effaclar_gel", brand: "La Roche-Posay", name: "Effaclar Gel", segment: "mid", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_balancing" },
  { id: "bioderma_sebium_gel", brand: "Bioderma", name: "Sébium Gel", segment: "mid", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_balancing" },
  { id: "cerave_foaming", brand: "CeraVe", name: "Foaming Cleanser", segment: "budget", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_balancing" },
  { id: "cosrx_lowph_cleanser", brand: "COSRX", name: "Low pH Good Morning Gel", segment: "mid", skinTypes: ["normal", "combination_oily", "oily"], stepCategory: "cleanser_balancing" },
  { id: "medi_peel_ac_bubble", brand: "Medi-Peel", name: "A.C Bubble Cleanser", segment: "mid", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_balancing" },
  { id: "somebymi_miracle_foam", brand: "Some By Mi", name: "Miracle Acne Foam", segment: "budget", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_balancing" },
  { id: "for_me_pore_cleanser", brand: "For Me", name: "Pore Cleansing Gel", segment: "budget", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_balancing" },
  { id: "skin1004_centric_cleanser", brand: "SKIN1004", name: "Centella Mild Cleansing Gel", segment: "mid", skinTypes: ["normal", "combination_oily"], stepCategory: "cleanser_balancing" },
  { id: "drjart_teatreement_foam", brand: "Dr.Jart+", name: "Teatreement Cleansing Foam", segment: "premium", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_balancing" },
  { id: "dermacos_pure_clean_gel", brand: "Dermacos", name: "Pure Clean Gel", segment: "budget", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_balancing" },

  // 3. DEEP CLEAN / ACID / PORE (8 средств)
  { id: "cosrx_salic_cleanser", brand: "COSRX", name: "Salicylic Acid Cleanser", segment: "mid", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_deep" },
  { id: "somebymi_aha_bha_foam", brand: "Some By Mi", name: "AHA-BHA-PHA Foam", segment: "budget", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_deep" },
  { id: "the_inkey_salic_cleanser", brand: "The Inkey List", name: "Salicylic Acid Cleanser", segment: "mid", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_deep" },
  { id: "paulas_choice_pore_normalizing", brand: "Paula's Choice", name: "Pore Normalizing Cleanser", segment: "premium", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_deep" },
  { id: "holika_tea_tree_foam", brand: "Holika Holika", name: "Tea Tree Foam", segment: "budget", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_deep" },
  { id: "dr_ceuticals_pore_clean", brand: "Dr.Ceuracle", name: "Tea Tree Cleansing Foam", segment: "premium", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_deep" },
  { id: "mixit_clean_pores", brand: "Mixit", name: "Clean Pores Gel", segment: "budget", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_deep" },
  { id: "cleara_pro_gel", brand: "Cleara", name: "Anti-Acne Gel Cleanser", segment: "budget", skinTypes: ["combination_oily", "oily"], stepCategory: "cleanser_deep" },

  // 4. Тоники / эссенции (10 штук)
  { id: "pyunkang_essence_toner", brand: "Pyunkang Yul", name: "Essence Toner", segment: "mid", skinTypes: ["dry", "normal", "combination_dry"], stepCategory: "toner_hydrating" },
  { id: "hada_labo_lotion", brand: "Hada Labo", name: "Gokujyun Lotion", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "toner_hydrating" },
  { id: "cerave_hydrating_toner", brand: "CeraVe", name: "Hydrating Toner", segment: "budget", skinTypes: ["dry", "normal", "combination_dry"], stepCategory: "toner_hydrating" },
  { id: "laroche_hydrating_toner", brand: "La Roche-Posay", name: "Hydrating Tonic", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "toner_hydrating" },
  { id: "bioderma_sensibio_tonic", brand: "Bioderma", name: "Sensibio Tonic", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "toner_soothing" },
  { id: "uriage_thermal_mist", brand: "Uriage", name: "Thermal Water", segment: "budget", skinTypes: ["dry", "normal", "combination_dry"], stepCategory: "toner_soothing" },
  { id: "skin1004_centella_toner", brand: "SKIN1004", name: "Centella Toner", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "toner_soothing" },
  { id: "drjart_cicapair_toner", brand: "Dr.Jart+", name: "Cicapair Toner", segment: "premium", skinTypes: ["dry", "normal", "combination_dry"], stepCategory: "toner_soothing" },
  { id: "for_me_panthenol_toner", brand: "For Me", name: "Soothing Panthenol Toner", segment: "budget", skinTypes: ["dry", "normal"], stepCategory: "toner_soothing" },

  // 5. Сыворотки (25 средств)
  // serum_hydrating
  { id: "cosrx_hyaluronic_ampoule", brand: "COSRX", name: "Hydrium Triple Hyaluronic", segment: "mid", skinTypes: ["dry", "normal", "combination_dry"], stepCategory: "serum_hydrating" },
  { id: "cerave_hyal_serum", brand: "CeraVe", name: "Hydrating HA Serum", segment: "budget", skinTypes: ["dry", "normal"], stepCategory: "serum_hydrating" },
  { id: "the_ordinary_marine_hyal", brand: "The Ordinary", name: "Marine Hyaluronics", segment: "budget", skinTypes: ["dry", "normal"], stepCategory: "serum_hydrating" },
  { id: "medipeel_biocell_hyal", brand: "Medi-Peel", name: "Bio-Cell Hyaluron", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "serum_hydrating" },
  { id: "for_me_hyal_serum", brand: "For Me", name: "Hyaluron Serum", segment: "budget", skinTypes: ["dry", "normal"], stepCategory: "serum_hydrating" },

  // serum_niacinamide
  { id: "the_ordinary_niacinamide", brand: "The Ordinary", name: "Niacinamide 10%+Zinc", segment: "budget", skinTypes: ["normal", "combination_oily", "oily"], stepCategory: "serum_niacinamide" },
  { id: "cosrx_niacinamide_15", brand: "COSRX", name: "Niacinamide 15", segment: "mid", skinTypes: ["combination_oily", "oily"], stepCategory: "serum_niacinamide" },
  { id: "qa_niacinamide", brand: "Q+A", name: "Niacinamide Serum", segment: "budget", skinTypes: ["normal", "combination_oily"], stepCategory: "serum_niacinamide" },
  { id: "cerave_blemish_serum", brand: "CeraVe", name: "Blemish Control Serum", segment: "budget", skinTypes: ["oily", "combination_oily"], stepCategory: "serum_niacinamide" },
  { id: "mixit_niacinamide", brand: "Mixit", name: "Niacinamide Booster", segment: "budget", skinTypes: ["oily", "combination_oily"], stepCategory: "serum_niacinamide" },

  // serum_vitc / brightening
  { id: "cosrx_vitc23", brand: "COSRX", name: "Vitamin C 23", segment: "mid", skinTypes: ["normal", "combination_dry"], stepCategory: "serum_vitc" },
  { id: "somebymi_yuja_serum", brand: "Some By Mi", name: "Yuja Niacin", segment: "budget", skinTypes: ["normal", "combination_dry"], stepCategory: "serum_brightening_soft" },
  { id: "the_ordinary_ascorb_glucoside", brand: "The Ordinary", name: "Ascorbyl Glucoside 12%", segment: "budget", skinTypes: ["normal", "combination_dry"], stepCategory: "serum_vitc" },
  { id: "drjart_v7_toner", brand: "Dr.Jart+", name: "V7 Lightening", segment: "premium", skinTypes: ["normal"], stepCategory: "serum_brightening_soft" },
  { id: "medi_peel_vit_c_serum", brand: "Medi-Peel", name: "Vitamin C Ampoule", segment: "mid", skinTypes: ["normal", "combination_dry"], stepCategory: "serum_vitc" },

  // anti-redness
  { id: "laroche_rosaliac_ar", brand: "La Roche-Posay", name: "Rosaliac AR", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "serum_anti_redness" },
  { id: "uriage_roseliane", brand: "Uriage", name: "Roséliane Serum", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "serum_anti_redness" },
  { id: "drjart_cicapair_serum", brand: "Dr.Jart+", name: "Cicapair Serum", segment: "premium", skinTypes: ["dry", "normal"], stepCategory: "serum_anti_redness" },
  { id: "skin1004_centella_serum", brand: "SKIN1004", name: "Ampoule Centella", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "serum_anti_redness" },

  // 6. Лечебные средства (30 средств)
  // BPO
  { id: "baziron_5", brand: "Galderma", name: "Baziron AC 5%", segment: "mid", skinTypes: ["oily", "combination_oily"], stepCategory: "treatment_acne_bpo" },
  { id: "cleara_bpo_2", brand: "Cleara", name: "BPO 2.5%", segment: "budget", skinTypes: ["oily", "combination_oily"], stepCategory: "treatment_acne_bpo" },
  { id: "cleara_bpo_5", brand: "Cleara", name: "BPO 5%", segment: "budget", skinTypes: ["oily", "combination_oily"], stepCategory: "treatment_acne_bpo" },

  // Aza
  { id: "skinoren_gel", brand: "Skinoren", name: "Azelaic Acid 15% Gel", segment: "mid", skinTypes: ["normal", "combination_oily", "oily"], stepCategory: "treatment_acne_azelaic" },
  { id: "azelik_azelain", brand: "Azelik", name: "Azelaic Acid", segment: "budget", skinTypes: ["normal", "combination_oily"], stepCategory: "treatment_acne_azelaic" },
  { id: "the_ordinary_azelaic", brand: "The Ordinary", name: "Azelaic 10%", segment: "budget", skinTypes: ["normal", "combination_oily"], stepCategory: "treatment_acne_azelaic" },

  // spot
  { id: "effaclar_duo", brand: "La Roche-Posay", name: "Effaclar Duo(+)", segment: "mid", skinTypes: ["oily", "combination_oily"], stepCategory: "treatment_acne_local" },
  { id: "cosrx_ac_collection_spot", brand: "COSRX", name: "AC Collection Spot", segment: "mid", skinTypes: ["oily"], stepCategory: "treatment_acne_local" },
  { id: "mixit_anti_acne_spot", brand: "Mixit", name: "Acne Spot", segment: "budget", skinTypes: ["combination_oily", "oily"], stepCategory: "treatment_acne_local" },

  // exfoliant_mild
  { id: "cosrx_bha_power_liquid", brand: "COSRX", name: "BHA Blackhead Liquid", segment: "mid", skinTypes: ["oily", "combination_oily"], stepCategory: "treatment_exfoliant_mild" },
  { id: "somebymi_miracle_toner", brand: "Some By Mi", name: "AHA-BHA-PHA Toner", segment: "budget", skinTypes: ["oily"], stepCategory: "treatment_exfoliant_mild" },
  { id: "the_inkey_bha", brand: "The Inkey List", name: "Beta Hydroxy Acid", segment: "mid", skinTypes: ["oily"], stepCategory: "treatment_exfoliant_mild" },
  { id: "paulas_choice_bha_2", brand: "Paula's Choice", name: "2% BHA", segment: "premium", skinTypes: ["oily"], stepCategory: "treatment_exfoliant_mild" },

  // exfoliant_strong
  { id: "the_ordinary_glycolic_7", brand: "The Ordinary", name: "Glycolic Acid 7%", segment: "budget", skinTypes: ["normal", "combination_oily"], stepCategory: "treatment_exfoliant_strong" },
  { id: "revuele_aha_peel", brand: "Revuele", name: "AHA Peeling", segment: "budget", skinTypes: ["normal"], stepCategory: "treatment_exfoliant_strong" },

  // pigmentation
  { id: "the_ordinary_alpha_arbutin", brand: "The Ordinary", name: "Alpha Arbutin", segment: "budget", skinTypes: ["normal"], stepCategory: "treatment_pigmentation" },
  { id: "laroche_pigmentclar", brand: "La Roche-Posay", name: "Pigmentclar", segment: "mid", skinTypes: ["normal"], stepCategory: "treatment_pigmentation" },
  { id: "medi_peel_mela_tox", brand: "Medi-Peel", name: "Mela Tox Ampoule", segment: "mid", skinTypes: ["normal"], stepCategory: "treatment_pigmentation" },

  // antiage
  { id: "medik8_crystal_retinal3", brand: "Medik8", name: "Crystal Retinal 3", segment: "premium", skinTypes: ["normal"], stepCategory: "treatment_antiage" },
  { id: "for_me_bakuchiol", brand: "For Me", name: "Bakuchiol Serum", segment: "budget", skinTypes: ["normal", "dry"], stepCategory: "treatment_antiage" },
  { id: "mixit_peptide_serum", brand: "Mixit", name: "Peptide Booster", segment: "budget", skinTypes: ["dry", "normal"], stepCategory: "treatment_antiage" },

  // 7. Увлажняющие кремы (20 средств)
  // light
  { id: "cerave_pm_lotion", brand: "CeraVe", name: "PM Facial Lotion", segment: "budget", skinTypes: ["normal", "combination_oily"], stepCategory: "moisturizer_light" },
  { id: "cosrx_oil_free_lotion", brand: "COSRX", name: "Oil-Free Ultra Moisturizing", segment: "mid", skinTypes: ["combination_oily", "oily"], stepCategory: "moisturizer_light" },
  { id: "mixit_light_gel", brand: "Mixit", name: "Light Gel Cream", segment: "budget", skinTypes: ["normal"], stepCategory: "moisturizer_light" },

  // balancing
  { id: "effaclar_mat", brand: "La Roche-Posay", name: "Effaclar MAT", segment: "mid", skinTypes: ["combination_oily", "oily"], stepCategory: "moisturizer_balancing" },
  { id: "bioderma_sebium_mat", brand: "Bioderma", name: "Sébium Mat Control", segment: "mid", skinTypes: ["oily"], stepCategory: "moisturizer_balancing" },
  { id: "for_me_mat_gel", brand: "For Me", name: "Matte Gel Cream", segment: "budget", skinTypes: ["oily"], stepCategory: "moisturizer_balancing" },

  // barrier
  { id: "cerave_moisturizing_cream", brand: "CeraVe", name: "Moisturizing Cream", segment: "budget", skinTypes: ["dry", "normal"], stepCategory: "moisturizer_barrier" },
  { id: "laroche_cicaplast_b5", brand: "La Roche-Posay", name: "Cicaplast Baume B5", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "moisturizer_barrier" },
  { id: "uriage_bariederm_cica", brand: "Uriage", name: "Bariederm Cica", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "moisturizer_barrier" },
  { id: "avene_cicalfate", brand: "Avene", name: "Cicalfate+", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "moisturizer_barrier" },

  // soothing
  { id: "toleriane_sensitive", brand: "La Roche-Posay", name: "Toleriane Sensitive", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "moisturizer_soothing" },
  { id: "drjart_cicapair_cream", brand: "Dr.Jart+", name: "Cicapair Cream", segment: "premium", skinTypes: ["dry", "normal"], stepCategory: "moisturizer_soothing" },
  { id: "mixit_cica_cream", brand: "Mixit", name: "Cica Cream", segment: "budget", skinTypes: ["dry"], stepCategory: "moisturizer_soothing" },

  // 8. Кремы для век (6 средств)
  { id: "cerave_eye", brand: "CeraVe", name: "Eye Repair Cream", segment: "budget", skinTypes: ["dry", "normal"], stepCategory: "eye_cream_basic" },
  { id: "laroche_hyalu_eye", brand: "La Roche-Posay", name: "Hyalu B5 Eye", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "eye_cream_basic" },
  { id: "kiehls_avocado", brand: "Kiehl's", name: "Creamy Eye Avocado", segment: "premium", skinTypes: ["dry", "normal"], stepCategory: "eye_cream_basic" },
  { id: "drjart_cicapair_eye", brand: "Dr.Jart+", name: "Cicapair Eye", segment: "premium", skinTypes: ["dry", "normal"], stepCategory: "eye_cream_basic" },
  { id: "mixit_eye_lift", brand: "Mixit", name: "Eye Lift Gel", segment: "budget", skinTypes: ["normal"], stepCategory: "eye_cream_basic" },
  { id: "for_me_eye_care", brand: "For Me", name: "Gentle Eye Cream", segment: "budget", skinTypes: ["normal"], stepCategory: "eye_cream_basic" },

  // 9. SPF (12 средств)
  // spf_50_face
  { id: "dalba_waterfull_spf", brand: "d'Alba", name: "Waterfull Essence SPF50", segment: "mid", skinTypes: ["normal", "combination_dry"], stepCategory: "spf_50_face" },
  { id: "laroche_uvmune_fluid", brand: "La Roche-Posay", name: "UVMune 400 Fluid", segment: "mid", skinTypes: ["normal", "combination_oily"], stepCategory: "spf_50_face" },
  { id: "skin1004_centella_spf", brand: "SKIN1004", name: "Centella SPF50", segment: "mid", skinTypes: ["normal", "combination_oily"], stepCategory: "spf_50_face" },

  // spf_50_oily
  { id: "eucerin_oil_control_spf", brand: "Eucerin", name: "Oil Control SPF50+", segment: "mid", skinTypes: ["oily", "combination_oily"], stepCategory: "spf_50_oily" },
  { id: "bioderma_photoderm_aqua", brand: "Bioderma", name: "Photoderm AKN Mat SPF30/50", segment: "mid", skinTypes: ["oily"], stepCategory: "spf_50_oily" },
  { id: "somebymi_truecica_spf", brand: "Some By Mi", name: "Truecica Mineral 50+", segment: "budget", skinTypes: ["oily"], stepCategory: "spf_50_oily" },

  // spf_50_sensitive
  { id: "bioderma_ar_spf", brand: "Bioderma", name: "Photoderm AR SPF50+", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "spf_50_sensitive" },
  { id: "laroche_anthelios_comfort", brand: "La Roche-Posay", name: "Anthelios Comfort", segment: "mid", skinTypes: ["dry"], stepCategory: "spf_50_sensitive" },
  { id: "uriage_bariederm_spf", brand: "Uriage", name: "Bariederm Cica SPF50", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "spf_50_sensitive" },

  // 10. Маски + Патчи + Доп. уход (15 средств)
  { id: "loreal_pure_clay", brand: "L'Oreal", name: "Pure Clay Mask", segment: "budget", skinTypes: ["oily"], stepCategory: "mask_clay" },
  { id: "laroche_effaclar_mask", brand: "La Roche-Posay", name: "Effaclar Clay Mask", segment: "mid", skinTypes: ["oily"], stepCategory: "mask_clay" },
  { id: "laneige_sleeping_mask", brand: "Laneige", name: "Sleeping Mask", segment: "premium", skinTypes: ["dry"], stepCategory: "mask_sleeping" },
  { id: "medi_peel_cica_mask", brand: "Medi-Peel", name: "Cica Mask", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "mask_soothing" },
  { id: "for_me_hydrating_sheet", brand: "For Me", name: "Hydrating Sheet Mask", segment: "budget", skinTypes: ["dry", "normal"], stepCategory: "mask_hydrating" },
  { id: "cosrx_snail_mask", brand: "COSRX", name: "Snail Hydrogel Mask", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "mask_hydrating" },
  { id: "uriage_cica_balm", brand: "Uriage", name: "Cica Balm", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "balm_barrier_repair" },
  { id: "laroche_cicaplast_b5_balm", brand: "La Roche-Posay", name: "Cicaplast Baume B5", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "balm_barrier_repair" },
  { id: "for_me_barrier_balm", brand: "For Me", name: "Barrier Balm", segment: "budget", skinTypes: ["dry"], stepCategory: "balm_barrier_repair" },
  { id: "nuxe_reve_de_miel", brand: "Nuxe", name: "Reve de Miel Lip Balm", segment: "mid", skinTypes: ["any"], stepCategory: "lip_care" },
  { id: "mixit_lip_balm", brand: "Mixit", name: "Lip Balm", segment: "budget", skinTypes: ["any"], stepCategory: "lip_care" },
  { id: "cosrx_ac_patch", brand: "COSRX", name: "AC Collection Patches", segment: "mid", skinTypes: ["oily"], stepCategory: "spot_treatment" },
  { id: "medi_peel_eye_patches", brand: "Medi-Peel", name: "Black Peptide Patches", segment: "mid", skinTypes: ["dry", "normal"], stepCategory: "spot_treatment" },
  { id: "somebymi_snail_patch", brand: "Some By Mi", name: "Snail Brightening Patch", segment: "budget", skinTypes: ["normal"], stepCategory: "spot_treatment" },
  { id: "mixit_pore_clay_mask", brand: "Mixit", name: "Pore Clay Mask", segment: "budget", skinTypes: ["oily"], stepCategory: "mask_clay" },
];

async function main() {
  console.log('🧹 Начинаю очистку продуктов из БД...');

  try {
    // Удаляем связанные записи
    console.log('📋 Удаляю связанные записи...');
    
    await prisma.wishlist.deleteMany({});
    await prisma.wishlistFeedback.deleteMany({});
    await prisma.productReplacement.deleteMany({});
    await prisma.recommendationSession.deleteMany({});
    
    // Удаляем продукты
    console.log('📦 Удаляю продукты...');
    const deletedCount = await prisma.product.deleteMany({});
    console.log(`✅ Удалено продуктов: ${deletedCount.count}`);

    console.log('📥 Начинаю загрузку 150 новых продуктов...');

    // Собираем уникальные бренды
    const uniqueBrands = new Set(productsData.map(p => p.brand));
    console.log(`📌 Найдено уникальных брендов: ${uniqueBrands.size}`);

    // Создаем или получаем бренды
    const brandMap = new Map<string, number>();
    for (const brandName of uniqueBrands) {
      const brand = await prisma.brand.upsert({
        where: { name: brandName },
        update: {},
        create: {
          name: brandName,
          slug: createSlug(brandName),
          isActive: true,
        },
      });
      brandMap.set(brandName, brand.id);
    }
    console.log(`✅ Бренды созданы/обновлены: ${brandMap.size}`);

    // Создаем продукты
    let createdCount = 0;
    for (let i = 0; i < productsData.length; i++) {
      const productData = productsData[i];
      const brandId = brandMap.get(productData.brand);
      if (!brandId) {
        console.warn(`⚠️  Бренд не найден: ${productData.brand}`);
        continue;
      }

      const step = mapStepCategoryToStep(productData.stepCategory);
      const priceSegment = mapSegmentToPriceSegment(productData.segment);
      const skinTypes = mapSkinTypes(productData.skinTypes);
      // Используем id из данных + индекс для уникальности slug
      const baseSlug = createSlug(`${productData.brand} ${productData.name}`);
      const slug = `${baseSlug}-${productData.id}`;

      await prisma.product.create({
        data: {
          brandId,
          name: productData.name,
          slug,
          step: productData.stepCategory, // Сохраняем полный stepCategory
          category: step, // Базовый category
          skinTypes,
          priceSegment,
          published: true,
          status: 'published',
        },
      });

      createdCount++;
      if (createdCount % 20 === 0) {
        console.log(`  ✅ Загружено продуктов: ${createdCount}/${productsData.length}`);
      }
    }

    console.log(`🎉 Успешно загружено ${createdCount} продуктов!`);
  } catch (error) {
    console.error('❌ Ошибка при загрузке:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Критическая ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

