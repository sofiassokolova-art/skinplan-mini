// scripts/check-product-step-matching.ts
// Проверка матчинга продуктов к шагам плана

import { PrismaClient } from '@prisma/client';
import { getBaseStepFromStepCategory } from '../lib/plan-helpers';
import { StepCategory } from '../lib/step-category-rules';
// Removed invalid import of StepCategory (not exported from plan-helpers)

const prisma = new PrismaClient();

// Копируем логику mapStepToStepCategory из plan-generator.ts
function mapStepToStepCategory(
  step: string | null | undefined,
  category: string | null | undefined,
  skinType: string
): StepCategory[] {
  const stepStr = (step || category || '').toLowerCase();
  const categoryStr = (category || '').toLowerCase();
  const categories: StepCategory[] = [];

  // Cleanser
  if (stepStr === 'cleanser_oil' || categoryStr.includes('oil') || stepStr.includes('oil')) {
    categories.push('cleanser_oil');
    categories.push('cleanser_gentle');
  } else if (stepStr.startsWith('cleanser_gentle') || categoryStr.includes('gentle')) {
    categories.push('cleanser_gentle');
  } else if (stepStr.startsWith('cleanser_balancing') || (stepStr.includes('cleanser') && (stepStr.includes('balancing') || categoryStr.includes('balancing')))) {
    categories.push('cleanser_balancing');
  } else if (stepStr.startsWith('cleanser_deep') || stepStr.includes('deep') || categoryStr.includes('deep')) {
    categories.push('cleanser_deep');
  } else if (stepStr.startsWith('cleanser') || categoryStr === 'cleanser' || stepStr === 'cleanser') {
    categories.push('cleanser_gentle');
    categories.push('cleanser_balancing');
    categories.push('cleanser_deep');
  }

  // Toner
  if (stepStr.startsWith('toner_hydrating') || categoryStr.includes('hydrating')) {
    categories.push('toner_hydrating');
  } else if (stepStr.startsWith('toner_soothing') || (stepStr.includes('toner') && (stepStr.includes('soothing') || categoryStr.includes('soothing')))) {
    categories.push('toner_soothing');
  } else if (stepStr === 'toner' || categoryStr === 'toner') {
    categories.push('toner_hydrating');
    categories.push('toner_soothing');
  }

  // Serum
  if (stepStr.startsWith('serum_hydrating') || categoryStr.includes('hydrating')) {
    categories.push('serum_hydrating');
  } else if (stepStr.startsWith('serum_niacinamide') || stepStr.includes('niacinamide') || categoryStr.includes('niacinamide')) {
    categories.push('serum_niacinamide');
  } else if (stepStr.startsWith('serum_vitc') || stepStr.includes('vitamin c') || stepStr.includes('vitc') || categoryStr.includes('vitamin c')) {
    categories.push('serum_vitc');
  } else if (stepStr.startsWith('serum_anti_redness') || stepStr.includes('anti-redness') || categoryStr.includes('anti-redness')) {
    categories.push('serum_anti_redness');
  } else if (stepStr.startsWith('serum_brightening') || stepStr.includes('brightening') || categoryStr.includes('brightening')) {
    categories.push('serum_brightening_soft');
  } else if (stepStr === 'serum' || categoryStr === 'serum') {
    categories.push('serum_hydrating');
    categories.push('serum_niacinamide');
  }

  // Treatment
  if (stepStr.startsWith('treatment_acne_bpo') || stepStr.includes('benzoyl peroxide')) {
    categories.push('treatment_acne_bpo');
  } else if (stepStr.startsWith('treatment_acne_azelaic') || stepStr.includes('azelaic')) {
    categories.push('treatment_acne_azelaic');
  } else if (stepStr.startsWith('treatment_acne_local') || stepStr.includes('spot treatment')) {
    categories.push('treatment_acne_local');
  } else if (stepStr.startsWith('treatment_exfoliant_mild') || (stepStr.includes('exfoliant') && !stepStr.includes('strong'))) {
    categories.push('treatment_exfoliant_mild');
  } else if (stepStr.startsWith('treatment_exfoliant_strong') || stepStr.includes('strong exfoliant')) {
    categories.push('treatment_exfoliant_strong');
  } else if (stepStr.startsWith('treatment_pigmentation') || stepStr.includes('pigmentation')) {
    categories.push('treatment_pigmentation');
  } else if (stepStr.startsWith('treatment_antiage') || stepStr.includes('antiage') || stepStr.includes('anti-age')) {
    categories.push('treatment_antiage');
  } else if (stepStr.startsWith('spot_treatment') || stepStr.includes('spot treatment')) {
    categories.push('spot_treatment');
  }

  // Moisturizer
  if (stepStr.startsWith('moisturizer_light') || categoryStr.includes('light')) {
    categories.push('moisturizer_light');
  } else if (stepStr.startsWith('moisturizer_balancing') || stepStr.includes('balancing') || categoryStr.includes('balancing')) {
    categories.push('moisturizer_balancing');
  } else if (stepStr.startsWith('moisturizer_barrier') || stepStr.includes('barrier') || categoryStr.includes('barrier')) {
    categories.push('moisturizer_barrier');
  } else if (stepStr.startsWith('moisturizer_soothing') || (stepStr.includes('moisturizer') && (stepStr.includes('soothing') || categoryStr.includes('soothing')))) {
    categories.push('moisturizer_soothing');
  } else if (stepStr === 'moisturizer' || stepStr === 'cream' || categoryStr === 'moisturizer' || categoryStr === 'cream') {
    // Для dry кожи приоритет - moisturizer_barrier
    if (skinType === 'dry' || skinType === 'combination_dry') {
      categories.push('moisturizer_barrier');
      categories.push('moisturizer_soothing');
      categories.push('moisturizer_light');
    } else {
      categories.push('moisturizer_light');
      categories.push('moisturizer_balancing');
      categories.push('moisturizer_barrier');
    }
  }

  // SPF - ИСПРАВЛЕНО: Проверяем специфичные варианты ПЕРВЫМИ
  if (stepStr.startsWith('spf_50_sensitive') || (stepStr.includes('spf') && stepStr.includes('sensitive'))) {
    categories.push('spf_50_sensitive');
  } else if (stepStr.startsWith('spf_50_oily') || (stepStr.includes('spf') && stepStr.includes('oily'))) {
    categories.push('spf_50_oily');
  } else if (stepStr.startsWith('spf_50_face') || stepStr === 'spf' || categoryStr === 'spf') {
    categories.push('spf_50_face');
  }

  // Mask - ИСПРАВЛЕНО: Проверяем, что это именно mask, а не toner/moisturizer с тем же суффиксом
  if (stepStr.startsWith('mask_clay') || (stepStr.includes('mask') && stepStr.includes('clay'))) {
    categories.push('mask_clay');
  } else if (stepStr.startsWith('mask_hydrating') || (stepStr.includes('mask') && stepStr.includes('hydrating'))) {
    categories.push('mask_hydrating');
  } else if (stepStr.startsWith('mask_soothing') || (stepStr.includes('mask') && stepStr.includes('soothing'))) {
    categories.push('mask_soothing');
  } else if (stepStr.startsWith('mask_sleeping') || (stepStr.includes('mask') && stepStr.includes('sleeping'))) {
    categories.push('mask_sleeping');
  } else if (stepStr === 'mask' || categoryStr === 'mask') {
    categories.push('mask_clay', 'mask_hydrating', 'mask_soothing', 'mask_sleeping');
  }

  return categories;
}

