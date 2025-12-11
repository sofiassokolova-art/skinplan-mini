// scripts/check-plan-mapping.ts
// Проверка маппинга продуктов из RecommendationSession на шаги плана

import { prisma } from '../lib/db';
import { generate28DayPlan } from '../lib/plan-generator';

const telegramId = process.argv[2] || '643160759';

async function checkPlanMapping() {
  console.log(`🔍 Проверяю маппинг продуктов для пользователя: ${telegramId}\n`);
  
  try {
    // Находим пользователя
    const user = await prisma.user.findFirst({
      where: { telegramId },
      select: { id: true, telegramId: true, firstName: true },
    });
    
    if (!user) {
      console.log('❌ Пользователь не найден');
      await prisma.$disconnect();
      return;
    }
    
    console.log('✅ Пользователь найден:', {
      userId: user.id,
      telegramId: user.telegramId,
      name: user.firstName,
    });
    console.log('');
    
    // Проверяем RecommendationSession
    const session = await prisma.recommendationSession.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        rule: {
          select: { name: true, stepsJson: true },
        },
      },
    });
    
    if (!session || !Array.isArray(session.products)) {
      console.log('❌ RecommendationSession не найдена');
      await prisma.$disconnect();
      return;
    }
    
    console.log('💾 RecommendationSession:');
    console.log('   ID:', session.id);
    console.log('   Rule:', session.rule?.name);
    console.log('   Products:', session.products.length);
    console.log('');
    
    // Получаем продукты
    const productIds = session.products as number[];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { 
        id: true, 
        name: true, 
        step: true, 
        category: true,
        brand: {
          select: { name: true, isActive: true },
        },
      },
    });
    
    console.log('📦 Продукты из RecommendationSession:');
    products.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ID ${p.id}: ${p.name}`);
      console.log(`      step: ${p.step || 'null'}, category: ${p.category || 'null'}`);
    });
    console.log('');
    
    // Проверяем текущий план
    const profile = await prisma.skinProfile.findFirst({
      where: { userId: user.id },
      orderBy: { version: 'desc' },
    });
    
    if (!profile) {
      console.log('❌ Профиль не найден');
      await prisma.$disconnect();
      return;
    }
    
    const plan = await prisma.plan28.findFirst({
      where: { userId: user.id, profileVersion: profile.version },
    });
    
    if (!plan) {
      console.log('❌ План не найден');
      await prisma.$disconnect();
      return;
    }
    
    const planData = plan.planData as any;
    
    console.log('📅 Текущий план:');
    console.log('   Profile Version:', plan.profileVersion);
    console.log('   Days:', planData?.days?.length || 0);
    console.log('');
    
    // Проверяем шаги в первом дне
    if (planData?.days?.[0]) {
      const day1 = planData.days[0];
      
      console.log('📋 Шаги в первом дне:');
      
      const allSteps = new Set<string>();
      const stepsWithProducts = new Map<string, number[]>();
      
      if (day1.morning && Array.isArray(day1.morning)) {
        console.log('   Morning:');
        day1.morning.forEach((step: any) => {
          const stepCategory = step.stepCategory || 'unknown';
          const productId = step.productId ? Number(step.productId) : null;
          allSteps.add(stepCategory);
          
          if (productId) {
            if (!stepsWithProducts.has(stepCategory)) {
              stepsWithProducts.set(stepCategory, []);
            }
            stepsWithProducts.get(stepCategory)!.push(productId);
          }
          
          console.log(`      - ${stepCategory}: productId ${productId || 'нет'} ${productId ? `(${products.find(p => p.id === productId)?.name || 'unknown'})` : ''}`);
        });
      }
      
      if (day1.evening && Array.isArray(day1.evening)) {
        console.log('   Evening:');
        day1.evening.forEach((step: any) => {
          const stepCategory = step.stepCategory || 'unknown';
          const productId = step.productId ? Number(step.productId) : null;
          allSteps.add(stepCategory);
          
          if (productId) {
            if (!stepsWithProducts.has(stepCategory)) {
              stepsWithProducts.set(stepCategory, []);
            }
            stepsWithProducts.get(stepCategory)!.push(productId);
          }
          
          console.log(`      - ${stepCategory}: productId ${productId || 'нет'} ${productId ? `(${products.find(p => p.id === productId)?.name || 'unknown'})` : ''}`);
        });
      }
      
      console.log('');
      console.log('📊 Статистика:');
      console.log(`   Всего уникальных шагов: ${allSteps.size}`);
      console.log(`   Шагов с продуктами: ${stepsWithProducts.size}`);
      console.log(`   Шагов без продуктов: ${Array.from(allSteps).filter(s => !stepsWithProducts.has(s)).length}`);
      console.log('');
      
      // Проверяем, какие продукты используются
      const usedProductIds = new Set<number>();
      stepsWithProducts.forEach((ids) => {
        ids.forEach(id => usedProductIds.add(id));
      });
      
      console.log('📦 Используемые продукты:');
      console.log(`   Всего уникальных продуктов в плане: ${usedProductIds.size}`);
      usedProductIds.forEach(productId => {
        const product = products.find(p => p.id === productId);
        if (product) {
          console.log(`   - ID ${product.id}: ${product.name} (step: ${product.step}, category: ${product.category})`);
        } else {
          console.log(`   - ID ${productId}: НЕ НАЙДЕН В RECOMMENDATION SESSION`);
        }
      });
      console.log('');
      
      // Проверяем, какие продукты из RecommendationSession НЕ используются
      const unusedProducts = products.filter(p => !usedProductIds.has(p.id));
      if (unusedProducts.length > 0) {
        console.log('⚠️  Продукты из RecommendationSession, которые НЕ используются в плане:');
        unusedProducts.forEach(p => {
          console.log(`   - ID ${p.id}: ${p.name} (step: ${p.step}, category: ${p.category})`);
        });
        console.log('');
      }
      
      // Проверяем шаги без продуктов
      const stepsWithoutProducts = Array.from(allSteps).filter(s => !stepsWithProducts.has(s));
      if (stepsWithoutProducts.length > 0) {
        console.log('⚠️  Шаги без продуктов:');
        stepsWithoutProducts.forEach(step => {
          console.log(`   - ${step}`);
        });
        console.log('');
      }
    }
    
    // Проверяем маппинг через mapStepToStepCategory (симуляция)
    console.log('🔍 Проверка маппинга step/category -> StepCategory:');
    const stepMapping = new Map<string, string[]>();
    
    products.forEach(p => {
      const step = p.step || '';
      const category = p.category || '';
      
      // Симулируем mapStepToStepCategory
      const mappedCategories: string[] = [];
      const stepStr = step.toLowerCase();
      const categoryStr = category.toLowerCase();
      
      // Cleanser
      if (stepStr.startsWith('cleanser_gentle') || categoryStr.includes('gentle')) {
        mappedCategories.push('cleanser_gentle');
      } else if (stepStr.startsWith('cleanser_balancing') || stepStr.includes('balancing')) {
        mappedCategories.push('cleanser_balancing');
      } else if (stepStr.startsWith('cleanser')) {
        mappedCategories.push('cleanser_gentle', 'cleanser_balancing');
      }
      
      // Toner
      if (stepStr.startsWith('toner_hydrating') || categoryStr.includes('hydrating')) {
        mappedCategories.push('toner_hydrating');
      } else if (stepStr.startsWith('toner_soothing') || stepStr.includes('soothing')) {
        mappedCategories.push('toner_soothing');
      } else if (stepStr.startsWith('toner')) {
        mappedCategories.push('toner_hydrating', 'toner_soothing');
      }
      
      // Serum
      if (stepStr.startsWith('serum_hydrating') || categoryStr.includes('hydrating')) {
        mappedCategories.push('serum_hydrating');
      } else if (stepStr.startsWith('serum_niacinamide') || stepStr.includes('niacinamide')) {
        mappedCategories.push('serum_niacinamide');
      } else if (stepStr.startsWith('serum')) {
        mappedCategories.push('serum_hydrating', 'serum_niacinamide');
      }
      
      // Moisturizer
      if (stepStr.startsWith('moisturizer_light') || categoryStr.includes('light')) {
        mappedCategories.push('moisturizer_light');
      } else if (stepStr.startsWith('moisturizer_barrier') || stepStr.includes('barrier')) {
        mappedCategories.push('moisturizer_barrier');
      } else if (stepStr.startsWith('moisturizer_balancing') || stepStr.includes('balancing')) {
        mappedCategories.push('moisturizer_balancing');
      } else if (stepStr.startsWith('moisturizer')) {
        mappedCategories.push('moisturizer_light', 'moisturizer_balancing');
      }
      
      // SPF
      if (stepStr.startsWith('spf_50_face') || stepStr === 'spf' || categoryStr === 'spf') {
        mappedCategories.push('spf_50_face');
      } else if (stepStr.startsWith('spf_50_sensitive') || stepStr.includes('sensitive')) {
        mappedCategories.push('spf_50_sensitive');
      } else if (stepStr.startsWith('spf')) {
        mappedCategories.push('spf_50_face', 'spf_50_sensitive');
      }
      
      if (mappedCategories.length === 0) {
        mappedCategories.push('unknown');
      }
      
      stepMapping.set(`${p.id}:${p.name}`, mappedCategories);
    });
    
    console.log('   Маппинг продуктов:');
    stepMapping.forEach((categories, key) => {
      const [id, name] = key.split(':');
      const product = products.find(p => p.id === Number(id));
      console.log(`   - ID ${id}: ${name}`);
      console.log(`     step: ${product?.step || 'null'}, category: ${product?.category || 'null'}`);
      console.log(`     -> ${categories.join(', ')}`);
    });
    console.log('');
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkPlanMapping()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
