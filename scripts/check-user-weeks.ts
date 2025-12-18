// scripts/check-user-weeks.ts
// Скрипт для проверки weeks данных пользователя

import { prisma } from '../lib/db';

const telegramId = 287939646;

async function checkWeeks() {
  try {
    console.log(`\n🔍 Проверяю weeks данные для пользователя ${telegramId}\n`);

    const user = await prisma.user.findFirst({
      where: { telegramId: String(telegramId) },
    });

    if (!user) {
      console.error('❌ Пользователь не найден');
      return;
    }

    // Проверяем план
    const plan = await prisma.plan28.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan || !plan.planData) {
      console.error('❌ План не найден');
      return;
    }

    const planData = plan.planData as any;
    
    // Проверяем, есть ли weeks в planData
    if (planData.weeks) {
      console.log('📅 Weeks данные найдены:');
      planData.weeks.forEach((week: any, weekIdx: number) => {
        console.log(`\n   Неделя ${week.week}:`);
        if (week.days && week.days.length > 0) {
          const day1 = week.days[0];
          console.log(`     День ${day1.day}:`);
          console.log(`       Утро: ${day1.morning?.length || 0} шагов`);
          if (day1.morning) {
            day1.morning.forEach((step: string) => {
              console.log(`         - ${step}`);
            });
          }
          console.log(`       Вечер: ${day1.evening?.length || 0} шагов`);
          if (day1.evening) {
            day1.evening.forEach((step: string) => {
              console.log(`         - ${step}`);
            });
          }
        }
      });
    } else {
      console.log('❌ Weeks данные не найдены в planData');
    }

    // Проверяем plan28.days
    if (planData.days) {
      console.log('\n📅 Plan28 days данные:');
      const day1 = planData.days[0];
      if (day1) {
        console.log(`   День ${day1.dayIndex}:`);
        console.log(`     Утро: ${day1.morning?.length || 0} шагов`);
        if (day1.morning) {
          day1.morning.forEach((step: any) => {
            console.log(`       - ${step.stepCategory}${step.productId ? ` (продукт: ${step.productId})` : ' (без продукта)'}`);
          });
        }
        console.log(`     Вечер: ${day1.evening?.length || 0} шагов`);
        if (day1.evening) {
          day1.evening.forEach((step: any) => {
            console.log(`       - ${step.stepCategory}${step.productId ? ` (продукт: ${step.productId})` : ' (без продукта)'}`);
          });
        }
      }
    }

    console.log('\n✅ Проверка завершена\n');
  } catch (error: any) {
    console.error('❌ Ошибка:', error?.message);
    console.error(error?.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkWeeks();
