// scripts/clear-all-test-data.ts
// Удаление всех тестовых данных и данных пользователя

import { prisma } from '../lib/db';
import { invalidateAllUserCache } from '../lib/cache';

async function clearAllTestData() {
  console.log('🗑️  Удаление всех тестовых данных...\n');

  try {
    // 1. Находим всех тестовых пользователей
    const testUsers = await prisma.user.findMany({
      where: {
        telegramId: { startsWith: 'test_client_' },
      },
      select: { id: true, telegramId: true, firstName: true },
    });

    console.log(`📊 Найдено тестовых пользователей: ${testUsers.length}`);

    if (testUsers.length > 0) {
      console.log('\n📋 Удаляю тестовых пользователей:');
      for (const user of testUsers) {
        console.log(`   - ${user.firstName || ''} (${user.telegramId})`);
        
        // Очищаем кэш
        try {
          await invalidateAllUserCache(user.id);
        } catch (e) {
          // Игнорируем ошибки кэша
        }
      }

      // Удаляем все связанные данные тестовых пользователей
      const userIds = testUsers.map(u => u.id);

      console.log('\n🗑️  Удаляю связанные данные...');
      
      const deletedPlan28 = await prisma.plan28.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`   ✅ Plan28: ${deletedPlan28.count}`);

      const deletedProfiles = await prisma.skinProfile.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`   ✅ SkinProfile: ${deletedProfiles.count}`);

      const deletedAnswers = await prisma.userAnswer.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`   ✅ UserAnswer: ${deletedAnswers.count}`);

      const deletedSessions = await prisma.recommendationSession.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`   ✅ RecommendationSession: ${deletedSessions.count}`);

      const deletedProgress = await prisma.planProgress.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`   ✅ PlanProgress: ${deletedProgress.count}`);

      const deletedWishlist = await prisma.wishlist.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`   ✅ Wishlist: ${deletedWishlist.count}`);

      const deletedCart = await prisma.cart.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`   ✅ Cart: ${deletedCart.count}`);

      const deletedFeedback = await prisma.planFeedback.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`   ✅ PlanFeedback: ${deletedFeedback.count}`);

      const deletedLogs = await prisma.clientLog.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`   ✅ ClientLog: ${deletedLogs.count}`);

      // Удаляем самих пользователей
      const deletedUsers = await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
      console.log(`   ✅ Users: ${deletedUsers.count}`);

      console.log('\n✅ Все тестовые данные удалены!\n');
    } else {
      console.log('✅ Тестовых пользователей не найдено\n');
    }

    // 2. Удаляем данные основного пользователя (если нужно)
    const mainUserTelegramId = '643160759'; // Sofia
    const mainUser = await prisma.user.findUnique({
      where: { telegramId: mainUserTelegramId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (mainUser) {
      console.log(`\n🗑️  Удаляю данные пользователя: ${mainUser.firstName || ''} ${mainUser.lastName || ''} (${mainUserTelegramId})`);
      console.log(`   User ID: ${mainUser.id}\n`);

      // Очищаем кэш
      try {
        await invalidateAllUserCache(mainUser.id);
        console.log('   ✅ Кэш очищен');
      } catch (e) {
        console.log('   ⚠️  Ошибка очистки кэша (не критично)');
      }

      // Удаляем все данные пользователя
      const deletedPlan28 = await prisma.plan28.deleteMany({
        where: { userId: mainUser.id },
      });
      console.log(`   ✅ Plan28: ${deletedPlan28.count}`);

      const deletedProfiles = await prisma.skinProfile.deleteMany({
        where: { userId: mainUser.id },
      });
      console.log(`   ✅ SkinProfile: ${deletedProfiles.count}`);

      const deletedAnswers = await prisma.userAnswer.deleteMany({
        where: { userId: mainUser.id },
      });
      console.log(`   ✅ UserAnswer: ${deletedAnswers.count}`);

      const deletedSessions = await prisma.recommendationSession.deleteMany({
        where: { userId: mainUser.id },
      });
      console.log(`   ✅ RecommendationSession: ${deletedSessions.count}`);

      const deletedProgress = await prisma.planProgress.deleteMany({
        where: { userId: mainUser.id },
      });
      console.log(`   ✅ PlanProgress: ${deletedProgress.count}`);

      const deletedWishlist = await prisma.wishlist.deleteMany({
        where: { userId: mainUser.id },
      });
      console.log(`   ✅ Wishlist: ${deletedWishlist.count}`);

      const deletedCart = await prisma.cart.deleteMany({
        where: { userId: mainUser.id },
      });
      console.log(`   ✅ Cart: ${deletedCart.count}`);

      const deletedFeedback = await prisma.planFeedback.deleteMany({
        where: { userId: mainUser.id },
      });
      console.log(`   ✅ PlanFeedback: ${deletedFeedback.count}`);

      const deletedLogs = await prisma.clientLog.deleteMany({
        where: { userId: mainUser.id },
      });
      console.log(`   ✅ ClientLog: ${deletedLogs.count}`);

      console.log('\n✅ Все данные пользователя удалены!');
      console.log('   Пользователь теперь как новый - может пройти анкету заново.\n');
    } else {
      console.log(`\nℹ️  Пользователь с Telegram ID ${mainUserTelegramId} не найден\n`);
    }

    // 3. Итоговая статистика
    const remainingUsers = await prisma.user.count();
    const remainingProfiles = await prisma.skinProfile.count();
    const remainingPlans = await prisma.plan28.count();

    console.log('📊 ИТОГОВАЯ СТАТИСТИКА:');
    console.log(`   Пользователей в БД: ${remainingUsers}`);
    console.log(`   Профилей в БД: ${remainingProfiles}`);
    console.log(`   Планов в БД: ${remainingPlans}`);
    console.log('');

  } catch (error: any) {
    console.error('❌ Ошибка при удалении данных:', error);
    console.error('   Message:', error?.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearAllTestData()
  .then(() => {
    console.log('✅ Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения:', error);
    process.exit(1);
  });
