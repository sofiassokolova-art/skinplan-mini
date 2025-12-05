// scripts/clear-all-user-data.ts
// Скрипт для полной очистки всех данных пользователя (как новый пользователь)

import { PrismaClient } from '@prisma/client';
import { invalidateCache, invalidateAllUserCache } from '../lib/cache';

const prisma = new PrismaClient();

async function clearAllUserData(telegramId: string) {
  console.log(`\n🗑️  ПОЛНАЯ ОЧИСТКА всех данных пользователя ${telegramId}\n`);
  
  try {
    const user = await prisma.user.findFirst({
      where: { telegramId },
      include: {
        skinProfiles: true,
      },
    });

    if (!user) {
      console.error(`❌ Пользователь с Telegram ID "${telegramId}" не найден`);
      process.exit(1);
    }

    console.log(`✅ Пользователь найден: ${user.firstName} ${user.lastName || ''} (ID: ${user.id})\n`);

    // Получаем все версии профилей для инвалидации кэша
    const profileVersions = user.skinProfiles.map(p => p.version);

    // 1. Удаляем ответы на анкету (UserAnswer)
    console.log('📋 Удаляю ответы на анкету...');
    const answersDeleted = await prisma.userAnswer.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено ответов: ${answersDeleted.count}`);

    // 2. Удаляем профили кожи (SkinProfile) - это удалит все связанные данные
    console.log('📋 Удаляю профили кожи...');
    const profilesDeleted = await prisma.skinProfile.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено профилей: ${profilesDeleted.count}`);

    // 3. Удаляем сессии рекомендаций
    console.log('📋 Удаляю сессии рекомендаций...');
    const sessionsDeleted = await prisma.recommendationSession.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено сессий: ${sessionsDeleted.count}`);

    // 4. Удаляем прогресс плана
    console.log('📋 Удаляю прогресс плана...');
    const progressDeleted = await prisma.planProgress.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено записей прогресса: ${progressDeleted.count}`);

    // 5. Удаляем отзывы на план
    console.log('📋 Удаляю отзывы на план...');
    const feedbackDeleted = await prisma.planFeedback.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено отзывов: ${feedbackDeleted.count}`);

    // 6. Удаляем избранное (wishlist)
    console.log('📋 Удаляю избранное...');
    const wishlistDeleted = await prisma.wishlist.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено из избранного: ${wishlistDeleted.count}`);

    // 7. Удаляем отзывы на избранное
    console.log('📋 Удаляю отзывы на избранное...');
    const wishlistFeedbackDeleted = await prisma.wishlistFeedback.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено отзывов на избранное: ${wishlistFeedbackDeleted.count}`);

    // 8. Удаляем замены продуктов
    console.log('📋 Удаляю замены продуктов...');
    const replacementsDeleted = await prisma.productReplacement.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено замен: ${replacementsDeleted.count}`);

    // 9. Удаляем корзину
    console.log('📋 Удаляю корзину...');
    const cartDeleted = await prisma.cart.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено из корзины: ${cartDeleted.count}`);

    // 10. Инвалидируем весь кэш пользователя (все версии)
    // ВАЖНО: Делаем это ДО удаления профилей, чтобы получить версии
    // Но также очищаем весь кэш после удаления, чтобы гарантировать полную очистку
    console.log('📋 Инвалидирую кэш плана и рекомендаций...');
    
    // Сначала очищаем кэш для известных версий (если они есть)
    for (const version of profileVersions) {
      try {
        await invalidateCache(user.id, version);
        console.log(`   ✅ Кэш инвалидирован для версии ${version}`);
      } catch (error) {
        console.warn(`   ⚠️  Ошибка при инвалидации кэша версии ${version} (может быть недоступен): ${error}`);
      }
    }
    
    // Затем очищаем весь кэш пользователя (все возможные версии)
    // Это гарантирует, что даже если версии не были получены, кэш будет очищен
    try {
      await invalidateAllUserCache(user.id);
      console.log(`   ✅ Весь кэш пользователя очищен (все версии)`);
    } catch (error) {
      console.warn(`   ⚠️  Ошибка при полной очистке кэша (может быть недоступен): ${error}`);
    }

    // Финальная проверка
    const finalAnswersCount = await prisma.userAnswer.count({ where: { userId: user.id } });
    const finalProfilesCount = await prisma.skinProfile.count({ where: { userId: user.id } });
    const finalSessionsCount = await prisma.recommendationSession.count({ where: { userId: user.id } });
    const finalProgressCount = await prisma.planProgress.count({ where: { userId: user.id } });

    console.log('\n🎉 Полная очистка завершена успешно!');
    console.log(`📊 Финальное состояние:`);
    console.log(`   - Ответов на анкету: ${finalAnswersCount}`);
    console.log(`   - Профилей кожи: ${finalProfilesCount}`);
    console.log(`   - Сессий рекомендаций: ${finalSessionsCount}`);
    console.log(`   - Записей прогресса: ${finalProgressCount}`);
    console.log(`\n✅ Пользователь может пройти весь путь заново как новый пользователь!\n`);

  } catch (error) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

const telegramIdArg = process.argv[2] || '643160759';
clearAllUserData(telegramIdArg)
  .catch((e) => {
    console.error('❌ Критическая ошибка:', e);
    process.exit(1);
  });


