// scripts/check-product-selection-logs.ts
// Скрипт для проверки логов подбора средств для пользователя

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkProductSelectionLogs(telegramId: string) {
  console.log(`\n🔍 Проверка логов подбора средств для пользователя ${telegramId}\n`);
  
  try {
    // Находим пользователя
    const user = await prisma.user.findFirst({
      where: { telegramId },
      include: {
        skinProfiles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      console.error(`❌ Пользователь с Telegram ID "${telegramId}" не найден`);
      process.exit(1);
    }

    console.log(`✅ Пользователь найден: ${user.firstName} ${user.lastName || ''} (ID: ${user.id})\n`);

    // Получаем RecommendationSession
    const sessions = await prisma.recommendationSession.findMany({
      where: { userId: user.id },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            stepsJson: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`📊 Найдено сессий рекомендаций: ${sessions.length}\n`);

    if (sessions.length === 0) {
      console.log('⚠️  Сессии рекомендаций не найдены');
      return;
    }

    for (const session of sessions) {
      const products = session.products as number[] | null;
      const productCount = Array.isArray(products) ? products.length : 0;
      
      console.log(`\n📦 Сессия #${session.id}`);
      console.log(`   Создана: ${new Date(session.createdAt).toLocaleString('ru-RU')}`);
      console.log(`   Правило: ${session.rule?.name || 'Без правила'}`);
      console.log(`   Количество продуктов: ${productCount}`);
      console.log(`   Product IDs: ${Array.isArray(products) ? products.slice(0, 20).join(', ') : 'нет'}`);
      
      if (session.rule?.stepsJson) {
        const stepsJson = session.rule.stepsJson as any;
        console.log(`   Шаги в правиле:`);
        if (typeof stepsJson === 'object' && stepsJson !== null) {
          for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
            const step = stepConfig as any;
            const maxItems = step.max_items || 3;
            console.log(`     - ${stepName}: max_items=${maxItems}`);
          }
        }
      }

      // Загружаем детали продуктов
      if (Array.isArray(products) && products.length > 0) {
        const productDetails = await prisma.product.findMany({
          where: {
            id: { in: products },
          },
          select: {
            id: true,
            name: true,
            step: true,
            category: true,
            brand: {
              select: {
                name: true,
              },
            },
          },
        });

        console.log(`   \n   Детали продуктов:`);
        for (const product of productDetails) {
          console.log(`     - ${product.name} (${product.brand.name}) - step: ${product.step}, category: ${product.category}`);
        }
      }
    }

    // Проверяем логи ClientLog, связанные с подбором продуктов
    const selectionLogs = await prisma.clientLog.findMany({
      where: {
        userId: user.id,
        OR: [
          { message: { contains: 'product', mode: 'insensitive' } },
          { message: { contains: 'recommendation', mode: 'insensitive' } },
          { message: { contains: 'подбор', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (selectionLogs.length > 0) {
      console.log(`\n\n📋 Логи подбора продуктов (${selectionLogs.length}):\n`);
      for (const log of selectionLogs) {
        console.log(`[${log.level.toUpperCase()}] ${log.message}`);
        console.log(`   Время: ${new Date(log.createdAt).toLocaleString('ru-RU')}`);
        if (log.context) {
          const context = log.context as any;
          if (context.productCount) {
            console.log(`   Количество продуктов: ${context.productCount}`);
          }
          if (context.productIds) {
            console.log(`   Product IDs: ${Array.isArray(context.productIds) ? context.productIds.slice(0, 10).join(', ') : context.productIds}`);
          }
        }
        console.log('   ---');
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const telegramId = process.argv[2] || '643160759';
checkProductSelectionLogs(telegramId)
  .catch((e) => {
    console.error('❌ Критическая ошибка:', e);
    process.exit(1);
  });
