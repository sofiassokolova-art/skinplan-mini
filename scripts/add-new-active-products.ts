// scripts/add-new-active-products.ts
// Добавление новых продуктов с активными ингредиентами

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

// Новые продукты для добавления
const newProducts = [
  // 1. serum_peptide (пептиды / в т.ч. copper peptide)
  {
    name: "Multi-Peptide Revitalizing",
    brand: "DoctorProffi",
    stepCategory: "serum_peptide",
    category: "serum",
    price: 0, // Нужно будет указать цену
    volume: "30 мл",
    skinTypes: ["dry", "normal", "combination_dry", "combination_oily"],
    concerns: ["wrinkles", "barrier_damage"],
    activeIngredients: ["peptide", "peptide_complex"],
    marketLinks: { zy: "https://goldapple.ru/99000035668-multi-peptide-revitalizing" },
    descriptionUser: "Сыворотка с пептидами для восстановления и омоложения кожи",
  },
  {
    name: "Bifida Biome Concentrate Serum",
    brand: "Manyo",
    stepCategory: "serum_peptide",
    category: "serum",
    price: 0,
    volume: "50 мл",
    skinTypes: ["dry", "normal", "combination_dry", "combination_oily"],
    concerns: ["wrinkles", "barrier_damage"],
    activeIngredients: ["peptide", "bifida"],
    marketLinks: { zy: "https://goldapple.ru/19000091204-bifida-biome-complex-ampoule" },
    descriptionUser: "Концентрат с бифидобактериями и пептидами для восстановления микробиома кожи",
  },
  {
    name: "0,2% Copper Tripeptide-1 anti-age",
    brand: "ANNA SHAROVA",
    stepCategory: "serum_peptide",
    category: "serum",
    price: 0,
    volume: "30 мл",
    skinTypes: ["dry", "normal", "combination_dry", "combination_oily"],
    concerns: ["wrinkles"],
    activeIngredients: ["copper", "peptide", "peptide_complex"],
    marketLinks: { zy: "https://goldapple.ru/review/product/19000220218" },
    descriptionUser: "Антивозрастная сыворотка с медным трипептидом-1",
  },
  {
    name: "Nourish & Repair Ceramide",
    brand: "Skinjestique",
    stepCategory: "serum_peptide",
    category: "serum",
    price: 0,
    volume: "30 мл",
    skinTypes: ["dry", "normal", "combination_dry"],
    concerns: ["wrinkles", "barrier_damage"],
    activeIngredients: ["copper", "peptide", "ceramides"],
    marketLinks: { zy: "https://goldapple.ru/review/product/19000360542" },
    descriptionUser: "Сыворотка с медным трипептидом и церамидами для восстановления барьера",
  },
  {
    name: "Copper Tripeptide & Ectoin Advanced Repair Serum",
    brand: "Allies of Skin",
    stepCategory: "serum_peptide",
    category: "serum",
    price: 0,
    volume: "30 мл",
    skinTypes: ["dry", "normal", "combination_dry"],
    concerns: ["wrinkles", "barrier_damage"],
    activeIngredients: ["copper", "peptide", "peptide_complex"],
    marketLinks: { zy: "https://goldapple.ru/review/product/19000333881" },
    descriptionUser: "Продвинутая восстанавливающая сыворотка с медным трипептидом и эктоином",
  },

  // 2. serum_antiage (anti-age без кислот)
  {
    name: "Double Serum Complete Age Control Concentrate",
    brand: "Clarins",
    stepCategory: "serum_antiage",
    category: "serum",
    price: 0,
    volume: "30 мл",
    skinTypes: ["dry", "normal", "combination_dry"],
    concerns: ["wrinkles"],
    activeIngredients: [],
    marketLinks: { zy: "https://goldapple.ru/19743000003-double-serum-complete-age-control-concentrate" },
    descriptionUser: "Антивозрастной концентрат двойного действия",
  },
  {
    name: "Resveraderm Antiox Concentrate",
    brand: "Sesderma",
    stepCategory: "serum_antiage",
    category: "serum",
    price: 0,
    volume: "30 мл",
    skinTypes: ["dry", "normal", "combination_dry"],
    concerns: ["wrinkles"],
    activeIngredients: ["resveratrol"],
    marketLinks: { zy: "https://goldapple.ru/19000104232-resveraderm-antiox-concentrate" },
    descriptionUser: "Антиоксидантный концентрат с ресвератролом",
  },
  {
    name: "Grape Stem Cell Wrinkle Lifting Essence",
    brand: "Farm Stay",
    stepCategory: "serum_antiage",
    category: "serum",
    price: 0,
    volume: "50 мл",
    skinTypes: ["dry", "normal", "combination_dry"],
    concerns: ["wrinkles"],
    activeIngredients: ["stem_cell"],
    marketLinks: { zy: "https://goldapple.ru/review/product/99730300005" },
    descriptionUser: "Эссенция с стволовыми клетками винограда для подтяжки и разглаживания морщин",
  },

  // 3. serum_exfoliant (сыворотки-эксфолианты: lactic / mandelic)
  {
    name: "Grunge No More Serum",
    brand: "RAD",
    stepCategory: "serum_exfoliant",
    category: "serum",
    price: 0,
    volume: "30 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "pigmentation"],
    activeIngredients: ["lactic"],
    marketLinks: { zy: "https://goldapple.ru/review/product/19000160559" },
    descriptionUser: "Сыворотка-эксфолиант с молочной кислотой",
  },
  {
    name: "Сыворотка с миндальной кислотой",
    brand: "СПИВАКЪ",
    stepCategory: "serum_exfoliant",
    category: "serum",
    price: 0,
    volume: "30 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "pigmentation"],
    activeIngredients: ["mandelic"],
    marketLinks: { zy: "https://goldapple.ru/review/product/19000213107" },
    descriptionUser: "Сыворотка с миндальной кислотой для мягкого отшелушивания",
  },

  // 4. toner_exfoliant / toner_acid (тонеры с AHA/BHA/PHA)
  {
    name: "C-TONING Clear Toner",
    brand: "Nightingale",
    stepCategory: "toner_exfoliant",
    category: "toner",
    price: 0,
    volume: "150 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "acne", "pigmentation"],
    activeIngredients: ["pha"],
    marketLinks: { zy: "https://goldapple.ru/19000098867-c-toning-clear-toner" },
    descriptionUser: "Очищающий тонер с PHA (глюконолактон)",
  },
  {
    name: "AHA/BHA/PHA Centella Toner 9.9%",
    brand: "Queencharm",
    stepCategory: "toner_exfoliant",
    category: "toner",
    price: 0,
    volume: "200 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "acne", "pigmentation"],
    activeIngredients: ["aha", "bha", "pha", "lactic"],
    marketLinks: { zy: "https://goldapple.ru/19000288019-aha-bha-bha-acids-and-centella-asiatica-9-9" },
    descriptionUser: "Тонер с AHA/BHA/PHA и центеллой азиатской 9.9%",
  },
  {
    name: "Toner with PHA",
    brand: "bhab",
    stepCategory: "toner_exfoliant",
    category: "toner",
    price: 0,
    volume: "150 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "acne"],
    activeIngredients: ["pha"],
    marketLinks: { zy: "https://goldapple.ru/19000394955-slowchaga-miniature" },
    descriptionUser: "Тонер с PHA (глюконолактон)",
  },
  {
    name: "Phyto Aqua Toner",
    brand: "Passion&Beyond",
    stepCategory: "toner_exfoliant",
    category: "toner",
    price: 0,
    volume: "200 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores"],
    activeIngredients: ["pha"],
    marketLinks: { zy: "https://goldapple.ru/review/product/19000232884" },
    descriptionUser: "Тонер с PHA для мягкого отшелушивания",
  },
  {
    name: "AC Triple Acid Toner",
    brand: "Millford",
    stepCategory: "toner_exfoliant",
    category: "toner",
    price: 0,
    volume: "150 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "acne", "pigmentation"],
    activeIngredients: ["aha", "bha", "pha"],
    marketLinks: { zy: "https://goldapple.ru/review/product/19000111188" },
    descriptionUser: "Тройной кислотный тонер с AHA/BHA/PHA",
  },

  // 5. mask_enzyme (enzyme / papain / bromelain)
  {
    name: "Enzyme Mask with prebiotics",
    brand: "SmoRodina",
    stepCategory: "mask_enzyme",
    category: "mask",
    price: 0,
    volume: "50 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "dullness"],
    activeIngredients: ["enzyme", "papain", "bromelain"],
    marketLinks: { zy: "https://goldapple.ru/19000316763-enzyme-mask-for-all-skin-types-with-prebiotics" },
    descriptionUser: "Энзимная маска с папаином и бромелайном, обогащенная пребиотиками",
  },
  {
    name: "Glow Skin Exfoliating Enzyme Mask",
    brand: "ICON SKIN",
    stepCategory: "mask_enzyme",
    category: "mask",
    price: 0,
    volume: "50 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "dullness"],
    activeIngredients: ["enzyme", "bromelain"],
    marketLinks: { zy: "https://goldapple.ru/19000035657-glow-skin-exfoliating-enzyme-mask" },
    descriptionUser: "Отшелушивающая энзимная маска с бромелайном",
  },
  {
    name: "Enzyme Complex + Bromelain 2%",
    brand: "ART&FACT",
    stepCategory: "mask_enzyme",
    category: "mask",
    price: 0,
    volume: "30 г",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "dullness"],
    activeIngredients: ["enzyme", "bromelain"],
    marketLinks: { zy: "https://goldapple.ru/review/product/19000269979" },
    descriptionUser: "Энзимная пудра с бромелайном 2%",
  },

  // 6. mask_acid / mask_peel (acid / peel: AHA/BHA/PHA + lactic/mandelic)
  {
    name: "DER. CLEAR AHA BHA PHA Peeling Mask",
    brand: "RNW",
    stepCategory: "mask_acid",
    category: "mask",
    price: 0,
    volume: "50 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "acne", "pigmentation"],
    activeIngredients: ["aha", "bha", "pha", "lactic"],
    marketLinks: { zy: "https://goldapple.ru/19000121235-der-clear-aha-bha-pha-peeling-mask" },
    descriptionUser: "Пилинговая маска с AHA/BHA/PHA и молочной кислотой",
  },
  {
    name: "10 MINUTES RED PEELING AHA30%+BHA2%",
    brand: "Professor SkinGOOD",
    stepCategory: "mask_peel",
    category: "mask",
    price: 0,
    volume: "50 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "acne", "pigmentation"],
    activeIngredients: ["aha", "bha", "lactic"],
    marketLinks: { zy: "https://goldapple.ru/review/product/19000212326" },
    descriptionUser: "Красная пилинговая маска AHA 30% + BHA 2% с молочной кислотой",
  },
  {
    name: "Mandelic acid 30%",
    brand: "ART&FACT",
    stepCategory: "mask_acid",
    category: "mask",
    price: 0,
    volume: "30 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "pigmentation"],
    activeIngredients: ["mandelic"],
    marketLinks: { zy: "https://goldapple.ru/review/product/19000039329" },
    descriptionUser: "Маска с миндальной кислотой 30%",
  },
  {
    name: "Azelaic smart peel",
    brand: "Biotime For Home Care",
    stepCategory: "mask_acid",
    category: "mask",
    price: 0,
    volume: "50 мл",
    skinTypes: ["normal", "combination_dry", "combination_oily", "oily"],
    concerns: ["texture", "pores", "acne", "pigmentation"],
    activeIngredients: ["mandelic", "azelaic_acid"],
    marketLinks: { zy: "https://goldapple.ru/review/product/99000007457" },
    descriptionUser: "Умный пилинг с азелаиновой и миндальной кислотой",
  },
];

