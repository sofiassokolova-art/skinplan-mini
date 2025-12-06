// scripts/check-user-plan-status.ts
// Проверка статуса плана пользователя после перепрохождения анкеты

import { prisma } from '../lib/db';
import { getCachedPlan } from '../lib/cache';

async function checkUserPlanStatus(telegramId: string) {
  console.log(`\n🔍 Проверка статуса плана для пользователя ${telegramId}\n`);

  try {
    const user = await prisma.user.findFirst({
      where: { telegramId },
      include: {
        skinProfiles: {
          orderBy: { version: 'desc' },
        },
      },
    });

    if (!user) {
      console.error(`❌ Пользователь с Telegram ID "${telegramId}" не найден`);
      process.exit(1);
    }

    console.log(`✅ Пользователь: ${user.firstName} ${user.lastName || ''} (ID: ${user.id})\n`);

    // Проверяем все версии профилей
    console.log('📋 Версии профилей:');
    for (const profile of user.skinProfiles) {
      console.log(`   Версия ${profile.version}: ${profile.skinType} (создан: ${profile.createdAt.toISOString()})`);
      
      // Проверяем кэш плана для этой версии
      const cachedPlan = await getCachedPlan(user.id, profile.version);
      if (cachedPlan && cachedPlan.plan28) {
        const daysCount = cachedPlan.plan28.days?.length || 0;
        console.log(`      ✅ План в кэше: ${daysCount} дней`);
        
        // Проверяем количество средств в первом дне
        if (cachedPlan.plan28.days && cachedPlan.plan28.days.length > 0) {
          const day1 = cachedPlan.plan28.days[0];
          const morningCount = day1.morning?.length || 0;
          const eveningCount = day1.evening?.length || 0;
          const weeklyCount = day1.weekly?.length || 0;
          console.log(`         День 1: утро=${morningCount}, вечер=${eveningCount}, неделя=${weeklyCount}`);
          
          if (day1.morning) {
            console.log(`         Утро: ${day1.morning.map((s: any) => s.stepCategory).join(', ')}`);
          }
          if (day1.evening) {
            console.log(`         Вечер: ${day1.evening.map((s: any) => s.stepCategory).join(', ')}`);
          }
        }
      } else {
        console.log(`      ❌ План в кэше НЕ найден`);
      }
      
      // Проверяем сессии рекомендаций
      const sessions = await prisma.recommendationSession.findMany({
        where: {
          userId: user.id,
          profileId: profile.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      
      console.log(`      📦 Сессий рекомендаций: ${sessions.length}`);
      if (sessions.length > 0) {
        const lastSession = sessions[0];
        const productIds = Array.isArray(lastSession.products) ? lastSession.products as number[] : [];
        console.log(`         Последняя сессия (ID: ${lastSession.id}): ${productIds.length} продуктов`);
        if (lastSession.ruleId) {
          const rule = await prisma.recommendationRule.findUnique({
            where: { id: lastSession.ruleId },
            select: { name: true, stepsJson: true },
          });
          if (rule) {
            const steps = Object.keys(rule.stepsJson as Record<string, any>);
            console.log(`         Правило: "${rule.name}" (шаги: ${steps.join(', ')})`);
          }
        }
      }
    }

    // Проверяем последнюю версию профиля
    const latestProfile = user.skinProfiles[0];
    if (latestProfile) {
      console.log(`\n📊 Последняя версия профиля: ${latestProfile.version}`);
      
      // Проверяем, что план генерируется для последней версии
      console.log(`\n🔍 Проверка плана для последней версии:`);
      const cachedPlan = await getCachedPlan(user.id, latestProfile.version);
      
      if (cachedPlan && cachedPlan.plan28) {
        console.log(`   ✅ План найден в кэше`);
        const day1 = cachedPlan.plan28.days?.[0];
        if (day1) {
          console.log(`   📦 Средства в день 1:`);
          console.log(`      Утро: ${day1.morning?.length || 0} средств`);
          day1.morning?.forEach((step: any, idx: number) => {
            console.log(`         ${idx + 1}. ${step.stepCategory} (productId: ${step.productId || 'нет'})`);
          });
          console.log(`      Вечер: ${day1.evening?.length || 0} средств`);
          day1.evening?.forEach((step: any, idx: number) => {
            console.log(`         ${idx + 1}. ${step.stepCategory} (productId: ${step.productId || 'нет'})`);
          });
          console.log(`      Неделя: ${day1.weekly?.length || 0} средств`);
        }
      } else {
        console.log(`   ❌ План НЕ найден в кэше - нужно сгенерировать`);
      }
    }

    console.log('\n✅ Проверка завершена\n');

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const telegramIdArg = process.argv[2] || '643160759';
checkUserPlanStatus(telegramIdArg)
  .then(() => {
    console.log('✅ Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения:', error);
    process.exit(1);
  });
