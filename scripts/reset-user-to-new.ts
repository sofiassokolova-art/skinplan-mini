// scripts/reset-user-to-new.ts
// Сброс данных конкретного пользователя (как новый)

import { prisma } from '../lib/db';
import { invalidateAllUserCache } from '../lib/cache';

async function resetUserToNew(telegramId: string) {
  console.log(`🔄 Сбрасываю данные для пользователя ${telegramId}...\n`);

  try {
    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, telegramId: true, firstName: true, lastName: true, username: true },
    });

    if (!user) {
      console.error(`❌ Пользователь с telegramId ${telegramId} не найден`);
      process.exit(1);
    }

    const userName = user.firstName || user.username || user.telegramId;
    console.log(`✅ Пользователь найден: ${userName} (${user.id})\n`);

    // Очищаем кэш пользователя
    console.log('🗑️  Очищаю кэш пользователя...');
    try {
      await invalidateAllUserCache(user.id);
      console.log(`   ✅ Кэш очищен`);
    } catch (cacheError: any) {
      console.log(`   ⚠️  Ошибка очистки кэша: ${cacheError?.message || 'не критично'}`);
    }

    // Удаляем все данные пользователя в правильном порядке (из-за foreign keys)
    
    // 1. Удаляем клиентские логи
    console.log('🗑️  Удаляю клиентские логи...');
    const deletedLogs = await prisma.clientLog.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено логов: ${deletedLogs.count}`);

    // 2. Удаляем BroadcastLog
    console.log('🗑️  Удаляю логи рассылок...');
    const deletedBroadcastLogs = await prisma.broadcastLog.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено логов рассылок: ${deletedBroadcastLogs.count}`);

    // 3. Удаляем SupportMessage (через SupportChat)
    console.log('🗑️  Удаляю сообщения поддержки...');
    const supportChats = await prisma.supportChat.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    for (const chat of supportChats) {
      await prisma.supportMessage.deleteMany({
        where: { chatId: chat.id },
      });
    }
    console.log(`   ✅ Удалено сообщений из ${supportChats.length} чатов`);

    // 4. Удаляем SupportChat
    console.log('🗑️  Удаляю чаты поддержки...');
    const deletedSupportChats = await prisma.supportChat.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено чатов: ${deletedSupportChats.count}`);

    // 5. Удаляем BotMessage
    console.log('🗑️  Удаляю сообщения бота...');
    const deletedBotMessages = await prisma.botMessage.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено сообщений бота: ${deletedBotMessages.count}`);

    // 6. Удаляем ProductReplacement
    console.log('🗑️  Удаляю замены продуктов...');
    const deletedReplacements = await prisma.productReplacement.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено замен: ${deletedReplacements.count}`);

    // 7. Удаляем WishlistFeedback
    console.log('🗑️  Удаляю отзывы на избранное...');
    const deletedWishlistFeedbacks = await prisma.wishlistFeedback.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено отзывов: ${deletedWishlistFeedbacks.count}`);

    // 8. Удаляем Wishlist
    console.log('🗑️  Удаляю избранное...');
    const deletedWishlist = await prisma.wishlist.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено избранного: ${deletedWishlist.count}`);

    // 9. Удаляем Cart
    console.log('🗑️  Удаляю корзину...');
    const deletedCart = await prisma.cart.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено корзин: ${deletedCart.count}`);

    // 10. Удаляем PlanFeedback
    console.log('🗑️  Удаляю отзывы на план...');
    const deletedPlanFeedbacks = await prisma.planFeedback.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено отзывов: ${deletedPlanFeedbacks.count}`);

    // 11. Удаляем PlanProgress
    console.log('🗑️  Удаляю прогресс плана...');
    const deletedPlanProgress = await prisma.planProgress.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено прогрессов: ${deletedPlanProgress.count}`);

    // 12. Удаляем Plan28
    console.log('🗑️  Удаляю планы Plan28...');
    const deletedPlan28 = await prisma.plan28.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено планов: ${deletedPlan28.count}`);

    // 13. Удаляем RecommendationSession
    console.log('🗑️  Удаляю сессии рекомендаций...');
    const deletedSessions = await prisma.recommendationSession.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено сессий: ${deletedSessions.count}`);

    // 14. Удаляем SkinProfile (удалит связанные Plan28 и RecommendationSession через cascade)
    console.log('🗑️  Удаляю профили кожи...');
    const deletedProfiles = await prisma.skinProfile.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено профилей: ${deletedProfiles.count}`);

    // 15. Удаляем UserAnswer
    console.log('🗑️  Удаляю ответы на вопросы анкеты...');
    const deletedAnswers = await prisma.userAnswer.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено ответов: ${deletedAnswers.count}`);

    // 16. Удаляем Entitlement
    console.log('🗑️  Удаляю entitlements...');
    const deletedEntitlements = await prisma.entitlement.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено entitlements: ${deletedEntitlements.count}`);

    // 17. Удаляем Payment
    console.log('🗑️  Удаляю платежи...');
    const deletedPayments = await prisma.payment.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено платежей: ${deletedPayments.count}`);

    // ВАЖНО: Пользователя НЕ удаляем - только его данные

    console.log('\n✅ Все данные пользователя успешно удалены!');
    console.log(`   Пользователь ${userName} теперь как новый.\n`);

  } catch (error: any) {
    console.error('❌ Ошибка при сбросе данных:', error);
    console.error('   Message:', error?.message);
    console.error('   Code:', error?.code);
    console.error('   Stack:', error?.stack?.substring(0, 500));
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
