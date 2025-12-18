// scripts/diagnose-plan-products.ts
// Диагностика проблемы с продуктами в плане

import { PrismaClient } from '@prisma/client';
import { getBaseStepFromStepCategory } from '../lib/plan-helpers';

const prisma = new PrismaClient();

async function diagnosePlanProducts() {
  const telegramId = process.argv[2] || '643160759';
  
  console.log(`\n🔍 Диагностика продуктов в плане для пользователя ${telegramId}\n`);
  
  try {
    const user = await prisma.user.findFirst({
      where: { telegramId },
    });

    if (!user) {
      console.error('❌ Пользователь не найден');
      process.exit(1);
    }

    // Проверяем RecommendationSession
    const session = await prisma.recommendationSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        rule: true,
      },
    });

    if (!session) {
      console.error('❌ Сессия не найдена');
      process.exit(1);
    }

    console.log(`✅ Сессия найдена: ${session.id}`);
    console.log(`   Правило: ${session.rule?.name || 'нет'}`);
    console.log(`   Продуктов в сессии: ${Array.isArray(session.products) ? session.products.length : 0}`);
    
    const productIds = Array.from(new Set(session.products as number[]));
    console.log(`   Уникальных продуктов: ${productIds.length}`);
    console.log(`   ID продуктов: ${JSON.stringify(productIds)}\n`);

    // Загружаем продукты
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { brand: true },
    });

    console.log(`📦 Продукты из сессии:\n`);
    products.forEach((product, idx) => {
      console.log(`   ${idx + 1}. ${product.name} (ID: ${product.id})`);
      console.log(`      Бренд: ${product.brand.name}`);
      console.log(`      Step: ${product.step || 'нет'}`);
      console.log(`      Category: ${product.category || 'нет'}`);
      
      // Проверяем маппинг
      const stepStr = (product.step || product.category || '').toLowerCase();
      const categoryStr = (product.category || '').toLowerCase();
      
      const mappedSteps: string[] = [];
      
      // Маппинг как в mapStepToStepCategory
      if (stepStr.startsWith('cleanser_gentle') || categoryStr.includes('gentle')) {
        mappedSteps.push('cleanser_gentle');
      } else if (stepStr.startsWith('cleanser')) {
        mappedSteps.push('cleanser_gentle', 'cleanser_balancing', 'cleanser_deep');
      }
      
      if (stepStr.startsWith('moisturizer_light') || categoryStr.includes('light')) {
        mappedSteps.push('moisturizer_light');
      } else if (stepStr.startsWith('moisturizer')) {
        mappedSteps.push('moisturizer_light', 'moisturizer_balancing');
      }
      
      if (stepStr.startsWith('spf_50_face') || stepStr === 'spf' || categoryStr === 'spf') {
        mappedSteps.push('spf_50_face');
      }
      
      console.log(`      Маппится на: ${mappedSteps.length > 0 ? mappedSteps.join(', ') : 'НЕ МАППИТСЯ'}`);
      console.log('');
    });

    // Проверяем, какие шаги нужны для атопического дерматита
    console.log(`📋 Требуемые шаги для атопического дерматита в ремиссии:\n`);
    const requiredSteps = [
      'cleanser_gentle',
      'serum_hydrating',
      'moisturizer_barrier',
      'spf_50_face',
      'moisturizer_soothing',
    ];
    
    requiredSteps.forEach(step => {
      const hasProduct = products.some(p => {
        const mapped = mappedStepsForProduct(p);
        return mapped.includes(step as any);
      });
      console.log(`   ${hasProduct ? '✅' : '❌'} ${step}`);
    });

    console.log(`\n🔍 Анализ:\n`);
    const missingSteps = requiredSteps.filter(step => {
      return !products.some(p => {
        const mapped = mappedStepsForProduct(p);
        return mapped.includes(step as any);
      });
    });
    
    if (missingSteps.length > 0) {
      console.log(`   Отсутствуют продукты для шагов: ${missingSteps.join(', ')}`);
      console.log(`   Это объясняет, почему в плане только ${products.length} средства`);
    } else {
      console.log(`   Все шаги покрыты продуктами из сессии`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function mappedStepsForProduct(product: any): string[] {
  const stepStr = (product.step || product.category || '').toLowerCase();
  const categoryStr = (product.category || '').toLowerCase();
  const mapped: string[] = [];
  
  if (stepStr.startsWith('cleanser_gentle') || categoryStr.includes('gentle')) {
    mapped.push('cleanser_gentle');
  } else if (stepStr.startsWith('cleanser_balancing')) {
    mapped.push('cleanser_balancing');
  } else if (stepStr.startsWith('cleanser_deep')) {
    mapped.push('cleanser_deep');
  } else if (stepStr.startsWith('cleanser')) {
    mapped.push('cleanser_gentle', 'cleanser_balancing', 'cleanser_deep');
  }
  
  if (stepStr.startsWith('moisturizer_light') || categoryStr.includes('light')) {
    mapped.push('moisturizer_light');
  } else if (stepStr.startsWith('moisturizer_balancing')) {
    mapped.push('moisturizer_balancing');
  } else if (stepStr.startsWith('moisturizer_barrier')) {
    mapped.push('moisturizer_barrier');
  } else if (stepStr.startsWith('moisturizer_soothing')) {
    mapped.push('moisturizer_soothing');
  } else if (stepStr.startsWith('moisturizer')) {
    mapped.push('moisturizer_light', 'moisturizer_balancing');
  }
  
  if (stepStr.startsWith('spf_50_face') || stepStr === 'spf' || categoryStr === 'spf') {
    mapped.push('spf_50_face');
  }
  
  return mapped;
}

diagnosePlanProducts();

