// scripts/check-plan-for-user.ts
// Проверка плана для пользователя

import { prisma } from '../lib/db';

const telegramId = '643160759';

async function checkPlan() {
  console.log('🔍 Проверяю план для пользователя:', telegramId);
  
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, telegramId: true, firstName: true },
    });
    
    if (!user) {
      console.log('❌ Пользователь не найден');
      await prisma.$disconnect();
      return;
    }
    
    console.log('✅ Пользователь найден:', user.id);
    
    const profile = await prisma.skinProfile.findFirst({
      where: { userId: user.id },
      orderBy: { version: 'desc' },
    });
    
    if (!profile) {
      console.log('❌ Профиль не найден');
      await prisma.$disconnect();
      return;
    }
    
    console.log('✅ Профиль найден:', {
      id: profile.id,
      version: profile.version,
      skinType: profile.skinType,
    });
    
    const plan = await prisma.plan28.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!plan) {
      console.log('❌ Plan28 не найден в БД');
      await prisma.$disconnect();
      return;
    }
    
    console.log('✅ Plan28 найден:', {
      id: plan.id,
      profileVersion: plan.profileVersion,
      daysCount: plan.days?.length || 0,
      createdAt: plan.createdAt,
    });
    
    if (plan.days && Array.isArray(plan.days)) {
      const productIds = new Set<number>();
      plan.days.forEach((day: any) => {
        if (day.morning) {
          day.morning.forEach((step: any) => {
            if (step.productId) productIds.add(Number(step.productId));
          });
        }
        if (day.evening) {
          day.evening.forEach((step: any) => {
            if (step.productId) productIds.add(Number(step.productId));
          });
        }
        if (day.weekly) {
          day.weekly.forEach((step: any) => {
            if (step.productId) productIds.add(Number(step.productId));
          });
        }
      });
      
      console.log('📦 Уникальных продуктов в плане:', productIds.size);
      
      if (productIds.size < 3) {
        console.log('⚠️ В плане меньше 3 продуктов - это может быть причиной проблемы');
      }
    }
    
    // Проверяем соответствие версий
    if (plan.profileVersion !== profile.version) {
      console.log('⚠️ ВНИМАНИЕ: Версия плана не совпадает с версией профиля!');
      console.log(`   План версия: ${plan.profileVersion}, Профиль версия: ${profile.version}`);
    } else {
      console.log('✅ Версии совпадают');
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkPlan()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
