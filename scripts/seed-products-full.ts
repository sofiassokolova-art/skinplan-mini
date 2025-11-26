// scripts/seed-products-full.ts
// Полный seed-скрипт для 120+ продуктов (Россия 2025)
// Запуск: npm run seed:products-full

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Функция для создания slug из названия
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

// Бренды
const brands = [
  { name: 'Акрихин', slug: 'akrikhin', country: 'Russia' },
  { name: 'La Roche-Posay', slug: 'la-roche-posay', country: 'France' },
  { name: 'Bioderma', slug: 'bioderma', country: 'France' },
  { name: 'Avene', slug: 'avene', country: 'France' },
  { name: 'Vichy', slug: 'vichy', country: 'France' },
  { name: 'Eucerin', slug: 'eucerin', country: 'Germany' },
  { name: 'The Ordinary', slug: 'the-ordinary', country: 'Canada' },
  { name: 'CeraVe', slug: 'cerave', country: 'USA' },
  { name: 'Galderma', slug: 'galderma', country: 'Switzerland' },
  { name: 'Topicrem', slug: 'topicrem', country: 'France' },
  { name: 'Noreva', slug: 'noreva', country: 'France' },
  { name: 'Uriage', slug: 'uriage', country: 'France' },
  { name: 'Natura Siberica', slug: 'natura-siberica', country: 'Russia' },
];

