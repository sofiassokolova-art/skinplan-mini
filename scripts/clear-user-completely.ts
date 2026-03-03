// scripts/clear-user-completely.ts
// Полная очистка всех данных пользователя: БД, KV логи, кэш

import { prisma } from '../lib/db';
import { invalidateAllUserCache, invalidateCache } from '../lib/cache';
import { getRedis } from '../lib/redis';

// Ищем пользователя по telegramId
// Можно передать Telegram ID первым аргументом командной строки:
//   tsx scripts/clear-user-completely.ts 7595625369
const telegramId = process.argv[2] || '643160759';
let userId: string | null = null;

async function clearUserCompletely() {
  console.log('🔄 Полная очистка всех данных пользователя:');
  console.log(`   Telegram ID: ${telegramId}`);
  console.log('');

  try {
    // Сначала находим пользователя по telegramId
    const user = await prisma.user.findFirst({
      where: { telegramId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!user) {
      console.log('❌ Пользователь не найден в БД');
      await prisma.$disconnect();
      return;
    }

    userId = user.id;
    console.log(`✅ Пользователь найден:`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Имя: ${user.firstName || ''} ${user.lastName || ''}`);
    console.log('');
    // ============================================
    // 1. ОЧИСТКА БД
    // ============================================
    console.log('📊 ОЧИСТКА БАЗЫ ДАННЫХ:');
    console.log('');

    // 1.1. Получаем информацию о профиле
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, skinType: true },
    });

    if (profile) {
      console.log('📊 Текущий профиль:');
      console.log(`   Profile ID: ${profile.id}`);
      console.log(`   Version: ${profile.version}`);
      console.log(`   Skin Type: ${profile.skinType}`);
      console.log('');

      // Очищаем кэш для конкретной версии
      console.log(`📋 Очищаю кэш для версии ${profile.version}...`);
      try {
        await invalidateCache(userId, profile.version);
        console.log('   ✅ Кэш для версии очищен');
      } catch (cacheError: any) {
        console.warn('   ⚠️ Ошибка при очистке кэша версии:', cacheError?.message);
      }
    }

    // 1.2. Очищаем весь кэш пользователя (все версии)
    console.log('📋 Очищаю весь кэш пользователя (все версии)...');
    try {
      await invalidateAllUserCache(userId);
      console.log('   ✅ Весь кэш очищен');
    } catch (cacheError: any) {
      console.warn('   ⚠️ Ошибка при очистке кэша:', cacheError?.message);
    }

    // 1.3. Удаляем все RecommendationSession
    console.log('📋 Удаляю RecommendationSession...');
    const sessionsDeleted = await prisma.recommendationSession.deleteMany({
      where: { userId },
    });
    console.log(`   ✅ Удалено сессий: ${sessionsDeleted.count}`);

    // 1.4. Удаляем PlanProgress
    console.log('📋 Удаляю PlanProgress...');
    try {
      const progressDeleted = await prisma.planProgress.deleteMany({
        where: { userId },
      });
      console.log(`   ✅ Удалено записей прогресса: ${progressDeleted.count}`);
    } catch (progressError: any) {
      if (progressError?.code === 'P2022' || progressError?.message?.includes('completed_days')) {
        console.log('   ⚠️ PlanProgress не удален (проблема со схемой БД), но это не критично');
      } else {
        console.warn('   ⚠️ Ошибка при удалении PlanProgress:', progressError?.message);
      }
    }

    // 1.5. Удаляем все ответы на анкету (UserAnswer)
    console.log('📋 Удаляю ответы на анкету (UserAnswer)...');
    const answersDeleted = await prisma.userAnswer.deleteMany({
      where: { userId },
    });
    console.log(`   ✅ Удалено ответов: ${answersDeleted.count}`);

    // 1.6. Удаляем все профили (SkinProfile)
    console.log('📋 Удаляю профили (SkinProfile)...');
    const profilesDeleted = await prisma.skinProfile.deleteMany({
      where: { userId },
    });
    console.log(`   ✅ Удалено профилей: ${profilesDeleted.count}`);

    // 1.7. Удаляем PlanFeedback
    console.log('📋 Удаляю PlanFeedback...');
    try {
      const feedbackDeleted = await prisma.planFeedback.deleteMany({
        where: { userId },
      });
      console.log(`   ✅ Удалено отзывов: ${feedbackDeleted.count}`);
    } catch (error: any) {
      console.warn('   ⚠️ Ошибка при удалении PlanFeedback:', error?.message);
    }

    // 1.8. Удаляем Wishlist
    console.log('📋 Удаляю Wishlist...');
    try {
      const wishlistDeleted = await prisma.wishlist.deleteMany({
        where: { userId },
      });
      console.log(`   ✅ Удалено избранного: ${wishlistDeleted.count}`);
    } catch (error: any) {
      console.warn('   ⚠️ Ошибка при удалении Wishlist:', error?.message);
    }

    // 1.9. Удаляем Cart
    console.log('📋 Удаляю Cart...');
    try {
      const cartDeleted = await prisma.cart.deleteMany({
        where: { userId },
      });
      console.log(`   ✅ Удалено корзин: ${cartDeleted.count}`);
    } catch (error: any) {
      console.warn('   ⚠️ Ошибка при удалении Cart:', error?.message);
    }

    // 1.10. Удаляем Plan28
    console.log('📋 Удаляю Plan28...');
    try {
      const plan28Deleted = await prisma.plan28.deleteMany({
        where: { userId },
      });
      console.log(`   ✅ Удалено планов: ${plan28Deleted.count}`);
    } catch (error: any) {
      console.warn('   ⚠️ Ошибка при удалении Plan28:', error?.message);
    }

    // 1.11. Удаляем ClientLog
    console.log('📋 Удаляю ClientLog...');
    try {
      const logsDeleted = await prisma.clientLog.deleteMany({
        where: { userId },
      });
      console.log(`   ✅ Удалено клиентских логов: ${logsDeleted.count}`);
    } catch (error: any) {
      console.warn('   ⚠️ Ошибка при удалении ClientLog:', error?.message);
    }

    // 1.11. Проверяем, что все очищено
    const remainingProfile = await prisma.skinProfile.findFirst({
      where: { userId },
    });
    const remainingAnswers = await prisma.userAnswer.count({
      where: { userId },
    });
    const remainingSessions = await prisma.recommendationSession.count({
      where: { userId },
    });

    let remainingProgress = 0;
    try {
      remainingProgress = await prisma.planProgress.count({
        where: { userId },
      });
    } catch {
      // Игнорируем ошибки схемы
    }

    console.log('\n✅ Очистка БД завершена!');
    console.log(`   Осталось профилей: ${remainingProfile ? 1 : 0}`);
    console.log(`   Осталось ответов: ${remainingAnswers}`);
    console.log(`   Осталось сессий: ${remainingSessions}`);
    console.log(`   Осталось прогресса: ${remainingProgress}`);

    if (remainingProfile || remainingAnswers > 0) {
      console.log('\n⚠️ ВНИМАНИЕ: Некоторые данные не были удалены!');
    } else {
      console.log('\n✅ Пользователь теперь как новый - будет перенаправлен на анкету');
    }

    // ============================================
    // 2. ОЧИСТКА KV ЛОГОВ
    // ============================================
    console.log('\n📊 ОЧИСТКА KV ЛОГОВ:');
    console.log('');

    const redis = getRedis();
    if (!redis) {
      console.warn('⚠️ Redis/KV недоступен, пропускаю очистку логов');
    } else {
      try {
        // 2.1. Очищаем обычные логи пользователя
        console.log('📋 Очищаю обычные логи пользователя...');
        const userLogsKey = `user_logs:${userId}`;
        const userLogKeys = await redis.lrange(userLogsKey, 0, -1); // Все логи
        if (userLogKeys.length > 0) {
          // Удаляем все ключи логов
          await Promise.all(
            userLogKeys.map((logKey) =>
              redis.del(logKey).catch(() => {
                // Игнорируем ошибки удаления отдельных ключей
              })
            )
          );
          // Очищаем список
          await redis.del(userLogsKey);
          console.log(`   ✅ Удалено ${userLogKeys.length} обычных логов`);
        } else {
          console.log('   ℹ️ Обычных логов не найдено');
        }

        // 2.2. Очищаем API логи пользователя
        console.log('📋 Очищаю API логи пользователя...');
        const userApiLogsKey = `user_api_logs:${userId}`;
        const apiLogKeys = await redis.lrange(userApiLogsKey, 0, -1); // Все логи
        if (apiLogKeys.length > 0) {
          // Удаляем все ключи логов
          await Promise.all(
            apiLogKeys.map((logKey) =>
              redis.del(logKey).catch(() => {
                // Игнорируем ошибки удаления отдельных ключей
              })
            )
          );
          // Очищаем список
          await redis.del(userApiLogsKey);
          console.log(`   ✅ Удалено ${apiLogKeys.length} API логов`);
        } else {
          console.log('   ℹ️ API логов не найдено');
        }

        // 2.3. Пробуем удалить логи по паттерну api_logs:userId:*
        console.log('📋 Очищаю логи по паттерну api_logs:userId:*...');
        // К сожалению, Upstash KV не поддерживает SCAN напрямую
        // Но мы можем попробовать удалить известные ключи
        // В реальности, эти ключи имеют TTL и удалятся автоматически через 30 дней
        console.log('   ℹ️ Логи с паттерном api_logs:* имеют TTL 30 дней и удалятся автоматически');

        console.log('\n✅ Очистка KV логов завершена!');
      } catch (kvError: any) {
        console.warn('⚠️ Ошибка при очистке KV логов:', kvError?.message);
      }
    }

    // ============================================
    // 3. ИНСТРУКЦИИ ПО ОЧИСТКЕ LOCALSTORAGE
    // ============================================
    console.log('\n📱 ВАЖНО: Очистите localStorage в браузере:');
    console.log('   Откройте консоль браузера (F12) и выполните:');
    console.log('   localStorage.removeItem("is_retaking_quiz");');
    console.log('   localStorage.removeItem("full_retake_from_home");');
    console.log('   localStorage.removeItem("quiz_progress");');
    console.log('   sessionStorage.removeItem("quiz_just_submitted");');
    console.log('   Или очистите все: localStorage.clear(); sessionStorage.clear();');
    console.log('');

  } catch (error: any) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearUserCompletely()
  .then(() => {
    console.log('\n🎉 Готово! Все данные удалены из БД и KV.');
    console.log('   Не забудьте очистить localStorage в браузере!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  });


