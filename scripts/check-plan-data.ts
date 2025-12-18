// scripts/check-plan-data.ts
// Проверка данных плана в БД

import { prisma } from '../lib/db';

const telegramId = '643160759';

async function checkPlanData() {
  console.log('🔍 Проверяю данные плана для пользователя:', telegramId);
  
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });
    
    if (!user) {
      console.log('❌ Пользователь не найден');
      await prisma.$disconnect();
      return;
    }
    
    const plan = await prisma.plan28.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!plan) {
      console.log('❌ Plan28 не найден');
      await prisma.$disconnect();
      return;
    }
    
    console.log('✅ Plan28 найден:', {
      id: plan.id,
      profileVersion: plan.profileVersion,
    });
    
    // Проверяем структуру planData
    const planData = plan.planData as any;
    console.log('\n📊 Структура planData:');
    console.log('   Тип:', typeof planData);
    console.log('   Ключи:', planData ? Object.keys(planData) : 'null');
    
    if (planData && typeof planData === 'object') {
      if (planData.days) {
        console.log('   ✅ days найден');
        console.log('   Тип days:', typeof planData.days);
        console.log('   days - это массив?', Array.isArray(planData.days));
        if (Array.isArray(planData.days)) {
          console.log('   Длина days:', planData.days.length);
          if (planData.days.length > 0) {
            console.log('   Первый день:', JSON.stringify(planData.days[0], null, 2).substring(0, 200));
          }
        }
      } else {
        console.log('   ❌ days НЕ найден в planData');
      }
      
      if (planData.mainGoals) {
        console.log('   ✅ mainGoals найден:', planData.mainGoals);
      }
    }
    
    // Проверяем, как план читается через Prisma
    // В схеме Prisma planData это Json, поэтому он должен автоматически парситься
    console.log('\n📖 Проверка чтения через Prisma:');
    const planFromDb = await prisma.plan28.findFirst({
      where: { userId: user.id },
      select: {
        id: true,
        planData: true,
      },
    });
    
    if (planFromDb && planFromDb.planData) {
      const data = planFromDb.planData as any;
      console.log('   Тип planData после чтения:', typeof data);
      if (data && typeof data === 'object') {
        console.log('   Ключи:', Object.keys(data));
        if (data.days) {
          console.log('   days найден, длина:', Array.isArray(data.days) ? data.days.length : 'не массив');
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkPlanData()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
