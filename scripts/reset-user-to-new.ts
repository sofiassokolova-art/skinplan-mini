// scripts/reset-user-to-new.ts
// Полная очистка данных пользователя, чтобы сделать его "как нового"

import { prisma } from '../lib/db';
import { invalidateAllUserCache, invalidateCache } from '../lib/cache';

const userId = 'cmieq8w2v0000js0480u0n0ax'; // User ID для Sofia
const telegramId = '643160759';

async function resetUserToNew() {
  console.log('🔄 Полная очистка данных пользователя (как новый пользователь):');
  console.log(`   User ID: ${userId}`);
  console.log(`   Telegram ID: ${telegramId}`);
  console.log('');
  
  try {
    // 1. Получаем информацию о профиле
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
    
    // 2. Очищаем весь кэш пользователя (все версии)
    console.log('📋 Очищаю весь кэш пользователя (все версии)...');
    try {
      await invalidateAllUserCache(userId);
      console.log('   ✅ Весь кэш очищен');
    } catch (cacheError: any) {
      console.warn('   ⚠️ Ошибка при очистке кэша:', cacheError?.message);
    }
    
    // 3. Удаляем все RecommendationSession
    console.log('📋 Удаляю RecommendationSession...');
    const sessionsDeleted = await prisma.recommendationSession.deleteMany({
      where: { userId },
    });
    console.log(`   ✅ Удалено сессий: ${sessionsDeleted.count}`);
    
    // 4. Удаляем PlanProgress
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
    
    // 5. Удаляем все ответы на анкету (UserAnswer)
    console.log('📋 Удаляю ответы на анкету (UserAnswer)...');
    const answersDeleted = await prisma.userAnswer.deleteMany({
      where: { userId },
    });
    console.log(`   ✅ Удалено ответов: ${answersDeleted.count}`);
    
    // 6. Удаляем все профили (SkinProfile)
    console.log('📋 Удаляю профили (SkinProfile)...');
    const profilesDeleted = await prisma.skinProfile.deleteMany({
      where: { userId },
    });
    console.log(`   ✅ Удалено профилей: ${profilesDeleted.count}`);
    
    // 7. Проверяем, что все очищено
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
    
    console.log('\n✅ Очистка завершена!');
    console.log(`   Осталось профилей: ${remainingProfile ? 1 : 0}`);
    console.log(`   Осталось ответов: ${remainingAnswers}`);
    console.log(`   Осталось сессий: ${remainingSessions}`);
    console.log(`   Осталось прогресса: ${remainingProgress}`);
    
    if (remainingProfile || remainingAnswers > 0) {
      console.log('\n⚠️ ВНИМАНИЕ: Некоторые данные не были удалены!');
    } else {
      console.log('\n✅ Пользователь теперь как новый - будет перенаправлен на анкету');
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetUserToNew()
  .then(() => {
    console.log('\n🎉 Готово! Пользователь теперь как новый.');
    console.log('   При следующем заходе будет перенаправлен на анкету.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  });
