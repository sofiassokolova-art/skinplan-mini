// scripts/reset-user.ts
// Сброс всех данных пользователя для тестирования

import { prisma } from '../lib/db';

async function resetUser() {
  const telegramId = '643160759';

  console.log(`🔄 Сбрасываю все данные для пользователя ${telegramId}...`);

  try {
    // Находим пользователя
    const user = await prisma.user.findFirst({
      where: { telegramId },
    });

    if (!user) {
      console.log('❌ Пользователь не найден.');
      return;
    }

    console.log(`\n👤 Пользователь: ${user.firstName} (${user.id})`);

    // 1. Удаляем ответы на анкету
    const deletedAnswers = await prisma.userAnswer.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено ответов: ${deletedAnswers.count}`);

    // 2. Удаляем прогресс анкеты
    const deletedProgress = await prisma.questionnaireProgress.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено записей прогресса анкеты: ${deletedProgress.count}`);

    // 3. Удаляем прогресс плана
    const deletedPlanProgress = await prisma.planProgress.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено записей прогресса плана: ${deletedPlanProgress.count}`);

    // 4. Удаляем планы
    const deletedPlans = await prisma.plan28.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено планов: ${deletedPlans.count}`);

    // 5. Удаляем рекомендации
    const deletedRecommendations = await prisma.recommendationSession.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено сессий рекомендаций: ${deletedRecommendations.count}`);

    // 6. Удаляем профили кожи
    const deletedProfiles = await prisma.skinProfile.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено профилей кожи: ${deletedProfiles.count}`);

    // 7. Удаляем корзину
    const deletedCart = await prisma.cart.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено товаров из корзины: ${deletedCart.count}`);

    // 8. Удаляем вишлист
    const deletedWishlist = await prisma.wishlist.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено товаров из вишлиста: ${deletedWishlist.count}`);

    // 9. Сбрасываем настройки пользователя
    const existingPrefs = await prisma.userPreferences.findUnique({
      where: { userId: user.id },
    });

    if (existingPrefs) {
      await prisma.userPreferences.update({
        where: { userId: user.id },
        data: {
          hasPlanProgress: false,
          isRetakingQuiz: false,
          fullRetakeFromHome: false,
          paymentRetakingCompleted: false,
          paymentFullRetakeCompleted: false,
          extra: {},
        },
      });
      console.log(`✅ Настройки пользователя сброшены`);
    }

    // 10. Удаляем логи (опционально)
    const deletedLogs = await prisma.clientLog.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено логов: ${deletedLogs.count}`);

    console.log('\n✅ Все данные пользователя успешно сброшены!');
    console.log('📱 Теперь при входе в приложение пользователь увидит начальные экраны анкеты.');

  } catch (error: unknown) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetUser()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