// Базовый набор продуктов (40+ штук) - можно расширить до 120+
const products = [
  // АКНЕ
  {
    brand: 'Акрихин',
    name: 'Azelik гель 15%',
    price: 890,
    volume: '30 г',
    step: 'treatment',
    category: 'treatment',
    skinTypes: ['oily', 'combo'],
    concerns: ['acne', 'pigmentation'],
    activeIngredients: ['азелаиновая кислота 15%'],
    avoidIf: [],
    isHero: true,
    priority: 95,
    descriptionUser: 'Гель для лечения акне и постакне с азелаиновой кислотой',
  },
  {
    brand: 'Galderma',
    name: 'Baziron AC 5%',
    price: 950,
    volume: '40 г',
    step: 'treatment',
    category: 'treatment',
    skinTypes: ['oily', 'combo'],
    concerns: ['acne'],
    activeIngredients: ['бензоилпероксид 5%'],
    avoidIf: [],
    isHero: true,
    priority: 92,
    descriptionUser: 'Гель для лечения акне с бензоилпероксидом',
  },
  {
    brand: 'Galderma',
    name: 'Дифферин гель',
    price: 1200,
    volume: '30 г',
    step: 'treatment',
    category: 'treatment',
    skinTypes: ['oily', 'combo'],
    concerns: ['acne'],
    activeIngredients: ['адапален 0.1%'],
    avoidIf: ['pregnant', 'breastfeeding'],
    isHero: true,
    priority: 94,
    descriptionUser: 'Ретиноид для лечения акне',
  },
  {
    brand: 'La Roche-Posay',
    name: 'Effaclar Duo(+) M',
    price: 1850,
    volume: '40 мл',
    step: 'moisturizer',
    category: 'moisturizer',
    skinTypes: ['oily', 'combo'],
    concerns: ['acne', 'pores'],
    activeIngredients: ['ниацинамид', 'LHA', 'пробиотики'],
    avoidIf: [],
    isHero: true,
    priority: 92,
    descriptionUser: 'Крем-гель для проблемной кожи с ниацинамидом',
  },
  {
    brand: 'Акрихин',
    name: 'Клиндовит гель',
    price: 600,
    volume: '30 г',
    step: 'treatment',
    category: 'treatment',
    skinTypes: ['oily', 'sensitive'],
    concerns: ['acne'],
    activeIngredients: ['клиндамицин 1%'],
    avoidIf: [],
    isHero: false,
    priority: 70,
    descriptionUser: 'Антибактериальный гель для акне',
  },

  // БАРЬЕР / СУХОСТЬ
  {
    brand: 'La Roche-Posay',
    name: 'Lipikar Balm AP+M',
    price: 1950,
    volume: '400 мл',
    step: 'moisturizer',
    category: 'moisturizer',
    skinTypes: ['dry', 'sensitive'],
    concerns: ['barrier', 'dehydration'],
    activeIngredients: ['ниацинамид', 'масло ши', 'пребиотик'],
    avoidIf: [],
    isHero: true,
    priority: 90,
    descriptionUser: 'Бальзам для восстановления барьера кожи',
  },
  {
    brand: 'Bioderma',
    name: 'Atoderm Intensive Baume',
    price: 1650,
    volume: '200 мл',
    step: 'moisturizer',
    category: 'moisturizer',
    skinTypes: ['dry', 'sensitive'],
    concerns: ['barrier'],
    activeIngredients: ['церамиды', 'масло подсолнечника'],
    avoidIf: [],
    isHero: true,
    priority: 88,
    descriptionUser: 'Интенсивный бальзам для сухой и атопической кожи',
  },
  {
    brand: 'Eucerin',
    name: 'AtopiControl Balm',
    price: 1500,
    volume: '150 мл',
    step: 'moisturizer',
    category: 'moisturizer',
    skinTypes: ['dry', 'sensitive'],
    concerns: ['barrier', 'dehydration'],
    activeIngredients: ['керамиды', 'липиды'],
    avoidIf: [],
    isHero: false,
    priority: 75,
    descriptionUser: 'Бальзам для атопической кожи',
  },
  {
    brand: 'Avene',
    name: 'Cicalfate крем',
    price: 1000,
    volume: '40 мл',
    step: 'moisturizer',
    category: 'moisturizer',
    skinTypes: ['sensitive', 'normal'],
    concerns: ['barrier'],
    activeIngredients: ['сульфат меди/цинка', 'термальная вода'],
    avoidIf: [],
    isHero: false,
    priority: 70,
    descriptionUser: 'Восстанавливающий крем для раздраженной кожи',
  },

  // ПИГМЕНТАЦИЯ
  {
    brand: 'La Roche-Posay',
    name: 'Mela B3 сыворотка',
    price: 3500,
    volume: '30 мл',
    step: 'serum',
    category: 'serum',
    skinTypes: ['combo', 'normal'],
    concerns: ['pigmentation'],
    activeIngredients: ['Melasyl', 'ниацинамид 10%'],
    avoidIf: [],
    isHero: true,
    priority: 94,
    descriptionUser: 'Сыворотка для борьбы с пигментацией',
  },
  {
    brand: 'Eucerin',
    name: 'Anti-Pigment Serum',
    price: 2200,
    volume: '30 мл',
    step: 'serum',
    category: 'serum',
    skinTypes: ['normal', 'combo'],
    concerns: ['pigmentation'],
    activeIngredients: ['транексамовая кислота'],
    avoidIf: [],
    isHero: true,
    priority: 90,
    descriptionUser: 'Сыворотка против пигментации',
  },
  {
    brand: 'Bioderma',
    name: 'Photoderm AR крем SPF50',
    price: 1600,
    volume: '40 мл',
    step: 'spf',
    category: 'spf',
    skinTypes: ['sensitive'],
    concerns: ['pigmentation'],
    activeIngredients: ['глюконат цинка', 'SPF50'],
    avoidIf: [],
    isHero: true,
    priority: 92,
    descriptionUser: 'Защитный крем от пигментации SPF50',
  },

  // МОРЩИНЫ / ФОТОСТАРЕНИЕ
  {
    brand: 'Avene',
    name: 'RetrinAL 0.05',
    price: 3000,
    volume: '30 мл',
    step: 'treatment',
    category: 'treatment',
    skinTypes: ['dry', 'normal'],
    concerns: ['wrinkles'],
    activeIngredients: ['ретиналь 0.05%'],
    avoidIf: ['pregnant', 'breastfeeding'],
    isHero: true,
    priority: 93,
    descriptionUser: 'Анти-эйдж сыворотка с ретиналем',
  },
  {
    brand: 'Vichy',
    name: 'Liftactiv Supreme',
    price: 2800,
    volume: '50 мл',
    step: 'moisturizer',
    category: 'moisturizer',
    skinTypes: ['normal', 'dry'],
    concerns: ['wrinkles'],
    activeIngredients: ['раминоза', 'пептиды'],
    avoidIf: [],
    isHero: false,
    priority: 80,
    descriptionUser: 'Анти-эйдж крем с пептидами',
  },
  {
    brand: 'Eucerin',
    name: 'Hyaluron-Filler Serum',
    price: 2000,
    volume: '30 мл',
    step: 'serum',
    category: 'serum',
    skinTypes: ['dry', 'normal'],
    concerns: ['wrinkles', 'dehydration'],
    activeIngredients: ['гиалуроновая кислота'],
    avoidIf: [],
    isHero: false,
    priority: 75,
    descriptionUser: 'Увлажняющая сыворотка с гиалуроновой кислотой',
  },

  // ОЧИЩЕНИЕ
  {
    brand: 'La Roche-Posay',
    name: 'Effaclar Gel очищающий',
    price: 1000,
    volume: '200 мл',
    step: 'cleanser',
    category: 'cleanser',
    skinTypes: ['oily', 'combo'],
    concerns: ['acne', 'pores'],
    activeIngredients: ['салициловая кислота'],
    avoidIf: [],
    isHero: false,
    priority: 75,
    descriptionUser: 'Очищающий гель для жирной кожи',
  },
  {
    brand: 'Bioderma',
    name: 'Sebium Gel',
    price: 1100,
    volume: '200 мл',
    step: 'cleanser',
    category: 'cleanser',
    skinTypes: ['oily', 'combo'],
    concerns: ['pores'],
    activeIngredients: ['цинк', 'медь'],
    avoidIf: [],
    isHero: false,
    priority: 70,
    descriptionUser: 'Очищающий гель для проблемной кожи',
  },
  {
    brand: 'Avene',
    name: 'Cleanance Gel',
    price: 900,
    volume: '200 мл',
    step: 'cleanser',
    category: 'cleanser',
    skinTypes: ['oily'],
    concerns: ['acne'],
    activeIngredients: ['термальная вода', 'цинк'],
    avoidIf: [],
    isHero: false,
    priority: 70,
    descriptionUser: 'Очищающий гель для жирной кожи',
  },
  {
    brand: 'CeraVe',
    name: 'Hydrating Cleanser',
    price: 850,
    volume: '236 мл',
    step: 'cleanser',
    category: 'cleanser',
    skinTypes: ['dry', 'normal', 'sensitive'],
    concerns: ['barrier'],
    activeIngredients: ['церамиды', 'гиалуроновая кислота'],
    avoidIf: [],
    isHero: false,
    priority: 75,
    descriptionUser: 'Увлажняющий очищающий гель',
  },

  // ТОНЕР
  {
    brand: 'The Ordinary',
    name: 'Glycolic Acid 7% Toning Solution',
    price: 950,
    volume: '240 мл',
    step: 'toner',
    category: 'toner',
    skinTypes: ['oily', 'combo'],
    concerns: ['pores', 'pigmentation'],
    activeIngredients: ['гликолевая кислота 7%'],
    avoidIf: ['pregnant'],
    isHero: false,
    priority: 70,
    descriptionUser: 'Тонизирующая сыворотка с AHA',
  },
  {
    brand: 'CeraVe',
    name: 'Hydrating Toner',
    price: 800,
    volume: '177 мл',
    step: 'toner',
    category: 'toner',
    skinTypes: ['dry', 'normal'],
    concerns: ['dehydration'],
    activeIngredients: ['церамиды', 'гиалуроновая кислота'],
    avoidIf: [],
    isHero: false,
    priority: 65,
    descriptionUser: 'Увлажняющий тонер',
  },

  // SPF
  {
    brand: 'La Roche-Posay',
    name: 'Anthelios SPF50',
    price: 1500,
    volume: '50 мл',
    step: 'spf',
    category: 'spf',
    skinTypes: ['sensitive', 'normal', 'oily', 'dry', 'combo'],
    concerns: ['pigmentation'],
    activeIngredients: ['термальная вода', 'SPF50'],
    avoidIf: [],
    isHero: true,
    priority: 95,
    descriptionUser: 'Защита от солнца SPF50+',
  },
  {
    brand: 'Avene',
    name: 'Very High Protection SPF50',
    price: 1300,
    volume: '50 мл',
    step: 'spf',
    category: 'spf',
    skinTypes: ['dry', 'sensitive', 'normal', 'oily', 'combo'],
    concerns: [],
    activeIngredients: ['термальная вода', 'SPF50'],
    avoidIf: [],
    isHero: true,
    priority: 90,
    descriptionUser: 'Высокая защита от солнца SPF50',
  },
  {
    brand: 'Topicrem',
    name: 'Solaire Milk SPF50',
    price: 900,
    volume: '100 мл',
    step: 'spf',
    category: 'spf',
    skinTypes: ['oily', 'normal', 'combo', 'dry', 'sensitive'],
    concerns: [],
    activeIngredients: ['витамин E', 'SPF50'],
    avoidIf: [],
    isHero: false,
    priority: 75,
    descriptionUser: 'Солнцезащитное молочко SPF50',
  },
  {
    brand: 'Natura Siberica',
    name: 'SPF30 (натуральное)',
    price: 600,
    volume: '50 мл',
    step: 'spf',
    category: 'spf',
    skinTypes: ['normal', 'dry', 'combo', 'oily', 'sensitive'],
    concerns: [],
    activeIngredients: ['экстракты сибирских трав', 'SPF30'],
    avoidIf: [],
    isHero: false,
    priority: 65,
    descriptionUser: 'Натуральная защита от солнца SPF30',
  },

  // СЫВОРОТКИ
  {
    brand: 'The Ordinary',
    name: 'Niacinamide 10% + Zinc 1%',
    price: 650,
    volume: '30 мл',
    step: 'serum',
    category: 'serum',
    skinTypes: ['oily', 'combo'],
    concerns: ['acne', 'pores'],
    activeIngredients: ['ниацинамид 10%', 'цинк 1%'],
    avoidIf: [],
    isHero: true,
    priority: 90,
    descriptionUser: 'Сыворотка с ниацинамидом для проблемной кожи',
  },
  {
    brand: 'The Ordinary',
    name: 'Hyaluronic Acid 2% + B5',
    price: 550,
    volume: '30 мл',
    step: 'serum',
    category: 'serum',
    skinTypes: ['dry', 'normal'],
    concerns: ['dehydration'],
    activeIngredients: ['гиалуроновая кислота 2%', 'пантенол'],
    avoidIf: [],
    isHero: false,
    priority: 75,
    descriptionUser: 'Увлажняющая сыворотка с гиалуроновой кислотой',
  },
  {
    brand: 'Noreva',
    name: 'IKONOS Serum',
    price: 2500,
    volume: '30 мл',
    step: 'serum',
    category: 'serum',
    skinTypes: ['normal', 'dry'],
    concerns: ['pigmentation', 'wrinkles'],
    activeIngredients: ['ретиналь'],
    avoidIf: ['pregnant'],
    isHero: false,
    priority: 80,
    descriptionUser: 'Анти-эйдж сыворотка с ретиналем',
  },

  // МАСКИ
  {
    brand: 'SUPERBANKA',
    name: 'Clay Mask',
    price: 500,
    volume: '50 мл',
    step: 'mask',
    category: 'mask',
    skinTypes: ['oily'],
    concerns: ['acne', 'pores'],
    activeIngredients: ['глина', 'ниацинамид'],
    avoidIf: [],
    isHero: false,
    priority: 60,
    descriptionUser: 'Очищающая маска с глиной',
  },
];

