// scripts/check-plan-generation-logs.ts
// Скрипт для проверки логов генерации плана для конкретного пользователя

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPlanGenerationLogs(telegramId: string) {
  console.log(`\n🔍 Проверка логов генерации плана для пользователя ${telegramId}\n`);

  try {
    const user = await prisma.user.findFirst({
      where: { telegramId },
      include: {
        skinProfiles: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!user) {
      console.error(`❌ Пользователь с Telegram ID "${telegramId}" не найден`);
      process.exit(1);
    }

    console.log(`✅ Пользователь: ${user.firstName} ${user.lastName || ''} (ID: ${user.id})\n`);

    // Проверяем ответы на анкету
    const answers = await prisma.userAnswer.findMany({
      where: {
        userId: user.id,
        questionnaireId: 2, // v2 анкета
      },
      include: {
        question: {
          select: {
            id: true,
            code: true,
            text: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`📋 Ответы на анкету: ${answers.length}`);
    if (answers.length === 0) {
      console.log(`   ⚠️  Ответов не найдено! Это может быть причиной проблемы.\n`);
    } else {
      console.log(`   Последние ответы:`);
      answers.slice(0, 10).forEach((answer, idx) => {
        console.log(`      ${idx + 1}. ${answer.question.code}: ${answer.answerValue || JSON.stringify(answer.answerValues)}`);
      });
      console.log('');
    }

    // Проверяем профили
    const latestProfile = user.skinProfiles[0];
    if (latestProfile) {
      console.log(`📊 Последний профиль:`);
      console.log(`   Версия: ${latestProfile.version}`);
      console.log(`   Тип кожи: ${latestProfile.skinType}`);
      console.log(`   Создан: ${latestProfile.createdAt.toISOString()}`);
      console.log(`   Обновлен: ${latestProfile.updatedAt.toISOString()}`);
      console.log('');

      // Проверяем сессии рекомендаций
      const sessions = await prisma.recommendationSession.findMany({
        where: {
          userId: user.id,
          profileId: latestProfile.id,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          rule: {
            select: {
              name: true,
            },
          },
        },
      });

      console.log(`📦 Сессии рекомендаций: ${sessions.length}`);
      sessions.forEach((session, idx) => {
        const productIds = Array.isArray(session.products) ? session.products as number[] : [];
        console.log(`   ${idx + 1}. ID: ${session.id}`);
        console.log(`      Правило: ${session.rule?.name || 'нет'}`);
        console.log(`      Продуктов: ${productIds.length}`);
        console.log(`      Продукты: [${productIds.join(',')}]`);
        console.log(`      Создан: ${session.createdAt.toISOString()}`);
        console.log('');
      });

      // Проверяем, какие продукты есть в сессии
      if (sessions.length > 0) {
        const lastSession = sessions[0];
        const productIds = Array.isArray(lastSession.products) ? lastSession.products as number[] : [];
        
        if (productIds.length > 0) {
          console.log(`🔍 Детали продуктов из последней сессии:`);
          const products = await prisma.product.findMany({
            where: {
              id: { in: productIds },
            },
            select: {
              id: true,
              name: true,
              step: true,
              category: true,
              published: true,
              brand: {
                select: {
                  name: true,
                  isActive: true,
                },
              },
            },
          });

          products.forEach((product) => {
            console.log(`   ${product.id}. ${product.name}`);
            console.log(`      Step: ${product.step || 'нет'}`);
            console.log(`      Category: ${product.category || 'нет'}`);
            console.log(`      Published: ${product.published}`);
            console.log(`      Brand: ${product.brand.name} (active: ${product.brand.isActive})`);
            console.log('');
          });
        }
      }
    }

    console.log('\n✅ Проверка завершена\n');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const telegramIdArg = process.argv[2] || '643160759';
checkPlanGenerationLogs(telegramIdArg)
  .then(() => {
    console.log('✅ Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения:', error);
    process.exit(1);
  });

