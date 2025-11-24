// scripts/seed-products.ts
// Скрипт для заполнения начальных продуктов

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedProducts() {
  console.log('🌱 Seeding products...');

  // Создаем бренды
  const laRochePosay = await prisma.brand.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'La Roche-Posay',
      country: 'France',
      isActive: true,
    },
  });

  const pyunkangYul = await prisma.brand.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Pyunkang Yul',
      country: 'South Korea',
      isActive: true,
    },
  });

  const purito = await prisma.brand.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: 'Purito',
      country: 'South Korea',
      isActive: true,
    },
  });

  const uriage = await prisma.brand.upsert({
    where: { id: 4 },
    update: {},
    create: {
      name: 'Uriage',
      country: 'France',
      isActive: true,
    },
  });

  const bioderma = await prisma.brand.upsert({
    where: { id: 5 },
    update: {},
    create: {
      name: 'Bioderma',
      country: 'France',
      isActive: true,
    },
  });

  // Создаем продукты
  const products = [
    {
      brandId: laRochePosay.id,
      name: 'Toleriane Cleansing',
      line: 'Toleriane',
      category: 'cleanser',
      step: 'cleansing',
      skinTypes: ['dry', 'sensitive', 'normal'],
      concerns: ['sensitivity', 'dryness'],
      isFragranceFree: true,
      isNonComedogenic: true,
      priceSegment: 'mid',
      descriptionUser: 'Мягкое очищающее средство для чувствительной кожи',
      status: 'published' as const,
    },
    {
      brandId: pyunkangYul.id,
      name: 'Essence Toner',
      line: 'Essence',
      category: 'toner',
      step: 'toning',
      skinTypes: ['dry', 'sensitive', 'normal'],
      concerns: ['dryness', 'sensitivity'],
      isFragranceFree: true,
      isNonComedogenic: true,
      priceSegment: 'mid',
      descriptionUser: 'Увлажняющий тонер для сухой и чувствительной кожи',
      status: 'published' as const,
    },
    {
      brandId: purito.id,
      name: 'Galacto Niacin 97 Power Essence',
      line: 'Galacto Niacin',
      category: 'serum',
      step: 'treatment',
      skinTypes: ['oily', 'combo', 'normal'],
      concerns: ['acne', 'pores'],
      isFragranceFree: true,
      isNonComedogenic: true,
      priceSegment: 'mid',
      descriptionUser: 'Сыворотка с ниацинамидом для проблемной кожи',
      status: 'published' as const,
    },
    {
      brandId: uriage.id,
      name: 'Roséliane Anti-Redness Cream',
      line: 'Roséliane',
      category: 'cream',
      step: 'moisturizer',
      skinTypes: ['sensitive', 'normal'],
      concerns: ['sensitivity'],
      isFragranceFree: true,
      isNonComedogenic: true,
      priceSegment: 'mid',
      descriptionUser: 'Успокаивающий крем для чувствительной кожи',
      status: 'published' as const,
    },
    {
      brandId: bioderma.id,
      name: 'Sensibio Oil',
      line: 'Sensibio',
      category: 'cleanser',
      step: 'cleansing',
      skinTypes: ['dry', 'sensitive', 'normal'],
      concerns: ['sensitivity', 'dryness'],
      isFragranceFree: true,
      isNonComedogenic: true,
      priceSegment: 'mid',
      descriptionUser: 'Очищающее масло для двойного очищения',
      status: 'published' as const,
    },
  ];

  for (const product of products) {
    // Проверяем существование продукта
    const existing = await prisma.product.findFirst({
      where: {
        brandId: product.brandId,
        name: product.name,
      },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: product,
      });
    } else {
      await prisma.product.create({
        data: product,
      });
    }
  }

  console.log('✅ Products seeded:', products.length);
}

seedProducts()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
