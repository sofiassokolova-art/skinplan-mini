// scripts/test-all-rules.ts
// Автотесты для проверки, что все правила рекомендаций генерируют продукты

import { createScriptPrisma } from './lib/prisma';

const prisma = createScriptPrisma();

interface RuleStep {
  category?: string[];
  concerns?: string[];
  skin_types?: string[];
  is_non_comedogenic?: boolean;
  is_fragrance_free?: boolean;
  budget?: 'бюджетный' | 'средний' | 'премиум' | 'любой';
  is_natural?: boolean;
  active_ingredients?: string[];
  max_items?: number;
}

// Функция подбора продуктов (та же логика, что в recommendations/route.ts)
async function getProductsForStep(step: RuleStep) {
  const where: any = {
    published: true,
    brand: {
      isActive: true,
    },
  };

  const isSPF = step.category?.includes('spf') || step.category?.some((c: string) => c.toLowerCase().includes('spf'));

  if (step.category && step.category.length > 0) {
    const categoryConditions: any[] = [];
    
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
    
    for (const cat of step.category) {
      const normalizedCats = categoryMapping[cat] || [cat];
      
      for (const normalizedCat of normalizedCats) {
        categoryConditions.push({ category: normalizedCat });
        categoryConditions.push({ step: normalizedCat });
        categoryConditions.push({ step: { startsWith: normalizedCat } });
      }
    }
    
    where.OR = categoryConditions;
  }

  if (step.skin_types && step.skin_types.length > 0 && !isSPF) {
    const normalizedSkinTypes: string[] = [];
    
    for (const skinType of step.skin_types) {
      normalizedSkinTypes.push(skinType);
      if (skinType === 'combo') {
        normalizedSkinTypes.push('combination_dry');
        normalizedSkinTypes.push('combination_oily');
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

  if (step.concerns && step.concerns.length > 0) {
    const concernsCondition = {
      OR: [
        { concerns: { hasSome: step.concerns } },
        { concerns: { isEmpty: true } },
      ],
    };
    
    if (where.AND) {
      where.AND = Array.isArray(where.AND) ? [...where.AND, concernsCondition] : [where.AND, concernsCondition];
    } else {
      where.AND = [concernsCondition];
    }
  }

  if (step.is_non_comedogenic === true) {
    where.isNonComedogenic = true;
  }

  if (step.is_fragrance_free === true) {
    where.isFragranceFree = true;
  }

  if (step.budget && step.budget !== 'любой') {
    const budgetMapping: Record<string, string> = {
      'бюджетный': 'mass',
      'средний': 'mid',
      'премиум': 'premium',
    };
    
    const priceSegment = budgetMapping[step.budget];
    if (priceSegment) {
      where.priceSegment = priceSegment;
    }
  }

  if (step.active_ingredients && step.active_ingredients.length > 0) {
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
      
      return variants;
    };
    
    const normalizedIngredients: string[] = [];
    for (const ingredient of step.active_ingredients) {
      const variants = normalizeIngredient(ingredient);
      normalizedIngredients.push(...variants);
    }
    
    const activeIngredientsCondition = {
      OR: [
        ...normalizedIngredients.map(ingredient => ({
          activeIngredients: { has: ingredient },
        })),
        { activeIngredients: { isEmpty: true } },
      ],
    };
    
    if (where.AND) {
      where.AND = Array.isArray(where.AND) ? [...where.AND, activeIngredientsCondition] : [where.AND, activeIngredientsCondition];
    } else {
      where.AND = [activeIngredientsCondition];
    }
  }

  let products = await prisma.product.findMany({
    where,
    include: {
      brand: true,
    },
    take: (step.max_items || 3) * 3,
  });

  // Дополнительная фильтрация по ингредиентам с частичным совпадением
  if (step.active_ingredients && step.active_ingredients.length > 0 && products.length > 0) {
    const normalizeIngredient = (ing: string): string => {
      let normalized = ing.replace(/\s*\d+[–\-]\d+\s*%/gi, '');
      normalized = normalized.replace(/\s*\d+\s*%/gi, '');
      normalized = normalized.replace(/\s*%\s*/gi, '');
      normalized = normalized.split('(')[0].split(',')[0].trim();
      return normalized.toLowerCase().trim();
    };

    const normalizedRuleIngredients = step.active_ingredients.map(normalizeIngredient);
    
    products = products.filter(product => {
      if (product.activeIngredients.length === 0) {
        return true;
      }
      
      return product.activeIngredients.some(productIng => {
        const normalizedProductIng = productIng.toLowerCase().trim();
        return normalizedRuleIngredients.some(ruleIng => {
          if (normalizedProductIng === ruleIng) return true;
          if (normalizedProductIng.includes(ruleIng) || ruleIng.includes(normalizedProductIng)) return true;
          const productIngNoUnderscore = normalizedProductIng.replace(/_/g, '');
          const ruleIngNoUnderscore = ruleIng.replace(/_/g, '');
          if (productIngNoUnderscore === ruleIngNoUnderscore) return true;
          if (productIngNoUnderscore.includes(ruleIngNoUnderscore) || ruleIngNoUnderscore.includes(productIngNoUnderscore)) return true;
          return false;
        });
      });
    });
  }

  if (products.length < (step.max_items || 3)) {
    const fallbackWhere: any = {
      published: true,
      brand: {
        isActive: true,
      },
    };

    if (step.category && step.category.length > 0) {
      const fallbackConditions: any[] = [];
      for (const cat of step.category) {
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
        const normalizedCats = categoryMapping[cat] || [cat];
        for (const normalizedCat of normalizedCats) {
          fallbackConditions.push({ category: { contains: normalizedCat } });
          fallbackConditions.push({ step: { contains: normalizedCat } });
        }
      }
      fallbackWhere.OR = fallbackConditions;
    }

    const fallbackProducts = await prisma.product.findMany({
      where: fallbackWhere,
      include: {
        brand: true,
      },
      take: (step.max_items || 3) * 2,
    });

    const existingIds = new Set(products.map(p => p.id));
    const newProducts = fallbackProducts.filter(p => !existingIds.has(p.id));
    products = [...products, ...newProducts];
  }

  const sorted = products.sort((a: any, b: any) => {
    if (a.isHero !== b.isHero) return b.isHero ? 1 : -1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return sorted.slice(0, step.max_items || 3);
}

async function testAllRules() {
  console.log('=== Автотесты для всех правил рекомендаций ===\n');
  
  const rules = await prisma.recommendationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });
  
  console.log(`Всего активных правил: ${rules.length}\n`);
  
  const results: Array<{
    ruleId: number;
    ruleName: string;
    passed: boolean;
    stepsWithProducts: number;
    totalSteps: number;
    missingSteps: string[];
    errors: string[];
  }> = [];
  
  for (const rule of rules) {
    const stepsJson = rule.stepsJson as Record<string, RuleStep>;
    const steps = Object.keys(stepsJson);
    
    console.log(`\n📋 Правило ${rule.id}: ${rule.name}`);
    console.log(`   Шаги: ${steps.join(', ')}`);
    
    const stepResults: Array<{ stepName: string; productCount: number; error?: string }> = [];
    const missingSteps: string[] = [];
    
    for (const [stepName, stepConfig] of Object.entries(stepsJson)) {
      try {
        const products = await getProductsForStep(stepConfig);
        stepResults.push({ stepName, productCount: products.length });
        
        if (products.length === 0) {
          missingSteps.push(stepName);
          console.log(`   ❌ ${stepName}: продуктов не найдено`);
        } else {
          console.log(`   ✅ ${stepName}: найдено ${products.length} продуктов`);
          if (products.length > 0) {
            console.log(`      Пример: ${products[0].name} (ID: ${products[0].id})`);
          }
        }
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        stepResults.push({ stepName, productCount: 0, error: errorMsg });
        missingSteps.push(stepName);
        console.log(`   ❌ ${stepName}: ошибка - ${errorMsg}`);
      }
    }
    
    const stepsWithProducts = stepResults.filter(r => r.productCount > 0).length;
    const passed = missingSteps.length === 0;
    
    results.push({
      ruleId: rule.id,
      ruleName: rule.name,
      passed,
      stepsWithProducts,
      totalSteps: steps.length,
      missingSteps,
      errors: stepResults.filter(r => r.error).map(r => `${r.stepName}: ${r.error}`),
    });
  }
  
  console.log('\n\n=== ИТОГОВЫЕ РЕЗУЛЬТАТЫ ===\n');
  
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  
  console.log(`✅ Правил с полным набором продуктов: ${passedCount}/${results.length}`);
  console.log(`❌ Правил с отсутствующими продуктами: ${failedCount}/${results.length}\n`);
  
  if (failedCount > 0) {
    console.log('❌ Правила с проблемами:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`\n   Правило ${r.ruleId}: ${r.ruleName}`);
      console.log(`   Найдено продуктов: ${r.stepsWithProducts}/${r.totalSteps} шагов`);
      console.log(`   Отсутствуют продукты для: ${r.missingSteps.join(', ')}`);
      if (r.errors.length > 0) {
        console.log(`   Ошибки: ${r.errors.join('; ')}`);
      }
    });
  }
  
  console.log('\n✅ Все правила протестированы!\n');
  
  await prisma.$disconnect();
  
  // Возвращаем код выхода: 0 если все прошло, 1 если есть ошибки
  process.exit(failedCount > 0 ? 1 : 0);
}

testAllRules().catch((error) => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});