async function checkProductStepMatching() {
  console.log('🔍 Проверка матчинга продуктов к шагам...\n');

  // Получаем все опубликованные продукты
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
    take: 100, // Ограничиваем для теста
  });

  console.log(`📦 Всего продуктов: ${products.length}\n`);

  // Группируем по типам кожи для проверки
  const skinTypes = ['dry', 'oily', 'normal', 'combo'];
  
  const issues: Array<{
    productId: number;
    productName: string;
    step: string | null;
    category: string | null;
    skinType: string;
    mappedCategories: StepCategory[];
    issue: string;
  }> = [];

  for (const skinType of skinTypes) {
    console.log(`\n📋 Проверка для типа кожи: ${skinType}`);
    console.log('─'.repeat(80));

    for (const product of products) {
      const mappedCategories = mapStepToStepCategory(product.step, product.category, skinType);

      // Проверяем проблемы
      if (mappedCategories.length === 0) {
        issues.push({
          productId: product.id,
          productName: product.name,
          step: product.step,
          category: product.category,
          skinType,
          mappedCategories: [],
          issue: 'НЕ МАППИТСЯ - пустой массив категорий',
        });
      } else if (mappedCategories.length > 5) {
        issues.push({
          productId: product.id,
          productName: product.name,
          step: product.step,
          category: product.category,
          skinType,
          mappedCategories,
          issue: 'СЛИШКОМ МНОГО категорий (>5)',
        });
      }

      // Показываем примеры маппинга
      if (product.id <= 5 || issues.length < 5) {
        console.log(`  ${product.name}`);
        console.log(`    Step: ${product.step || 'null'}, Category: ${product.category || 'null'}`);
        console.log(`    → Маппится на: ${mappedCategories.join(', ') || 'НИЧЕГО'}`);
      }
    }
  }

  // Проверяем конкретного пользователя
  console.log('\n\n👤 Проверка для пользователя 643160759 (dry skin)...');
  console.log('─'.repeat(80));

  const user = await prisma.user.findFirst({
    where: { telegramId: '643160759' },
    select: { id: true },
  });

  if (user) {
    const session = await prisma.recommendationSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (session) {
      const productIds = session.products as number[];
      const userProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, step: true, category: true },
      });

      console.log(`\n📦 Продукты из RecommendationSession (${userProducts.length}):\n`);

      const productsByStepMap = new Map<StepCategory, Array<{ id: number; name: string }>>();

      for (const product of userProducts) {
        const mappedCategories = mapStepToStepCategory(product.step, product.category, 'dry');
        
        console.log(`  ${product.name}`);
        console.log(`    Step: ${product.step || 'null'}, Category: ${product.category || 'null'}`);
        console.log(`    → Маппится на: ${mappedCategories.join(', ') || 'НИЧЕГО'}`);

        if (mappedCategories.length === 0) {
          issues.push({
            productId: product.id,
            productName: product.name,
            step: product.step,
            category: product.category,
            skinType: 'dry',
            mappedCategories: [],
            issue: 'НЕ МАППИТСЯ для dry кожи',
          });
        }

        // Регистрируем в productsByStepMap
        for (const category of mappedCategories) {
          const existing = productsByStepMap.get(category) || [];
          productsByStepMap.set(category, [...existing, { id: product.id, name: product.name }]);
        }
      }

      console.log('\n\n📊 Распределение по шагам:');
      console.log('─'.repeat(80));
      for (const [step, products] of productsByStepMap.entries()) {
        console.log(`  ${step}: ${products.length} продукт(ов)`);
        products.forEach(p => console.log(`    - ${p.name} (ID: ${p.id})`));
      }

      // Проверяем, какие шаги из шаблона имеют продукты
      const templateSteps: StepCategory[] = [
        'cleanser_gentle',
        'serum_hydrating',
        'moisturizer_barrier',
        'spf_50_sensitive',
      ];

      console.log('\n\n✅ Проверка шагов шаблона dry_sensitive_barrier:');
      console.log('─'.repeat(80));
      for (const step of templateSteps) {
        const stepProducts = productsByStepMap.get(step) || [];
        if (stepProducts.length === 0) {
          console.log(`  ❌ ${step}: НЕТ ПРОДУКТОВ`);
        } else {
          console.log(`  ✅ ${step}: ${stepProducts.length} продукт(ов)`);
        }
      }
    }
  }

  // Выводим найденные проблемы
  if (issues.length > 0) {
    console.log('\n\n⚠️  НАЙДЕННЫЕ ПРОБЛЕМЫ:');
    console.log('═'.repeat(80));
    for (const issue of issues) {
      console.log(`\n  Продукт: ${issue.productName} (ID: ${issue.productId})`);
      console.log(`    Step: ${issue.step || 'null'}, Category: ${issue.category || 'null'}`);
      console.log(`    Тип кожи: ${issue.skinType}`);
      console.log(`    Проблема: ${issue.issue}`);
      console.log(`    Маппится на: ${issue.mappedCategories.join(', ') || 'НИЧЕГО'}`);
    }
  } else {
    console.log('\n\n✅ Проблем не найдено!');
  }

  await prisma.$disconnect();
}

checkProductStepMatching().catch(console.error);

