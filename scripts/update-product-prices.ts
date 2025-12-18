// scripts/update-product-prices.ts
// Скрипт для обновления цен импортированных продуктов

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Цены из списка пользователя
const priceUpdates: Array<{ name: string; brand: string; price: number }> = [
  { name: 'La Roche-Posay Nutritic Intense Riche', brand: 'La Roche-Posay', price: 2490 },
  { name: 'La Roche-Posay Nutritic Intense', brand: 'La Roche-Posay', price: 2290 },
  { name: 'Avène Hydrance Rich', brand: 'Avene', price: 2090 },
  { name: 'Dear, Klairs Rich Moist Soothing Cream', brand: 'Dear, Klairs', price: 2400 },
  { name: 'Bioderma Atoderm Creme', brand: 'Bioderma', price: 1850 },
  { name: 'Avène Cold Cream', brand: 'Avene', price: 2090 },
  { name: 'Round Lab 1025 Dokdo Sleeping Pack', brand: 'Round Lab', price: 1800 },
  { name: "d'Alba Waterfull Vegan Sleeping Pack", brand: "d'Alba", price: 1700 },
  { name: 'Payot Sleeping Masque Éclat', brand: 'Payot', price: 3000 },
  { name: 'Uriage Eau Thermale Sleeping Mask', brand: 'Uriage', price: 2240 },
  { name: 'Dr.Jart+ Cicapair Tiger Grass Sleepair Intensive Mask', brand: 'Dr.Jart+', price: 3200 },
  { name: 'Manyo Bifida Biome Deep Sleeping Mask', brand: 'Ma:nyo', price: 1850 },
  { name: 'Avène Soothing Moisture Mask', brand: 'Avene', price: 1990 },
  { name: 'HYGGEE Relief Chamomile Mask', brand: 'HYGGEE', price: 1400 },
  { name: 'Manyo Herb Green Cica Pack', brand: 'Ma:nyo', price: 1600 },
  { name: 'Round Lab Mugwort Calming Mask Sheet', brand: 'Round Lab', price: 120 },
  { name: 'Planeta Organica PURE Soothing Mask', brand: 'Planeta Organica', price: 550 },
  { name: 'DARLING Ninja Star Soothing Mask', brand: 'DARLING', price: 600 },
  { name: 'La Roche-Posay Anthelios Oil Correct SPF50+', brand: 'La Roche-Posay', price: 1990 },
  { name: 'Eucerin Oil Control SPF50+', brand: 'Eucerin', price: 1790 },
  { name: 'For Me by Gold Apple Daily Sunscreen SPF50', brand: 'For Me', price: 1140 },
  { name: 'Dr.Ceuracle Cica Regen Vegan Sun', brand: 'Dr.Ceuracle', price: 1690 },
  { name: 'Round Lab Birch Juice Moisturizing Sun Cream SPF50+ PA++++', brand: 'Round Lab', price: 1890 },
  { name: 'La Roche-Posay Anthelios Mineral One SPF50+', brand: 'La Roche-Posay', price: 2190 },
  { name: 'Avène Mineral Cream SPF50', brand: 'Avene', price: 2190 },
  { name: 'Kuora Sunscreen Color SPF50', brand: 'Kuora', price: 2740 },
  { name: 'La Roche-Posay Pure Vitamin C10 Serum', brand: 'La Roche-Posay', price: 2190 },
  { name: 'Obagi Professional-C Serum 10%', brand: 'Obagi', price: 3640 },
  { name: 'Obagi Professional-C Serum 15%', brand: 'Obagi', price: 4140 },
  { name: 'COSRX The Vitamin C 23 Serum', brand: 'COSRX', price: 1890 },
  { name: 'Etat Pur Vitamin C 10%', brand: 'Etat Pur', price: 1390 },
  { name: 'SmoRodina Vitamin C 10% CE Ferulic', brand: 'SmoRodina', price: 1090 },
  { name: 'ART&FACT Benzoyl Peroxide 2.5% Anti-Acne Serum', brand: 'ART&FACT', price: 1290 },
  { name: 'ATB Lab Anti Acne Serum', brand: 'ATB Lab', price: 1590 },
  { name: 'Clinique Anti-Blemish Solutions All-Over Clearing Treatment', brand: 'Clinique', price: 2740 },
  { name: 'ATB Lab Matte Skin Cream', brand: 'ATB Lab', price: 1490 },
  { name: 'ART&FACT Azelaic Acid 15% + Zinc PCA', brand: 'ART&FACT', price: 1190 },
  { name: 'ARAVIA Laboratories Azelaic Correcting Cream', brand: 'ARAVIA Laboratories', price: 1690 },
  { name: 'BioBalance Azelaic Acid 10% Treatment Cream', brand: 'BIOBALANCE', price: 1090 },
  { name: 'ICON SKIN Azelais Corrective Cream', brand: 'ICON SKIN', price: 1190 },
  { name: 'GIGI Bioplasma Azelaic 15% Cream', brand: 'GIGI', price: 2440 },
  { name: 'Kora Sebocorrector Cream with Azelaic Acid', brand: 'Kora', price: 1090 },
];

async function updatePrices() {
  console.log('💰 Обновление цен для импортированных продуктов...\n');

  let updatedCount = 0;
  let notFoundCount = 0;

  for (const update of priceUpdates) {
    // Ищем продукт по названию и бренду
    const brand = await prisma.brand.findUnique({
      where: { name: update.brand },
    });

    if (!brand) {
      console.warn(`⚠️  Бренд не найден: ${update.brand}`);
      notFoundCount++;
      continue;
    }

    const product = await prisma.product.findFirst({
      where: {
        brandId: brand.id,
        name: update.name,
      },
    });

    if (!product) {
      console.warn(`⚠️  Продукт не найден: ${update.brand} - ${update.name}`);
      notFoundCount++;
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { price: update.price },
    });

    updatedCount++;
    console.log(`✅ Обновлена цена: ${update.brand} - ${update.name} → ${update.price} ₽`);
  }

  console.log(`\n🎉 Обновление завершено!`);
  console.log(`   ✅ Обновлено: ${updatedCount} продуктов`);
  console.log(`   ⚠️  Не найдено: ${notFoundCount} продуктов`);
}

updatePrices()
  .catch((error) => {
    console.error('❌ Ошибка при обновлении цен:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

