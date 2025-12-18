// scripts/clear-plan-and-recommendations.ts
// Скрипт для удаления плана и рекомендаций пользователя

import { PrismaClient } from '@prisma/client';
import { invalidateCache } from '../lib/cache';

const prisma = new PrismaClient();

async function clearPlanAndRecommendations() {
  const telegramId = process.argv[2] || '643160759';
  
  console.log(`\n🗑️  Очистка плана и рекомендаций для пользователя ${telegramId}\n`);
  
  try {
    const user = await prisma.user.findFirst({
      where: { telegramId: telegramId },
    });

    if (!user) {
      console.error(`❌ Пользователь с Telegram ID ${telegramId} не найден`);
      process.exit(1);
    }

    console.log(`✅ Пользователь найден: ${user.firstName} ${user.lastName || ''} (ID: ${user.id})\n`);

    // Получаем последний профиль для версии
    const profile = await prisma.skinProfile.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    // 1. Удаляем сессии рекомендаций
    console.log('📋 Удаляю сессии рекомендаций...');
    const sessionsDeleted = await prisma.recommendationSession.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено сессий: ${sessionsDeleted.count}`);

    // 2. Удаляем прогресс плана
    console.log('📋 Удаляю прогресс плана...');
    const progressDeleted = await prisma.planProgress.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено записей прогресса: ${progressDeleted.count}`);

    // 3. Удаляем отзывы на план
    console.log('📋 Удаляю отзывы на план...');
    const feedbackDeleted = await prisma.planFeedback.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено отзывов: ${feedbackDeleted.count}`);

    // 4. Инвалидируем кэш плана и рекомендаций
    if (profile) {
      console.log('📋 Инвалидирую кэш плана и рекомендаций...');
      try {
        await invalidateCache(user.id, profile.version);
        console.log(`   ✅ Кэш инвалидирован для версии ${profile.version}`);
      } catch (error) {
        console.warn(`   ⚠️  Ошибка при инвалидации кэша (может быть недоступен): ${error}`);
      }
    }

    // 5. Удаляем избранное (опционально, можно закомментировать если нужно сохранить)
    // console.log('📋 Удаляю избранное...');
    // const wishlistDeleted = await prisma.wishlist.deleteMany({
    //   where: { userId: user.id },
    // });
    // console.log(`   ✅ Удалено из избранного: ${wishlistDeleted.count}`);

    // Проверяем результат
    const finalSessionsCount = await prisma.recommendationSession.count({
      where: { userId: user.id },
    });
    const finalProgressCount = await prisma.planProgress.count({
      where: { userId: user.id },
    });

    console.log('\n🎉 Очистка завершена успешно!');
    console.log(`📊 Финальное количество сессий рекомендаций: ${finalSessionsCount}`);
    console.log(`📊 Финальное количество записей прогресса: ${finalProgressCount}`);
    console.log(`\n✅ Пользователь может пройти анкету заново и получить новый план и рекомендации\n`);

  } catch (error) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearPlanAndRecommendations()
  .catch((e) => {
    console.error('❌ Критическая ошибка:', e);
    process.exit(1);
  });

