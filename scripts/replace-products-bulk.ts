// scripts/replace-products-bulk.ts
// Массовая замена продуктов по их ID

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const skinIQReplacements = {
  "460": {
    original_name: "Hydrating Cleanser",
    original_step: "cleanser_gentle",
    original_category: "cleanser",
    original_skin_types: "dry, normal, combination_dry",
    replacement_id: 463,
    replacement_name: "Sensibio Gel Moussant",
    replacement_brand: "Bioderma",
    replacement_step: "cleanser_gentle",
    replacement_category: "cleanser",
    replacement_skin_types: "dry, normal, combination_dry",
    replacement_url_zy: "https://goldapple.ru/19000041345-sensibio",
  },
  "461": {
    original_name: "Cream-to-Foam Cleanser",
    original_step: "cleanser_gentle",
    original_category: "cleanser",
    original_skin_types: "dry, normal",
    replacement_id: 471,
    replacement_name: "Gentle Cleanser",
    replacement_brand: "Shiseido",
    replacement_step: "cleanser_gentle",
    replacement_category: "cleanser",
    replacement_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/15112500004-internal-power-resist",
  },
  "466": {
    original_name: "Soft Cleansing Gel",
    original_step: "cleanser_gentle",
    original_category: "cleanser",
    original_skin_types: "dry, normal",
    replacement_id: 471,
    replacement_name: "Gentle Cleanser",
    replacement_brand: "Shiseido",
    replacement_step: "cleanser_gentle",
    replacement_category: "cleanser",
    replacement_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/15112500004-internal-power-resist",
  },
  "474": {
    original_name: "Foaming Cleanser",
    original_step: "cleanser_balancing",
    original_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_id: 477,
    replacement_name: "Miracle Acne Foam",
    replacement_brand: "Some By Mi",
    replacement_step: "cleanser_balancing",
    replacement_category: "cleanser",
    replacement_skin_types: "combination_oily, oily",
    replacement_url_zy: "https://goldapple.ru/19760303639-aha-bha-pha-30-days-miracle-acne-clear-foam",
  },
  "478": {
    original_name: "Pore Cleansing Gel",
    original_step: "cleanser_balancing",
    original_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_id: 477,
    replacement_name: "Miracle Acne Foam",
    replacement_brand: "Some By Mi",
    replacement_step: "cleanser_balancing",
    replacement_category: "cleanser",
    replacement_skin_types: "combination_oily, oily",
    replacement_url_zy: "https://goldapple.ru/19760303639-aha-bha-pha-30-days-miracle-acne-clear-foam",
  },
  "480": {
    original_name: "Teatreement Cleansing Foam",
    original_step: "cleanser_balancing",
    original_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_id: 477,
    replacement_name: "Miracle Acne Foam",
    replacement_brand: "Some By Mi",
    replacement_step: "cleanser_balancing",
    replacement_category: "cleanser",
    replacement_skin_types: "combination_oily, oily",
    replacement_url_zy: "https://goldapple.ru/19760303639-aha-bha-pha-30-days-miracle-acne-clear-foam",
  },
  "481": {
    original_name: "Pure Clean Gel",
    original_step: "cleanser_balancing",
    original_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_id: 477,
    replacement_name: "Miracle Acne Foam",
    replacement_brand: "Some By Mi",
    replacement_step: "cleanser_balancing",
    replacement_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_url_zy: "https://goldapple.ru/19760303639-aha-bha-pha-30-days-miracle-acne-clear-foam",
  },
  "483": {
    original_name: "AHA-BHA-PHA Foam",
    original_step: "cleanser_deep",
    original_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_id: 488,
    replacement_name: "Clean Pores Gel",
    replacement_brand: "Mixit",
    replacement_step: "cleanser_deep",
    replacement_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_url_zy: "https://goldapple.ru/19000181104-for-all-skin-types",
  },
  "484": {
    original_name: "Salicylic Acid Cleanser",
    original_step: "cleanser_deep",
    original_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_id: 488,
    replacement_name: "Clean Pores Gel",
    replacement_brand: "Mixit",
    replacement_step: "cleanser_deep",
    replacement_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_url_zy: "https://goldapple.ru/19000181104-for-all-skin-types",
  },
  "485": {
    original_name: "Pore Normalizing Cleanser",
    original_step: "cleanser_deep",
    original_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_id: 488,
    replacement_name: "Clean Pores Gel",
    replacement_brand: "Mixit",
    replacement_step: "cleanser_deep",
    replacement_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_url_zy: "https://goldapple.ru/19000181104-for-all-skin-types",
  },
  "489": {
    original_name: "Anti-Acne Gel Cleanser",
    original_step: "cleanser_deep",
    original_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_id: 488,
    replacement_name: "Clean Pores Gel",
    replacement_brand: "Mixit",
    replacement_step: "cleanser_deep",
    replacement_category: "cleanser",
    original_skin_types: "combination_oily, oily",
    replacement_url_zy: "https://goldapple.ru/19000181104-for-all-skin-types",
  },
  "492": {
    original_name: "Hydrating Toner",
    original_step: "toner_hydrating",
    original_category: "toner",
    original_skin_types: "dry, normal, combination_dry",
    replacement_id: 490,
    replacement_name: "Essence Toner",
    replacement_brand: "Pyunkang Yul",
    replacement_step: "toner_hydrating",
    replacement_category: "toner",
    original_skin_types: "dry, normal, combination_dry",
    replacement_url_zy: "https://goldapple.ru/19000150215-essence-toner",
  },
  "493": {
    original_name: "Hydrating Tonic",
    original_step: "toner_hydrating",
    original_category: "toner",
    original_skin_types: "dry, normal",
    replacement_id: 491,
    replacement_name: "Gokujyun Lotion",
    replacement_brand: "Hada Labo",
    replacement_step: "toner_hydrating",
    replacement_category: "toner",
    original_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/19000333837-gokujyun-milk",
  },
  "497": {
    original_name: "Cicapair Toner",
    original_step: "toner_soothing",
    original_category: "toner",
    original_skin_types: "dry, normal, combination_dry",
    replacement_id: 495,
    replacement_name: "Thermal Water",
    replacement_brand: "Uriage",
    replacement_step: "toner_soothing",
    replacement_category: "toner",
    original_skin_types: "dry, normal, combination_dry",
    replacement_url_zy: "https://goldapple.ru/89142200001-1st-thermal-water",
  },
  "500": {
    original_name: "Hydrating HA Serum",
    original_step: "serum_hydrating",
    original_category: "serum",
    original_skin_types: "dry, normal",
    replacement_id: 503,
    replacement_name: "Hyaluron Serum",
    replacement_brand: "For Me",
    replacement_step: "serum_hydrating",
    replacement_category: "serum",
    original_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/19000224127-noni-hyaluronic",
  },
  "501": {
    original_name: "Marine Hyaluronics",
    original_step: "serum_hydrating",
    original_category: "serum",
    original_skin_types: "dry, normal",
    replacement_id: 503,
    replacement_name: "Hyaluron Serum",
    replacement_brand: "For Me",
    replacement_step: "serum_hydrating",
    replacement_category: "serum",
    original_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/19000224127-noni-hyaluronic",
  },
  "502": {
    original_name: "Bio-Cell Hyaluron",
    original_step: "serum_hydrating",
    original_category: "serum",
    original_skin_types: "dry, normal",
    replacement_id: 503,
    replacement_name: "Hyaluron Serum",
    replacement_brand: "For Me",
    replacement_step: "serum_hydrating",
    replacement_category: "serum",
    original_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/19000224127-noni-hyaluronic",
  },
  "504": {
    original_name: "Niacinamide 10%+Zinc",
    original_step: "serum_niacinamide",
    original_category: "serum",
    original_skin_types: "normal, combination_oily, oily",
    replacement_id: 508,
    replacement_name: "Niacinamide Booster",
    replacement_brand: "Mixit",
    replacement_step: "serum_niacinamide",
    replacement_category: "serum",
    original_skin_types: "normal, combination_oily, oily",
    replacement_url_zy: "https://goldapple.ru/19000420958-niacinamide",
  },
  "507": {
    original_name: "Blemish Control Serum",
    original_step: "serum_niacinamide",
    original_category: "serum",
    original_skin_types: "oily, combination_oily",
    replacement_id: 508,
    replacement_name: "Niacinamide Booster",
    replacement_brand: "Mixit",
    replacement_step: "serum_niacinamide",
    replacement_category: "serum",
    original_skin_types: "normal, combination_oily, oily",
    replacement_url_zy: "https://goldapple.ru/19000420958-niacinamide",
  },
  "511": {
    original_name: "Ascorbyl Glucoside 12%",
    original_step: "serum_vitc",
    original_category: "serum",
    original_skin_types: "normal, combination_dry",
    replacement_id: 509,
    replacement_name: "Vitamin C 23",
    replacement_brand: "COSRX",
    replacement_step: "serum_vitc",
    replacement_category: "serum",
    original_skin_types: "normal, combination_dry",
    replacement_url_zy: "https://goldapple.ru/19000163788-the-vitamin-c-23-serum",
  },
  "512": {
    original_name: "V7 Lightening",
    original_step: "serum_brightening_soft",
    original_category: "serum",
    original_skin_types: "normal",
    replacement_id: 510,
    replacement_name: "Yuja Niacin",
    replacement_brand: "Some By Mi",
    replacement_step: "serum_brightening_soft",
    replacement_category: "serum",
    original_skin_types: "normal",
    replacement_url_zy: "https://goldapple.ru/19000240643-yuja-niacin-all-in-one",
  },
  "513": {
    original_name: "Vitamin C Ampoule",
    original_step: "serum_vitc",
    original_category: "serum",
    original_skin_types: "normal, combination_dry",
    replacement_id: 509,
    replacement_name: "Vitamin C 23",
    replacement_brand: "COSRX",
    replacement_step: "serum_vitc",
    replacement_category: "serum",
    original_skin_types: "normal, combination_dry",
    replacement_url_zy: "https://goldapple.ru/19000163788-the-vitamin-c-23-serum",
  },
  "518": {
    original_name: "Baziron AC 5%",
    original_step: "treatment_acne_bpo",
    original_category: "treatment",
    original_skin_types: "oily, combination_oily",
    replacement_id: 526,
    replacement_name: "Acne Spot",
    replacement_brand: "Mixit",
    replacement_step: "treatment_acne_local",
    replacement_category: "treatment",
    original_skin_types: "oily, combination_oily",
    replacement_url_zy: "https://goldapple.ru/19000383969-stop-acne",
  },
  "519": {
    original_name: "BPO 2.5%",
    original_step: "treatment_acne_bpo",
    original_category: "treatment",
    original_skin_types: "oily, combination_oily",
    replacement_id: 526,
    replacement_name: "Acne Spot",
    replacement_brand: "Mixit",
    replacement_step: "treatment_acne_local",
    replacement_category: "treatment",
    original_skin_types: "oily, combination_oily",
    replacement_url_zy: "https://goldapple.ru/19000383969-stop-acne",
  },
  "520": {
    original_name: "BPO 5%",
    original_step: "treatment_acne_bpo",
    original_category: "treatment",
    original_skin_types: "oily, combination_oily",
    replacement_id: 526,
    replacement_name: "Acne Spot",
    replacement_brand: "Mixit",
    replacement_step: "treatment_acne_local",
    replacement_category: "treatment",
    original_skin_types: "oily, combination_oily",
    replacement_url_zy: "https://goldapple.ru/19000383969-stop-acne",
  },
  "521": {
    original_name: "Azelaic Acid 15% Gel",
    original_step: "treatment_acne_azelaic",
    original_category: "treatment",
    original_skin_types: "normal, combination_oily, oily",
    replacement_id: 526,
    replacement_name: "Acne Spot",
    replacement_brand: "Mixit",
    replacement_step: "treatment_acne_local",
    replacement_category: "treatment",
    original_skin_types: "oily, combination_oily",
    replacement_url_zy: "https://goldapple.ru/19000383969-stop-acne",
  },
  "522": {
    original_name: "Azelaic Acid",
    original_step: "treatment_acne_azelaic",
    original_category: "treatment",
    original_skin_types: "normal, combination_oily",
    replacement_id: 526,
    replacement_name: "Acne Spot",
    replacement_brand: "Mixit",
    replacement_step: "treatment_acne_local",
    replacement_category: "treatment",
    original_skin_types: "oily, combination_oily",
    replacement_url_zy: "https://goldapple.ru/19000383969-stop-acne",
  },
  "523": {
    original_name: "Azelaic 10%",
    original_step: "treatment_acne_azelaic",
    original_category: "treatment",
    original_skin_types: "normal, combination_oily",
    replacement_id: 526,
    replacement_name: "Acne Spot",
    replacement_brand: "Mixit",
    replacement_step: "treatment_acne_local",
    replacement_category: "treatment",
    original_skin_types: "oily, combination_oily",
    replacement_url_zy: "https://goldapple.ru/19000383969-stop-acne",
  },
  "525": {
    original_name: "AC Collection Spot",
    original_step: "treatment_acne_local",
    original_category: "treatment",
    original_skin_types: "oily",
    replacement_id: 526,
    replacement_name: "Acne Spot",
    replacement_brand: "Mixit",
    replacement_step: "treatment_acne_local",
    replacement_category: "treatment",
    original_skin_types: "oily, combination_oily",
    replacement_url_zy: "https://goldapple.ru/19000383969-stop-acne",
  },
  "529": {
    original_name: "Beta Hydroxy Acid",
    original_step: "treatment_exfoliant_mild",
    original_category: "treatment",
    original_skin_types: "oily",
    replacement_id: 528,
    replacement_name: "AHA-BHA-PHA Toner",
    replacement_brand: "Some By Mi",
    replacement_step: "treatment_exfoliant_mild",
    replacement_category: "treatment",
    original_skin_types: "oily",
    replacement_url_zy: "https://goldapple.ru/19000062755-aha-bha-pha-30-days-miracle-toner-mini",
  },
  "530": {
    original_name: "2% BHA",
    original_step: "treatment_exfoliant_mild",
    original_category: "treatment",
    original_skin_types: "oily",
    replacement_id: 528,
    replacement_name: "AHA-BHA-PHA Toner",
    replacement_brand: "Some By Mi",
    replacement_step: "treatment_exfoliant_mild",
    replacement_category: "treatment",
    original_skin_types: "oily",
    replacement_url_zy: "https://goldapple.ru/19000062755-aha-bha-pha-30-days-miracle-toner-mini",
  },
  "531": {
    original_name: "Glycolic Acid 7%",
    original_step: "treatment_exfoliant_strong",
    original_category: "treatment",
    original_skin_types: "normal, combination_oily",
    replacement_id: 527,
    replacement_name: "BHA Blackhead Liquid",
    replacement_brand: "COSRX",
    replacement_step: "treatment_exfoliant_mild",
    replacement_category: "treatment",
    original_skin_types: "normal, combination_oily",
    replacement_url_zy: "https://goldapple.ru/97560200010-bha-blackhead-power-liquid",
  },
  "532": {
    original_name: "AHA Peeling",
    original_step: "treatment_exfoliant_strong",
    original_category: "treatment",
    original_skin_types: "normal",
    replacement_id: 528,
    replacement_name: "AHA-BHA-PHA Toner",
    replacement_brand: "Some By Mi",
    replacement_step: "treatment_exfoliant_mild",
    replacement_category: "treatment",
    original_skin_types: "oily",
    replacement_url_zy: "https://goldapple.ru/19000062755-aha-bha-pha-30-days-miracle-toner-mini",
  },
  "533": {
    original_name: "Alpha Arbutin",
    original_step: "treatment_pigmentation",
    original_category: "treatment",
    original_skin_types: "normal",
    replacement_id: 535,
    replacement_name: "Mela Tox Ampoule",
    replacement_brand: "Medi-Peel",
    replacement_step: "treatment_pigmentation",
    replacement_category: "treatment",
    original_skin_types: "normal",
    replacement_url_zy: "https://goldapple.ru/19000077165-bor-tox-ampoule-mask",
  },
  "534": {
    original_name: "Pigmentclar",
    original_step: "treatment_pigmentation",
    original_category: "treatment",
    original_skin_types: "normal",
    replacement_id: 535,
    replacement_name: "Mela Tox Ampoule",
    replacement_brand: "Medi-Peel",
    replacement_step: "treatment_pigmentation",
    replacement_category: "treatment",
    original_skin_types: "normal",
    replacement_url_zy: "https://goldapple.ru/19000077165-bor-tox-ampoule-mask",
  },
  "536": {
    original_name: "Crystal Retinal 3",
    original_step: "treatment_antiage",
    original_category: "treatment",
    original_skin_types: "normal",
    replacement_id: 538,
    replacement_name: "Peptide Booster",
    replacement_brand: "Mixit",
    replacement_step: "treatment_antiage",
    replacement_category: "treatment",
    original_skin_types: "normal",
    replacement_url_zy: "https://goldapple.ru/19000038692-skin-chemistry",
  },
  "539": {
    original_name: "PM Facial Lotion",
    original_step: "moisturizer_light",
    original_category: "moisturizer",
    original_skin_types: "normal, combination_oily",
    replacement_id: 541,
    replacement_name: "Light Gel Cream",
    replacement_brand: "For Me",
    replacement_step: "moisturizer_light",
    replacement_category: "moisturizer",
    original_skin_types: "normal, combination_oily",
    replacement_url_zy: "https://goldapple.ru/19000168215-wow-moisture",
  },
  "544": {
    original_name: "Matte Gel Cream",
    original_step: "moisturizer_balancing",
    original_category: "moisturizer",
    original_skin_types: "oily",
    replacement_id: 543,
    replacement_name: "Sébium Mat Control",
    replacement_brand: "Bioderma",
    replacement_step: "moisturizer_balancing",
    replacement_category: "moisturizer",
    original_skin_types: "oily",
    replacement_url_zy: "https://goldapple.ru/89270200008-sebium-mat-control-shine-control-moisturizer",
  },
  "545": {
    original_name: "Moisturizing Cream",
    original_step: "moisturizer_barrier",
    original_category: "moisturizer",
    original_skin_types: "dry, normal",
    replacement_id: 547,
    replacement_name: "Bariederm Cica",
    replacement_brand: "Uriage",
    replacement_step: "moisturizer_barrier",
    replacement_category: "moisturizer",
    original_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/19000093784-brriederm-cica-cleansing-gel-with-copper-zinc",
  },
  "551": {
    original_name: "Cica Cream",
    original_step: "moisturizer_soothing",
    original_category: "moisturizer",
    original_skin_types: "dry",
    replacement_id: 574,
    replacement_name: "Cicaplast Baume B5",
    replacement_brand: "La Roche-Posay",
    replacement_step: "balm_barrier_repair",
    replacement_category: "moisturizer",
    original_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/19000275596-cicaplast-baume-b5",
  },
  "552": {
    original_name: "Eye Repair Cream",
    original_step: "eye_cream_basic",
    original_category: "moisturizer",
    original_skin_types: "dry, normal",
    replacement_id: 555,
    replacement_name: "Cicapair Eye",
    replacement_brand: "Dr.Jart+",
    replacement_step: "eye_cream_basic",
    replacement_category: "moisturizer",
    original_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/19000380772-ceramidin",
  },
  "554": {
    original_name: "Creamy Eye Avocado",
    original_step: "eye_cream_basic",
    original_category: "moisturizer",
    original_skin_types: "dry, normal",
    replacement_id: 555,
    replacement_name: "Cicapair Eye",
    replacement_brand: "Dr.Jart+",
    replacement_step: "eye_cream_basic",
    replacement_category: "moisturizer",
    original_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/19000380772-ceramidin",
  },
  "556": {
    original_name: "Eye Lift Gel",
    original_step: "eye_cream_basic",
    original_category: "moisturizer",
    original_skin_types: "normal",
    replacement_id: 557,
    replacement_name: "Gentle Eye Cream",
    replacement_brand: "For Me",
    replacement_step: "eye_cream_basic",
    original_category: "moisturizer",
    original_skin_types: "normal",
    replacement_url_zy: "https://goldapple.ru/19000339797-ceramides-vit-b3",
  },
  "567": {
    original_name: "Pure Clay Mask",
    original_step: "mask_clay",
    original_category: "mask",
    original_skin_types: "oily",
    replacement_id: 568,
    replacement_name: "Effaclar Clay Mask",
    replacement_brand: "La Roche-Posay",
    replacement_step: "mask_clay",
    replacement_category: "mask",
    original_skin_types: "oily",
    replacement_url_zy: "https://goldapple.ru/89320200012-effaclar",
  },
  "569": {
    original_name: "Sleeping Mask",
    original_step: "mask_sleeping",
    original_category: "mask",
    original_skin_types: "dry",
    replacement_id: 572,
    replacement_name: "Snail Hydrogel Mask",
    replacement_brand: "COSRX",
    replacement_step: "mask_hydrating",
    replacement_category: "mask",
    original_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/19000402079-advanced-snail-mucin-mask",
  },
  "570": {
    original_name: "Cica Mask",
    original_step: "mask_soothing",
    original_category: "mask",
    original_skin_types: "dry, normal",
    replacement_id: 574,
    replacement_name: "Cicaplast Baume B5",
    replacement_brand: "La Roche-Posay",
    replacement_step: "balm_barrier_repair",
    replacement_category: "moisturizer",
    original_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/19000275596-cicaplast-baume-b5",
  },
  "576": {
    original_name: "Reve de Miel Lip Balm",
    original_step: "lip_care",
    original_category: "moisturizer",
    original_skin_types: "dry, normal, combination_dry, combination_oily, oily",
    replacement_id: 577,
    replacement_name: "Lip Balm",
    replacement_brand: "Mixit",
    replacement_step: "lip_care",
    replacement_category: "moisturizer",
    original_skin_types: "any",
    replacement_url_zy: "https://goldapple.ru/19000326972-lipstick-balm",
  },
  "579": {
    original_name: "Black Peptide Patches",
    original_step: "spot_treatment",
    original_category: "treatment",
    original_skin_types: "dry, normal",
    replacement_id: 580,
    replacement_name: "Snail Brightening Patch",
    replacement_brand: "Some By Mi",
    replacement_step: "spot_treatment",
    replacement_category: "treatment",
    original_skin_types: "dry, normal",
    replacement_url_zy: "https://goldapple.ru/19000143973-real-vitamin",
  },
  "581": {
    original_name: "Pore Clay Mask",
    original_step: "mask_clay",
    original_category: "mask",
    original_skin_types: "oily",
    replacement_id: 568,
    replacement_name: "Effaclar Clay Mask",
    replacement_brand: "La Roche-Posay",
    replacement_step: "mask_clay",
    replacement_category: "mask",
    original_skin_types: "oily",
    replacement_url_zy: "https://goldapple.ru/89320200012-effaclar",
  },
} as const;

