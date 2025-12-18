// scripts/check-user-data.ts
// Скрипт для проверки данных пользователя (профиль, рекомендации, план)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserData() {
  const telegramId = process.argv[2] || '643160759';
  
  console.log(`\n🔍 Проверка данных пользователя с Telegram ID: ${telegramId}\n`);
  
  try {
    // Находим пользователя
    const user = await prisma.user.findFirst({
      where: { telegramId: telegramId },
    });

    if (!user) {
      console.error(`❌ Пользователь с Telegram ID ${telegramId} не найден`);
      process.exit(1);
    }

    console.log(`✅ Пользователь найден: ${user.firstName} ${user.lastName || ''} (ID: ${user.id})`);
    console.log(`   Username: @${user.username || 'нет'}`);
    console.log(`   Telegram ID: ${user.telegramId}\n`);

    // Проверяем профили кожи
    const profiles = await prisma.skinProfile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`📊 Профили кожи: ${profiles.length}`);
    if (profiles.length > 0) {
      profiles.forEach((profile, idx) => {
        console.log(`   ${idx + 1}. ID: ${profile.id}`);
        console.log(`      Тип кожи: ${profile.skinType}`);
        console.log(`      Версия: ${profile.version}`);
        console.log(`      Создан: ${profile.createdAt.toLocaleString('ru-RU')}`);
      });
    } else {
      console.log('   ⚠️  Профилей не найдено\n');
    }

    // Проверяем сессии рекомендаций
    const sessions = await prisma.recommendationSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        rule: true,
      },
      take: 5,
    });

    console.log(`\n📊 Сессии рекомендаций: ${sessions.length}`);
    if (sessions.length > 0) {
      sessions.forEach((session, idx) => {
        console.log(`   ${idx + 1}. ID: ${session.id}`);
        console.log(`      Правило: ${session.rule?.name || 'нет'}`);
        console.log(`      Продуктов: ${Array.isArray(session.products) ? session.products.length : 0}`);
        console.log(`      Продукты: ${Array.isArray(session.products) ? JSON.stringify(session.products) : 'нет'}`);
        console.log(`      Создан: ${session.createdAt.toLocaleString('ru-RU')}`);
      });
    } else {
      console.log('   ⚠️  Сессий не найдено');
    }

    // Проверяем ответы на анкету
    const answers = await prisma.userAnswer.findMany({
      where: { userId: user.id },
      include: {
        question: true,
      },
      take: 10,
    });

    console.log(`\n📊 Ответы на анкету: ${answers.length}`);
    if (answers.length > 0) {
      console.log(`   Последние ${Math.min(answers.length, 5)} ответов:`);
      answers.slice(0, 5).forEach((answer, idx) => {
        console.log(`   ${idx + 1}. Вопрос: ${answer.question?.code || 'нет кода'}`);
        console.log(`      Ответ: ${JSON.stringify(answer.answerValue || answer.answerValues)}`);
      });
    } else {
      console.log('   ⚠️  Ответов не найдено');
    }

    // Проверяем активные правила
    const activeRules = await prisma.recommendationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
      take: 5,
    });

    console.log(`\n📊 Активные правила рекомендаций: ${activeRules.length}`);
    if (activeRules.length > 0) {
      activeRules.forEach((rule, idx) => {
        console.log(`   ${idx + 1}. ${rule.name} (приоритет: ${rule.priority})`);
      });
    } else {
      console.log('   ⚠️  Активных правил не найдено - это может быть причиной отсутствия рекомендаций!');
    }

    // Проверяем продукты
    const productsCount = await prisma.product.count({
      where: { 
        published: true as any,
        brand: { isActive: true },
      } as any,
    });

    console.log(`\n📊 Опубликованных продуктов с активными брендами: ${productsCount}`);
    
    // Проверяем, какие шаги доступны
    const productsByStep = await prisma.product.groupBy({
      by: ['step'],
      where: {
        published: true as any,
        brand: { isActive: true },
      } as any,
      _count: {
        id: true,
      },
    });

    console.log(`\n📊 Продукты по шагам:`);
    productsByStep.forEach((item) => {
      console.log(`   ${item.step || 'нет шага'}: ${item._count.id} продуктов`);
    });

    console.log(`\n✅ Проверка завершена\n`);

  } catch (error) {
    console.error('❌ Ошибка при проверке данных:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkUserData()
  .catch((e) => {
    console.error('❌ Критическая ошибка:', e);
    process.exit(1);
  });

