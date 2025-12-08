// scripts/reset-user-to-new.ts
// Сброс данных конкретного пользователя (как новый)

import { prisma } from '../lib/db';

async function resetUserToNew(telegramId: string) {
  console.log(`🔄 Сбрасываю данные для пользователя ${telegramId}...\n`);

  try {
    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, telegramId: true, name: true },
    });

    if (!user) {
      console.error(`❌ Пользователь с telegramId ${telegramId} не найден`);
      process.exit(1);
    }

    console.log(`✅ Пользователь найден: ${user.name || 'N/A'} (${user.id})`);

    // Удаляем все данные пользователя в правильном порядке (из-за foreign keys)
    
    // 1. Удаляем ответы на вопросы анкеты
    console.log('🗑️  Удаляю ответы на вопросы анкеты...');
    const deletedAnswers = await prisma.questionnaireAnswer.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено ответов: ${deletedAnswers.count}`);

    // 2. Удаляем прогресс анкеты
    console.log('🗑️  Удаляю прогресс анкеты...');
    const deletedProgress = await prisma.questionnaireProgress.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено прогрессов: ${deletedProgress.count}`);

    // 3. Удаляем RecommendationSession
    console.log('🗑️  Удаляю RecommendationSession...');
    const deletedSessions = await prisma.recommendationSession.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено сессий: ${deletedSessions.count}`);

    // 4. Удаляем планы
    console.log('🗑️  Удаляю планы...');
    const deletedPlans = await prisma.skinPlan.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено планов: ${deletedPlans.count}`);

    // 5. Удаляем профили кожи
    console.log('🗑️  Удаляю профили кожи...');
    const deletedProfiles = await prisma.skinProfile.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено профилей: ${deletedProfiles.count}`);

    // 6. Удаляем клиентские логи (опционально, можно оставить для диагностики)
    console.log('🗑️  Удаляю клиентские логи...');
    const deletedLogs = await prisma.clientLog.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено логов: ${deletedLogs.count}`);

    // 7. Удаляем корзину (если есть)
    console.log('🗑️  Удаляю корзину...');
    const deletedCart = await prisma.cart.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено корзин: ${deletedCart.count}`);

    // 8. Удаляем избранное (если есть)
    console.log('🗑️  Удаляю избранное...');
    const deletedFavorites = await prisma.favorite.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено избранного: ${deletedFavorites.count}`);

    // ВАЖНО: Пользователя НЕ удаляем - только его данные

    console.log('\n✅ Все данные пользователя успешно удалены!');
    console.log(`   Пользователь ${user.name || telegramId} теперь как новый.\n`);

  } catch (error: any) {
    console.error('❌ Ошибка при сбросе данных:', error);
    console.error('   Message:', error?.message);
    console.error('   Code:', error?.code);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем telegramId из аргументов командной строки
const telegramId = process.argv[2];

if (!telegramId) {
  console.error('❌ Укажите telegramId пользователя');
  console.error('   Использование: npx tsx scripts/reset-user-to-new.ts <telegramId>');
  console.error('   Пример: npx tsx scripts/reset-user-to-new.ts 643160759');
  process.exit(1);
}

resetUserToNew(telegramId)
  .then(() => {
    console.log('✅ Готово!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
