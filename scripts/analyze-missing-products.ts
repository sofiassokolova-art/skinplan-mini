// scripts/analyze-missing-products.ts
// Детальный анализ недостающих продуктов для правил

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeMissingProducts() {
  console.log('📊 Детальный анализ недостающих продуктов для правил\n');

  // Получаем все активные правила
  const rules = await prisma.recommendationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });

  console.log(`Всего активных правил: ${rules.length}\n`);

  // Собираем все уникальные шаги с их конфигурациями
  const stepConfigs = new Map<string, any[]>();

  for (const rule of rules) {
    const stepsJson = rule.stepsJson as Record<string, any>;
    for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
      if (!stepConfigs.has(stepName)) {
        stepConfigs.set(stepName, []);
      }
      stepConfigs.get(stepName)!.push({
        ruleName: rule.name,
        ruleId: rule.id,
        config: stepConfig,
      });
    }
  }

  console.log(`Уникальных шагов: ${stepConfigs.size}\n`);

  const missingProducts: Array<{
    stepName: string;
    category: string;
    filters: any;
    currentCount: number;
    neededCount: number;
    existingProducts: any[];
    missingFilters: string[];
  }> = [];

  // Анализируем каждый шаг
  for (const [stepName, configs] of stepConfigs.entries()) {
    // Берем первую конфигурацию для анализа (они обычно похожи)
    const stepConfig = configs[0].config;
    
    console.log(`\n📋 Шаг: ${stepName}`);
    console.log(`   Используется в ${configs.length} правилах`);
    console.log(`   Конфигурация:`, JSON.stringify(stepConfig, null, 2));

    // Строим запрос как в getProductsForStep
    const where: any = {
      published: true,
      brand: {
        isActive: true,
      },
    };

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
        categoryConditions.push({ step: { startsWith: normalizedCat } });
      }
    }

    if (categoryConditions.length > 0) {
      where.OR = categoryConditions;
    }

    // Без фильтров - базовый запрос
    const allProductsInCategory = await prisma.product.findMany({
      where: {
        published: true,
        brand: { isActive: true },
        OR: categoryConditions,
      },
      include: { brand: true },
      take: 50,
    });

    console.log(`   📦 Всего продуктов в категории: ${allProductsInCategory.length}`);

    // С фильтрами
    if (stepConfig.skin_types && stepConfig.skin_types.length > 0) {
      const normalizedSkinTypes: string[] = [];
      for (const skinType of stepConfig.skin_types) {
        normalizedSkinTypes.push(skinType);
        if (skinType === 'combo') {
          normalizedSkinTypes.push('combination_dry', 'combination_oily');
        }
        if (skinType === 'dry') {
          normalizedSkinTypes.push('combination_dry');
        }
        if (skinType === 'oily') {
          normalizedSkinTypes.push('combination_oily');
        }
      }
      where.skinTypes = { hasSome: normalizedSkinTypes };
    }

    if (stepConfig.concerns && stepConfig.concerns.length > 0) {
      where.concerns = { hasSome: stepConfig.concerns };
    }

    if (stepConfig.active_ingredients && stepConfig.active_ingredients.length > 0) {
      where.activeIngredients = { hasSome: stepConfig.active_ingredients };
    }

    if (stepConfig.is_non_comedogenic) {
      where.isNonComedogenic = true;
    }

    if (stepConfig.is_fragrance_free) {
      where.isFragranceFree = true;
    }

    const filteredProducts = await prisma.product.findMany({
      where,
      include: { brand: true },
      take: 50,
    });

    const neededCount = stepConfig.max_items || 3;
    const currentCount = filteredProducts.length;

    console.log(`   ✅ Продуктов с фильтрами: ${currentCount} (нужно: ${neededCount})`);

    if (currentCount < neededCount) {
      const missingFilters: string[] = [];

      // Проверяем, что именно блокирует
      if (stepConfig.concerns && stepConfig.concerns.length > 0) {
        const withConcerns = allProductsInCategory.filter(p => 
          stepConfig.concerns.some((c: string) => p.concerns.includes(c))
        );
        if (withConcerns.length < neededCount) {
          missingFilters.push(`concerns: ${stepConfig.concerns.join(', ')} (есть только ${withConcerns.length})`);
        }
      }

      if (stepConfig.active_ingredients && stepConfig.active_ingredients.length > 0) {
        const withActives = allProductsInCategory.filter(p => 
          stepConfig.active_ingredients.some((ai: string) => 
            p.activeIngredients.some(pi => 
              pi.toLowerCase().includes(ai.toLowerCase()) ||
              ai.toLowerCase().includes(pi.toLowerCase())
            )
          )
        );
        if (withActives.length < neededCount) {
          missingFilters.push(`active_ingredients: ${stepConfig.active_ingredients.join(', ')} (есть только ${withActives.length})`);
        }
      }

      if (stepConfig.skin_types && stepConfig.skin_types.length > 0) {
        const withSkinTypes = allProductsInCategory.filter(p => 
          stepConfig.skin_types.some((st: string) => 
            p.skinTypes.includes(st) || 
            p.skinTypes.includes('all') ||
            (st === 'combo' && (p.skinTypes.includes('combination_dry') || p.skinTypes.includes('combination_oily')))
          )
        );
        if (withSkinTypes.length < neededCount) {
          missingFilters.push(`skin_types: ${stepConfig.skin_types.join(', ')} (есть только ${withSkinTypes.length})`);
        }
      }

      if (stepConfig.is_non_comedogenic) {
        const nonComedogenic = allProductsInCategory.filter(p => p.isNonComedogenic);
        if (nonComedogenic.length < neededCount) {
          missingFilters.push(`is_non_comedogenic: true (есть только ${nonComedogenic.length})`);
        }
      }

      if (stepConfig.is_fragrance_free) {
        const fragranceFree = allProductsInCategory.filter(p => p.isFragranceFree);
        if (fragranceFree.length < neededCount) {
          missingFilters.push(`is_fragrance_free: true (есть только ${fragranceFree.length})`);
        }
      }

      missingProducts.push({
        stepName,
        category: category.join(', '),
        filters: stepConfig,
        currentCount,
        neededCount,
        existingProducts: allProductsInCategory.slice(0, 5),
        missingFilters,
      });

      console.log(`   ⚠️  Не хватает: ${neededCount - currentCount} продуктов`);
      if (missingFilters.length > 0) {
        console.log(`   🔍 Проблемные фильтры:`);
        missingFilters.forEach(f => console.log(`      - ${f}`));
      }
    } else {
      console.log(`   ✅ Достаточно продуктов`);
    }
  }

  // Итоговый отчет
  console.log('\n\n=== ИТОГОВЫЙ ОТЧЕТ ===\n');

  if (missingProducts.length === 0) {
    console.log('✅ Все шаги имеют достаточное количество продуктов!\n');
  } else {
    console.log(`⚠️  Шагов с недостаточным количеством продуктов: ${missingProducts.length}\n`);

    // Группируем по категориям
    const byCategory = new Map<string, typeof missingProducts>();
    for (const item of missingProducts) {
      const cat = item.category.split(',')[0] || 'other';
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(item);
    }

    console.log('📋 ДЕТАЛЬНЫЕ РЕКОМЕНДАЦИИ:\n');

    for (const [category, items] of byCategory.entries()) {
      console.log(`\n📦 ${category.toUpperCase()}:`);
      
      for (const item of items) {
        console.log(`\n   Шаг: ${item.stepName}`);
        console.log(`   Нужно: ${item.neededCount} продуктов, есть: ${item.currentCount}`);
        console.log(`   Не хватает: ${item.neededCount - item.currentCount} продуктов`);
        
        if (item.missingFilters.length > 0) {
          console.log(`   Проблемные фильтры:`);
          item.missingFilters.forEach(f => console.log(`      - ${f}`));
        }

        // Показываем примеры существующих продуктов
        if (item.existingProducts.length > 0) {
          console.log(`   Примеры существующих продуктов в категории:`);
          item.existingProducts.forEach(p => {
            console.log(`      - ${p.brand.name} ${p.name}`);
            console.log(`        step: ${p.step}, concerns: [${p.concerns.join(', ')}], actives: [${p.activeIngredients.join(', ')}]`);
          });
        }

        // Рекомендации
        console.log(`   💡 Что нужно добавить:`);
        const recommendations: string[] = [];
        
        if (item.filters.concerns && item.filters.concerns.length > 0) {
          recommendations.push(`${category} с concerns: ${item.filters.concerns.join(', ')}`);
        }
        
        if (item.filters.active_ingredients && item.filters.active_ingredients.length > 0) {
          recommendations.push(`${category} с active_ingredients: ${item.filters.active_ingredients.join(', ')}`);
        }
        
        if (item.filters.skin_types && item.filters.skin_types.length > 0) {
          recommendations.push(`${category} для типов кожи: ${item.filters.skin_types.join(', ')}`);
        }
        
        if (item.filters.is_non_comedogenic) {
          recommendations.push(`${category} non-comedogenic`);
        }
        
        if (item.filters.is_fragrance_free) {
          recommendations.push(`${category} fragrance-free`);
        }

        if (recommendations.length === 0) {
          recommendations.push(`Больше ${category} в целом`);
        }

        recommendations.forEach(r => console.log(`      - ${r}`));
      }
    }

    // Статистика по шагам
    console.log('\n\n📊 СТАТИСТИКА ПО ШАГАМ:\n');
    
    const stepFrequency = new Map<string, number>();
    for (const rule of rules) {
      const stepsJson = rule.stepsJson as Record<string, any>;
      for (const stepName of Object.keys(stepsJson)) {
        stepFrequency.set(stepName, (stepFrequency.get(stepName) || 0) + 1);
      }
    }

    const sortedSteps = Array.from(stepFrequency.entries())
      .sort((a, b) => b[1] - a[1]);

    for (const [stepName, count] of sortedSteps) {
      const missing = missingProducts.find(m => m.stepName === stepName);
      const status = missing ? '⚠️' : '✅';
      const info = missing 
        ? `продуктов: ${missing.currentCount}/${missing.neededCount}`
        : 'продуктов достаточно';
      console.log(`   ${status} ${stepName}: используется в ${count} правилах, ${info}`);
    }
  }

  await prisma.$disconnect();
}

analyzeMissingProducts().catch((error) => {
  console.error('❌ Ошибка при анализе:', error);
  process.exit(1);
});

