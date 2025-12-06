// scripts/check-product-category-match.ts
// Проверка соответствия между типами средств в БД, сессией рекомендаций и правилами

import { prisma } from '../lib/db';

async function checkProductCategoryMatch() {
  console.log('🔍 Проверка соответствия категорий продуктов между БД, правилами и сессиями\n');

  try {
    // 1. Проверяем категории в БД
    console.log('📊 1. Категории в базе данных (Product):');
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        step: true,
        published: true,
      },
      take: 100, // Берем первые 100 для анализа
    });

    const categoriesInDB = new Set<string>();
    const stepsInDB = new Set<string>();
    
    allProducts.forEach(p => {
      if (p.category) categoriesInDB.add(p.category);
      if (p.step) stepsInDB.add(p.step);
    });

    console.log(`   Категории (category): ${Array.from(categoriesInDB).sort().join(', ')}`);
    console.log(`   Шаги (step): ${Array.from(stepsInDB).sort().join(', ')}\n`);

    // 2. Проверяем категории в правилах
    console.log('📋 2. Категории в правилах рекомендаций:');
    const rules = await prisma.recommendationRule.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        stepsJson: true,
      },
    });

    const categoriesInRules = new Set<string>();
    const stepNamesInRules = new Set<string>();

    rules.forEach(rule => {
      const stepsJson = rule.stepsJson as Record<string, any>;
      Object.entries(stepsJson).forEach(([stepName, stepConfig]) => {
        stepNamesInRules.add(stepName);
        if (stepConfig.category && Array.isArray(stepConfig.category)) {
          stepConfig.category.forEach((cat: string) => categoriesInRules.add(cat));
        }
      });
    });

    console.log(`   Имена шагов (stepName): ${Array.from(stepNamesInRules).sort().join(', ')}`);
    console.log(`   Категории (category): ${Array.from(categoriesInRules).sort().join(', ')}\n`);

    // 3. Проверяем продукты в сессиях рекомендаций
    console.log('💾 3. Продукты в сессиях рекомендаций:');
    const sessions = await prisma.recommendationSession.findMany({
      where: {
        ruleId: { not: null },
      },
      select: {
        id: true,
        ruleId: true,
        products: true,
        createdAt: true,
      },
      take: 10, // Берем последние 10 сессий
      orderBy: { createdAt: 'desc' },
    });

    const productsInSessions = new Set<number>();
    sessions.forEach(session => {
      if (Array.isArray(session.products)) {
        (session.products as number[]).forEach(id => productsInSessions.add(id));
      }
    });

    if (productsInSessions.size > 0) {
      const sessionProducts = await prisma.product.findMany({
        where: { id: { in: Array.from(productsInSessions) } },
        select: {
          id: true,
          name: true,
          category: true,
          step: true,
        },
      });

      const sessionCategories = new Set<string>();
      const sessionSteps = new Set<string>();
      
      sessionProducts.forEach(p => {
        if (p.category) sessionCategories.add(p.category);
        if (p.step) sessionSteps.add(p.step);
      });

      console.log(`   Продуктов в сессиях: ${sessionProducts.length}`);
      console.log(`   Категории: ${Array.from(sessionCategories).sort().join(', ')}`);
      console.log(`   Шаги: ${Array.from(sessionSteps).sort().join(', ')}\n`);
    } else {
      console.log('   Нет продуктов в сессиях\n');
    }

    // 4. Проверяем соответствие маппинга
    console.log('🔄 4. Проверка маппинга категорий:');
    const categoryMapping: Record<string, string[]> = {
      'cream': ['moisturizer'],
      'moisturizer': ['moisturizer'],
      'cleanser': ['cleanser'],
      'cleanser_oil': ['cleanser'],
      'serum': ['serum'],
      'toner': ['toner'],
      'treatment': ['treatment'],
      'spf': ['spf'],
      'mask': ['mask'],
    };

    console.log('   Маппинг из правил в БД:');
    Object.entries(categoryMapping).forEach(([ruleCat, dbCats]) => {
      const existsInRules = categoriesInRules.has(ruleCat) || stepNamesInRules.has(ruleCat);
      const existsInDB = dbCats.some(dbCat => categoriesInDB.has(dbCat) || stepsInDB.has(dbCat));
      
      const status = existsInRules && existsInDB ? '✅' : existsInRules ? '⚠️' : '❌';
      console.log(`   ${status} ${ruleCat} -> ${dbCats.join(', ')}`);
      if (existsInRules && !existsInDB) {
        console.log(`      ⚠️  Категория ${ruleCat} используется в правилах, но не найдена в БД`);
      }
      if (!existsInRules && existsInDB) {
        console.log(`      ℹ️  Категория ${ruleCat} есть в БД, но не используется в правилах`);
      }
    });

    // 5. Проверяем несоответствия
    console.log('\n⚠️  5. Потенциальные проблемы:');
    
    // Проверяем категории в БД, которые не маппятся из правил
    const allMappedDBCategories = new Set<string>();
    Object.values(categoryMapping).flat().forEach(cat => allMappedDBCategories.add(cat));
    
    const unmappedCategories = Array.from(categoriesInDB).filter(
      cat => !allMappedDBCategories.has(cat) && !categoriesInRules.has(cat)
    );
    
    if (unmappedCategories.length > 0) {
      console.log(`   ❌ Категории в БД, не маппящиеся из правил: ${unmappedCategories.join(', ')}`);
    }

    // Проверяем шаги в правилах, которых нет в БД
    const unmappedSteps = Array.from(stepNamesInRules).filter(
      stepName => !categoryMapping[stepName] && !categoriesInDB.has(stepName) && !stepsInDB.has(stepName)
    );
    
    if (unmappedSteps.length > 0) {
      console.log(`   ⚠️  Шаги в правилах без маппинга: ${unmappedSteps.join(', ')}`);
    }

    // 6. Проверяем конкретную сессию (последнюю)
    if (sessions.length > 0) {
      const lastSession = sessions[0];
      if (lastSession.ruleId && Array.isArray(lastSession.products) && lastSession.products.length > 0) {
        console.log('\n📦 6. Детали последней сессии:');
        
        const rule = await prisma.recommendationRule.findUnique({
          where: { id: lastSession.ruleId },
          select: { name: true, stepsJson: true },
        });

        if (rule) {
          console.log(`   Правило: ${rule.name}`);
          console.log(`   Продуктов: ${lastSession.products.length}`);
          
          const sessionProducts = await prisma.product.findMany({
            where: { id: { in: lastSession.products as number[] } },
            select: {
              id: true,
              name: true,
              category: true,
              step: true,
            },
          });

          const stepsJson = rule.stepsJson as Record<string, any>;
          const ruleSteps = Object.keys(stepsJson);
          
          console.log(`   Шаги в правиле: ${ruleSteps.join(', ')}`);
          
          // Группируем продукты по шагам
          const productsByStep: Record<string, string[]> = {};
          sessionProducts.forEach(p => {
            const step = p.step || p.category || 'unknown';
            if (!productsByStep[step]) {
              productsByStep[step] = [];
            }
            productsByStep[step].push(p.name);
          });
          
          console.log(`   Продукты по шагам:`);
          Object.entries(productsByStep).forEach(([step, products]) => {
            console.log(`     ${step}: ${products.length} продукт(ов) - ${products.slice(0, 2).join(', ')}${products.length > 2 ? '...' : ''}`);
          });

          // Проверяем соответствие
          ruleSteps.forEach(ruleStep => {
            const matchingProducts = sessionProducts.filter(p => {
              const stepConfig = stepsJson[ruleStep];
              const categories = stepConfig?.category || [];
              return categories.includes(p.category) || 
                     categories.includes(p.step) ||
                     p.step?.startsWith(ruleStep) ||
                     p.category === ruleStep;
            });
            
            if (matchingProducts.length === 0) {
              console.log(`     ⚠️  Шаг "${ruleStep}" в правиле не имеет соответствующих продуктов в сессии`);
            }
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

// Запуск
checkProductCategoryMatch()
  .then(() => {
    console.log('✅ Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения:', error);
    process.exit(1);
  });
