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

    // 6. Проверяем маппинг всех продуктов в БД на все возможные шаги
    console.log('\n🔍 6. Проверка маппинга всех продуктов:');
    const allProductsForMapping = await prisma.product.findMany({
      where: { published: true },
      select: {
        id: true,
        name: true,
        category: true,
        step: true,
      },
    });

    const mappingIssues: Array<{ product: string; step: string; category: string; issue: string }> = [];
    const allStepCategories = [
      'cleanser_gentle', 'cleanser_balancing', 'cleanser_deep', 'cleanser_oil',
      'toner_hydrating', 'toner_soothing',
      'serum_hydrating', 'serum_niacinamide', 'serum_vitc', 'serum_anti_redness', 'serum_brightening_soft',
      'treatment_acne_bpo', 'treatment_acne_azelaic', 'treatment_acne_local',
      'treatment_exfoliant_mild', 'treatment_exfoliant_strong',
      'treatment_pigmentation', 'treatment_antiage',
      'moisturizer_light', 'moisturizer_balancing', 'moisturizer_barrier', 'moisturizer_soothing',
      'spf_50_face', 'spf_50_oily', 'spf_50_sensitive',
      'mask_clay', 'mask_hydrating', 'mask_soothing', 'mask_sleeping',
    ];

    // Функция маппинга (копия из generate/route.ts)
    const mapStepToStepCategory = (step: string | null | undefined, category: string | null | undefined): string[] => {
      const stepStr = (step || category || '').toLowerCase();
      const categoryStr = (category || '').toLowerCase();
      const categories: string[] = [];
      
      // Упрощенная версия маппинга для проверки
      if (stepStr.includes('cleanser_gentle') || categoryStr.includes('gentle')) categories.push('cleanser_gentle');
      if (stepStr.includes('cleanser_balancing') || categoryStr.includes('balancing')) categories.push('cleanser_balancing');
      if (stepStr.includes('cleanser_deep') || categoryStr.includes('deep')) categories.push('cleanser_deep');
      if (stepStr.includes('oil') || stepStr.includes('масл')) categories.push('cleanser_oil');
      if (stepStr.includes('cleanser') || categoryStr === 'cleanser') {
        categories.push('cleanser_gentle', 'cleanser_balancing', 'cleanser_deep');
      }
      
      if (stepStr.includes('toner_hydrating') || categoryStr.includes('hydrating')) categories.push('toner_hydrating');
      if (stepStr.includes('toner_soothing') || categoryStr.includes('soothing')) categories.push('toner_soothing');
      if (stepStr.includes('toner') || categoryStr === 'toner') {
        categories.push('toner_hydrating', 'toner_soothing');
      }
      
      if (stepStr.includes('serum_hydrating')) categories.push('serum_hydrating');
      if (stepStr.includes('serum_niacinamide') || stepStr.includes('niacinamide')) categories.push('serum_niacinamide');
      if (stepStr.includes('serum_vitc') || stepStr.includes('vitc')) categories.push('serum_vitc');
      if (stepStr.includes('serum_anti_redness')) categories.push('serum_anti_redness');
      if (stepStr.includes('serum_brightening')) categories.push('serum_brightening_soft');
      if (stepStr.includes('serum') || categoryStr === 'serum') {
        categories.push('serum_hydrating', 'serum_niacinamide');
      }
      
      if (stepStr.includes('treatment_acne_bpo') || stepStr.includes('benzoyl')) categories.push('treatment_acne_bpo');
      if (stepStr.includes('treatment_acne_azelaic') || stepStr.includes('azelaic')) categories.push('treatment_acne_azelaic');
      if (stepStr.includes('treatment_acne_local')) categories.push('treatment_acne_local');
      if (stepStr.includes('treatment_exfoliant_mild')) categories.push('treatment_exfoliant_mild');
      if (stepStr.includes('treatment_exfoliant_strong')) categories.push('treatment_exfoliant_strong');
      if (stepStr.includes('treatment_pigmentation')) categories.push('treatment_pigmentation');
      if (stepStr.includes('treatment_antiage') || stepStr.includes('antiage')) categories.push('treatment_antiage');
      if (stepStr.includes('spot_treatment') || stepStr.includes('spot treatment')) categories.push('spot_treatment');
      // НЕ добавляем fallback для просто 'treatment'
      
      if (stepStr.includes('moisturizer_light')) categories.push('moisturizer_light');
      if (stepStr.includes('moisturizer_balancing')) categories.push('moisturizer_balancing');
      if (stepStr.includes('moisturizer_barrier')) categories.push('moisturizer_barrier');
      if (stepStr.includes('moisturizer_soothing')) categories.push('moisturizer_soothing');
      if (stepStr.includes('moisturizer') || stepStr.includes('cream') || categoryStr === 'moisturizer') {
        categories.push('moisturizer_light', 'moisturizer_balancing');
      }
      
      if (stepStr.includes('spf_50_face') || stepStr === 'spf' || categoryStr === 'spf') categories.push('spf_50_face');
      if (stepStr.includes('spf_50_oily')) categories.push('spf_50_oily');
      if (stepStr.includes('spf_50_sensitive')) categories.push('spf_50_sensitive');
      
      // Маски
      if (stepStr.includes('mask_clay') || stepStr.includes('clay')) categories.push('mask_clay');
      if (stepStr.includes('mask_hydrating') || stepStr.includes('hydrating')) categories.push('mask_hydrating');
      if (stepStr.includes('mask_soothing') || stepStr.includes('soothing')) categories.push('mask_soothing');
      if (stepStr.includes('mask_sleeping') || stepStr.includes('sleeping')) categories.push('mask_sleeping');
      if (stepStr === 'mask' || categoryStr === 'mask') {
        categories.push('mask_clay', 'mask_hydrating', 'mask_soothing', 'mask_sleeping');
      }
      
      return [...new Set(categories)]; // Убираем дубликаты
    };

    let unmappedProducts = 0;
    allProductsForMapping.forEach(product => {
      const mappedCategories = mapStepToStepCategory(product.step, product.category);
      if (mappedCategories.length === 0) {
        unmappedProducts++;
        mappingIssues.push({
          product: product.name,
          step: product.step || 'null',
          category: product.category || 'null',
          issue: 'Не маппится ни в один StepCategory',
        });
      }
    });

    console.log(`   Всего продуктов: ${allProductsForMapping.length}`);
    console.log(`   Продуктов без маппинга: ${unmappedProducts}`);
    if (mappingIssues.length > 0) {
      console.log(`   Проблемные продукты (первые 10):`);
      mappingIssues.slice(0, 10).forEach(issue => {
        console.log(`     ❌ ${issue.product}: step="${issue.step}", category="${issue.category}" - ${issue.issue}`);
      });
    } else {
      console.log(`   ✅ Все продукты успешно маппятся`);
    }

    // 7. Проверяем все правила на использование базовых шагов
    console.log('\n📋 7. Анализ всех правил на использование базовых vs детальных шагов:');
    const allRules = await prisma.recommendationRule.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        stepsJson: true,
      },
    });

    const basicSteps = ['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'cream', 'spf', 'mask'];
    const detailedStepsMap: Record<string, string[]> = {
      'cleanser': ['cleanser_gentle', 'cleanser_balancing', 'cleanser_deep'],
      'toner': ['toner_hydrating', 'toner_soothing'],
      'serum': ['serum_hydrating', 'serum_niacinamide', 'serum_vitc', 'serum_anti_redness', 'serum_brightening_soft'],
      'treatment': ['treatment_acne_bpo', 'treatment_acne_azelaic', 'treatment_acne_local', 
                   'treatment_exfoliant_mild', 'treatment_exfoliant_strong', 
                   'treatment_pigmentation', 'treatment_antiage'],
      'moisturizer': ['moisturizer_light', 'moisturizer_balancing', 'moisturizer_barrier', 'moisturizer_soothing'],
      'cream': ['moisturizer_light', 'moisturizer_balancing', 'moisturizer_barrier', 'moisturizer_soothing'],
      'spf': ['spf_50_face', 'spf_50_oily', 'spf_50_sensitive'],
      'mask': ['mask_clay', 'mask_hydrating', 'mask_soothing', 'mask_sleeping'],
    };

    const rulesWithBasicSteps: Array<{ id: number; name: string; basicSteps: string[] }> = [];
    
    allRules.forEach(rule => {
      const stepsJson = rule.stepsJson as Record<string, any>;
      const ruleStepNames = Object.keys(stepsJson);
      const usedBasicSteps = ruleStepNames.filter(step => basicSteps.includes(step));
      
      if (usedBasicSteps.length > 0) {
        rulesWithBasicSteps.push({
          id: rule.id,
          name: rule.name,
          basicSteps: usedBasicSteps,
        });
      }
    });

    console.log(`   Всего правил: ${allRules.length}`);
    console.log(`   Правил с базовыми шагами: ${rulesWithBasicSteps.length}`);
    
    if (rulesWithBasicSteps.length > 0) {
      console.log(`   Правила, требующие обновления (первые 10):`);
      rulesWithBasicSteps.slice(0, 10).forEach(rule => {
        console.log(`     ⚠️  "${rule.name}" (ID: ${rule.id}): использует ${rule.basicSteps.join(', ')}`);
        rule.basicSteps.forEach(basicStep => {
          console.log(`        → Может быть заменено на: ${detailedStepsMap[basicStep]?.join(', ') || 'неизвестно'}`);
        });
      });
    } else {
      console.log(`   ✅ Все правила используют детальные шаги`);
    }

    // 8. Проверяем конкретную сессию (последнюю) - оставляем для обратной совместимости
    if (sessions.length > 0) {
      const lastSession = sessions[0];
      if (lastSession.ruleId && Array.isArray(lastSession.products) && lastSession.products.length > 0) {
        console.log('\n📦 8. Детали последней сессии:');
        
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
