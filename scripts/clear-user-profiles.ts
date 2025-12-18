// scripts/clear-user-profiles.ts
// Скрипт для очистки профилей и планов пользователя

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2] || 'sofiagguseynova';
  
  console.log(`🔍 Ищу пользователя с username: ${username}...`);

  try {
    // Находим пользователя по username
    const user = await prisma.user.findFirst({
      where: {
        username: username,
      },
    });

    if (!user) {
      console.error(`❌ Пользователь с username "${username}" не найден`);
      process.exit(1);
    }

    console.log(`✅ Найден пользователь: ${user.firstName} ${user.lastName || ''} (ID: ${user.id}, Telegram ID: ${user.telegramId})`);

    // Подсчитываем текущее количество профилей
    const profilesCount = await prisma.skinProfile.count({
      where: { userId: user.id },
    });
    console.log(`📊 Текущее количество профилей: ${profilesCount}`);

    // Подсчитываем текущее количество планов (recommendation sessions)
    const plansCount = await prisma.recommendationSession.count({
      where: { userId: user.id },
    });
    console.log(`📊 Текущее количество планов: ${plansCount}`);

    if (profilesCount === 0 && plansCount === 0) {
      console.log('✅ У пользователя уже 0 профилей и 0 планов. Ничего удалять не нужно.');
      return;
    }

    console.log('\n🗑️  Начинаю очистку...\n');

    // Удаляем связанные данные в правильном порядке (из-за foreign keys)
    
    // 1. Удаляем планы (recommendation sessions)
    console.log('📋 Удаляю планы (recommendation sessions)...');
    const sessionsDeleted = await prisma.recommendationSession.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено планов: ${sessionsDeleted.count}`);

    // 2. Удаляем ответы пользователя (user answers)
    console.log('📋 Удаляю ответы пользователя...');
    const answersDeleted = await prisma.userAnswer.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено ответов: ${answersDeleted.count}`);

    // 3. Удаляем отзывы на план
    console.log('📋 Удаляю отзывы на план...');
    const planFeedbacksDeleted = await prisma.planFeedback.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено отзывов на план: ${planFeedbacksDeleted.count}`);

    // 4. Удаляем избранное (wishlist)
    console.log('📋 Удаляю избранное...');
    const wishlistDeleted = await prisma.wishlist.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено записей из избранного: ${wishlistDeleted.count}`);

    // 5. Удаляем отзывы на избранное
    console.log('📋 Удаляю отзывы на избранное...');
    const wishlistFeedbacksDeleted = await prisma.wishlistFeedback.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено отзывов на избранное: ${wishlistFeedbacksDeleted.count}`);

    // 6. Удаляем замены продуктов
    console.log('📋 Удаляю замены продуктов...');
    const replacementsDeleted = await prisma.productReplacement.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено замен продуктов: ${replacementsDeleted.count}`);

    // 7. Удаляем профили кожи (SkinProfile) - это основное
    console.log('📋 Удаляю профили кожи...');
    const profilesDeleted = await prisma.skinProfile.deleteMany({
      where: { userId: user.id },
    });
    console.log(`✅ Удалено профилей: ${profilesDeleted.count}`);

    // Проверяем результат
    const finalProfilesCount = await prisma.skinProfile.count({
      where: { userId: user.id },
    });
    const finalPlansCount = await prisma.recommendationSession.count({
      where: { userId: user.id },
    });

    console.log('\n🎉 Очистка завершена успешно!');
    console.log(`📊 Финальное количество профилей: ${finalProfilesCount}`);
    console.log(`📊 Финальное количество планов: ${finalPlansCount}`);

    if (finalProfilesCount === 0 && finalPlansCount === 0) {
      console.log('✅ Цель достигнута: 0 профилей и 0 планов');
    } else {
      console.warn('⚠️  Остались некоторые данные. Проверьте логи выше.');
    }
  } catch (error) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Критическая ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

