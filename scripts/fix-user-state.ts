// scripts/fix-user-state.ts
// Исправление состояния пользователя

import { prisma } from '../lib/db';

const TELEGRAM_ID = '643160759';

async function fixUserState() {
  console.log(`🔧 Исправляю состояние пользователя ${TELEGRAM_ID}...\n`);

  try {
    const user = await prisma.user.findFirst({
      where: { telegramId: TELEGRAM_ID },
      include: {
        userPreferences: true,
        plan28s: true,
        questionnaireProgress: true,
      },
    });

    if (!user) {
      console.log('❌ Пользователь не найден');
      return;
    }

    console.log(`👤 Пользователь: ${user.firstName} (${user.id})`);

    // 1. Удаляем прогресс анкеты
    if (user.questionnaireProgress.length > 0) {
      console.log('\n🗑️ Удаляю сохраненный прогресс анкеты...');
      const deleted = await prisma.questionnaireProgress.deleteMany({
        where: { userId: user.id },
      });
      console.log(`   Удалено записей: ${deleted.count}`);
    }

    // 2. Исправляем hasPlanProgress, если план есть
    if (user.plan28s.length > 0 && user.userPreferences && !user.userPreferences.hasPlanProgress) {
      console.log('\n✅ Исправляю hasPlanProgress (план есть, но флаг false)...');
      await prisma.userPreferences.update({
        where: { userId: user.id },
        data: { hasPlanProgress: true },
      });
      console.log('   hasPlanProgress установлен в true');
    }

    console.log('\n✅ Состояние пользователя исправлено');
    console.log('   Теперь при заходе на /quiz пользователь увидит инфо-экраны');

  } catch (error: any) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserState()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
