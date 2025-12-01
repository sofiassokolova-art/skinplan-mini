// scripts/clear-user-data.ts
// Скрипт для удаления всех данных пользователя (профили, планы, ответы и т.д.)

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const username = 'sofiagguseynova';
  
  console.log(`🔍 Ищу пользователя с username: ${username}...`);

  // Ищем пользователя по username (в Telegram это может быть в разных полях)
  // Проверяем несколько вариантов
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: username },
        { username: `@${username}` },
        { username: username.replace('@', '') },
      ],
    },
  });

  // Если не нашли по username, попробуем найти по firstName/lastName
  if (!user) {
    console.log('⚠️  Пользователь не найден по username, пробую найти по имени...');
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { firstName: { contains: 'Sofia', mode: 'insensitive' } },
          { firstName: { contains: 'София', mode: 'insensitive' } },
        ],
      },
    });
  }

  if (!user) {
    console.error('❌ Пользователь не найден!');
    console.log('Доступные пользователи:');
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        telegramId: true,
      },
      take: 10,
    });
    allUsers.forEach(u => {
      console.log(`  - ID: ${u.id}, username: ${u.username || 'N/A'}, name: ${u.firstName || ''} ${u.lastName || ''}, telegramId: ${u.telegramId}`);
    });
    return;
  }

  console.log(`✅ Найден пользователь:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Username: ${user.username || 'N/A'}`);
  console.log(`   Name: ${user.firstName || ''} ${user.lastName || ''}`);
  console.log(`   Telegram ID: ${user.telegramId}`);

  console.log('\n🗑️  Начинаю удаление данных...');

  try {
    // Удаляем связанные записи в правильном порядке (сначала зависимые)
    
    // 1. Wishlist и связанные
    console.log('📋 Удаляю wishlist...');
    const wishlistCount = await prisma.wishlist.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено записей wishlist: ${wishlistCount.count}`);

    const wishlistFeedbackCount = await prisma.wishlistFeedback.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено записей wishlistFeedback: ${wishlistFeedbackCount.count}`);

    // 2. Cart
    console.log('🛒 Удаляю корзину...');
    const cartCount = await prisma.cart.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено записей корзины: ${cartCount.count}`);

    // 3. ProductReplacements
    console.log('🔄 Удаляю замены продуктов...');
    const replacementsCount = await prisma.productReplacement.deleteMany({
      where: {
        OR: [
          { userId: user.id },
          { oldProduct: { wishlist: { some: { userId: user.id } } } },
        ],
      },
    });
    console.log(`   ✅ Удалено записей замен: ${replacementsCount.count}`);

    // 4. PlanProgress
    console.log('📅 Удаляю прогресс плана...');
    const planProgressCount = await prisma.planProgress.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено записей прогресса плана: ${planProgressCount.count}`);

    // 5. PlanFeedback
    console.log('💬 Удаляю отзывы о плане...');
    const planFeedbackCount = await prisma.planFeedback.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено записей отзывов: ${planFeedbackCount.count}`);

    // 6. RecommendationSession
    console.log('🎯 Удаляю сессии рекомендаций...');
    const sessionCount = await prisma.recommendationSession.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено сессий: ${sessionCount.count}`);

    // 7. SkinProfile
    console.log('👤 Удаляю профили кожи...');
    const profileCount = await prisma.skinProfile.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено профилей: ${profileCount.count}`);

    // 8. UserAnswer
    console.log('📝 Удаляю ответы на анкету...');
    const answersCount = await prisma.userAnswer.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено ответов: ${answersCount.count}`);

    // 9. BotMessages
    console.log('💬 Удаляю сообщения бота...');
    const botMessagesCount = await prisma.botMessage.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено сообщений: ${botMessagesCount.count}`);

    // 10. BroadcastLogs
    console.log('📢 Удаляю логи рассылок...');
    const broadcastCount = await prisma.broadcastLog.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено логов: ${broadcastCount.count}`);

    // 11. SupportChats
    console.log('💬 Удаляю чаты поддержки...');
    const supportCount = await prisma.supportChat.deleteMany({
      where: { userId: user.id },
    });
    console.log(`   ✅ Удалено чатов: ${supportCount.count}`);

    console.log('\n🎉 Все данные пользователя успешно удалены!');
    console.log(`\n📊 Итого удалено:`);
    console.log(`   - Wishlist: ${wishlistCount.count}`);
    console.log(`   - WishlistFeedback: ${wishlistFeedbackCount.count}`);
    console.log(`   - Cart: ${cartCount.count}`);
    console.log(`   - ProductReplacements: ${replacementsCount.count}`);
    console.log(`   - PlanProgress: ${planProgressCount.count}`);
    console.log(`   - PlanFeedback: ${planFeedbackCount.count}`);
    console.log(`   - RecommendationSession: ${sessionCount.count}`);
    console.log(`   - SkinProfile: ${profileCount.count}`);
    console.log(`   - UserAnswer: ${answersCount.count}`);
    console.log(`   - BotMessages: ${botMessagesCount.count}`);
    console.log(`   - BroadcastLogs: ${broadcastCount.count}`);
    console.log(`   - SupportChats: ${supportCount.count}`);

    console.log('\n✅ Пользователь готов к повторному прохождению анкеты!');
  } catch (error) {
    console.error('❌ Ошибка при удалении данных:', error);
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

