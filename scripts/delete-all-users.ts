// scripts/delete-all-users.ts
// Полное удаление всех пользователей и всех их данных
// ВНИМАНИЕ: Это необратимая операция!

import { prisma } from '../lib/db';
import { invalidateAllUserCache } from '../lib/cache';

async function deleteAllUsers() {
  console.log('🗑️  ПОЛНОЕ УДАЛЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ И ВСЕХ ДАННЫХ');
  console.log('   ⚠️  Это необратимая операция!\n');
  
  try {
    // Подсчитываем количество пользователей
    const usersCount = await prisma.user.count({});
    console.log(`📊 Найдено пользователей: ${usersCount}`);
    
    if (usersCount === 0) {
      console.log('✅ Пользователей нет, нечего удалять');
      await prisma.$disconnect();
      return;
    }
    
    // 1. Получаем всех пользователей для очистки кэша
    const allUsers = await prisma.user.findMany({
      select: { id: true, telegramId: true, firstName: true },
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
    
    // 2. Удаляем все данные в правильном порядке (из-за foreign keys)
    
    console.log('\n📋 Шаг 2: Удаляю ClientLog (логи клиентов)...');
    const clientLogsDeleted = await prisma.clientLog.deleteMany({});
    console.log(`   ✅ Удалено логов: ${clientLogsDeleted.count}`);
    
    console.log('\n📋 Шаг 3: Удаляю BroadcastLog (логи рассылок)...');
    const broadcastLogsDeleted = await prisma.broadcastLog.deleteMany({});
    console.log(`   ✅ Удалено логов рассылок: ${broadcastLogsDeleted.count}`);
    
    console.log('\n📋 Шаг 4: Удаляю SupportMessage (сообщения поддержки)...');
    const supportMessagesDeleted = await prisma.supportMessage.deleteMany({});
    console.log(`   ✅ Удалено сообщений: ${supportMessagesDeleted.count}`);
    
    console.log('\n📋 Шаг 5: Удаляю SupportChat (чаты поддержки)...');
    const supportChatsDeleted = await prisma.supportChat.deleteMany({});
    console.log(`   ✅ Удалено чатов: ${supportChatsDeleted.count}`);
    
    console.log('\n📋 Шаг 6: Удаляю BotMessage (сообщения бота)...');
    const botMessagesDeleted = await prisma.botMessage.deleteMany({});
    console.log(`   ✅ Удалено сообщений бота: ${botMessagesDeleted.count}`);
    
    console.log('\n📋 Шаг 7: Удаляю WishlistFeedback (отзывы на избранное)...');
    const wishlistFeedbacksDeleted = await prisma.wishlistFeedback.deleteMany({});
    console.log(`   ✅ Удалено отзывов: ${wishlistFeedbacksDeleted.count}`);
    
    console.log('\n📋 Шаг 8: Удаляю ProductReplacement (замены продуктов)...');
    const replacementsDeleted = await prisma.productReplacement.deleteMany({});
    console.log(`   ✅ Удалено замен: ${replacementsDeleted.count}`);
    
    console.log('\n📋 Шаг 9: Удаляю Cart (корзина)...');
    const cartDeleted = await prisma.cart.deleteMany({});
    console.log(`   ✅ Удалено записей корзины: ${cartDeleted.count}`);
    
    console.log('\n📋 Шаг 10: Удаляю Wishlist (избранное)...');
    const wishlistDeleted = await prisma.wishlist.deleteMany({});
    console.log(`   ✅ Удалено записей избранного: ${wishlistDeleted.count}`);
    
    console.log('\n📋 Шаг 11: Удаляю PlanFeedback (отзывы на план)...');
    const planFeedbacksDeleted = await prisma.planFeedback.deleteMany({});
    console.log(`   ✅ Удалено отзывов: ${planFeedbacksDeleted.count}`);
    
    console.log('\n📋 Шаг 12: Удаляю PlanProgress (прогресс плана)...');
    try {
      const progressDeleted = await prisma.planProgress.deleteMany({});
      console.log(`   ✅ Удалено записей прогресса: ${progressDeleted.count}`);
    } catch (progressError: any) {
      console.warn(`   ⚠️ Ошибка при удалении PlanProgress: ${progressError?.message}`);
    }
    
    console.log('\n📋 Шаг 13: Удаляю Plan28 (планы)...');
    const plan28Deleted = await prisma.plan28.deleteMany({});
    console.log(`   ✅ Удалено планов: ${plan28Deleted.count}`);
    
    console.log('\n📋 Шаг 14: Удаляю RecommendationSession (сессии рекомендаций)...');
    const sessionsDeleted = await prisma.recommendationSession.deleteMany({});
    console.log(`   ✅ Удалено сессий: ${sessionsDeleted.count}`);
    
    console.log('\n📋 Шаг 15: Удаляю QuestionnaireSubmission (отправки анкет)...');
    const submissionsDeleted = await prisma.questionnaireSubmission.deleteMany({});
    console.log(`   ✅ Удалено отправок: ${submissionsDeleted.count}`);
    
    console.log('\n📋 Шаг 16: Удаляю QuestionnaireProgress (прогресс анкет)...');
    try {
      const questionnaireProgressDeleted = await prisma.questionnaireProgress.deleteMany({});
      console.log(`   ✅ Удалено записей прогресса анкет: ${questionnaireProgressDeleted.count}`);
    } catch (progressError: any) {
      if (progressError?.code === 'P2021' || progressError?.message?.includes('does not exist')) {
        console.log('   ⚠️ Таблица QuestionnaireProgress не существует, пропускаем');
      } else {
        console.warn(`   ⚠️ Ошибка при удалении QuestionnaireProgress: ${progressError?.message}`);
      }
    }
    
    console.log('\n📋 Шаг 17: Удаляю UserAnswer (ответы на вопросы)...');
    const answersDeleted = await prisma.userAnswer.deleteMany({});
    console.log(`   ✅ Удалено ответов: ${answersDeleted.count}`);
    
    console.log('\n📋 Шаг 18: Удаляю SkinProfile (профили кожи)...');
    const profilesDeleted = await prisma.skinProfile.deleteMany({});
    console.log(`   ✅ Удалено профилей: ${profilesDeleted.count}`);
    
    console.log('\n📋 Шаг 19: Удаляю Payment (платежи)...');
    const paymentsDeleted = await prisma.payment.deleteMany({});
    console.log(`   ✅ Удалено платежей: ${paymentsDeleted.count}`);
    
    console.log('\n📋 Шаг 20: Удаляю Entitlement (права доступа)...');
    const entitlementsDeleted = await prisma.entitlement.deleteMany({});
    console.log(`   ✅ Удалено прав доступа: ${entitlementsDeleted.count}`);
    
    // 21. Удаляем всех пользователей
    console.log('\n📋 Шаг 21: Удаляю всех пользователей (User)...');
    const usersDeleted = await prisma.user.deleteMany({});
    console.log(`   ✅ Удалено пользователей: ${usersDeleted.count}`);
    
    // Проверка результатов
    console.log('\n📊 Проверка результатов удаления...');
    const remainingUsers = await prisma.user.count({});
    const remainingProfiles = await prisma.skinProfile.count({});
    const remainingAnswers = await prisma.userAnswer.count({});
    const remainingSessions = await prisma.recommendationSession.count({});
    const remainingPlans = await prisma.plan28.count({});
    const remainingCart = await prisma.cart.count({});
    const remainingWishlist = await prisma.wishlist.count({});
    const remainingFeedbacks = await prisma.planFeedback.count({});
    
    console.log('\n✅ Удаление завершено!');
    console.log(`   Осталось пользователей: ${remainingUsers}`);
    console.log(`   Осталось профилей: ${remainingProfiles}`);
    console.log(`   Осталось ответов: ${remainingAnswers}`);
    console.log(`   Осталось сессий рекомендаций: ${remainingSessions}`);
    console.log(`   Осталось планов: ${remainingPlans}`);
    console.log(`   Осталось в корзине: ${remainingCart}`);
    console.log(`   Осталось в избранном: ${remainingWishlist}`);
    console.log(`   Осталось отзывов: ${remainingFeedbacks}`);
    
    if (remainingUsers > 0 || remainingProfiles > 0 || remainingAnswers > 0 || remainingSessions > 0 || remainingPlans > 0) {
      console.log('\n⚠️ ВНИМАНИЕ: Некоторые данные не были удалены!');
    } else {
      console.log('\n✅ Все пользователи и все их данные полностью удалены!');
      console.log('   База данных теперь чистая, как будто никто еще не заходил в приложение.');
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка при удалении:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Запрашиваем подтверждение перед выполнением
console.log('⚠️  ⚠️  ⚠️  КРИТИЧЕСКОЕ ВНИМАНИЕ ⚠️  ⚠️  ⚠️');
console.log('');
console.log('Этот скрипт УДАЛИТ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ и ВСЕ ИХ ДАННЫЕ:');
console.log('   - Всех пользователей (User)');
console.log('   - Все профили кожи (SkinProfile)');
console.log('   - Все ответы на анкеты (UserAnswer)');
console.log('   - Все планы (Plan28)');
console.log('   - Все сессии рекомендаций (RecommendationSession)');
console.log('   - Все корзины и избранное (Cart, Wishlist)');
console.log('   - Все отзывы (PlanFeedback, WishlistFeedback)');
console.log('   - Все логи (ClientLog, BroadcastLog)');
console.log('   - Все сообщения поддержки (SupportChat, SupportMessage)');
console.log('   - Все платежи (Payment)');
console.log('   - ВСЕ ОСТАЛЬНЫЕ ДАННЫЕ ПОЛЬЗОВАТЕЛЕЙ');
console.log('');
console.log('⚠️  ЭТО НЕОБРАТИМАЯ ОПЕРАЦИЯ! ⚠️');
console.log('');
console.log('Для продолжения запустите скрипт с флагом --confirm');
console.log('');

if (process.argv.includes('--confirm')) {
  deleteAllUsers()
    .then(() => {
      console.log('\n🎉 Готово! Все пользователи и все данные удалены.');
      console.log('   База данных теперь чистая.');
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

