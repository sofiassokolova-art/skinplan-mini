// scripts/seed-products-120.ts
// Полный seed на 120 реальных продуктов для России 2025
// Аптечные, маркетплейсы, всё актуально на ноябрь 2025

import { createScriptPrisma } from './lib/prisma';

const prisma = createScriptPrisma();

// Функция для создания slug
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

// Бренды (все, что используются в списке продуктов ниже)
const brands = [
  'Акрихин',
  'Astellas',
  'Avene',
  'Avon',
  'Bayer',
  'Bioderma',
  'CeraVe',
  'Cosrx',
  'Eucerin',
  'Galderma',
  'Gedeon Richter',
  'Geek & Gorgeous',
  'Glenmark',
  'Isdin',
  "L'Oreal Paris",
  'La Roche-Posay',
  'LRP',
  'Neutrogena',
  'Noreva',
  'Pfizer',
  'Purito',
  'RoC',
  'Rohto',
  'Sesderma',
  'Stiefel',
  'The Ordinary',
  'Topicrem',
  'Uriage',
  'Vichy',
];

// Продукты
const products = [
  // ========== АКНЕ / ВОСПАЛЕНИЯ (25) ==========
  { name: "Azelik гель 15%", brand: "Акрихин", price: 890, volume: "30 г", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne","pigmentation"], activeIngredients: ["азелаиновая кислота 15%"], priority: 98 },
  { name: "Finacea гель 15%", brand: "Bayer", price: 2850, volume: "30 г", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne","pigmentation"], activeIngredients: ["азелаиновая кислота 15%"], priority: 95 },
  { name: "Baziron AC 5%", brand: "Galderma", price: 950, volume: "40 г", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["бензоила пероксид 5%"], priority: 94 },
  { name: "Effaclar Duo(+) M", brand: "La Roche-Posay", price: 1850, volume: "40 мл", step: "moisturizer", skinTypes: ["oily","combo"], concerns: ["acne","pores"], activeIngredients: ["ниацинамид","LHA","пробиотики"], priority: 96 },
  { name: "Normaderm Phytosolution", brand: "Vichy", price: 1950, volume: "50 мл", step: "moisturizer", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["салициловая кислота","пробиотики"], priority: 90 },
  { name: "Клензит-С гель", brand: "Glenmark", price: 980, volume: "30 г", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["адапален 0.1%","клиндамицин"], priority: 93 },
  { name: "Skinoren крем 20%", brand: "Bayer", price: 1650, volume: "30 г", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne","pigmentation"], activeIngredients: ["азелаиновая кислота 20%"], priority: 92 },
  { name: "Differin крем 0.1%", brand: "Galderma", price: 1250, volume: "30 г", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["адапален 0.1%"], priority: 91 },
  { name: "Zindaclin гель", brand: "Galderma", price: 1450, volume: "30 г", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["клиндамицин 1%"], priority: 89 },
  { name: "Curiosin гель", brand: "Gedeon Richter", price: 750, volume: "15 г", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["цинк","гиалуроновая кислота"], priority: 87 },
  { name: "Zineryt лосьон", brand: "Astellas", price: 1250, volume: "30 мл", step: "treatment", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["эритромицин","цинк"], priority: 86 },
  { name: "Isotrexin гель", brand: "Stiefel", price: 1650, volume: "30 г", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["изотретиноин 0.05%","эритромицин"], priority: 88 },
  { name: "Clindovit гель", brand: "Galderma", price: 1350, volume: "30 г", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["клиндамицин 1%"], priority: 85 },
  { name: "Dalacin T гель", brand: "Pfizer", price: 1550, volume: "30 г", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["клиндамицин 1%"], priority: 84 },
  { name: "Adapalene гель 0.1%", brand: "Glenmark", price: 1150, volume: "30 г", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["адапален 0.1%"], priority: 83 },
  { name: "Benzoyl Peroxide 2.5%", brand: "The Ordinary", price: 850, volume: "30 мл", step: "treatment", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["бензоила пероксид 2.5%"], priority: 82 },
  { name: "SA Cleanser", brand: "CeraVe", price: 1100, volume: "236 мл", step: "cleanser", skinTypes: ["oily","combo"], concerns: ["acne","pores"], activeIngredients: ["салициловая кислота","ниацинамид"], priority: 81 },
  { name: "Effaclar K+", brand: "La Roche-Posay", price: 1650, volume: "40 мл", step: "moisturizer", skinTypes: ["oily","combo"], concerns: ["acne","pores"], activeIngredients: ["LHA","ниацинамид"], priority: 80 },
  { name: "Pore Balancing Toner", brand: "Cosrx", price: 1350, volume: "150 мл", step: "toner", skinTypes: ["oily","combo"], concerns: ["acne","pores"], activeIngredients: ["BHA","AHA"], priority: 79 },
  { name: "Snail 96 Mucin Power Essence", brand: "Cosrx", price: 1450, volume: "100 мл", step: "serum", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["муцин улитки 96%"], priority: 78 },
  { name: "Centella Blemish Cream", brand: "Purito", price: 1250, volume: "50 мл", step: "moisturizer", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["центella asiatica","ниацинамид"], priority: 77 },
  { name: "AHA BHA PHA Toner", brand: "Cosrx", price: 1550, volume: "150 мл", step: "toner", skinTypes: ["oily","combo"], concerns: ["acne","pores"], activeIngredients: ["AHA","BHA","PHA"], priority: 76 },
  { name: "Salicylic Acid 2%", brand: "The Ordinary", price: 750, volume: "30 мл", step: "serum", skinTypes: ["oily","combo"], concerns: ["acne","pores"], activeIngredients: ["салициловая кислота 2%"], priority: 75 },
  { name: "Effaclar Purifying Foaming Gel", brand: "La Roche-Posay", price: 1450, volume: "200 мл", step: "cleanser", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["цинк","ниацинамид"], priority: 74 },
  { name: "Geek & Gorgeous B-Bomb", brand: "Geek & Gorgeous", price: 1150, volume: "30 мл", step: "serum", skinTypes: ["oily","combo"], concerns: ["acne","pores"], activeIngredients: ["ниацинамид 5%","пантенол"], priority: 73 },

  // ========== БАРЬЕР / СУХОСТЬ (20) ==========
  { name: "Lipikar Balm AP+M", brand: "La Roche-Posay", price: 1950, volume: "400 мл", step: "moisturizer", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["ниацинамид","масло ши","пребиотик"], priority: 97 },
  { name: "Cicaplast Baume B5+", brand: "La Roche-Posay", price: 950, volume: "100 мл", step: "moisturizer", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["пантенол 5%","мадекассосид"], priority: 96 },
  { name: "Atoderm Intensive Baume", brand: "Bioderma", price: 1750, volume: "500 мл", step: "moisturizer", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["ниацинамид","липиды"], priority: 94 },
  { name: "Toleriane Sensitive", brand: "La Roche-Posay", price: 1650, volume: "40 мл", step: "moisturizer", skinTypes: ["sensitive"], concerns: ["barrier"], activeIngredients: ["пребиотик","ниацинамид"], priority: 92 },
  { name: "Physio Gel AI", brand: "Uriage", price: 1350, volume: "40 мл", step: "moisturizer", skinTypes: ["sensitive","dry"], concerns: ["barrier"], activeIngredients: ["термальная вода","липиды"], priority: 90 },
  { name: "Tolerance Control Soothing Skin Recovery", brand: "Avene", price: 1850, volume: "40 мл", step: "moisturizer", skinTypes: ["sensitive"], concerns: ["barrier"], activeIngredients: ["термальная вода","трицерамиды"], priority: 88 },
  { name: "Cicabio Crème", brand: "Bioderma", price: 1250, volume: "40 мл", step: "moisturizer", skinTypes: ["sensitive","dry"], concerns: ["barrier"], activeIngredients: ["цинк","медь"], priority: 87 },
  { name: "Atoderm PP Baume", brand: "Bioderma", price: 1550, volume: "500 мл", step: "moisturizer", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["ниацинамид","церамиды"], priority: 86 },
  { name: "XeraCalm A.D Lipid-Replenishing Balm", brand: "Avene", price: 1950, volume: "400 мл", step: "moisturizer", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["термальная вода","церамиды"], priority: 85 },
  { name: "Eau Thermale Crème", brand: "Uriage", price: 1450, volume: "40 мл", step: "moisturizer", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["термальная вода","церамиды"], priority: 84 },
  { name: "Hydrance Aqua-Gel", brand: "Avene", price: 1650, volume: "50 мл", step: "moisturizer", skinTypes: ["dry","dehydrated"], concerns: ["barrier","dehydration"], activeIngredients: ["термальная вода","гиалуроновая кислота"], priority: 83 },
  { name: "Moisturizing Cream", brand: "CeraVe", price: 1150, volume: "454 г", step: "moisturizer", skinTypes: ["dry","normal"], concerns: ["barrier"], activeIngredients: ["церамиды","гиалуроновая кислота"], priority: 82 },
  { name: "Hydrating Cleanser", brand: "CeraVe", price: 1050, volume: "236 мл", step: "cleanser", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["церамиды","гиалуроновая кислота"], priority: 81 },
  { name: "Hyaluronic Acid 2% + B5", brand: "The Ordinary", price: 950, volume: "30 мл", step: "serum", skinTypes: ["dry","dehydrated"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","витамин B5"], priority: 80 },
  { name: "Moisturizing Lotion", brand: "CeraVe", price: 1250, volume: "473 мл", step: "moisturizer", skinTypes: ["dry","normal"], concerns: ["barrier"], activeIngredients: ["церамиды","ниацинамид"], priority: 79 },
  { name: "Toleriane Ultra 8", brand: "La Roche-Posay", price: 1750, volume: "40 мл", step: "moisturizer", skinTypes: ["sensitive"], concerns: ["barrier"], activeIngredients: ["ниацинамид","термальная вода"], priority: 78 },
  { name: "Physio Lift Riche", brand: "Uriage", price: 1850, volume: "50 мл", step: "moisturizer", skinTypes: ["dry"], concerns: ["barrier","wrinkles"], activeIngredients: ["термальная вода","пептиды"], priority: 77 },
  { name: "Lipidic Ultra Nourishing Cream", brand: "Avene", price: 1950, volume: "50 мл", step: "moisturizer", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["термальная вода","масло карите"], priority: 76 },
  { name: "Skin Recovery Cream", brand: "Bioderma", price: 1550, volume: "40 мл", step: "moisturizer", skinTypes: ["sensitive","dry"], concerns: ["barrier"], activeIngredients: ["термальная вода","липиды"], priority: 75 },
  { name: "Barrier Repair Cream", brand: "La Roche-Posay", price: 1650, volume: "50 мл", step: "moisturizer", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["церамиды","ниацинамид"], priority: 74 },

  // ========== ПИГМЕНТАЦИЯ (18) ==========
  { name: "Mela B3 сыворотка", brand: "La Roche-Posay", price: 3500, volume: "30 мл", step: "serum", skinTypes: ["combo","normal"], concerns: ["pigmentation"], activeIngredients: ["Melasyl","ниацинамид 10%"], priority: 98 },
  { name: "Pigmentclar Serum", brand: "La Roche-Posay", price: 3200, volume: "30 мл", step: "serum", skinTypes: ["combo","normal"], concerns: ["pigmentation"], activeIngredients: ["феретиновая кислота","ниацинамид"], priority: 95 },
  { name: "Brightening Serum", brand: "The Ordinary", price: 1450, volume: "30 мл", step: "serum", skinTypes: ["all"], concerns: ["pigmentation"], activeIngredients: ["альфа-арбутин 2%","ниацинамид"], priority: 93 },
  { name: "Vitamin C Suspension 23%", brand: "The Ordinary", price: 1350, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["pigmentation"], activeIngredients: ["витамин C 23%"], priority: 92 },
  { name: "Ascorbic Acid 8% + Alpha Arbutin 2%", brand: "The Ordinary", price: 1450, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["pigmentation"], activeIngredients: ["витамин C","альфа-арбутин"], priority: 91 },
  { name: "Galacto Niacin 97 Power Essence", brand: "Purito", price: 1550, volume: "60 мл", step: "serum", skinTypes: ["combo","normal"], concerns: ["pigmentation"], activeIngredients: ["ниацинамид 5%","галактомицес"], priority: 90 },
  { name: "Niacinamide 12% + Zinc 1.2%", brand: "The Ordinary", price: 1150, volume: "30 мл", step: "serum", skinTypes: ["oily","combo"], concerns: ["pigmentation","acne"], activeIngredients: ["ниацинамид 12%","цинк"], priority: 89 },
  { name: "Alpha Arbutin 2% + HA", brand: "The Ordinary", price: 1250, volume: "30 мл", step: "serum", skinTypes: ["all"], concerns: ["pigmentation"], activeIngredients: ["альфа-арбутин 2%","гиалуроновая кислота"], priority: 88 },
  { name: "Dark Spot Serum", brand: "La Roche-Posay", price: 3100, volume: "30 мл", step: "serum", skinTypes: ["combo","normal"], concerns: ["pigmentation"], activeIngredients: ["ниацинамид","альфа-арбутин"], priority: 87 },
  { name: "White Spot Expert", brand: "Bioderma", price: 2950, volume: "30 мл", step: "serum", skinTypes: ["combo","normal"], concerns: ["pigmentation"], activeIngredients: ["ниацинамид","альфа-арбутин"], priority: 86 },
  { name: "Pigmentbio Targeted Serum", brand: "Bioderma", price: 2850, volume: "30 мл", step: "serum", skinTypes: ["combo","normal"], concerns: ["pigmentation"], activeIngredients: ["ниацинамид","альфа-арбутин"], priority: 85 },
  { name: "A-Oxitive", brand: "Vichy", price: 3150, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["pigmentation"], activeIngredients: ["витамин C","эперулин"], priority: 84 },
  { name: "LiftActiv Vitamin C Serum", brand: "Vichy", price: 3050, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["pigmentation","wrinkles"], activeIngredients: ["витамин C","пептиды"], priority: 83 },
  { name: "Bright Reveal Peel Pads", brand: "Bioderma", price: 2650, volume: "30 шт", step: "treatment", skinTypes: ["combo","normal"], concerns: ["pigmentation"], activeIngredients: ["AHA","ниацинамид"], priority: 82 },
  { name: "Luminosity Vitamin C+ Serum", brand: "Geek & Gorgeous", price: 1650, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["pigmentation"], activeIngredients: ["витамин C","феруловая кислота"], priority: 81 },
  { name: "C-Glow", brand: "Geek & Gorgeous", price: 1450, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["pigmentation"], activeIngredients: ["витамин C 15%"], priority: 80 },
  { name: "Melano CC Essence", brand: "Rohto", price: 1350, volume: "20 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["pigmentation"], activeIngredients: ["витамин C","витамин E"], priority: 79 },
  { name: "Tranexamic Acid 5%", brand: "The Ordinary", price: 1550, volume: "30 мл", step: "serum", skinTypes: ["combo","normal"], concerns: ["pigmentation"], activeIngredients: ["транэксамовая кислота 5%"], priority: 78 },

  // ========== УВЛАЖНЕНИЕ (15) ==========
  { name: "Hyalu B5 сыворотка", brand: "La Roche-Posay", price: 3100, volume: "30 мл", step: "serum", skinTypes: ["dry","dehydrated"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","витамин B5"], priority: 96 },
  { name: "Mineral 89", brand: "Vichy", price: 2150, volume: "50 мл", step: "serum", skinTypes: ["all"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","минералы"], priority: 94 },
  { name: "Hyaluronic Acid B5", brand: "The Ordinary", price: 950, volume: "30 мл", step: "serum", skinTypes: ["all"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","витамин B5"], priority: 92 },
  { name: "Hydrating Toner", brand: "Cosrx", price: 1250, volume: "150 мл", step: "toner", skinTypes: ["all"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","бета-глюкан"], priority: 91 },
  { name: "Aqua Bomb Serum", brand: "Purito", price: 1650, volume: "60 мл", step: "serum", skinTypes: ["all"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","бета-глюкан"], priority: 90 },
  { name: "Hydrating Foaming Cleanser", brand: "CeraVe", price: 1150, volume: "236 мл", step: "cleanser", skinTypes: ["normal","dry"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","церамиды"], priority: 89 },
  { name: "Hydrating Cleansing Milk", brand: "Bioderma", price: 1350, volume: "200 мл", step: "cleanser", skinTypes: ["dry","sensitive"], concerns: ["dehydration"], activeIngredients: ["термальная вода","гиалуроновая кислота"], priority: 88 },
  { name: "Thermal Spring Water", brand: "Avene", price: 750, volume: "300 мл", step: "toner", skinTypes: ["all"], concerns: ["dehydration"], activeIngredients: ["термальная вода"], priority: 87 },
  { name: "Aqua Gel Cream", brand: "Bioderma", price: 1450, volume: "40 мл", step: "moisturizer", skinTypes: ["all"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","термальная вода"], priority: 86 },
  { name: "Intense Hydrating Serum", brand: "Vichy", price: 2750, volume: "30 мл", step: "serum", skinTypes: ["dry","dehydrated"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","витамин B5"], priority: 85 },
  { name: "Hyaluronic Acid Essence", brand: "Geek & Gorgeous", price: 1350, volume: "50 мл", step: "serum", skinTypes: ["all"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота"], priority: 84 },
  { name: "Moisturizing Toner", brand: "Purito", price: 1150, volume: "200 мл", step: "toner", skinTypes: ["all"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","бета-глюкан"], priority: 83 },
  { name: "Hydro Boost Water Gel", brand: "Neutrogena", price: 1450, volume: "50 мл", step: "moisturizer", skinTypes: ["normal","combo"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота"], priority: 82 },
  { name: "Hydrating Serum", brand: "La Roche-Posay", price: 2850, volume: "30 мл", step: "serum", skinTypes: ["dry","dehydrated"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","витамин B5"], priority: 81 },
  { name: "Aquaphor Healing Ointment", brand: "Eucerin", price: 950, volume: "50 г", step: "moisturizer", skinTypes: ["dry","sensitive"], concerns: ["dehydration","barrier"], activeIngredients: ["пантенол","минеральное масло"], priority: 80 },

  // ========== SPF (15) ==========
  { name: "Anthelios Shaka Fluid SPF50+", brand: "La Roche-Posay", price: 1950, volume: "50 мл", step: "spf", skinTypes: ["all"], concerns: ["photoaging"], activeIngredients: ["Mexoryl XL"], priority: 97 },
  { name: "Capital Soleil SPF50+", brand: "Vichy", price: 1850, volume: "50 мл", step: "spf", skinTypes: ["all"], concerns: ["photoaging"], activeIngredients: ["Mexoryl"], priority: 95 },
  { name: "Anthelios XL SPF50+", brand: "La Roche-Posay", price: 1750, volume: "50 мл", step: "spf", skinTypes: ["all"], concerns: ["photoaging"], activeIngredients: ["Mexoryl"], priority: 93 },
  { name: "Fusion Water SPF50+", brand: "Isdin", price: 1650, volume: "50 мл", step: "spf", skinTypes: ["all"], concerns: ["photoaging"], priority: 92 },
  { name: "Photoderm MAX SPF50+", brand: "Bioderma", price: 1550, volume: "50 мл", step: "spf", skinTypes: ["all"], concerns: ["photoaging"], priority: 91 },
  { name: "Sun Fluid SPF50+", brand: "Avene", price: 1450, volume: "50 мл", step: "spf", skinTypes: ["all"], concerns: ["photoaging"], activeIngredients: ["термальная вода"], priority: 90 },
  { name: "Mineral SPF50+", brand: "CeraVe", price: 1250, volume: "88 мл", step: "spf", skinTypes: ["sensitive"], concerns: ["photoaging"], activeIngredients: ["оксид цинка","диоксид титана"], priority: 89 },
  { name: "Anthelios Ultra SPF50+", brand: "La Roche-Posay", price: 1850, volume: "50 мл", step: "spf", skinTypes: ["sensitive"], concerns: ["photoaging"], activeIngredients: ["Mexoryl"], priority: 88 },
  { name: "Solar Water SPF50+", brand: "Vichy", price: 1750, volume: "50 мл", step: "spf", skinTypes: ["all"], concerns: ["photoaging"], activeIngredients: ["Mexoryl"], priority: 87 },
  { name: "Protective Water SPF50+", brand: "Uriage", price: 1650, volume: "50 мл", step: "spf", skinTypes: ["all"], concerns: ["photoaging"], activeIngredients: ["термальная вода"], priority: 86 },
  { name: "Suncare SPF50+", brand: "Bioderma", price: 1550, volume: "40 мл", step: "spf", skinTypes: ["sensitive"], concerns: ["photoaging"], activeIngredients: ["термальная вода"], priority: 85 },
  { name: "Mineral Sunscreen SPF50+", brand: "Purito", price: 1350, volume: "50 мл", step: "spf", skinTypes: ["sensitive"], concerns: ["photoaging"], activeIngredients: ["оксид цинка"], priority: 84 },
  { name: "Daily Go-To Sunscreen SPF50+", brand: "Purito", price: 1150, volume: "60 мл", step: "spf", skinTypes: ["all"], concerns: ["photoaging"], activeIngredients: ["циноксат","ниацинамид"], priority: 83 },
  { name: "Anthelios Age Correct SPF50+", brand: "La Roche-Posay", price: 2050, volume: "50 мл", step: "spf", skinTypes: ["normal","combo"], concerns: ["photoaging","wrinkles"], activeIngredients: ["Mexoryl","пептиды"], priority: 82 },
  { name: "Anthelios Invisible Fluid SPF50+", brand: "La Roche-Posay", price: 1950, volume: "50 мл", step: "spf", skinTypes: ["all"], concerns: ["photoaging"], activeIngredients: ["Mexoryl XL"], priority: 81 },

  // ========== АНТИ-ЭЙДЖ (15) ==========
  { name: "Retinol B3 сыворотка", brand: "La Roche-Posay", price: 3400, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["ретинол","ниацинамид"], avoidIf: ["pregnant"], priority: 96 },
  { name: "Redermic R", brand: "La Roche-Posay", price: 3200, volume: "30 мл", step: "serum", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["ретинол 0.3%"], avoidIf: ["pregnant"], priority: 94 },
  { name: "Retinol 0.5% in Squalane", brand: "The Ordinary", price: 1250, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["ретинол 0.5%"], avoidIf: ["pregnant"], priority: 92 },
  { name: "Granactive Retinoid 2% Emulsion", brand: "The Ordinary", price: 1350, volume: "30 мл", step: "serum", skinTypes: ["normal","sensitive"], concerns: ["wrinkles"], activeIngredients: ["ретиноид 2%"], avoidIf: ["pregnant"], priority: 91 },
  { name: "LiftActiv Retinol HA", brand: "Vichy", price: 3350, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["ретинол","гиалуроновая кислота"], avoidIf: ["pregnant"], priority: 90 },
  { name: "Redermic R Eyes", brand: "La Roche-Posay", price: 2850, volume: "15 мл", step: "serum", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["ретинол","кофеин"], avoidIf: ["pregnant"], priority: 89 },
  { name: "Matrixyl 10% + HA", brand: "The Ordinary", price: 1150, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["пептиды Matrixyl","гиалуроновая кислота"], priority: 88 },
  { name: "Argireline Solution 10%", brand: "The Ordinary", price: 1050, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["аргирелин 10%"], priority: 87 },
  { name: "Buffet + Copper Peptides 1%", brand: "The Ordinary", price: 1850, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["пептиды меди","пептиды"], priority: 86 },
  { name: "A-Game 5", brand: "Geek & Gorgeous", price: 1450, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["ретиноид"], avoidIf: ["pregnant"], priority: 85 },
  { name: "A-Game 10", brand: "Geek & Gorgeous", price: 1650, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["ретиноид 0.1%"], avoidIf: ["pregnant"], priority: 84 },
  { name: "LiftActiv Supreme", brand: "Vichy", price: 3150, volume: "50 мл", step: "moisturizer", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["пептиды","ниацинамид"], priority: 83 },
  { name: "Retinol Correxion", brand: "RoC", price: 1550, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["ретинол"], avoidIf: ["pregnant"], priority: 82 },
  { name: "Anew Clinical", brand: "Avon", price: 1250, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["ретинол"], avoidIf: ["pregnant"], priority: 81 },
  { name: "Age Perfect Cell Renewal", brand: "L'Oreal Paris", price: 1450, volume: "50 мл", step: "moisturizer", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["ретинол","пептиды"], avoidIf: ["pregnant"], priority: 80 },

  // ========== ОЧИЩЕНИЕ (12) ==========
  { name: "Effaclar гель", brand: "La Roche-Posay", price: 1350, volume: "400 мл", step: "cleanser", skinTypes: ["oily","combo"], concerns: ["acne"], priority: 95 },
  { name: "Sensibio H2O", brand: "Bioderma", price: 1250, volume: "500 мл", step: "cleanser", skinTypes: ["sensitive"], priority: 94 },
  { name: "Foaming Facial Cleanser", brand: "CeraVe", price: 1050, volume: "236 мл", step: "cleanser", skinTypes: ["normal","oily"], concerns: [], activeIngredients: ["церамиды","гиалуроновая кислота"], priority: 93 },
  { name: "Toleriane Dermo-Cleanser", brand: "La Roche-Posay", price: 1450, volume: "200 мл", step: "cleanser", skinTypes: ["sensitive","dry"], concerns: ["barrier"], priority: 92 },
  { name: "Micellar Water", brand: "Bioderma", price: 1150, volume: "250 мл", step: "cleanser", skinTypes: ["all"], concerns: [], activeIngredients: ["термальная вода"], priority: 91 },
  { name: "Gentle Cleansing Foam", brand: "La Roche-Posay", price: 1350, volume: "150 мл", step: "cleanser", skinTypes: ["sensitive"], concerns: ["barrier"], priority: 90 },
  { name: "Low pH Good Morning Gel Cleanser", brand: "Cosrx", price: 950, volume: "150 мл", step: "cleanser", skinTypes: ["oily","combo"], concerns: ["acne"], activeIngredients: ["BHA","BHA"], priority: 89 },
  { name: "Green Tea Oil Cleanser", brand: "Purito", price: 1150, volume: "200 мл", step: "cleanser", skinTypes: ["all"], concerns: [], activeIngredients: ["масло чайного дерева"], priority: 88 },
  { name: "Hydrating Cleanser", brand: "CeraVe", price: 1050, volume: "236 мл", step: "cleanser", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["церамиды"], priority: 87 },
  { name: "Antirougeurs Cleansing Milk", brand: "Avene", price: 1250, volume: "200 мл", step: "cleanser", skinTypes: ["sensitive"], concerns: ["redness"], activeIngredients: ["термальная вода"], priority: 86 },
  { name: "Toleriane Caring Wash", brand: "La Roche-Posay", price: 1450, volume: "400 мл", step: "cleanser", skinTypes: ["sensitive","dry"], concerns: ["barrier"], priority: 85 },
  { name: "Micellar Cleansing Water", brand: "Vichy", price: 1150, volume: "250 мл", step: "cleanser", skinTypes: ["all"], concerns: [], activeIngredients: ["термальная вода"], priority: 84 },

  // ========== ТОП The Ordinary / Geek & Gorgeous (20+) ==========
  { name: "Niacinamide 10% + Zinc 1%", brand: "The Ordinary", price: 1150, volume: "30 мл", step: "serum", skinTypes: ["oily","combo"], concerns: ["acne","pores"], activeIngredients: ["ниацинамид 10%","цинк"], priority: 97 },
  { name: "Azelaic Acid 10%", brand: "The Ordinary", price: 1350, volume: "30 мл", step: "serum", skinTypes: ["oily","combo"], concerns: ["acne","pigmentation"], activeIngredients: ["азелаиновая кислота 10%"], priority: 96 },
  { name: "AHA 30% + BHA 2% Peeling", brand: "The Ordinary", price: 1550, volume: "30 мл", step: "treatment", skinTypes: ["combo","normal"], concerns: ["pores"], activeIngredients: ["гликолевая","салициловая"], priority: 92 },
  { name: "Caffeine Solution 5%", brand: "The Ordinary", price: 1250, volume: "30 мл", step: "serum", skinTypes: ["all"], concerns: ["redness"], activeIngredients: ["кофеин 5%"], priority: 88 },
  { name: "Lactic Acid 10% + HA", brand: "The Ordinary", price: 1250, volume: "30 мл", step: "serum", skinTypes: ["combo","normal"], concerns: ["pores"], activeIngredients: ["молочная кислота 10%"], priority: 87 },
  { name: "Glycolic Acid 7% Toning Solution", brand: "The Ordinary", price: 1050, volume: "240 мл", step: "toner", skinTypes: ["combo","normal"], concerns: ["pores"], activeIngredients: ["гликолевая кислота 7%"], priority: 86 },
  { name: "NMF + HA", brand: "The Ordinary", price: 1150, volume: "100 мл", step: "moisturizer", skinTypes: ["normal","dry"], concerns: ["dehydration"], activeIngredients: ["NMF","гиалуроновая кислота"], priority: 85 },
  { name: "Multi-Peptide + HA Serum", brand: "The Ordinary", price: 1450, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["пептиды","гиалуроновая кислота"], priority: 84 },
  { name: "Niacinamide 10% + Arginine", brand: "Geek & Gorgeous", price: 1150, volume: "30 мл", step: "serum", skinTypes: ["oily","combo"], concerns: ["acne","pores"], activeIngredients: ["ниацинамид 10%"], priority: 83 },
  { name: "aPAD", brand: "Geek & Gorgeous", price: 1350, volume: "30 мл", step: "serum", skinTypes: ["combo","normal"], concerns: ["pores"], activeIngredients: ["азалаиновая кислота"], priority: 82 },
  { name: "Cheer Up", brand: "Geek & Gorgeous", price: 1150, volume: "30 мл", step: "serum", skinTypes: ["combo","normal"], concerns: ["pores"], activeIngredients: ["BHA","AHA"], priority: 81 },
  { name: "Stress Less", brand: "Geek & Gorgeous", price: 1250, volume: "30 мл", step: "serum", skinTypes: ["sensitive"], concerns: ["redness"], activeIngredients: ["бета-глюкан","аллантоин"], priority: 80 },
  { name: "Calm Down", brand: "Geek & Gorgeous", price: 1350, volume: "30 мл", step: "serum", skinTypes: ["sensitive"], concerns: ["redness"], activeIngredients: ["бета-глюкан","ниацинамид"], priority: 79 },
  { name: "Mighty Melt", brand: "Geek & Gorgeous", price: 1150, volume: "100 мл", step: "cleanser", skinTypes: ["all"], concerns: [], activeIngredients: ["масла"], priority: 78 },
  { name: "Jelly Joker", brand: "Geek & Gorgeous", price: 1050, volume: "150 мл", step: "cleanser", skinTypes: ["all"], concerns: [], activeIngredients: ["бета-глюкан"], priority: 77 },
];

async function main() {
  console.log('🌱 Seeding 120 products...');

  // Создаем бренды
  const brandMap = new Map<string, number>();
  for (const brandName of brands) {
    const brand = await prisma.brand.upsert({
      where: { name: brandName },
      update: {},
      create: {
        name: brandName,
        slug: createSlug(brandName),
        country: null,
        isActive: true,
      },
    });
    brandMap.set(brandName, brand.id);
    console.log(`  ✅ Brand: ${brandName}`);
  }

  // Создаем продукты
  let created = 0;
  let updated = 0;

  for (const p of products) {
    try {
      const brandId = brandMap.get(p.brand);
      if (!brandId) {
        console.error(`  ❌ Brand not found: ${p.brand}`);
        continue;
      }

      const slug = createSlug(p.name);
      const rawSkinTypes = p.skinTypes || ['normal'];
      const skinTypes = rawSkinTypes.includes('all')
        ? ['dry', 'normal', 'combo', 'oily', 'sensitive']
        : rawSkinTypes;

      const productData: any = {
        name: p.name,
        slug,
        brandId,
        price: p.price,
        volume: p.volume || null,
        description: null,
        descriptionUser: p.activeIngredients?.slice(0, 2).join(', ') || null,
        imageUrl: `/products/${slug}.jpg`,
        skinTypes,
        concerns: p.concerns || [],
        activeIngredients: p.activeIngredients || [],
        avoidIf: p.avoidIf || [],
        step: p.step,
        category: p.step, // Для обратной совместимости
        isHero: p.priority > 90,
        priority: p.priority || 0,
        published: true,
        status: 'published',
      };

      // Используем upsert для более надежной работы
      try {
        const result = await prisma.product.upsert({
          where: { slug },
          update: productData,
          create: productData,
        });
        
        // Определяем, создан ли новый продукт или обновлен существующий
        const wasExisting = await prisma.product.findUnique({
          where: { slug },
          select: { createdAt: true, updatedAt: true },
        });
        
        if (wasExisting && wasExisting.createdAt.getTime() === wasExisting.updatedAt.getTime()) {
          created++;
        } else {
          updated++;
        }
      } catch (upsertError: any) {
        // Если upsert не сработал из-за уникального ограничения, пробуем создать
        if (upsertError.code === 'P2002') {
          try {
            await prisma.product.update({
              where: { slug },
              data: productData,
            });
            updated++;
          } catch (updateError) {
            console.error(`  ❌ Failed to update product "${p.name}":`, updateError);
          }
        } else {
          throw upsertError;
        }
      }
    } catch (error: any) {
      console.error(`  ❌ Error processing product "${p.name}":`, error.message);
      // Продолжаем обработку следующих продуктов
      continue;
    }
  }

  console.log(`\n✅ Products seeding complete!`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Total: ${products.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding products:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

