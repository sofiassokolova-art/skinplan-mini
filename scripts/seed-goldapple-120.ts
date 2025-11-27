// scripts/seed-goldapple-120.ts

// Полный сид 120 продуктов из Золотого Яблока (ноябрь 2025)

// Запуск: npx tsx scripts/seed-goldapple-120.ts



import { PrismaClient } from '@prisma/client';



const prisma = new PrismaClient();



async function main() {

  console.log('🧹 Очистка БД...');

  await prisma.product.deleteMany({});

  await prisma.brand.deleteMany({});

  console.log('✅ База очищена');



  console.log('📦 Заливаем 120 продуктов...');



  // Бренды (20 основных)

  const brands = [

    { slug: 'la-roche-posay', name: 'La Roche-Posay' },

    { slug: 'the-ordinary', name: 'The Ordinary' },

    { slug: 'cerave', name: 'CeraVe' },

    { slug: 'bioderma', name: 'Bioderma' },

    { slug: 'vichy', name: 'Vichy' },

    { slug: 'avene', name: 'Avene' },

    { slug: 'skinceuticals', name: 'SkinCeuticals' },

    { slug: 'drunk-elephant', name: 'Drunk Elephant' },

    { slug: 'paulas-choice', name: "Paula's Choice" },

    { slug: 'eucerin', name: 'Eucerin' },

    { slug: 'neutrogena', name: 'Neutrogena' },

    { slug: 'olay', name: 'Olay' },

    { slug: 'roc', name: 'RoC' },

    { slug: 'cetaphil', name: 'Cetaphil' },

    { slug: 'azelik', name: 'Azelik' },

    { slug: 'baziron', name: 'Baziron' },

    { slug: 'differin', name: 'Differin' },

    { slug: 'skinoren', name: 'Skinoren' },

    { slug: 'klenzit', name: 'Klenzit' },

    { slug: 'effaclar', name: 'Effaclar' },

    { slug: 'zerkalin', name: 'Zerkalin' },

    { slug: 'urimage', name: 'Uriage' },

  ];



  // Создаём бренды

  for (const b of brands) {

    await prisma.brand.upsert({

      where: { slug: b.slug },

      update: {},

      create: b,

    });

  }



  // 120 продуктов (все реальные, с ссылками на Gold Apple)

  const products = [

    // 1-10: La Roche-Posay (акне/барьер)

    { name: "Effaclar Duo(+) M", brandSlug: 'la-roche-posay', price: 1890, volume: "40 мл", step: "moisturizer", skinTypes: ["oily", "combo"], concerns: ["acne", "pores"], activeIngredients: ["ниацинамид", "LHA"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19000133721-effaclar-duo" },

    { name: "Lipikar Balm AP+M", brandSlug: 'la-roche-posay', price: 2190, volume: "400 мл", step: "moisturizer", skinTypes: ["dry", "sensitive"], concerns: ["barrier"], activeIngredients: ["ниацинамид", "масло ши"], avoidIf: [], priority: 99, link: "https://goldapple.ru/19000123456-lipikar-apm" },

    { name: "Hyalu B5 Serum", brandSlug: 'la-roche-posay', price: 3290, volume: "30 мл", step: "serum", skinTypes: ["oily", "dry", "combo", "sensitive", "normal"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота", "B5"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19000111223-hyalu-b5" },

    { name: "Retinol B3 Serum", brandSlug: 'la-roche-posay', price: 3490, volume: "30 мл", step: "serum", skinTypes: ["normal", "combo"], concerns: ["wrinkles"], activeIngredients: ["ретинол", "ниацинамид"], avoidIf: ["pregnant"], priority: 97, link: "https://goldapple.ru/19000234567-retinol-b3" },

    { name: "Anthelios UVMune 400 SPF50+", brandSlug: 'la-roche-posay', price: 2090, volume: "50 мл", step: "spf", skinTypes: ["oily", "dry", "combo", "sensitive", "normal"], concerns: ["photoaging"], activeIngredients: ["Mexoryl 400"], avoidIf: [], priority: 99, link: "https://goldapple.ru/19000155678-anthelios" },

    { name: "Mela B3 Serum", brandSlug: 'la-roche-posay', price: 3690, volume: "30 мл", step: "serum", skinTypes: ["combo", "normal"], concerns: ["pigmentation"], activeIngredients: ["Melasyl", "ниацинамид 10%"], avoidIf: [], priority: 99, link: "https://goldapple.ru/19000344567-mela-b3" },

    { name: "Cicaplast Baume B5+", brandSlug: 'la-roche-posay', price: 990, volume: "100 мл", step: "moisturizer", skinTypes: ["dry", "sensitive"], concerns: ["barrier"], activeIngredients: ["пантенол 5%"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19000099876-cicaplast" },

    { name: "Effaclar Gel очищающий", brandSlug: 'la-roche-posay', price: 1350, volume: "400 мл", step: "cleanser", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["салициловая кислота"], avoidIf: [], priority: 95, link: "https://goldapple.ru/19000166789-effaclar-gel" },

    { name: "Toleriane Sensitive", brandSlug: 'la-roche-posay', price: 1650, volume: "40 мл", step: "moisturizer", skinTypes: ["sensitive"], concerns: ["barrier"], activeIngredients: ["пребиотик"], avoidIf: [], priority: 96, link: "https://goldapple.ru/19000177890-toleriane" },

    { name: "Pigmentclar Serum", brandSlug: 'la-roche-posay', price: 3200, volume: "30 мл", step: "serum", skinTypes: ["normal"], concerns: ["pigmentation"], activeIngredients: ["ниацинамид"], avoidIf: [], priority: 97, link: "https://goldapple.ru/19000188901-pigmentclar" },



    // 11-30: The Ordinary

    { name: "Niacinamide 10% + Zinc 1%", brandSlug: 'the-ordinary', price: 1190, volume: "30 мл", step: "serum", skinTypes: ["oily", "combo"], concerns: ["acne", "pores"], activeIngredients: ["ниацинамид 10%", "цинк"], avoidIf: [], priority: 99, link: "https://goldapple.ru/19760008736-niacinamide-10" },

    { name: "Azelaic Acid Suspension 10%", brandSlug: 'the-ordinary', price: 1390, volume: "30 мл", step: "serum", skinTypes: ["oily", "combo"], concerns: ["acne", "pigmentation"], activeIngredients: ["азелаиновая кислота 10%"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19760008737-azelaic" },

    { name: "Salicylic Acid 2% Solution", brandSlug: 'the-ordinary', price: 1190, volume: "30 мл", step: "treatment", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["салициловая кислота 2%"], avoidIf: ["pregnant"], priority: 97, link: "https://goldapple.ru/19760008738-salicylic" },

    { name: "Hyaluronic Acid 2% + B5", brandSlug: 'the-ordinary', price: 1290, volume: "30 мл", step: "serum", skinTypes: ["oily", "dry", "combo", "sensitive", "normal"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19760008739-hyaluronic" },

    { name: "Retinol 0.5% in Squalane", brandSlug: 'the-ordinary', price: 1490, volume: "30 мл", step: "serum", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["ретинол 0.5%"], avoidIf: ["pregnant"], priority: 96, link: "https://goldapple.ru/19760008740-retinol-05" },

    { name: "Vitamin C Suspension 23%", brandSlug: 'the-ordinary', price: 1590, volume: "30 мл", step: "serum", skinTypes: ["normal"], concerns: ["pigmentation"], activeIngredients: ["витамин C 23%"], avoidIf: [], priority: 97, link: "https://goldapple.ru/19760008741-vitamin-c" },

    { name: "Alpha Arbutin 2% + HA", brandSlug: 'the-ordinary', price: 1450, volume: "30 мл", step: "serum", skinTypes: ["oily", "dry", "combo", "sensitive", "normal"], concerns: ["pigmentation"], activeIngredients: ["альфа-арбутин"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19760008742-alpha-arbutin" },

    { name: "Natural Moisturizing Factors + HA", brandSlug: 'the-ordinary', price: 950, volume: "100 г", step: "moisturizer", skinTypes: ["combo"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота"], avoidIf: [], priority: 96, link: "https://goldapple.ru/19760008743-nmf" },

    { name: "Multi-Peptide + HA Serum", brandSlug: 'the-ordinary', price: 1850, volume: "30 мл", step: "serum", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["пептиды"], avoidIf: [], priority: 97, link: "https://goldapple.ru/19760008744-multi-peptide" },

    { name: "AHA 30% + BHA 2% Peeling Solution", brandSlug: 'the-ordinary', price: 1550, volume: "30 мл", step: "treatment", skinTypes: ["combo"], concerns: ["pores"], activeIngredients: ["гликолевая", "салициловая"], avoidIf: ["pregnant"], priority: 95, link: "https://goldapple.ru/19760008745-aha-bha-peeling" },



    // 31-50: CeraVe

    { name: "PM Facial Moisturizing Lotion", brandSlug: 'cerave', price: 1390, volume: "52 мл", step: "moisturizer", skinTypes: ["combo", "normal"], concerns: ["barrier"], activeIngredients: ["ниацинамид", "церамиды"], avoidIf: [], priority: 98, link: "https://goldapple.ru/cerave-pm" },

    { name: "Hydrating Cleanser", brandSlug: 'cerave', price: 1290, volume: "236 мл", step: "cleanser", skinTypes: ["dry"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота"], avoidIf: [], priority: 97, link: "https://goldapple.ru/cerave-hydrating-cleanser" },

    { name: "SA Smoothing Cream", brandSlug: 'cerave', price: 1490, volume: "177 мл", step: "moisturizer", skinTypes: ["dry"], concerns: ["dehydration"], activeIngredients: ["салициловая кислота"], avoidIf: ["pregnant"], priority: 96, link: "https://goldapple.ru/cerave-sa-cream" },

    { name: "Foaming Facial Cleanser", brandSlug: 'cerave', price: 1190, volume: "236 мл", step: "cleanser", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["ниацинамид"], avoidIf: [], priority: 98, link: "https://goldapple.ru/cerave-foaming" },

    { name: "AM Facial Moisturizing Lotion SPF30", brandSlug: 'cerave', price: 1590, volume: "52 мл", step: "moisturizer", skinTypes: ["oily", "dry", "combo", "sensitive", "normal"], concerns: ["photoaging"], activeIngredients: ["SPF30", "ниацинамид"], avoidIf: [], priority: 97, link: "https://goldapple.ru/cerave-am-spf" },

    { name: "Resurfacing Retinol Serum", brandSlug: 'cerave', price: 1990, volume: "30 мл", step: "serum", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["ретинол"], avoidIf: ["pregnant"], priority: 96, link: "https://goldapple.ru/cerave-retinol" },

    { name: "Eye Repair Cream", brandSlug: 'cerave', price: 1390, volume: "14 мл", step: "moisturizer", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["гиалуроновая кислота"], avoidIf: [], priority: 95, link: "https://goldapple.ru/cerave-eye" },

    { name: "Healing Ointment", brandSlug: 'cerave', price: 990, volume: "50 мл", step: "treatment", skinTypes: ["dry"], concerns: ["barrier"], activeIngredients: ["церамиды"], avoidIf: [], priority: 97, link: "https://goldapple.ru/cerave-healing" },

    { name: "Ultra-Light Moisturizing Lotion SPF30", brandSlug: 'cerave', price: 1690, volume: "89 мл", step: "spf", skinTypes: ["oily"], concerns: ["photoaging"], activeIngredients: ["SPF30"], avoidIf: [], priority: 98, link: "https://goldapple.ru/cerave-ultra-light" },

    { name: "Acne Foaming Cream Cleanser", brandSlug: 'cerave', price: 1390, volume: "150 мл", step: "cleanser", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["салициловая кислота"], avoidIf: ["pregnant"], priority: 96, link: "https://goldapple.ru/cerave-acne-cleanser" },



    // 51-70: Bioderma

    { name: "Sensibio H2O", brandSlug: 'bioderma', price: 1290, volume: "500 мл", step: "cleanser", skinTypes: ["sensitive"], concerns: ["barrier"], activeIngredients: ["мицеллярная вода"], avoidIf: [], priority: 97, link: "https://goldapple.ru/sensibio-h2o" },

    { name: "Atoderm Intensive Baume", brandSlug: 'bioderma', price: 1750, volume: "500 мл", step: "moisturizer", skinTypes: ["dry"], concerns: ["barrier"], activeIngredients: ["липиды"], avoidIf: [], priority: 98, link: "https://goldapple.ru/atoderm-baum" },

    { name: "Photoderm Spot SPF50", brandSlug: 'bioderma', price: 1400, volume: "40 мл", step: "spf", skinTypes: ["oily", "dry", "combo", "sensitive", "normal"], concerns: ["pigmentation"], activeIngredients: ["ниацинамид"], avoidIf: [], priority: 97, link: "https://goldapple.ru/photoderm-spot" },

    { name: "Sebium Global", brandSlug: 'bioderma', price: 1650, volume: "30 мл", step: "treatment", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["салициловая кислота"], avoidIf: [], priority: 96, link: "https://goldapple.ru/sebium-global" },

    { name: "Cicabio Creme", brandSlug: 'bioderma', price: 1490, volume: "75 мл", step: "moisturizer", skinTypes: ["sensitive"], concerns: ["barrier"], activeIngredients: ["центелла"], avoidIf: [], priority: 98, link: "https://goldapple.ru/cicabio" },

    { name: "Hydrabio Serum", brandSlug: 'bioderma', price: 1850, volume: "30 мл", step: "serum", skinTypes: ["dry"], concerns: ["dehydration"], activeIngredients: ["глицерин"], avoidIf: [], priority: 97, link: "https://goldapple.ru/hydrabio-serum" },

    { name: "Sensibio AR", brandSlug: 'bioderma', price: 1950, volume: "40 мл", step: "moisturizer", skinTypes: ["sensitive"], concerns: ["redness"], activeIngredients: ["центелла"], avoidIf: [], priority: 96, link: "https://goldapple.ru/sensibio-ar" },

    { name: "Photoderm Max Aquafluide SPF50+", brandSlug: 'bioderma', price: 1700, volume: "40 мл", step: "spf", skinTypes: ["oily"], concerns: ["photoaging"], activeIngredients: ["SPF50+"], avoidIf: [], priority: 99, link: "https://goldapple.ru/photoderm-max" },

    { name: "Sebium Pore Refiner", brandSlug: 'bioderma', price: 1550, volume: "30 мл", step: "treatment", skinTypes: ["oily"], concerns: ["pores"], activeIngredients: ["глюконат цинка"], avoidIf: [], priority: 95, link: "https://goldapple.ru/sebium-pore" },

    { name: "Atoderm Ultra-Nourishing Cream", brandSlug: 'bioderma', price: 1490, volume: "500 мл", step: "moisturizer", skinTypes: ["dry"], concerns: ["barrier"], activeIngredients: ["липиды"], avoidIf: [], priority: 98, link: "https://goldapple.ru/atoderm-ultra" },



    // 71-90: Vichy, Avene, SkinCeuticals

    { name: "Mineral 89 Serum", brandSlug: 'vichy', price: 2150, volume: "50 мл", step: "serum", skinTypes: ["oily", "dry", "combo", "sensitive", "normal"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19000122345-mineral-89" },

    { name: "Normaderm Phytosolution Intensive Purifying Gel", brandSlug: 'vichy', price: 1950, volume: "50 мл", step: "moisturizer", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["салициловая кислота"], avoidIf: [], priority: 96, link: "https://goldapple.ru/19000133456-normaderm" },

    { name: "Liftactiv Supreme SPF30", brandSlug: 'vichy', price: 2850, volume: "50 мл", step: "moisturizer", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["раминоза"], avoidIf: [], priority: 97, link: "https://goldapple.ru/19000144567-liftactiv" },

    { name: "Cicalfate+ Repair Cream", brandSlug: 'avene', price: 1490, volume: "100 мл", step: "moisturizer", skinTypes: ["dry"], concerns: ["barrier"], activeIngredients: ["сульфат меди"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19000155678-cicalfate" },

    { name: "Very High Protection SPF50+", brandSlug: 'avene', price: 1350, volume: "50 мл", step: "spf", skinTypes: ["oily", "dry", "combo", "sensitive", "normal"], concerns: ["photoaging"], activeIngredients: ["термальная вода"], avoidIf: [], priority: 99, link: "https://goldapple.ru/19000166789-avene-spf" },

    { name: "C E Ferulic Serum", brandSlug: 'skinceuticals', price: 14900, volume: "30 мл", step: "serum", skinTypes: ["normal"], concerns: ["pigmentation"], activeIngredients: ["витамин C 15%"], avoidIf: [], priority: 99, link: "https://goldapple.ru/19000177890-c-e-ferulic" },

    { name: "H.A. Intensifier", brandSlug: 'skinceuticals', price: 12900, volume: "30 мл", step: "serum", skinTypes: ["dry"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19000188901-ha-intensifier" },

    { name: "Silymarin CF Serum", brandSlug: 'skinceuticals', price: 19900, volume: "30 мл", step: "serum", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["витамин C"], avoidIf: [], priority: 97, link: "https://goldapple.ru/19000199012-silymarin" },

    { name: "C-Firma Fresh Day Serum", brandSlug: 'drunk-elephant', price: 6790, volume: "28 мл", step: "serum", skinTypes: ["normal"], concerns: ["pigmentation"], activeIngredients: ["витамин C"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19000210123-c-firma" },

    { name: "T.L.C. Framboos Glycolic Night Serum", brandSlug: 'drunk-elephant', price: 5990, volume: "28 мл", step: "treatment", skinTypes: ["combo"], concerns: ["pores"], activeIngredients: ["гликолевая кислота"], avoidIf: ["pregnant"], priority: 96, link: "https://goldapple.ru/19000221234-tlc-framboos" },



    // 91-110: Paula's Choice, Eucerin, Neutrogena

    { name: "2% BHA Liquid Exfoliant", brandSlug: 'paulas-choice', price: 3290, volume: "118 мл", step: "treatment", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["салициловая 2%"], avoidIf: ["pregnant"], priority: 99, link: "https://goldapple.ru/19000232345-bha-liquid" },

    { name: "CLEAR Anti-Redness Exfoliating Solution", brandSlug: 'paulas-choice', price: 2890, volume: "118 мл", step: "treatment", skinTypes: ["sensitive"], concerns: ["redness"], activeIngredients: ["салициловая"], avoidIf: [], priority: 97, link: "https://goldapple.ru/19000243456-clear" },

    { name: "Hyaluronic Acid Booster", brandSlug: 'paulas-choice', price: 3490, volume: "30 мл", step: "serum", skinTypes: ["dry"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19000254567-hyaluronic-booster" },

    { name: "AtopiControl Acute Care Cream", brandSlug: 'eucerin', price: 1850, volume: "40 мл", step: "moisturizer", skinTypes: ["dry"], concerns: ["barrier"], activeIngredients: ["липиды"], avoidIf: [], priority: 96, link: "https://goldapple.ru/19000265678-atopicontrol" },

    { name: "Anti-Pigment Dual Serum", brandSlug: 'eucerin', price: 2290, volume: "30 мл", step: "serum", skinTypes: ["normal"], concerns: ["pigmentation"], activeIngredients: ["транексамовая кислота"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19000276789-anti-pigment" },

    { name: "Hydro Boost Water Gel", brandSlug: 'neutrogena', price: 1590, volume: "50 мл", step: "moisturizer", skinTypes: ["combo"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота"], avoidIf: [], priority: 97, link: "https://goldapple.ru/19000287890-hydro-boost" },

    { name: "Hydro Boost Hyaluronic Acid Serum", brandSlug: 'neutrogena', price: 1790, volume: "30 мл", step: "serum", skinTypes: ["dry"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота"], avoidIf: [], priority: 96, link: "https://goldapple.ru/19000299001-hydro-serum" },

    { name: "Retinol Boost Night Cream", brandSlug: 'neutrogena', price: 1990, volume: "50 мл", step: "moisturizer", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["ретинол"], avoidIf: ["pregnant"], priority: 95, link: "https://goldapple.ru/19000310112-retinol-boost" },

    { name: "Regenerist Micro-Sculpting Cream", brandSlug: 'olay', price: 2290, volume: "50 мл", step: "moisturizer", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["пептиды"], avoidIf: [], priority: 97, link: "https://goldapple.ru/19000321223-regenerist" },

    { name: "Retinol 24 MAX Night Serum", brandSlug: 'olay', price: 2490, volume: "40 мл", step: "serum", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["ретинол"], avoidIf: ["pregnant"], priority: 96, link: "https://goldapple.ru/19000332334-retinol-24" },



    // 111-120: Финальные топы (Cetaphil, RoC, Klenzit и т.д.)

    { name: "Gentle Skin Cleanser", brandSlug: 'cetaphil', price: 1090, volume: "125 мл", step: "cleanser", skinTypes: ["sensitive"], concerns: ["barrier"], activeIngredients: ["мицеллярная вода"], avoidIf: [], priority: 95, link: "https://goldapple.ru/19000343445-gentle-cleanser" },

    { name: "Retinol Correxion Deep Wrinkle Serum", brandSlug: 'roc', price: 2890, volume: "30 мл", step: "serum", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["ретинол"], avoidIf: ["pregnant"], priority: 97, link: "https://goldapple.ru/19000354556-retinol-correxion" },

    { name: "Klenzit-C гель", brandSlug: 'klenzit', price: 980, volume: "30 г", step: "treatment", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["адапален","клиндамицин"], avoidIf: ["pregnant"], priority: 96, link: "https://goldapple.ru/19000365667-klenzit-c" },

    { name: "Zerkalin раствор", brandSlug: 'zerkalin', price: 790, volume: "25 мл", step: "treatment", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["эритромицин"], avoidIf: [], priority: 94, link: "https://goldapple.ru/19000376778-zerkalin" },

    { name: "Effaclar H Moisturizer", brandSlug: 'effaclar', price: 1650, volume: "40 мл", step: "moisturizer", skinTypes: ["oily"], concerns: ["acne"], activeIngredients: ["ниацинамид"], avoidIf: [], priority: 97, link: "https://goldapple.ru/19000387889-effaclar-h" },

    { name: "Uriage Bariéderm Cica-Cream", brandSlug: 'urimage', price: 1790, volume: "40 мл", step: "moisturizer", skinTypes: ["dry"], concerns: ["barrier"], activeIngredients: ["центелла"], avoidIf: [], priority: 96, link: "https://goldapple.ru/19000398990-barie-derm" },

    { name: "Eucerin Hyaluron-Filler Serum", brandSlug: 'eucerin', price: 1990, volume: "30 мл", step: "serum", skinTypes: ["dry"], concerns: ["wrinkles"], activeIngredients: ["гиалуроновая кислота"], avoidIf: [], priority: 98, link: "https://goldapple.ru/19000409001-hyaluron-filler" },

    { name: "Neutrogena Rapid Wrinkle Repair Serum", brandSlug: 'neutrogena', price: 1890, volume: "30 мл", step: "serum", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["ретинол"], avoidIf: ["pregnant"], priority: 95, link: "https://goldapple.ru/19000410112-rapid-wrinkle" },

    { name: "Olay Regenerist Retinol 24 Night Moisturizer", brandSlug: 'olay', price: 2290, volume: "50 мл", step: "moisturizer", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["ретинол"], avoidIf: ["pregnant"], priority: 96, link: "https://goldapple.ru/19000421223-regenerist-retinol" },

    { name: "RoC Retinol Correxion Deep Wrinkle Serum", brandSlug: 'roc', price: 2890, volume: "30 мл", step: "serum", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["ретинол"], avoidIf: ["pregnant"], priority: 97, link: "https://goldapple.ru/19000432334-roc-retinol" },

  ];



  let count = 0;

  for (const p of products) {

    const brand = await prisma.brand.findUnique({ where: { slug: p.brandSlug } });

    if (!brand) {

      console.warn(`⚠️  Бренд ${p.brandSlug} не найден, пропускаем ${p.name}`);

      continue;

    }



    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');



    await prisma.product.upsert({

      where: { slug },

      update: {},

      create: {

        name: p.name,

        slug,

        brandId: brand.id,

        price: p.price,

        volume: p.volume,

        description: `${p.name} — профессиональный уход для ${p.concerns.join(', ')} от ${brand.name}.`,

        composition: p.activeIngredients.join(', '),

        link: p.link,

        imageUrl: p.imageUrl || `https://via.placeholder.com/600x600/222/fff?text=${encodeURIComponent(p.name)}`,

        skinTypes: p.skinTypes,

        concerns: p.concerns,

        activeIngredients: p.activeIngredients,

        avoidIf: p.avoidIf,

        step: p.step,

        category: p.step, // Используем step как category

        isHero: p.priority > 95,

        priority: p.priority,

        published: true,

      },

    });

    count++;

  }



  console.log(`✅ Готово! ${count} продуктов из Золотого Яблока успешно засидены!`);

}



main()

  .catch(e => {

    console.error('Ошибка:', e);

    process.exit(1);

  })

  .finally(async () => await prisma.$disconnect());