async function addNewProducts() {
  console.log('🔄 Начинаю добавление новых продуктов...\n');

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ name: string; error: string }> = [];

  for (const productData of newProducts) {
    try {
      console.log(`\n📦 Добавляю продукт: ${productData.name} (${productData.brand})`);
      console.log(`   Категория: ${productData.stepCategory}`);

      // Ищем или создаем бренд
      let brand = await prisma.brand.findFirst({
        where: { name: productData.brand },
      });

      if (!brand) {
        brand = await prisma.brand.create({
          data: {
            name: productData.brand,
            slug: createSlug(productData.brand),
            isActive: true,
          },
        });
        console.log(`   ✅ Создан новый бренд: ${productData.brand}`);
      }

      // Проверяем, не существует ли уже такой продукт
      const existingProduct = await prisma.product.findFirst({
        where: {
          name: productData.name,
          brandId: brand.id,
        },
      });

      if (existingProduct) {
        console.log(`   ⚠️ Продукт уже существует (ID: ${existingProduct.id}), обновляю...`);
        
        // Обновляем существующий продукт
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            step: productData.stepCategory,
            category: productData.category,
            skinTypes: productData.skinTypes,
            concerns: productData.concerns,
            activeIngredients: productData.activeIngredients,
            marketLinks: productData.marketLinks as any,
            descriptionUser: productData.descriptionUser,
            published: true,
          },
        });
        console.log(`   ✅ Продукт обновлен`);
        successCount++;
        continue;
      }

      // Создаем новый продукт
      const product = await prisma.product.create({
        data: {
          name: productData.name,
          slug: createSlug(productData.name),
          brandId: brand.id,
          step: productData.stepCategory,
          category: productData.category,
          price: productData.price || 0,
          volume: productData.volume,
          skinTypes: productData.skinTypes,
          concerns: productData.concerns,
          activeIngredients: productData.activeIngredients,
          marketLinks: productData.marketLinks as any,
          descriptionUser: productData.descriptionUser,
          published: true,
          priority: 50, // Средний приоритет
        },
      });

      console.log(`   ✅ Продукт создан (ID: ${product.id})`);
      successCount++;
    } catch (error: any) {
      console.error(`   ❌ Ошибка при добавлении ${productData.name}:`, error.message);
      errorCount++;
      errors.push({ name: productData.name, error: error.message });
    }
  }

  console.log(`\n\n📊 Итоги:`);
  console.log(`   ✅ Успешно: ${successCount}`);
  console.log(`   ❌ Ошибок: ${errorCount}`);

  if (errors.length > 0) {
    console.log(`\n❌ Ошибки:`);
    errors.forEach(({ name, error }) => {
      console.log(`   ${name}: ${error}`);
    });
  }

  console.log(`\n✅ Добавление продуктов завершено!`);
}

addNewProducts()
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

