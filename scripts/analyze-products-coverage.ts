// scripts/analyze-products-coverage.ts
// Анализ покрытия продуктов по шагам и фильтрам для правил

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface StepAnalysis {
  stepName: string;
  category: string;
  totalProducts: number;
  bySkinType: Record<string, number>;
  byConcerns: Record<string, number>;
  byFilters: {
    isNonComedogenic: number;
    isFragranceFree: number;
    withActiveIngredients: number;
  };
  missing: string[];
}

async function analyzeProductsCoverage() {
  console.log('📊 Анализ покрытия продуктов по шагам и фильтрам\n');

  // Получаем все активные правила
  const rules = await prisma.recommendationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });

  console.log(`Всего активных правил: ${rules.length}\n`);

  // Собираем все уникальные шаги из правил
  const allSteps = new Map<string, any>();

  for (const rule of rules) {
    const stepsJson = rule.stepsJson as Record<string, any>;
    for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
      if (!allSteps.has(stepName)) {
        allSteps.set(stepName, stepConfig);
      }
    }
  }

  console.log(`Уникальных шагов в правилах: ${allSteps.size}\n`);

  const analysis: StepAnalysis[] = [];

  // Анализируем каждый шаг
  for (const [stepName, stepConfig] of allSteps.entries()) {
    console.log(`\n📋 Анализ шага: ${stepName}`);
    console.log(`   Конфигурация:`, JSON.stringify(stepConfig, null, 2));

    const where: any = {
      published: true,
      brand: {
        isActive: true,
      },
    };

    // Определяем категорию
    const category = stepConfig.category || [stepName];
    const categoryMapping: Record<string, string[]> = {
      'cream': ['moisturizer'],
      'moisturizer': ['moisturizer'],
      'cleanser': ['cleanser'],
      'serum': ['serum'],
      'toner': ['toner'],
      'treatment': ['treatment'],
      'spf': ['spf'],
      'mask': ['mask'],
    };

    const categoryConditions: any[] = [];
    for (const cat of category) {
      const normalizedCats = categoryMapping[cat] || [cat];
      for (const normalizedCat of normalizedCats) {
        categoryConditions.push({ category: normalizedCat });
        categoryConditions.push({ step: normalizedCat });
        // Также проверяем stepCategory (moisturizer_rich, mask_sleeping и т.д.)
        if (stepName.includes('_')) {
          categoryConditions.push({ step: stepName });
        }
      }
    }

    if (categoryConditions.length > 0) {
      where.OR = categoryConditions;
    }

    // Фильтры по типам кожи
    if (stepConfig.skin_types && stepConfig.skin_types.length > 0) {
      where.skinTypes = {
        hasSome: stepConfig.skin_types,
      };
    }

    // Фильтры по проблемам
    if (stepConfig.concerns && stepConfig.concerns.length > 0) {
      where.concerns = {
        hasSome: stepConfig.concerns,
      };
    }

    // Фильтры по активным ингредиентам
    if (stepConfig.active_ingredients && stepConfig.active_ingredients.length > 0) {
      where.activeIngredients = {
        hasSome: stepConfig.active_ingredients,
      };
    }

    // Фильтры по специфическим свойствам
    if (stepConfig.is_non_comedogenic) {
      where.isNonComedogenic = true;
    }

    if (stepConfig.is_fragrance_free) {
      where.isFragranceFree = true;
    }

    // Получаем все продукты для этого шага
    const allProducts = await prisma.product.findMany({
      where,
      include: {
        brand: true,
      },
    });

    // Анализируем по типам кожи
    const bySkinType: Record<string, number> = {};
    const skinTypes = ['dry', 'oily', 'combo', 'sensitive', 'normal', 'very_dry', 'combination_dry'];
    
    for (const skinType of skinTypes) {
      const count = allProducts.filter(p => 
        p.skinTypes.includes(skinType) || 
        p.skinTypes.length === 0 || 
        p.skinTypes.includes('all')
      ).length;
      if (count > 0) {
        bySkinType[skinType] = count;
      }
    }

    // Анализируем по проблемам
    const byConcerns: Record<string, number> = {};
    const concerns = ['acne', 'pigmentation', 'barrier', 'dehydration', 'wrinkles', 'pores', 'redness', 'sensitivity', 'dryness'];
    
    for (const concern of concerns) {
      const count = allProducts.filter(p => 
        p.concerns.includes(concern)
      ).length;
      if (count > 0) {
        byConcerns[concern] = count;
      }
    }

    // Анализируем по фильтрам
    const isNonComedogenic = allProducts.filter(p => p.isNonComedogenic).length;
    const isFragranceFree = allProducts.filter(p => p.isFragranceFree).length;
    const withActiveIngredients = allProducts.filter(p => p.activeIngredients.length > 0).length;

    // Определяем, чего не хватает
    const missing: string[] = [];
    const minRequired = stepConfig.max_items || 3;

    if (allProducts.length < minRequired) {
      missing.push(`Всего продуктов: ${allProducts.length} (нужно минимум ${minRequired})`);
    }

    // Проверяем покрытие по типам кожи
    if (stepConfig.skin_types && stepConfig.skin_types.length > 0) {
      for (const skinType of stepConfig.skin_types) {
        const count = bySkinType[skinType] || 0;
        if (count < minRequired) {
          missing.push(`Тип кожи "${skinType}": ${count} продуктов (нужно минимум ${minRequired})`);
        }
      }
    }

    // Проверяем покрытие по проблемам
    if (stepConfig.concerns && stepConfig.concerns.length > 0) {
      for (const concern of stepConfig.concerns) {
        const count = byConcerns[concern] || 0;
        if (count < minRequired) {
          missing.push(`Проблема "${concern}": ${count} продуктов (нужно минимум ${minRequired})`);
        }
      }
    }

    // Проверяем фильтры
    if (stepConfig.is_non_comedogenic && isNonComedogenic < minRequired) {
      missing.push(`Non-comedogenic: ${isNonComedogenic} продуктов (нужно минимум ${minRequired})`);
    }

    if (stepConfig.is_fragrance_free && isFragranceFree < minRequired) {
      missing.push(`Fragrance-free: ${isFragranceFree} продуктов (нужно минимум ${minRequired})`);
    }

    if (stepConfig.active_ingredients && stepConfig.active_ingredients.length > 0) {
      for (const ingredient of stepConfig.active_ingredients) {
        const count = allProducts.filter(p => 
          p.activeIngredients.some(ai => 
            ai.toLowerCase().includes(ingredient.toLowerCase()) ||
            ingredient.toLowerCase().includes(ai.toLowerCase())
          )
        ).length;
        if (count < minRequired) {
          missing.push(`Активный ингредиент "${ingredient}": ${count} продуктов (нужно минимум ${minRequired})`);
        }
      }
    }

    analysis.push({
      stepName,
      category: category.join(', '),
      totalProducts: allProducts.length,
      bySkinType,
      byConcerns,
      byFilters: {
        isNonComedogenic,
        isFragranceFree,
        withActiveIngredients,
      },
      missing,
    });

    console.log(`   ✅ Всего продуктов: ${allProducts.length}`);
    if (allProducts.length > 0) {
      console.log(`   Примеры: ${allProducts.slice(0, 3).map(p => `${p.brand.name} ${p.name}`).join(', ')}`);
    }
    if (missing.length > 0) {
      console.log(`   ⚠️  Не хватает:`);
      missing.forEach(m => console.log(`      - ${m}`));
    }
  }

  // Итоговый отчет
  console.log('\n\n=== ИТОГОВЫЙ ОТЧЕТ ===\n');

  const stepsWithIssues = analysis.filter(a => a.missing.length > 0);
  const stepsWithEnoughProducts = analysis.filter(a => a.totalProducts >= 3);

  console.log(`✅ Шагов с достаточным количеством продуктов (≥3): ${stepsWithEnoughProducts.length}/${analysis.length}`);
  console.log(`⚠️  Шагов с недостаточным количеством продуктов: ${stepsWithIssues.length}/${analysis.length}\n`);

  if (stepsWithIssues.length > 0) {
    console.log('📋 Шаги, требующие дополнительных продуктов:\n');
    
    // Группируем по категориям
    const byCategory = new Map<string, StepAnalysis[]>();
    for (const step of stepsWithIssues) {
      const cat = step.category.split(',')[0] || 'other';
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(step);
    }

    for (const [category, steps] of byCategory.entries()) {
      console.log(`\n📦 ${category.toUpperCase()}:`);
      for (const step of steps) {
        console.log(`\n   Шаг: ${step.stepName}`);
        console.log(`   Всего продуктов: ${step.totalProducts}`);
        console.log(`   Проблемы:`);
        step.missing.forEach(m => console.log(`      - ${m}`));
        
        // Показываем примеры существующих продуктов
        const exampleProducts = await prisma.product.findMany({
          where: {
            published: true,
            OR: [
              { category: category },
              { step: category },
            ],
          },
          take: 3,
          include: { brand: true },
        });
        
        if (exampleProducts.length > 0) {
          console.log(`   Примеры существующих: ${exampleProducts.map(p => `${p.brand.name} ${p.name}`).join(', ')}`);
        }
      }
    }

    // Рекомендации по добавлению продуктов
    console.log('\n\n💡 РЕКОМЕНДАЦИИ ПО ДОБАВЛЕНИЮ ПРОДУКТОВ:\n');
    
    const recommendations = new Map<string, Set<string>>();
    
    for (const step of stepsWithIssues) {
      const cat = step.category.split(',')[0] || 'other';
      if (!recommendations.has(cat)) {
        recommendations.set(cat, new Set());
      }
      
      // Анализируем, что именно не хватает
      for (const missing of step.missing) {
        if (missing.includes('Тип кожи')) {
          const skinType = missing.match(/"([^"]+)"/)?.[1];
          if (skinType) {
            recommendations.get(cat)!.add(`${cat} для ${skinType} кожи`);
          }
        } else if (missing.includes('Проблема')) {
          const concern = missing.match(/"([^"]+)"/)?.[1];
          if (concern) {
            recommendations.get(cat)!.add(`${cat} для ${concern}`);
          }
        } else if (missing.includes('Активный ингредиент')) {
          const ingredient = missing.match(/"([^"]+)"/)?.[1];
          if (ingredient) {
            recommendations.get(cat)!.add(`${cat} с ${ingredient}`);
          }
        } else if (missing.includes('Non-comedogenic')) {
          recommendations.get(cat)!.add(`${cat} non-comedogenic`);
        } else if (missing.includes('Fragrance-free')) {
          recommendations.get(cat)!.add(`${cat} fragrance-free`);
        } else {
          recommendations.get(cat)!.add(`Больше ${cat} в целом`);
        }
      }
    }

    for (const [category, recs] of recommendations.entries()) {
      console.log(`\n📦 ${category.toUpperCase()}:`);
      Array.from(recs).forEach(rec => console.log(`   - ${rec}`));
    }
  }

  // Статистика по шагам в правилах
  console.log('\n\n📊 СТАТИСТИКА ПО ШАГАМ В ПРАВИЛАХ:\n');
  
  const stepFrequency = new Map<string, number>();
  for (const rule of rules) {
    const stepsJson = rule.stepsJson as Record<string, any>;
    for (const stepName of Object.keys(stepsJson)) {
      stepFrequency.set(stepName, (stepFrequency.get(stepName) || 0) + 1);
    }
  }

  const sortedSteps = Array.from(stepFrequency.entries())
    .sort((a, b) => b[1] - a[1]);

  console.log('Частота использования шагов в правилах:');
  for (const [stepName, count] of sortedSteps) {
    const stepAnalysis = analysis.find(a => a.stepName === stepName);
    const productCount = stepAnalysis?.totalProducts || 0;
    const status = productCount >= 3 ? '✅' : '⚠️';
    console.log(`   ${status} ${stepName}: используется в ${count} правилах, продуктов: ${productCount}`);
  }

  await prisma.$disconnect();
}

analyzeProductsCoverage().catch((error) => {
  console.error('❌ Ошибка при анализе:', error);
  process.exit(1);
});

