// scripts/check-recommendation-session.ts
// Проверка сессии рекомендаций и продуктов

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRecommendationSession() {
  const telegramId = process.argv[2] || '643160759';
  
  console.log(`\n🔍 Проверка сессии рекомендаций для пользователя ${telegramId}\n`);
  
  try {
    const user = await prisma.user.findFirst({
      where: { telegramId: telegramId },
    });

    if (!user) {
      console.error(`❌ Пользователь не найден`);
      process.exit(1);
    }

    const session = await prisma.recommendationSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        rule: true,
      },
    });

    if (!session) {
      console.log('❌ Сессия рекомендаций не найдена');
      process.exit(1);
    }

    console.log(`✅ Сессия найдена: ID ${session.id}`);
    console.log(`   Правило: ${session.rule?.name || 'нет'}`);
    console.log(`   Продуктов: ${Array.isArray(session.products) ? session.products.length : 0}`);
    console.log(`   ID продуктов: ${JSON.stringify(session.products)}\n`);

    if (Array.isArray(session.products) && session.products.length > 0) {
      const productIds = session.products as number[];
      
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { brand: true },
      });

      console.log(`📦 Продукты в сессии:\n`);
      products.forEach((product, idx) => {
        console.log(`   ${idx + 1}. ${product.name}`);
        console.log(`      Бренд: ${product.brand.name}`);
        console.log(`      Шаг: ${product.step}`);
        console.log(`      Категория: ${product.category}`);
        console.log(`      Опубликован: ${product.published}`);
        console.log(`      Бренд активен: ${product.brand.isActive}`);
        console.log(`      ID: ${product.id}`);
        console.log('');
      });

      // Проверяем, какие шаги покрыты
      const steps = new Set(products.map(p => p.step).filter(Boolean));
      console.log(`📊 Шаги, покрытые продуктами: ${Array.from(steps).join(', ')}`);
      console.log(`   Всего уникальных шагов: ${steps.size}\n`);

      // Проверяем, каких шагов не хватает
      const requiredSteps = ['cleanser', 'moisturizer', 'spf'];
      const missingSteps = requiredSteps.filter(step => {
        return !products.some(p => 
          p.step === step || 
          p.step?.startsWith(step) || 
          p.category === step ||
          p.category?.includes(step)
        );
      });

      if (missingSteps.length > 0) {
        console.log(`⚠️  Отсутствуют базовые шаги: ${missingSteps.join(', ')}\n`);
      } else {
        console.log(`✅ Все базовые шаги покрыты\n`);
      }
    } else {
      console.log('⚠️  В сессии нет продуктов');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkRecommendationSession()
  .catch((e) => {
    console.error('❌ Критическая ошибка:', e);
    process.exit(1);
  });