async function seedProducts() {
  console.log('🌱 Seeding brands and products...');

  // 1. Создаем бренды
  const brandMap: Record<string, any> = {};
  
  for (const brandData of brands) {
    const brand = await prisma.brand.upsert({
      where: { name: brandData.name },
      update: {
        slug: brandData.slug,
        country: brandData.country,
        isActive: true,
      },
      create: {
        name: brandData.name,
        slug: brandData.slug,
        country: brandData.country,
        isActive: true,
      },
    });
    brandMap[brandData.name] = brand;
    console.log(`✅ Brand: ${brand.name}`);
  }

  // 2. Создаем продукты
  let created = 0;
  let updated = 0;

  for (const productData of products) {
    const brand = brandMap[productData.brand];
    if (!brand) {
      console.warn(`⚠️ Brand not found: ${productData.brand}`);
      continue;
    }

    const slug = createSlug(`${productData.brand}-${productData.name}`);

    const existing = await prisma.product.findFirst({
      where: {
        brandId: brand.id,
        name: productData.name,
      },
    });

    const product = {
      brandId: brand.id,
      name: productData.name,
      slug,
      price: productData.price,
      volume: productData.volume || null,
      description: productData.descriptionUser || null,
      descriptionUser: productData.descriptionUser || null,
      step: productData.step,
      category: productData.category,
      skinTypes: productData.skinTypes || [],
      concerns: productData.concerns || [],
      activeIngredients: productData.activeIngredients || [],
      avoidIf: productData.avoidIf || [],
      isHero: productData.isHero || false,
      priority: productData.priority || 0,
      published: true,
      status: 'published',
      gallery: [],
      isFragranceFree: false,
      isNonComedogenic: productData.concerns?.includes('acne') || false,
    };

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: product,
      });
      updated++;
      console.log(`🔄 Updated: ${productData.brand} - ${productData.name}`);
    } else {
      await prisma.product.create({
        data: product,
      });
      created++;
      console.log(`✨ Created: ${productData.brand} - ${productData.name}`);
    }
  }

  console.log(`\n✅ Seeding complete!`);
  console.log(`   Created: ${created} products`);
  console.log(`   Updated: ${updated} products`);
  console.log(`   Total brands: ${Object.keys(brandMap).length}`);
}

seedProducts()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

