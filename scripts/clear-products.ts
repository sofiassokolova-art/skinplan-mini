// scripts/clear-products.ts
// Скрипт для очистки всех продуктов из БД

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Начинаю очистку продуктов из БД...');

  try {
    // Сначала удаляем связанные записи
    console.log('📋 Удаляю связанные записи...');
    
    // Удаляем записи из wishlist
    const wishlistCount = await prisma.wishlist.deleteMany({});
    console.log(`✅ Удалено записей из wishlist: ${wishlistCount.count}`);

    // Удаляем записи из wishlistFeedback
    const wishlistFeedbackCount = await prisma.wishlistFeedback.deleteMany({});
    console.log(`✅ Удалено записей из wishlistFeedback: ${wishlistFeedbackCount.count}`);

    // Удаляем записи из productReplacements
    const replacementsCount = await prisma.productReplacement.deleteMany({});
    console.log(`✅ Удалено записей из productReplacements: ${replacementsCount.count}`);

    // Удаляем записи из recommendationSessions (они содержат JSON с product_id)
    const sessionsCount = await prisma.recommendationSession.deleteMany({});
    console.log(`✅ Удалено записей из recommendationSessions: ${sessionsCount.count}`);

    // Теперь удаляем сами продукты
    console.log('📦 Удаляю продукты...');
    const productsCount = await prisma.product.deleteMany({});
    console.log(`✅ Удалено продуктов: ${productsCount.count}`);

    console.log('🎉 Очистка завершена успешно!');
  } catch (error) {
    console.error('❌ Ошибка при очистке:', error);
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

