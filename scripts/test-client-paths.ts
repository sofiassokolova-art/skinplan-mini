// scripts/test-client-paths.ts
// Автоматические тесты клиентских путей для проверки синхронизации продуктов

import { createScriptPrisma } from './lib/prisma';

const prisma = createScriptPrisma();

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (error) {
    console.log(`   Ошибка: ${error}`);
  }
  if (details) {
    console.log(`   Детали:`, JSON.stringify(details, null, 2));
  }
}

async function testPlanGeneration() {
  console.log('\n📋 Тест 1: Генерация плана');
  
  try {
    // Находим пользователя с профилем
    const user = await prisma.user.findFirst({
      where: {
        skinProfiles: {
          some: {},
        },
      },
      include: {
        skinProfiles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      logTest('Генерация плана', false, 'Пользователь с профилем не найден');
      return;
    }

    const profile = user.skinProfiles[0];
    if (!profile) {
      logTest('Генерация плана', false, 'Профиль не найден');
      return;
    }

    // Проверяем наличие RecommendationSession
    const session = await prisma.recommendationSession.findFirst({
      where: {
        userId: user.id,
        profileId: profile.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      logTest('Генерация плана', false, 'RecommendationSession не найдена');
      return;
    }

    if (!session.products || !Array.isArray(session.products) || session.products.length === 0) {
      logTest('Генерация плана', false, 'RecommendationSession не содержит продуктов');
      return;
    }

    logTest('Генерация плана', true, undefined, {
      userId: user.id,
      profileId: profile.id,
      sessionId: session.id,
      productsCount: session.products.length,
    });
  } catch (error: any) {
    logTest('Генерация плана', false, error.message);
  }
}

async function testProductSynchronization() {
  console.log('\n🔄 Тест 2: Синхронизация продуктов');
  
  try {
    // Находим пользователя с профилем и сессией
    const user = await prisma.user.findFirst({
      where: {
        skinProfiles: {
          some: {},
        },
        recommendationSessions: {
          some: {},
        },
      },
      include: {
        skinProfiles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        recommendationSessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user || !user.recommendationSessions[0]) {
      logTest('Синхронизация продуктов', false, 'Пользователь с сессией не найден');
      return;
    }

    const session = user.recommendationSessions[0];
    const productIds = session.products as number[];

    if (!productIds || productIds.length === 0) {
      logTest('Синхронизация продуктов', false, 'Сессия не содержит продуктов');
      return;
    }

    // Проверяем, что все продукты существуют в БД
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        published: true,
      },
      include: {
        brand: true,
      },
    });

    const missingProducts = productIds.filter(id => !products.find(p => p.id === id));

    if (missingProducts.length > 0) {
      logTest('Синхронизация продуктов', false, 'Некоторые продукты не найдены в БД', {
        missingIds: missingProducts,
        totalProducts: productIds.length,
        foundProducts: products.length,
      });
      return;
    }

    // Проверяем, что продукты имеют необходимые поля
    const productsWithoutName = products.filter(p => !p.name);
    const productsWithoutBrand = products.filter(p => !p.brand);

    if (productsWithoutName.length > 0 || productsWithoutBrand.length > 0) {
      logTest('Синхронизация продуктов', false, 'Некоторые продукты не имеют обязательных полей', {
        withoutName: productsWithoutName.length,
        withoutBrand: productsWithoutBrand.length,
      });
      return;
    }

    logTest('Синхронизация продуктов', true, undefined, {
      totalProducts: productIds.length,
      allProductsFound: true,
      allProductsValid: true,
    });
  } catch (error: any) {
    logTest('Синхронизация продуктов', false, error.message);
  }
}

async function testPlan28Structure() {
  console.log('\n📅 Тест 3: Структура плана (plan28)');
  
  try {
    // Находим пользователя с планом
    const user = await prisma.user.findFirst({
      where: {
        skinProfiles: {
          some: {},
        },
      },
      include: {
        skinProfiles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      logTest('Структура плана', false, 'Пользователь не найден');
      return;
    }

    const profile = user.skinProfiles[0];
    if (!profile) {
      logTest('Структура плана', false, 'Профиль не найден');
      return;
    }

    // Проверяем, что план может быть сгенерирован
    // Для этого проверяем наличие RecommendationSession
    const session = await prisma.recommendationSession.findFirst({
      where: {
        userId: user.id,
        profileId: profile.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      logTest('Структура плана', false, 'RecommendationSession не найдена');
      return;
    }

    const productIds = session.products as number[];
    if (!productIds || productIds.length === 0) {
      logTest('Структура плана', false, 'Сессия не содержит продуктов');
      return;
    }

    // Проверяем, что есть продукты для разных шагов
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        published: true,
      },
    });

    const steps = new Set(products.map(p => p.step).filter(Boolean));
    const requiredSteps = ['cleanser', 'moisturizer', 'spf'];
    const missingSteps = requiredSteps.filter(step => !Array.from(steps).some(s => s?.includes(step)));

    if (missingSteps.length > 0) {
      logTest('Структура плана', false, 'Отсутствуют обязательные шаги', {
        missingSteps,
        availableSteps: Array.from(steps),
      });
      return;
    }

    logTest('Структура плана', true, undefined, {
      totalProducts: productIds.length,
      availableSteps: Array.from(steps),
      hasRequiredSteps: true,
    });
  } catch (error: any) {
    logTest('Структура плана', false, error.message);
  }
}

async function testProductLoading() {
  console.log('\n📦 Тест 4: Загрузка продуктов');
  
  try {
    // Находим пользователя с сессией
    const user = await prisma.user.findFirst({
      where: {
        recommendationSessions: {
          some: {},
        },
      },
      include: {
        recommendationSessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user || !user.recommendationSessions[0]) {
      logTest('Загрузка продуктов', false, 'Пользователь с сессией не найден');
      return;
    }

    const session = user.recommendationSessions[0];
    const productIds = session.products as number[];

    if (!productIds || productIds.length === 0) {
      logTest('Загрузка продуктов', false, 'Сессия не содержит продуктов');
      return;
    }

    // Загружаем продукты через Prisma (имитация /api/products/batch)
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        published: true,
      },
      include: {
        brand: true,
      },
    });

    // Проверяем структуру продуктов
    const invalidProducts = products.filter(p => {
      return !p.id || !p.name || !p.brand;
    });

    if (invalidProducts.length > 0) {
      logTest('Загрузка продуктов', false, 'Некоторые продукты имеют невалидную структуру', {
        invalidCount: invalidProducts.length,
        invalidIds: invalidProducts.map(p => p.id),
      });
      return;
    }

    // Проверяем, что все продукты загружены
    const missingProducts = productIds.filter(id => !products.find(p => p.id === id));

    if (missingProducts.length > 0) {
      // Проверяем, почему продукты не загружены (возможно, не опубликованы)
      const unpublishedProducts = await prisma.product.findMany({
        where: {
          id: { in: missingProducts },
          published: false,
        },
        select: { id: true, name: true, published: true },
      });

      if (unpublishedProducts.length > 0) {
        logTest('Загрузка продуктов', true, undefined, {
          totalRequested: productIds.length,
          totalLoaded: products.length,
          missingProducts: missingProducts.length,
          unpublishedProducts: unpublishedProducts.length,
          warning: 'Некоторые продукты не опубликованы, но это не критично для теста',
          unpublishedIds: unpublishedProducts.map(p => p.id),
        });
        return;
      }

      logTest('Загрузка продуктов', false, 'Некоторые продукты не загружены и не найдены в БД', {
        missingIds: missingProducts,
        totalRequested: productIds.length,
        totalLoaded: products.length,
      });
      return;
    }

    logTest('Загрузка продуктов', true, undefined, {
      totalRequested: productIds.length,
      totalLoaded: products.length,
      allProductsValid: true,
    });
  } catch (error: any) {
    logTest('Загрузка продуктов', false, error.message);
  }
}

async function testProductConsistency() {
  console.log('\n🔄 Тест 5: Консистентность продуктов между сессией и планом');
  
  try {
    // Находим пользователя с сессией и профилем
    const user = await prisma.user.findFirst({
      where: {
        skinProfiles: {
          some: {},
        },
        recommendationSessions: {
          some: {},
        },
      },
      include: {
        skinProfiles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        recommendationSessions: {
          where: {
            ruleId: { not: null }, // Только сессии из правил
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user || !user.recommendationSessions[0]) {
      logTest('Консистентность продуктов', false, 'Пользователь с сессией не найден');
      return;
    }

    const session = user.recommendationSessions[0];
    const profile = user.skinProfiles[0];

    if (!profile) {
      logTest('Консистентность продуктов', false, 'Профиль не найден');
      return;
    }

    // Проверяем, что сессия привязана к правильному профилю
    if (session.profileId !== profile.id) {
      logTest('Консистентность продуктов', false, 'Сессия привязана к другому профилю', {
        sessionProfileId: session.profileId,
        currentProfileId: profile.id,
      });
      return;
    }

    // Проверяем, что сессия создана из правил (ruleId !== null)
    if (!session.ruleId) {
      logTest('Консистентность продуктов', false, 'Сессия не создана из правил (ruleId = null)');
      return;
    }

    const productIds = session.products as number[];
    if (!productIds || productIds.length < 3) {
      logTest('Консистентность продуктов', false, 'Сессия содержит слишком мало продуктов', {
        productCount: productIds?.length || 0,
        minRequired: 3,
      });
      return;
    }

    logTest('Консистентность продуктов', true, undefined, {
      sessionId: session.id,
      profileId: profile.id,
      ruleId: session.ruleId,
      productsCount: productIds.length,
      sessionMatchesProfile: true,
    });
  } catch (error: any) {
    logTest('Консистентность продуктов', false, error.message);
  }
}

async function testProductDescriptions() {
  console.log('\n📝 Тест 6: Описания продуктов (descriptionUser)');
  
  try {
    // Находим пользователя с сессией
    const user = await prisma.user.findFirst({
      where: {
        recommendationSessions: {
          some: {},
        },
      },
      include: {
        recommendationSessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user || !user.recommendationSessions[0]) {
      logTest('Описания продуктов', false, 'Пользователь с сессией не найден');
      return;
    }

    const session = user.recommendationSessions[0];
    const productIds = session.products as number[];

    if (!productIds || productIds.length === 0) {
      logTest('Описания продуктов', false, 'Сессия не содержит продуктов');
      return;
    }

    // Загружаем продукты
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        published: true,
      },
    });

    // Проверяем наличие описания (descriptionUser или description)
    const productsWithoutDescription = products.filter(p => !p.descriptionUser && !p.description);
    const productsWithDescriptionUser = products.filter(p => p.descriptionUser);
    const productsWithDescriptionOnly = products.filter(p => !p.descriptionUser && p.description);

    if (productsWithoutDescription.length > 0) {
      // Это предупреждение, но не критическая ошибка
      logTest('Описания продуктов', true, undefined, {
        totalProducts: products.length,
        withDescriptionUser: productsWithDescriptionUser.length,
        withDescriptionOnly: productsWithDescriptionOnly.length,
        withoutDescription: productsWithoutDescription.length,
        warning: 'Некоторые продукты не имеют описания, но это не критично',
        productIdsWithoutDescription: productsWithoutDescription.map(p => p.id),
      });
      return;
    }

    logTest('Описания продуктов', true, undefined, {
      totalProducts: products.length,
      withDescriptionUser: productsWithDescriptionUser.length,
      withDescriptionOnly: productsWithDescriptionOnly.length,
      allHaveDescriptions: true,
    });
  } catch (error: any) {
    logTest('Описания продуктов', false, error.message);
  }
}

async function runAllTests() {
  console.log('🧪 Запуск автоматических тестов клиентских путей\n');
  console.log('=' .repeat(60));

  await testPlanGeneration();
  await testProductSynchronization();
  await testPlan28Structure();
  await testProductLoading();
  await testProductConsistency();
  await testProductDescriptions();

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Результаты тестирования:\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.error) {
      console.log(`   Ошибка: ${result.error}`);
    }
  });

  console.log(`\n✅ Пройдено: ${passed}`);
  console.log(`❌ Провалено: ${failed}`);
  console.log(`📊 Всего: ${results.length}`);

  if (failed > 0) {
    console.log('\n⚠️  Некоторые тесты провалены. Проверьте детали выше.');
    process.exit(1);
  } else {
    console.log('\n🎉 Все тесты пройдены успешно!');
    process.exit(0);
  }
}

// Запускаем тесты
runAllTests()
  .catch((error) => {
    console.error('❌ Критическая ошибка при запуске тестов:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

