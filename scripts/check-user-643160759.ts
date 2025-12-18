// scripts/check-user-643160759.ts
// Проверка данных пользователя 643160759

import { prisma } from '../lib/db';

async function checkUser() {
  const telegramId = '643160759';
  
  console.log('🔍 Ищу пользователя с telegramId:', telegramId);
  
  try {
    // Ищем пользователя по telegramId
    const user = await prisma.user.findFirst({
      where: { telegramId },
      include: {
        skinProfiles: {
          orderBy: { version: 'desc' },
          take: 5,
        },
        recommendationSessions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    
    if (!user) {
      console.log('❌ Пользователь не найден');
      console.log('\n💡 Возможные причины:');
      console.log('   1. Пользователь еще не проходил анкету');
      console.log('   2. telegramId указан неверно');
      console.log('   3. Пользователь был удален');
      
      // Проверяем, есть ли пользователи вообще
      const allUsers = await prisma.user.findMany({
        take: 5,
        select: { id: true, telegramId: true, firstName: true },
      });
      console.log('\n📊 Примеры пользователей в БД:');
      allUsers.forEach(u => {
        console.log(`   - ID: ${u.id}, TelegramID: ${u.telegramId}, Name: ${u.firstName}`);
      });
    } else {
      console.log('\n✅ Пользователь найден:');
      console.log(`   User ID: ${user.id}`);
      console.log(`   Telegram ID: ${user.telegramId}`);
      console.log(`   Name: ${user.firstName} ${user.lastName || ''}`);
      
      console.log(`\n📊 Профили кожи (${user.skinProfiles.length}):`);
      user.skinProfiles.forEach((profile, idx) => {
        console.log(`   ${idx + 1}. Version: ${profile.version}, SkinType: ${profile.skinType}, Created: ${profile.createdAt}`);
      });
      
      console.log(`\n📊 RecommendationSessions (${user.recommendationSessions.length}):`);
      user.recommendationSessions.forEach((session, idx) => {
        const productsCount = Array.isArray(session.products) ? session.products.length : 0;
        console.log(`   ${idx + 1}. ID: ${session.id}, Products: ${productsCount}, RuleID: ${session.ruleId}, Created: ${session.createdAt}`);
      });
      
      if (user.skinProfiles.length > 0) {
        const latestProfile = user.skinProfiles[0];
        console.log(`\n💡 Для очистки кэша используйте userId: ${user.id}`);
        console.log(`   Последний профиль: version ${latestProfile.version}`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkUser()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });

