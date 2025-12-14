// scripts/fix-missing-plan-progress.ts
// Создание PlanProgress для пользователей, у которых есть Plan28, но нет PlanProgress

import { prisma } from '../lib/db';

async function fixMissingPlanProgress(telegramId?: string) {
  console.log(`\n🔧 Исправление отсутствующих PlanProgress...\n`);

  try {
    let userIds: string[];

    if (telegramId) {
      // Для конкретного пользователя
      const user = await prisma.user.findFirst({
        where: { telegramId },
        select: { id: true, firstName: true },
      });

      if (!user) {
        console.error(`❌ Пользователь с Telegram ID "${telegramId}" не найден`);
        process.exit(1);
      }

      userIds = [user.id];
      console.log(`✅ Пользователь найден: ${user.firstName} (ID: ${user.id})\n`);
    } else {
      // Для всех пользователей с Plan28, но без PlanProgress
      const usersWithPlan28 = await prisma.plan28.findMany({
        select: { userId: true },
        distinct: ['userId'],
      });

      userIds = usersWithPlan28.map((p) => p.userId);
      console.log(`📊 Найдено пользователей с Plan28: ${userIds.length}\n`);
    }

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const userId of userIds) {
      try {
        // Проверяем, есть ли PlanProgress
        const existingProgress = await prisma.planProgress.findUnique({
          where: { userId },
        });

        if (existingProgress) {
          console.log(`⏭️  Пользователь ${userId}: PlanProgress уже существует`);
          skipped++;
          continue;
        }

        // Проверяем, есть ли Plan28
        const plan28 = await prisma.plan28.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        if (!plan28) {
          console.log(`⚠️  Пользователь ${userId}: Plan28 не найден, пропускаем`);
          skipped++;
          continue;
        }

        // Создаем PlanProgress
        const planProgress = await prisma.planProgress.create({
          data: {
            userId,
            currentDay: 1,
            completedDays: [],
            currentStreak: 0,
            longestStreak: 0,
            totalCompletedDays: 0,
          },
        });

        console.log(`✅ Пользователь ${userId}: PlanProgress создан (ID: ${planProgress.id})`);
        fixed++;
      } catch (error: any) {
        console.error(`❌ Пользователь ${userId}: Ошибка - ${error.message}`);
        errors++;
      }
    }

    console.log(`\n📊 Результаты:`);
    console.log(`   ✅ Исправлено: ${fixed}`);
    console.log(`   ⏭️  Пропущено: ${skipped}`);
    console.log(`   ❌ Ошибок: ${errors}`);

  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const telegramIdArg = process.argv[2];
fixMissingPlanProgress(telegramIdArg)
  .then(() => {
    console.log('\n✅ Готово!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения:', error);
    process.exit(1);
  });
