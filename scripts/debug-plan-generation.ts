// scripts/debug-plan-generation.ts
// Диагностика генерации плана

import { prisma } from '../lib/db';
import { generate28DayPlan } from '../lib/plan-generator';
import { logger } from '../lib/logger';

async function debugPlanGeneration() {
  const userId = 'cmieq8w2v0000js0480u0n0ax'; // Правильный userId для telegramId 643160759
  
  console.log('🔍 Начинаем диагностику генерации плана...\n');
  
  // 1. Проверяем профиль
  const profile = await prisma.skinProfile.findFirst({
    where: { userId },
    orderBy: { version: 'desc' },
  });
  
  if (!profile) {
    console.error('❌ Профиль не найден');
    await prisma.$disconnect();
    return;
  }
  
  console.log('✅ Профиль найден:', {
    id: profile.id,
    version: profile.version,
    createdAt: profile.createdAt,
  });
  
  // 2. Проверяем RecommendationSession
  const session = await prisma.recommendationSession.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  
  if (!session) {
    console.error('❌ RecommendationSession не найдена');
  } else {
    const products = Array.isArray(session.products) ? session.products : [];
    console.log('✅ RecommendationSession найдена:', {
      productsCount: products.length,
      productIds: products,
    });
  }
  
  // 3. Проверяем ответы
  const answersCount = await prisma.userAnswer.count({
    where: { userId },
  });
  console.log('✅ Ответов:', answersCount);
  
  // 4. Пытаемся сгенерировать план с детальным логированием
  console.log('\n🔄 Начинаем генерацию плана...\n');
  
  try {
    const plan = await generate28DayPlan(userId);
    
    console.log('\n✅ План сгенерирован!');
    console.log('Структура плана:', {
      hasPlan28: !!plan.plan28,
      plan28DaysCount: plan.plan28?.days?.length || 0,
      hasWeeks: !!plan.weeks,
      weeksCount: plan.weeks?.length || 0,
      productsCount: plan.products?.length || 0,
      planKeys: Object.keys(plan),
    });
    
    if (plan.plan28?.days) {
      const daysWithProducts = plan.plan28.days.filter(d => 
        d.morning.some(s => s.productId) || 
        d.evening.some(s => s.productId)
      );
      
      console.log('\n📊 Статистика дней:');
      console.log('  Всего дней:', plan.plan28.days.length);
      console.log('  Дней с продуктами:', daysWithProducts.length);
      console.log('  Дней без продуктов:', plan.plan28.days.length - daysWithProducts.length);
      
      // Проверяем первые 3 дня
      console.log('\n📅 Первые 3 дня:');
      plan.plan28.days.slice(0, 3).forEach((day, idx) => {
        console.log(`  День ${day.dayIndex}:`, {
          morningSteps: day.morning.length,
          morningWithProducts: day.morning.filter(s => s.productId).length,
          eveningSteps: day.evening.length,
          eveningWithProducts: day.evening.filter(s => s.productId).length,
        });
      });
    }
    
    if (plan.weeks) {
      console.log('\n📅 Недели:');
      plan.weeks.forEach((week, idx) => {
        console.log(`  Неделя ${week.week}:`, {
          daysCount: week.days.length,
          daysWithSteps: week.days.filter(d => d.morning.length > 0 || d.evening.length > 0).length,
        });
      });
    }
    
  } catch (error: any) {
    console.error('\n❌ Ошибка при генерации плана:');
    console.error('  Message:', error.message);
    console.error('  Stack:', error.stack);
    
    if (error.message?.includes('weeks array is empty')) {
      console.error('\n🔴 ПРОБЛЕМА: weeks массив пустой!');
    }
    
    if (error.message?.includes('no days generated')) {
      console.error('\n🔴 ПРОБЛЕМА: plan28Days пустой после генерации!');
    }
  }
  
  await prisma.$disconnect();
}

debugPlanGeneration().catch(console.error);
