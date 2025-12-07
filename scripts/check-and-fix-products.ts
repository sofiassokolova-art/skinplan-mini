// scripts/check-and-fix-products.ts
// Проверяет наличие продуктов для правил и добавляет недостающие

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAndFixProducts() {
  console.log('🔍 Проверяю наличие продуктов для правил...\n');

  // Получаем все активные правила
  const rules = await prisma.recommendationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });

  console.log(`📋 Найдено правил: ${rules.length}\n`);

  // Собираем все уникальные шаги из правил
  const allSteps = new Map<string, any>();
  
  for (const rule of rules) {
    const stepsJson = rule.stepsJson as any;
    for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
      if (!allSteps.has(stepName)) {
        allSteps.set(stepName, stepConfig);
      }
    }
  }

  console.log(`📋 Уникальных шагов: ${allSteps.size}\n`);

  // Проверяем каждый шаг
  const missingProducts: Array<{
    step: string;
    config: any;
    category: string;
    concerns?: string[];
    activeIngredients?: string[];
    count: number;
  }> = [];

  for (const [stepName, stepConfig] of allSteps.entries()) {
    const config = stepConfig as any;
    
    // Определяем категорию
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

    const categories = config.category || [stepName];
    const normalizedCats: string[] = [];
    for (const cat of categories) {
      const mapped = categoryMapping[cat] || [cat];
      normalizedCats.push(...mapped);
    }

    // Строим запрос
    const where: any = {
      published: true,
      brand: {
        isActive: true,
      },
      OR: [
        ...normalizedCats.map(cat => ({ category: cat })),
        ...normalizedCats.map(cat => ({ step: cat })),
        ...normalizedCats.map(cat => ({ step: { startsWith: cat } })),
      ],
    };

    // Проверяем с фильтрами
    if (config.concerns && config.concerns.length > 0) {
      where.concerns = { hasSome: config.concerns };
    }

    if (config.active_ingredients && config.active_ingredients.length > 0) {
      // Нормализуем ингредиенты
      const normalizeIngredient = (ing: string): string[] => {
        let normalized = ing.replace(/\s*\d+[–\-]\d+\s*%/gi, '');
        normalized = normalized.replace(/\s*\d+\s*%/gi, '');
        normalized = normalized.replace(/\s*%\s*/gi, '');
        normalized = normalized.split('(')[0].split(',')[0].trim();
        normalized = normalized.toLowerCase().trim();
        
        const variants = [normalized];
        if (normalized.includes('_')) {
          variants.push(normalized.replace(/_/g, ''));
        }
        if (normalized.includes(' ')) {
          variants.push(normalized.replace(/\s+/g, '_'));
        }
        
        return variants;
      };

      const normalizedIngredients: string[] = [];
      for (const ingredient of config.active_ingredients) {
        const variants = normalizeIngredient(ingredient);
        normalizedIngredients.push(...variants);
      }

      where.OR = [
        ...where.OR,
        ...normalizedIngredients.map(ing => ({
          activeIngredients: { has: ing },
        })),
      ];
    }

    const products = await prisma.product.findMany({
      where,
      take: 10,
    });

    console.log(`📦 ${stepName}: найдено ${products.length} продуктов`);
    if (config.concerns) {
      console.log(`   Concerns: ${config.concerns.join(', ')}`);
    }
    if (config.active_ingredients) {
      console.log(`   Active ingredients: ${config.active_ingredients.join(', ')}`);
    }

    if (products.length === 0) {
      missingProducts.push({
        step: stepName,
        config,
        category: normalizedCats[0] || stepName,
        concerns: config.concerns,
        activeIngredients: config.active_ingredients,
        count: 0,
      });
      console.log(`   ⚠️  НЕТ ПРОДУКТОВ!`);
    } else {
      console.log(`   ✅ Есть продукты: ${products.map(p => p.name).join(', ')}`);
    }
    console.log('');
  }

  if (missingProducts.length > 0) {
    console.log(`\n❌ Найдено ${missingProducts.length} шагов без продуктов:\n`);
    for (const missing of missingProducts) {
      console.log(`   - ${missing.step} (${missing.category})`);
      if (missing.concerns) {
        console.log(`     Concerns: ${missing.concerns.join(', ')}`);
      }
      if (missing.activeIngredients) {
        console.log(`     Active ingredients: ${missing.activeIngredients.join(', ')}`);
      }
    }

    console.log(`\n💡 Рекомендации:`);
    console.log(`   1. Проверьте, что в БД есть продукты с категорией "${missingProducts[0].category}"`);
    console.log(`   2. Если нужны специфические ингредиенты, убедитесь, что они указаны в activeIngredients`);
    console.log(`   3. Запустите скрипт seed-products для добавления базовых продуктов`);
  } else {
    console.log(`\n✅ Все шаги имеют продукты в БД!`);
  }
}

checkAndFixProducts()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


