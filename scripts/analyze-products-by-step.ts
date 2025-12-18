// scripts/analyze-products-by-step.ts
// Анализ продуктов по шагам для понимания покрытия правил

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeProductsByStep() {
  console.log('=== Анализ продуктов по шагам ухода ===\n');
  
  // Получаем все активные продукты
  const products = await prisma.product.findMany({
    where: {
      published: true,
      brand: {
        isActive: true,
      },
    },
    include: {
      brand: true,
    },
  });
  
  console.log(`Всего активных продуктов: ${products.length}\n`);
  
  // Группируем по шагам
  const stepMap = new Map<string, Array<{ id: number; name: string; brand: string; category: string }>>();
  
  products.forEach(product => {
    const step = product.step || 'unknown';
    if (!stepMap.has(step)) {
      stepMap.set(step, []);
    }
    stepMap.get(step)!.push({
      id: product.id,
      name: product.name,
      brand: product.brand.name,
      category: product.category || 'unknown',
    });
  });
  
  // Группируем по категориям
  const categoryMap = new Map<string, Array<{ id: number; name: string; brand: string; step: string }>>();
  
  products.forEach(product => {
    const category = product.category || 'unknown';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push({
      id: product.id,
      name: product.name,
      brand: product.brand.name,
      step: product.step || 'unknown',
    });
  });
  
  // Выводим статистику по шагам
  console.log('📊 Продукты по ШАГАМ (step):\n');
  const sortedSteps = Array.from(stepMap.entries()).sort((a, b) => b[1].length - a[1].length);
  sortedSteps.forEach(([step, products]) => {
    console.log(`  ${step}: ${products.length} продуктов`);
    if (products.length <= 3) {
      console.log(`    ⚠️  МАЛО ПРОДУКТОВ! Примеры: ${products.map(p => `${p.name} (${p.brand})`).join(', ')}`);
    } else if (products.length <= 5) {
      console.log(`    ⚠️  Мало продуктов. Примеры: ${products.slice(0, 3).map(p => `${p.name} (${p.brand})`).join(', ')}`);
    }
  });
  
  console.log('\n📊 Продукты по КАТЕГОРИЯМ (category):\n');
  const sortedCategories = Array.from(categoryMap.entries()).sort((a, b) => b[1].length - a[1].length);
  sortedCategories.forEach(([category, products]) => {
    console.log(`  ${category}: ${products.length} продуктов`);
    if (products.length <= 3) {
      console.log(`    ⚠️  МАЛО ПРОДУКТОВ! Примеры: ${products.map(p => `${p.name} (${p.brand})`).join(', ')}`);
    }
  });
  
  // Анализ по типам кожи
  console.log('\n📊 Продукты по типам кожи:\n');
  const skinTypeMap = new Map<string, number>();
  products.forEach(product => {
    const skinTypes = product.skinTypes || [];
    if (skinTypes.length === 0) {
      const key = 'any';
      skinTypeMap.set(key, (skinTypeMap.get(key) || 0) + 1);
    } else {
      skinTypes.forEach(st => {
        skinTypeMap.set(st, (skinTypeMap.get(st) || 0) + 1);
      });
    }
  });
  
  const sortedSkinTypes = Array.from(skinTypeMap.entries()).sort((a, b) => b[1] - a[1]);
  sortedSkinTypes.forEach(([skinType, count]) => {
    console.log(`  ${skinType}: ${count} продуктов`);
  });
  
  // Анализ по проблемам
  console.log('\n📊 Продукты по проблемам (concerns):\n');
  const concernMap = new Map<string, number>();
  products.forEach(product => {
    const concerns = product.concerns || [];
    if (concerns.length === 0) {
      const key = 'none';
      concernMap.set(key, (concernMap.get(key) || 0) + 1);
    } else {
      concerns.forEach(c => {
        concernMap.set(c, (concernMap.get(c) || 0) + 1);
      });
    }
  });
  
  const sortedConcerns = Array.from(concernMap.entries()).sort((a, b) => b[1] - a[1]);
  sortedConcerns.forEach(([concern, count]) => {
    console.log(`  ${concern}: ${count} продуктов`);
  });
  
  // Проверяем покрытие основных шагов
  console.log('\n\n=== ПРОВЕРКА ПОКРЫТИЯ ОСНОВНЫХ ШАГОВ ===\n');
  
  const requiredSteps = [
    'cleanser',
    'toner',
    'serum',
    'moisturizer',
    'spf',
    'treatment',
    'mask',
  ];
  
  const stepCategories = [
    'cleanser_gentle',
    'cleanser_balancing',
    'cleanser_deep',
    'toner_soothing',
    'toner_hydrating',
    'serum_niacinamide',
    'serum_vitc',
    'serum_anti_redness',
    'moisturizer_light',
    'moisturizer_balancing',
    'moisturizer_rich',
    'spf_50_face',
    'treatment_acne_bpo',
    'treatment_acne_azelaic',
    'treatment_antiage',
  ];
  
  console.log('Базовые шаги:');
  requiredSteps.forEach(step => {
    const stepProducts = products.filter(p => 
      p.step === step || 
      p.step?.startsWith(step) ||
      p.category === step
    );
    const count = stepProducts.length;
    const status = count >= 5 ? '✅' : count >= 3 ? '⚠️' : '❌';
    console.log(`  ${status} ${step}: ${count} продуктов`);
    if (count < 3) {
      console.log(`     Примеры: ${stepProducts.slice(0, 3).map(p => `${p.name} (${p.brand.name})`).join(', ')}`);
    }
  });
  
  console.log('\nСпецифические категории шагов:');
  stepCategories.forEach(stepCategory => {
    const stepProducts = products.filter(p => 
      p.step === stepCategory || 
      p.category === stepCategory ||
      (p.step?.includes(stepCategory.split('_')[0]) && p.category?.includes(stepCategory.split('_')[1]))
    );
    const count = stepProducts.length;
    const status = count >= 3 ? '✅' : count >= 1 ? '⚠️' : '❌';
    console.log(`  ${status} ${stepCategory}: ${count} продуктов`);
    if (count === 0) {
      console.log(`     ❌ НЕТ ПРОДУКТОВ!`);
    } else if (count <= 2) {
      console.log(`     Примеры: ${stepProducts.map(p => `${p.name} (${p.brand.name})`).join(', ')}`);
    }
  });
  
  await prisma.$disconnect();
}

analyzeProductsByStep().catch((error) => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});

