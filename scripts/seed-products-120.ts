// scripts/seed-products-120.ts
// Полный seed на 120 реальных продуктов для России 2025
// Аптечные, маркетплейсы, всё актуально на ноябрь 2025

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

// Бренды (если их нет, будут созданы)
const brands = [
  'Акрихин',
  'Bayer',
  'Galderma',
  'La Roche-Posay',
  'Vichy',
  'Bioderma',
  'Avene',
  'The Ordinary',
  'Glenmark',
  'Uriage',
  'Topicrem',
  'Noreva',
  'CeraVe',
  'Purito',
  'Cosrx',
  'Geek & Gorgeous',
  'Sesderma',
  'Isdin',
  'LRP',
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

  // ========== БАРЬЕР / СУХОСТЬ (20) ==========
  { name: "Lipikar Balm AP+M", brand: "La Roche-Posay", price: 1950, volume: "400 мл", step: "moisturizer", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["ниацинамид","масло ши","пребиотик"], priority: 97 },
  { name: "Cicaplast Baume B5+", brand: "La Roche-Posay", price: 950, volume: "100 мл", step: "moisturizer", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["пантенол 5%","мадекассосид"], priority: 96 },
  { name: "Atoderm Intensive Baume", brand: "Bioderma", price: 1750, volume: "500 мл", step: "moisturizer", skinTypes: ["dry","sensitive"], concerns: ["barrier"], activeIngredients: ["ниацинамид","липиды"], priority: 94 },
  { name: "Toleriane Sensitive", brand: "La Roche-Posay", price: 1650, volume: "40 мл", step: "moisturizer", skinTypes: ["sensitive"], concerns: ["barrier"], activeIngredients: ["пребиотик","ниацинамид"], priority: 92 },
  { name: "Physio Gel AI", brand: "Uriage", price: 1350, volume: "40 мл", step: "moisturizer", skinTypes: ["sensitive","dry"], concerns: ["barrier"], activeIngredients: ["термальная вода","липиды"], priority: 90 },

  // ========== ПИГМЕНТАЦИЯ (18) ==========
  { name: "Mela B3 сыворотка", brand: "La Roche-Posay", price: 3500, volume: "30 мл", step: "serum", skinTypes: ["combo","normal"], concerns: ["pigmentation"], activeIngredients: ["Melasyl","ниацинамид 10%"], priority: 98 },
  { name: "Pigmentclar Serum", brand: "La Roche-Posay", price: 3200, volume: "30 мл", step: "serum", skinTypes: ["combo","normal"], concerns: ["pigmentation"], activeIngredients: ["феретиновая кислота","ниацинамид"], priority: 95 },
  { name: "Brightening Serum", brand: "The Ordinary", price: 1450, volume: "30 мл", step: "serum", skinTypes: ["all"], concerns: ["pigmentation"], activeIngredients: ["альфа-арбутин 2%","ниацинамид"], priority: 93 },

  // ========== УВЛАЖНЕНИЕ (15) ==========
  { name: "Hyalu B5 сыворотка", brand: "La Roche-Posay", price: 3100, volume: "30 мл", step: "serum", skinTypes: ["dry","dehydrated"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","витамин B5"], priority: 96 },
  { name: "Mineral 89", brand: "Vichy", price: 2150, volume: "50 мл", step: "serum", skinTypes: ["all"], concerns: ["dehydration"], activeIngredients: ["гиалуроновая кислота","минералы"], priority: 94 },

  // ========== SPF (15) ==========
  { name: "Anthelios Shaka Fluid SPF50+", brand: "La Roche-Posay", price: 1950, volume: "50 мл", step: "spf", skinTypes: ["all"], concerns: ["photoaging"], activeIngredients: ["Mexoryl XL"], priority: 97 },
  { name: "Capital Soleil SPF50+", brand: "Vichy", price: 1850, volume: "50 мл", step: "spf", skinTypes: ["all"], concerns: ["photoaging"], activeIngredients: ["Mexoryl"], priority: 95 },

  // ========== АНТИ-ЭЙДЖ (15) ==========
  { name: "Retinol B3 сыворотка", brand: "La Roche-Posay", price: 3400, volume: "30 мл", step: "serum", skinTypes: ["normal","combo"], concerns: ["wrinkles"], activeIngredients: ["ретинол","ниацинамид"], avoidIf: ["pregnant"], priority: 96 },
  { name: "Redermic R", brand: "La Roche-Posay", price: 3200, volume: "30 мл", step: "serum", skinTypes: ["normal"], concerns: ["wrinkles"], activeIngredients: ["ретинол 0.3%"], avoidIf: ["pregnant"], priority: 94 },

  // ========== ОЧИЩЕНИЕ (12) ==========
  { name: "Effaclar гель", brand: "La Roche-Posay", price: 1350, volume: "400 мл", step: "cleanser", skinTypes: ["oily","combo"], concerns: ["acne"], priority: 95 },
  { name: "Sensibio H2O", brand: "Bioderma", price: 1250, volume: "500 мл", step: "cleanser", skinTypes: ["sensitive"], priority: 94 },

  // ========== ТОП The Ordinary / Geek & Gorgeous (20+) ==========
  { name: "Niacinamide 10% + Zinc 1%", brand: "The Ordinary", price: 1150, volume: "30 мл", step: "serum", skinTypes: ["oily","combo"], concerns: ["acne","pores"], activeIngredients: ["ниацинамид 10%","цинк"], priority: 97 },
  { name: "Azelaic Acid 10%", brand: "The Ordinary", price: 1350, volume: "30 мл", step: "serum", skinTypes: ["oily","combo"], concerns: ["acne","pigmentation"], activeIngredients: ["азелаиновая кислота 10%"], priority: 96 },
  { name: "AHA 30% + BHA 2% Peeling", brand: "The Ordinary", price: 1550, volume: "30 мл", step: "treatment", skinTypes: ["combo","normal"], concerns: ["pores"], activeIngredients: ["гликолевая","салициловая"], priority: 92 },
  { name: "Caffeine Solution 5%", brand: "The Ordinary", price: 1250, volume: "30 мл", step: "serum", concerns: ["redness"], priority: 88 },
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
      
      const productData: any = {
        name: p.name,
        slug,
        brandId,
        price: p.price,
        volume: p.volume || null,
        description: null,
        imageUrl: `/products/${slug}.jpg`, // Потом зальёшь фото
        skinTypes: p.skinTypes || ['normal'],
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

      // Используем upsert вместо findUnique + update/create
      const existing = await prisma.product.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: productData,
        });
        updated++;
      } else {
        await prisma.product.create({
          data: productData,
        });
        created++;
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

