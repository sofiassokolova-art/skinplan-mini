// scripts/check-products-details.ts
// Скрипт для проверки деталей продуктов в RecommendationSession

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProductsDetails() {
  try {
    const userId = 'cmieq8w2v0000js0480u0n0ax'; // Sofia
    const telegramId = '643160759';

    console.log(`\n🔍 Проверка продуктов для пользователя ${telegramId}\n`);

    // Получаем последние RecommendationSession
    const sessions = await prisma.recommendationSession.findMany({
      where: {
        userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            conditionsJson: true,
            stepsJson: true,
          },
        },
      },
    });

    for (const session of sessions) {
      console.log(`\n📦 Сессия ID: ${session.id}`);
      console.log(`   Profile ID: ${session.profileId}`);
      console.log(`   Rule ID: ${session.ruleId || 'нет (fallback)'}`);
      if (session.rule) {
        console.log(`   Правило: ${session.rule.name}`);
        console.log(`   Условия: ${JSON.stringify(session.rule.conditionsJson, null, 2)}`);
        console.log(`   Шаги: ${JSON.stringify(session.rule.stepsJson, null, 2).substring(0, 500)}...`);
      }
      console.log(`   Продукты: ${session.products.join(', ')}`);
      console.log(`   Создана: ${session.createdAt.toLocaleString('ru-RU')}`);

      // Получаем детали продуктов
      const products = await prisma.product.findMany({
        where: {
          id: { in: session.products },
        },
        include: {
          brand: {
            select: {
              name: true,
            },
          },
        },
      });

      console.log(`\n   Детали продуктов:`);
      products.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.brand.name} ${product.name}`);
        console.log(`      ID: ${product.id}`);
        console.log(`      Категория: ${product.category}`);
        console.log(`      Шаг: ${product.step}`);
        console.log(`      Concerns: ${product.concerns?.join(', ') || 'нет'}`);
        console.log(`      Типы кожи: ${product.skinTypes?.join(', ') || 'нет'}`);
      });
    }

    // Проверяем профили
    console.log(`\n\n👤 Профили пользователя:`);
    const profiles = await prisma.skinProfile.findMany({
      where: { userId },
      orderBy: { version: 'desc' },
      take: 2,
    });

    for (const profile of profiles) {
      console.log(`\n   Версия ${profile.version} (ID: ${profile.id})`);
      console.log(`   Тип кожи: ${profile.skinType}`);
      console.log(`   Чувствительность: ${profile.sensitivityLevel}`);
      console.log(`   Уровень акне: ${profile.acneLevel}`);
      console.log(`   Обезвоженность: ${profile.dehydrationLevel}`);
      console.log(`   Создан: ${profile.createdAt.toLocaleString('ru-RU')}`);
      console.log(`   Обновлен: ${profile.updatedAt.toLocaleString('ru-RU')}`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductsDetails();