async function replaceProductsBulk() {
  console.log('🔄 Начинаю массовую замену продуктов...\n');

  const replacements = Object.entries(skinIQReplacements);
  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ oldId: number; newId: number; error: string }> = [];

  for (const [oldIdStr, replacement] of replacements) {
    const oldId = parseInt(oldIdStr);
    const newId = replacement.replacement_id;

    try {
      console.log(`\n📦 Замена продукта ${oldId} → ${newId}`);
      console.log(`   Старый: ${replacement.original_name}`);
      console.log(`   Новый: ${replacement.replacement_name} (${replacement.replacement_brand})`);

      // Проверяем, что оба продукта существуют
      const oldProduct = await prisma.product.findUnique({
        where: { id: oldId },
      });

      const newProduct = await prisma.product.findUnique({
        where: { id: newId },
      });

      if (!oldProduct) {
        console.log(`   ⚠️ Старый продукт ${oldId} не найден, пропускаю`);
        errorCount++;
        errors.push({ oldId, newId, error: `Старый продукт не найден` });
        continue;
      }

      if (!newProduct) {
        console.log(`   ⚠️ Новый продукт ${newId} не найден, пропускаю`);
        errorCount++;
        errors.push({ oldId, newId, error: `Новый продукт не найден` });
        continue;
      }

      // 1. Обновляем Plan28 (все дни, где используется старый продукт)
      // ИСПРАВЛЕНО: Prisma не поддерживает JSON-поиск через path, получаем все планы и фильтруем в памяти
      const allPlan28sRaw = await prisma.plan28.findMany({});
      
      const plansToUpdate = allPlan28sRaw.filter(plan => {
        const days = plan.days as any[];
        if (!Array.isArray(days)) return false;
        
        return days.some((day: any) => {
          const morning = day.morning || [];
          const evening = day.evening || [];
          const weekly = day.weekly || [];
          
          const checkSteps = (steps: any[]) => {
            return steps.some((step: any) => {
              if (step.productId === String(oldId)) return true;
              const alternatives = step.alternatives || [];
              return alternatives.some((altId: string) => parseInt(altId) === oldId);
            });
          };
          
          return checkSteps(morning) || checkSteps(evening) || checkSteps(weekly);
        });
      });

      let plan28Updated = 0;
      for (const plan of plansToUpdate) {

        if (plan) {
          const updatedDays = (plan.days as any[]).map((day: any) => {
            const updateSteps = (steps: any[]) => {
              return steps.map((step: any) => {
                if (step.productId === String(oldId)) {
                  return { ...step, productId: String(newId) };
                }
                const updatedAlternatives = (step.alternatives || []).map((altId: string) =>
                  parseInt(altId) === oldId ? String(newId) : altId
                );
                return { ...step, alternatives: updatedAlternatives };
              });
            };

            return {
              ...day,
              morning: updateSteps(day.morning || []),
              evening: updateSteps(day.evening || []),
              weekly: updateSteps(day.weekly || []),
            };
          });

          await prisma.plan28.update({
            where: { id: planId },
            data: { days: updatedDays },
          });
          plan28Updated++;
        }
      }

      // 2. Обновляем RecommendationSession
      const sessions = await prisma.recommendationSession.findMany({
        where: {
          products: {
            array_contains: [oldId],
          },
        },
      });

      let sessionsUpdated = 0;
      for (const session of sessions) {
        const products = (session.products as number[]).map((pid) =>
          pid === oldId ? newId : pid
        );
        await prisma.recommendationSession.update({
          where: { id: session.id },
          data: { products },
        });
        sessionsUpdated++;
      }

      // 3. Обновляем Wishlist
      const wishlistItems = await prisma.wishlist.findMany({
        where: { productId: oldId },
      });

      let wishlistUpdated = 0;
      for (const item of wishlistItems) {
        await prisma.wishlist.update({
          where: { id: item.id },
          data: { productId: newId },
        });
        wishlistUpdated++;
      }

      // 4. Обновляем Cart
      const cartItems = await prisma.cart.findMany({
        where: { productId: oldId },
      });

      let cartUpdated = 0;
      for (const item of cartItems) {
        await prisma.cart.update({
          where: { id: item.id },
          data: { productId: newId },
        });
        cartUpdated++;
      }

      // 5. Создаем запись о замене в ProductReplacement
      const usersWithOldProduct = new Set<string>();
      
      // Собираем userId из всех мест, где используется старый продукт
      plan28s.forEach(plan => {
        if (plan.userId) usersWithOldProduct.add(plan.userId);
      });
      sessions.forEach(session => {
        usersWithOldProduct.add(session.userId);
      });
      wishlistItems.forEach(item => {
        usersWithOldProduct.add(item.userId);
      });
      cartItems.forEach(item => {
        usersWithOldProduct.add(item.userId);
      });

      for (const userId of usersWithOldProduct) {
        await prisma.productReplacement.create({
          data: {
            userId,
            oldProductId: oldId,
            newProductId: newId,
            reason: 'bulk_replacement',
          },
        });
      }

      // 6. Очищаем кэш для всех пользователей, у которых был старый продукт
      await prisma.cache.deleteMany({
        where: {
          userId: { in: Array.from(usersWithOldProduct) },
          OR: [
            { key: { startsWith: 'recommendations_' } },
            { key: { startsWith: 'plan_' } },
          ],
        },
      });

      console.log(`   ✅ Обновлено:`);
      console.log(`      - Plan28: ${plan28Updated} планов`);
      console.log(`      - RecommendationSession: ${sessionsUpdated} сессий`);
      console.log(`      - Wishlist: ${wishlistUpdated} записей`);
      console.log(`      - Cart: ${cartUpdated} записей`);
      console.log(`      - ProductReplacement: ${usersWithOldProduct.size} записей`);
      console.log(`      - Cache: очищен для ${usersWithOldProduct.size} пользователей`);

      successCount++;
    } catch (error: any) {
      console.error(`   ❌ Ошибка при замене ${oldId} → ${newId}:`, error.message);
      errorCount++;
      errors.push({ oldId, newId, error: error.message });
    }
  }

  console.log(`\n\n📊 Итоги:`);
  console.log(`   ✅ Успешно: ${successCount}`);
  console.log(`   ❌ Ошибок: ${errorCount}`);

  if (errors.length > 0) {
    console.log(`\n❌ Ошибки:`);
    errors.forEach(({ oldId, newId, error }) => {
      console.log(`   ${oldId} → ${newId}: ${error}`);
    });
  }

  console.log(`\n✅ Массовая замена завершена!`);
}

replaceProductsBulk()
  .then(() => {
    console.log('\n✅ Скрипт завершен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

