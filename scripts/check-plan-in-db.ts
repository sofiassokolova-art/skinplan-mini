// scripts/check-plan-in-db.ts
// Проверка плана в БД для пользователя

import { prisma } from '../lib/db';

async function checkPlanInDB(telegramId: string) {
  console.log(`\n🔍 Проверка плана в БД для пользователя ${telegramId}\n`);

  try {
    const user = await prisma.user.findFirst({
      where: { telegramId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!user) {
      console.error(`❌ Пользователь с Telegram ID "${telegramId}" не найден`);
      process.exit(1);
    }

    console.log(`✅ Пользователь: ${user.firstName} ${user.lastName || ''} (ID: ${user.id})\n`);

    // Проверяем Plan28 напрямую
    const plan28 = await prisma.plan28.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (plan28) {
      console.log(`✅ Plan28 найден!`);
      console.log(`   ID: ${plan28.id}`);
      console.log(`   SkinProfile ID: ${plan28.skinProfileId}`);
      console.log(`   Profile Version: ${plan28.profileVersion}`);
      console.log(`   Создан: ${plan28.createdAt.toISOString()}`);
      console.log(`   Обновлен: ${plan28.updatedAt.toISOString()}`);
      
      // План хранится в planData как JSON
      const planData = plan28.planData as any;
      if (planData && planData.days && Array.isArray(planData.days)) {
        console.log(`\n📅 План данных:`);
        console.log(`   Дней: ${planData.days.length}`);
        
        if (planData.days.length > 0) {
          console.log(`\n   Первые 3 дня:`);
          planData.days.slice(0, 3).forEach((day: any, idx: number) => {
            const morningSteps = day.morning || [];
            const eveningSteps = day.evening || [];
            const weeklySteps = day.weekly || [];
            console.log(`   День ${day.day || idx + 1}:`);
            console.log(`      Утро: ${morningSteps.length} шагов`);
            if (morningSteps.length > 0) {
              morningSteps.slice(0, 3).forEach((step: any, stepIdx: number) => {
                console.log(`         ${stepIdx + 1}. ${step.stepCategory} (productId: ${step.productId || 'нет'})`);
              });
            }
            console.log(`      Вечер: ${eveningSteps.length} шагов`);
            if (eveningSteps.length > 0) {
              eveningSteps.slice(0, 3).forEach((step: any, stepIdx: number) => {
                console.log(`         ${stepIdx + 1}. ${step.stepCategory} (productId: ${step.productId || 'нет'})`);
              });
            }
          });
        }
      } else {
        console.log(`   ⚠️ План данных пустой или некорректный`);
        console.log(`   Тип planData: ${typeof planData}`);
        console.log(`   Ключи: ${planData ? Object.keys(planData).join(', ') : 'null'}`);
      }
    } else {
      console.log(`❌ Plan28 НЕ найден в БД`);
    }

    // Проверяем PlanProgress
    const planProgress = await prisma.planProgress.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (planProgress) {
      console.log(`\n✅ PlanProgress найден!`);
      console.log(`   ID: ${planProgress.id}`);
      console.log(`   Plan28 ID: ${planProgress.plan28Id}`);
      console.log(`   Текущий день: ${planProgress.currentDay}`);
      console.log(`   Создан: ${planProgress.createdAt.toISOString()}`);
    } else {
      console.log(`\n❌ PlanProgress НЕ найден`);
    }

  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const telegramIdArg = process.argv[2] || '643160759';
checkPlanInDB(telegramIdArg)
  .then(() => {
    console.log('\n✅ Проверка завершена\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения:', error);
    process.exit(1);
  });
