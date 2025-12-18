// scripts/reset-all-users-to-new.ts
// Обнуление всех данных для всех пользователей - делаем их "как новых"

import { prisma } from '../lib/db';
import { invalidateAllUserCache } from '../lib/cache';

async function resetAllUsersToNew() {
  console.log('🔄 Обнуление всех данных для всех пользователей...');
  console.log('   Все пользователи будут как новые (без профилей, ответов, планов)\n');
  
  try {
    // Подсчитываем количество пользователей
    const usersCount = await prisma.user.count({});
    console.log(`📊 Найдено пользователей: ${usersCount}`);
    
    if (usersCount === 0) {
      console.log('✅ Пользователей нет, нечего очищать');
      await prisma.$disconnect();
      return;
    }
    
    // 1. Получаем всех пользователей для очистки кэша
    const allUsers = await prisma.user.findMany({
      select: { id: true },
    });
    
    console.log('\n📋 Шаг 1: Очистка кэша для всех пользователей...');
    let cacheClearedCount = 0;
    for (const user of allUsers) {
      try {
        await invalidateAllUserCache(user.id);
        cacheClearedCount++;
      } catch (cacheError: any) {
        console.warn(`   ⚠️ Ошибка очистки кэша для пользователя ${user.id}:`, cacheError?.message);
      }
    }
    console.log(`   ✅ Кэш очищен для ${cacheClearedCount}/${allUsers.length} пользователей`);
    
    // 2. Удаляем все ClientLog (логи клиентов)
    console.log('\n📋 Шаг 2: Удаляю ClientLog...');
    const clientLogsDeleted = await prisma.clientLog.deleteMany({});
    console.log(`   ✅ Удалено логов: ${clientLogsDeleted.count}`);
    
    // 3. Удаляем все BroadcastLog
    console.log('\n📋 Шаг 3: Удаляю BroadcastLog...');
    const broadcastLogsDeleted = await prisma.broadcastLog.deleteMany({});
    console.log(`   ✅ Удалено логов рассылок: ${broadcastLogsDeleted.count}`);
    
    // 4. Удаляем все SupportMessage и SupportChat
    console.log('\n📋 Шаг 4: Удаляю SupportMessage...');
    const supportMessagesDeleted = await prisma.supportMessage.deleteMany({});
    console.log(`   ✅ Удалено сообщений поддержки: ${supportMessagesDeleted.count}`);
    
    console.log('📋 Удаляю SupportChat...');
    const supportChatsDeleted = await prisma.supportChat.deleteMany({});
    console.log(`   ✅ Удалено чатов поддержки: ${supportChatsDeleted.count}`);
    
    // 5. Удаляем все BotMessage
    console.log('\n📋 Шаг 5: Удаляю BotMessage...');
    const botMessagesDeleted = await prisma.botMessage.deleteMany({});
    console.log(`   ✅ Удалено сообщений бота: ${botMessagesDeleted.count}`);
    
    // 6. Удаляем все WishlistFeedback
    console.log('\n📋 Шаг 6: Удаляю WishlistFeedback...');
    const wishlistFeedbacksDeleted = await prisma.wishlistFeedback.deleteMany({});
    console.log(`   ✅ Удалено отзывов на избранное: ${wishlistFeedbacksDeleted.count}`);
    
    // 7. Удаляем все ProductReplacement
    console.log('\n📋 Шаг 7: Удаляю ProductReplacement...');
    const replacementsDeleted = await prisma.productReplacement.deleteMany({});
    console.log(`   ✅ Удалено замен продуктов: ${replacementsDeleted.count}`);
    
    // 8. Удаляем все Cart (корзина)
    console.log('\n📋 Шаг 8: Удаляю Cart...');
    const cartDeleted = await prisma.cart.deleteMany({});
    console.log(`   ✅ Удалено записей корзины: ${cartDeleted.count}`);
    
    // 9. Удаляем все Wishlist (избранное)
    console.log('\n📋 Шаг 9: Удаляю Wishlist...');
    const wishlistDeleted = await prisma.wishlist.deleteMany({});
    console.log(`   ✅ Удалено записей избранного: ${wishlistDeleted.count}`);
    
    // 10. Удаляем все PlanFeedback
    console.log('\n📋 Шаг 10: Удаляю PlanFeedback...');
    const planFeedbacksDeleted = await prisma.planFeedback.deleteMany({});
    console.log(`   ✅ Удалено отзывов на план: ${planFeedbacksDeleted.count}`);
    
    // 11. Удаляем все PlanProgress
    console.log('\n📋 Шаг 11: Удаляю PlanProgress...');
    try {
      const progressDeleted = await prisma.planProgress.deleteMany({});
      console.log(`   ✅ Удалено записей прогресса: ${progressDeleted.count}`);
    } catch (progressError: any) {
      if (progressError?.code === 'P2022' || progressError?.message?.includes('completed_days')) {
        console.log('   ⚠️ PlanProgress не удален (проблема со схемой БД), но это не критично');
      } else {
        console.warn('   ⚠️ Ошибка при удалении PlanProgress:', progressError?.message);
      }
    }
    
    // 12. Удаляем все RecommendationSession
    console.log('\n📋 Шаг 12: Удаляю RecommendationSession...');
    const sessionsDeleted = await prisma.recommendationSession.deleteMany({});
    console.log(`   ✅ Удалено сессий рекомендаций: ${sessionsDeleted.count}`);
    
    // 13. Удаляем все ответы на анкету (UserAnswer)
    console.log('\n📋 Шаг 13: Удаляю UserAnswer...');
    const answersDeleted = await prisma.userAnswer.deleteMany({});
    console.log(`   ✅ Удалено ответов на анкету: ${answersDeleted.count}`);
    
    // 14. Удаляем все профили (SkinProfile)
    console.log('\n📋 Шаг 14: Удаляю SkinProfile...');
    const profilesDeleted = await prisma.skinProfile.deleteMany({});
    console.log(`   ✅ Удалено профилей: ${profilesDeleted.count}`);
    
    // 15. Проверяем, что все очищено
    console.log('\n📊 Проверка результатов очистки...');
    const remainingProfiles = await prisma.skinProfile.count({});
    const remainingAnswers = await prisma.userAnswer.count({});
    const remainingSessions = await prisma.recommendationSession.count({});
    const remainingProgress = await prisma.planProgress.count({}).catch(() => 0);
    const remainingCart = await prisma.cart.count({});
    const remainingWishlist = await prisma.wishlist.count({});
    const remainingFeedbacks = await prisma.planFeedback.count({});
    
    console.log('\n✅ Очистка завершена!');
    console.log(`   Осталось профилей: ${remainingProfiles}`);
    console.log(`   Осталось ответов: ${remainingAnswers}`);
    console.log(`   Осталось сессий рекомендаций: ${remainingSessions}`);
    console.log(`   Осталось прогресса: ${remainingProgress}`);
    console.log(`   Осталось в корзине: ${remainingCart}`);
    console.log(`   Осталось в избранном: ${remainingWishlist}`);
    console.log(`   Осталось отзывов: ${remainingFeedbacks}`);
    
    if (remainingProfiles > 0 || remainingAnswers > 0 || remainingSessions > 0 || remainingProgress > 0) {
      console.log('\n⚠️ ВНИМАНИЕ: Некоторые данные не были удалены!');
    } else {
      console.log('\n✅ Все пользователи теперь как новые!');
      console.log('   При следующем заходе все будут перенаправлены на анкету.');
    }
    
    console.log('\n📱 ВАЖНО: Пользователям нужно очистить localStorage в браузере:');
    console.log('   localStorage.removeItem("is_retaking_quiz");');
    console.log('   localStorage.removeItem("full_retake_from_home");');
    console.log('   localStorage.removeItem("quiz_progress");');
    console.log('   sessionStorage.removeItem("quiz_just_submitted");');
    console.log('   sessionStorage.removeItem("profile_check_cache");');
    console.log('   Или очистить все: localStorage.clear(); sessionStorage.clear();');
    
  } catch (error: any) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запрашиваем подтверждение перед выполнением
console.log('⚠️ ВНИМАНИЕ: Этот скрипт удалит ВСЕ данные всех пользователей!');
console.log('   - Все профили');
console.log('   - Все ответы на анкеты');
console.log('   - Все планы и прогресс');
console.log('   - Все корзины и избранное');
console.log('   - Все отзывы и логи');
console.log('');
console.log('Для продолжения запустите скрипт с флагом --confirm');
console.log('');

if (process.argv.includes('--confirm')) {
  resetAllUsersToNew()
    .then(() => {
      console.log('\n🎉 Готово! Все пользователи теперь как новые.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Ошибка:', error);
      process.exit(1);
    });
} else {
  console.log('❌ Скрипт не выполнен. Для подтверждения добавьте флаг --confirm');
  process.exit(1);
}
