// scripts/seed-products-from-prod.ts
// Копирует бренды и продукты из продовой базы в локальную (docker) для dev-тестов плана/оплаты.
//
// Использование:
// 1) В .env добавь строку с продовой БД (read-only или snapshot):
//    PROD_DATABASE_URL="postgres://user:pass@host:5432/dbname"
// 2) Убедись, что локальный docker поднят и DATABASE_URL указывает на локальную БД.
// 3) Запусти:
//    npx tsx scripts/seed-products-from-prod.ts
//
// Скрипт:
// - берёт все записи Brand и Product из PROD_DATABASE_URL
// - чистит связанные локальные таблицы (wishlist/cart/replacements), затем brands/products
// - вставляет бренды и продукты с теми же id, чтобы план/вишлист и т.п. могли ссылаться по productId

import { PrismaClient } from '@prisma/client';

const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL;

if (!PROD_DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ PROD_DATABASE_URL не задан. Добавь его в .env, например:\nPROD_DATABASE_URL="postgres://user:pass@host:5432/dbname"',
  );
  process.exit(1);
}

// Отдельный клиент для продовой БД
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: PROD_DATABASE_URL,
    },
  },
});

// Клиент для локальной (DATABASE_URL)
const localPrisma = new PrismaClient();

async function main() {
  // eslint-disable-next-line no-console
  console.log('🌱 Seeding brands/products from PROD into LOCAL...');

  // 1. Читаем данные из продовой базы
  const [prodBrands, prodProducts] = await Promise.all([
    prodPrisma.brand.findMany(),
    prodPrisma.product.findMany(),
  ]);

  // eslint-disable-next-line no-console
  console.log('📦 Prod data:', {
    brands: prodBrands.length,
    products: prodProducts.length,
  });

  if (prodProducts.length === 0) {
    // eslint-disable-next-line no-console
    console.warn('⚠️ В продовой базе нет продуктов. Нечего копировать.');
    return;
  }

  // 2. Чистим локальные зависимости и каталоги
  // ВАЖНО: порядок удаления учитывает внешние ключи.
  // eslint-disable-next-line no-console
  console.log('🧹 Clearing LOCAL dependent tables (wishlist/cart/replacements)...');
  await localPrisma.$transaction([
    localPrisma.wishlistFeedback.deleteMany(),
    localPrisma.wishlist.deleteMany(),
    localPrisma.cart.deleteMany(),
    localPrisma.productReplacement.deleteMany(),
  ]);

  // eslint-disable-next-line no-console
  console.log('🧹 Clearing LOCAL brands/products...');
  await localPrisma.$transaction([
    localPrisma.product.deleteMany(),
    localPrisma.brand.deleteMany(),
  ]);

  // 3. Копируем бренды
  // Сохраняем id, чтобы product.brandId совпадал с продом.
  // eslint-disable-next-line no-console
  console.log('📥 Inserting brands into LOCAL...');
  if (prodBrands.length > 0) {
    await localPrisma.brand.createMany({
      data: prodBrands.map((b) => ({
        id: b.id,
        name: b.name,
        country: b.country,
        isActive: b.isActive,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        logoUrl: b.logoUrl,
        slug: b.slug,
      })),
      skipDuplicates: true,
    });
  }

  // 4. Копируем продукты
  // eslint-disable-next-line no-console
  console.log('📥 Inserting products into LOCAL...');
  await localPrisma.product.createMany({
    data: prodProducts.map((p) => ({
      id: p.id,
      brandId: p.brandId,
      name: p.name,
      line: p.line,
      category: p.category,
      step: p.step,
      skinTypes: p.skinTypes,
      concerns: p.concerns,
      isFragranceFree: p.isFragranceFree,
      isNonComedogenic: p.isNonComedogenic,
      priceSegment: p.priceSegment,
      descriptionUser: p.descriptionUser,
      marketLinks: p.marketLinks,
      status: p.status,
      imageUrl: p.imageUrl,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      price: p.price,
      activeIngredients: p.activeIngredients,
      avoidIf: p.avoidIf,
      description: p.description,
      gallery: p.gallery,
      isHero: p.isHero,
      link: p.link,
      priority: p.priority,
      published: p.published,
      slug: p.slug,
      volume: p.volume,
      composition: p.composition,
    })),
    skipDuplicates: true,
  });

  // Проверяем результат
  const [localBrandCount, localProductCount] = await Promise.all([
    localPrisma.brand.count(),
    localPrisma.product.count(),
  ]);

  // eslint-disable-next-line no-console
  console.log('✅ Seeding completed:', {
    localBrands: localBrandCount,
    localProducts: localProductCount,
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('❌ Error while seeding products from PROD:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prodPrisma.$disconnect();
    await localPrisma.$disconnect();
  });

