// scripts/test-full-product-flow.ts
// Комплексный тест полного flow от ответов до отображения продуктов в плане

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

async function testAnswerToProfileFlow() {
  console.log('\n📝 Тест 1: Ответы → Профиль');
  
  try {
    // Находим пользователя с профилем (профиль создается из ответов)
    const user = await prisma.user.findFirst({
      where: {
        skinProfiles: {
          some: {},
        },
      },
      include: {
        userAnswers: {
          take: 5,
          include: {
            question: true,
          },
        },
        skinProfiles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      logTest('Ответы → Профиль', false, 'Пользователь с профилем не найден');
      return;
    }

    if (user.skinProfiles.length === 0) {
      logTest('Ответы → Профиль', false, 'У пользователя нет профиля');
      return;
    }

    const profile = user.skinProfiles[0];

    // Проверяем, что профиль содержит необходимые поля
    if (!profile.skinType) {
      logTest('Ответы → Профиль', false, 'Профиль не содержит skinType');
      return;
    }

    logTest('Ответы → Профиль', true, undefined, {
      userId: user.id,
      profileId: profile.id,
      answersCount: user.userAnswers.length,
      skinType: profile.skinType,
      sensitivityLevel: profile.sensitivityLevel,
      version: profile.version,
      hasAnswers: user.userAnswers.length > 0,
    });
  } catch (error: any) {
    logTest('Ответы → Профиль', false, error.message);
  }
}

async function testProfileToRuleMatching() {
  console.log('\n🎯 Тест 2: Профиль → Правила → RecommendationSession');
  
  try {
    // Находим пользователя с профилем и сессией
    const user = await prisma.user.findFirst({
      where: {
        skinProfiles: {
          some: {},
        },
        recommendationSessions: {
          some: {
            ruleId: { not: null },
          },
        },
      },
      include: {
        skinProfiles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        recommendationSessions: {
          where: {
            ruleId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            rule: true,
          },
        },
      },
    });

    if (!user || !user.recommendationSessions[0]) {
      logTest('Профиль → Правила', false, 'Пользователь с сессией из правил не найден');
      return;
    }

    const profile = user.skinProfiles[0];
    const session = user.recommendationSessions[0];
    const rule = session.rule;

    if (!profile) {
      logTest('Профиль → Правила', false, 'Профиль не найден');
      return;
    }

    if (!rule) {
      logTest('Профиль → Правила', false, 'Правило не найдено');
      return;
    }

    // Проверяем, что сессия привязана к правильному профилю
    if (session.profileId !== profile.id) {
      logTest('Профиль → Правила', false, 'Сессия привязана к другому профилю', {
        sessionProfileId: session.profileId,
        currentProfileId: profile.id,
      });
      return;
    }

    // Проверяем, что сессия содержит продукты
    const productIds = session.products as number[];
    if (!productIds || productIds.length === 0) {
      logTest('Профиль → Правила', false, 'Сессия не содержит продуктов');
      return;
    }

    // Проверяем, что правило активно
    if (!rule.isActive) {
      logTest('Профиль → Правила', false, 'Правило неактивно');
      return;
    }

    logTest('Профиль → Правила', true, undefined, {
      userId: user.id,
      profileId: profile.id,
      sessionId: session.id,
      ruleId: rule.id,
      ruleName: rule.name,
      productsCount: productIds.length,
      sessionMatchesProfile: true,
    });
  } catch (error: any) {
    logTest('Профиль → Правила', false, error.message);
  }
}

async function testSessionToPlanFlow() {
  console.log('\n📅 Тест 3: RecommendationSession → План');
  
  try {
    // Находим пользователя с сессией
    const user = await prisma.user.findFirst({
      where: {
        recommendationSessions: {
          some: {
            ruleId: { not: null },
          },
        },
      },
      include: {
        skinProfiles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        recommendationSessions: {
          where: {
            ruleId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user || !user.recommendationSessions[0]) {
      logTest('Сессия → План', false, 'Пользователь с сессией не найден');
      return;
    }

    const session = user.recommendationSessions[0];
    const profile = user.skinProfiles[0];

    if (!profile) {
      logTest('Сессия → План', false, 'Профиль не найден');
      return;
    }

    const productIds = session.products as number[];
    if (!productIds || productIds.length === 0) {
      logTest('Сессия → План', false, 'Сессия не содержит продуктов');
      return;
    }

    // Проверяем, что все продукты из сессии существуют в БД
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        published: true,
      },
      include: {
        brand: {
          select: {
            isActive: true,
          },
        },
      },
    });

    const missingProducts = productIds.filter(id => !products.find(p => p.id === id));
    const inactiveBrands = products.filter(p => !p.brand.isActive);

    if (missingProducts.length > 0) {
      logTest('Сессия → План', false, 'Некоторые продукты не найдены в БД', {
        missingIds: missingProducts,
        totalRequested: productIds.length,
        totalFound: products.length,
      });
      return;
    }

    if (inactiveBrands.length > 0) {
      logTest('Сессия → План', true, undefined, {
        warning: 'Некоторые продукты имеют неактивные бренды, но это не критично',
        inactiveBrandsCount: inactiveBrands.length,
        totalProducts: products.length,
      });
      return;
    }

    // Проверяем, что продукты распределены по шагам
    const steps = new Set(products.map(p => p.step).filter(Boolean));
    const requiredSteps = ['cleanser', 'moisturizer', 'spf'];
    const hasRequiredSteps = requiredSteps.every(step => 
      Array.from(steps).some(s => s?.includes(step))
    );

    if (!hasRequiredSteps) {
      logTest('Сессия → План', false, 'Отсутствуют обязательные шаги', {
        requiredSteps,
        availableSteps: Array.from(steps),
      });
      return;
    }

    logTest('Сессия → План', true, undefined, {
      sessionId: session.id,
      profileId: profile.id,
      productsCount: productIds.length,
      allProductsFound: true,
      allBrandsActive: true,
      hasRequiredSteps: true,
      availableSteps: Array.from(steps),
    });
  } catch (error: any) {
    logTest('Сессия → План', false, error.message);
  }
}

async function testProductSynchronization() {
  console.log('\n🔄 Тест 4: Синхронизация продуктов (главная, план, календарь)');
  
  try {
    // Находим пользователя с сессией
    const user = await prisma.user.findFirst({
      where: {
        recommendationSessions: {
          some: {
            ruleId: { not: null },
          },
        },
      },
      include: {
        skinProfiles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        recommendationSessions: {
          where: {
            ruleId: { not: null },
          },
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
    const profile = user.skinProfiles[0];

    if (!profile) {
      logTest('Синхронизация продуктов', false, 'Профиль не найден');
      return;
    }

    const productIds = session.products as number[];

    // Проверяем, что сессия создана для текущего профиля
    if (session.profileId !== profile.id) {
      logTest('Синхронизация продуктов', false, 'Сессия привязана к другому профилю');
      return;
    }

    // Проверяем, что сессия создана из правил (не из плана)
    if (!session.ruleId) {
      logTest('Синхронизация продуктов', false, 'Сессия не создана из правил (ruleId = null)');
      return;
    }

    // Проверяем, что сессия содержит достаточно продуктов
    if (productIds.length < 3) {
      logTest('Синхронизация продуктов', false, 'Сессия содержит слишком мало продуктов', {
        productCount: productIds.length,
        minRequired: 3,
      });
      return;
    }

    // Проверяем, что все продукты загружаются корректно
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
      logTest('Синхронизация продуктов', false, 'Некоторые продукты не загружены', {
        missingIds: missingProducts,
      });
      return;
    }

    // Проверяем структуру продуктов (для синхронизации с фронтендом)
    const invalidProducts = products.filter(p => {
      return !p.id || !p.name || !p.brand;
    });

    if (invalidProducts.length > 0) {
      logTest('Синхронизация продуктов', false, 'Некоторые продукты имеют невалидную структуру', {
        invalidCount: invalidProducts.length,
      });
      return;
    }

    logTest('Синхронизация продуктов', true, undefined, {
      sessionId: session.id,
      profileId: profile.id,
      ruleId: session.ruleId,
      productsCount: productIds.length,
      allProductsValid: true,
      sessionMatchesProfile: true,
      readyForFrontend: true,
    });
  } catch (error: any) {
    logTest('Синхронизация продуктов', false, error.message);
  }
}

async function testProductDescriptions() {
  console.log('\n📝 Тест 5: Описания продуктов для фронтенда');
  
  try {
    // Находим пользователя с сессией
    const user = await prisma.user.findFirst({
      where: {
        recommendationSessions: {
          some: {
            ruleId: { not: null },
          },
        },
      },
      include: {
        recommendationSessions: {
          where: {
            ruleId: { not: null },
          },
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

    // Загружаем продукты
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        published: true,
      },
    });

    // Проверяем наличие описаний (descriptionUser или description)
    const productsWithDescriptionUser = products.filter(p => p.descriptionUser);
    const productsWithDescriptionOnly = products.filter(p => !p.descriptionUser && p.description);
    const productsWithoutDescription = products.filter(p => !p.descriptionUser && !p.description);

    // Это не критично, но желательно
    if (productsWithoutDescription.length > products.length * 0.5) {
      logTest('Описания продуктов', true, undefined, {
        warning: 'Больше половины продуктов не имеют описания',
        withDescriptionUser: productsWithDescriptionUser.length,
        withDescriptionOnly: productsWithDescriptionOnly.length,
        withoutDescription: productsWithoutDescription.length,
        totalProducts: products.length,
      });
      return;
    }

    logTest('Описания продуктов', true, undefined, {
      totalProducts: products.length,
      withDescriptionUser: productsWithDescriptionUser.length,
      withDescriptionOnly: productsWithDescriptionOnly.length,
      withoutDescription: productsWithoutDescription.length,
    });
  } catch (error: any) {
    logTest('Описания продуктов', false, error.message);
  }
}

async function testRuleMatchingLogic() {
  console.log('\n🎯 Тест 6: Логика сопоставления правил');
  
  try {
    // Получаем все активные правила
    const rules = await prisma.recommendationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    if (rules.length === 0) {
      logTest('Логика сопоставления правил', false, 'Нет активных правил');
      return;
    }

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
        recommendationSessions: {
          where: {
            ruleId: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            rule: true,
          },
        },
      },
    });

    if (!user || !user.skinProfiles[0]) {
      logTest('Логика сопоставления правил', false, 'Пользователь с профилем не найден');
      return;
    }

    const profile = user.skinProfiles[0];
    const session = user.recommendationSessions[0];

    // Проверяем, что правило соответствует профилю
    if (session && session.rule) {
      const rule = session.rule;
      const conditions = rule.conditionsJson as any;

      // Простая проверка соответствия
      let matches = true;
      for (const [key, condition] of Object.entries(conditions)) {
        const profileValue = (profile as any)[key];

        if (Array.isArray(condition)) {
          if (!condition.includes(profileValue)) {
            matches = false;
            break;
          }
        } else if (typeof condition === 'object' && condition !== null) {
          const conditionObj = condition as Record<string, unknown>;
          if (typeof profileValue === 'number') {
            if ('gte' in conditionObj && typeof conditionObj.gte === 'number') {
              if (profileValue < conditionObj.gte) {
                matches = false;
                break;
              }
            }
            if ('lte' in conditionObj && typeof conditionObj.lte === 'number') {
              if (profileValue > conditionObj.lte) {
                matches = false;
                break;
              }
            }
          }
        } else if (condition !== profileValue) {
          matches = false;
          break;
        }
      }

      if (!matches) {
        logTest('Логика сопоставления правил', false, 'Правило не соответствует профилю', {
          ruleId: rule.id,
          ruleName: rule.name,
          profileId: profile.id,
        });
        return;
      }
    }

    logTest('Логика сопоставления правил', true, undefined, {
      totalRules: rules.length,
      activeRules: rules.length,
      userHasMatchedRule: !!session,
      ruleId: session?.ruleId || null,
    });
  } catch (error: any) {
    logTest('Логика сопоставления правил', false, error.message);
  }
}

async function runAllTests() {
  console.log('🧪 Комплексная проверка логики вывода средств в план\n');
  console.log('='.repeat(60));

  await testAnswerToProfileFlow();
  await testProfileToRuleMatching();
  await testSessionToPlanFlow();
  await testProductSynchronization();
  await testProductDescriptions();
  await testRuleMatchingLogic();

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
    console.log('\n⚠️  Некоторые тесты провалены. Система не готова к продакшену.');
    process.exit(1);
  } else {
    console.log('\n🎉 Все тесты пройдены! Система готова к продакшену ✅');
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

