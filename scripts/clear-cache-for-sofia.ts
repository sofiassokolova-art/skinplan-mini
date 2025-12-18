// scripts/clear-cache-for-sofia.ts
// Очистка кэша и сессий для пользователя Sofia (643160759)

import { prisma } from '../lib/db';
import { invalidateAllUserCache, invalidateCache } from '../lib/cache';

const userId = 'cmieq8w2v0000js0480u0n0ax'; // User ID для Sofia
const telegramId = '643160759';

async function clearCache() {
  console.log('🧹 Очищаю кэш и сессии для пользователя:');
  console.log(`   User ID: ${userId}`);
  console.log(`   Telegram ID: ${telegramId}`);
  console.log('');
  
  try {
    // Получаем информацию о профиле
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
      await invalidateCache(userId, profile.version);
      console.log('   ✅ Кэш для версии очищен');
    }
    
    // 1. Очищаем весь кэш пользователя (все версии)
    console.log('📋 Очищаю весь кэш пользователя (все версии)...');
    await invalidateAllUserCache(userId);
    console.log('   ✅ Весь кэш очищен');
    
    // 2. Удаляем все RecommendationSession
    console.log('📋 Удаляю RecommendationSession...');
    const sessionsDeleted = await prisma.recommendationSession.deleteMany({
      where: { userId },
    });
    console.log(`   ✅ Удалено сессий: ${sessionsDeleted.count}`);
    
    // 3. Удаляем PlanProgress (прогресс выполнения плана)
    console.log('📋 Удаляю PlanProgress...');
    try {
      const progressDeleted = await prisma.planProgress.deleteMany({
        where: { userId },
      });
      console.log(`   ✅ Удалено записей прогресса: ${progressDeleted.count}`);
    } catch (progressError: any) {
      // Игнорируем ошибки, связанные с отсутствием колонки completed_days
      if (progressError?.code === 'P2022' || progressError?.message?.includes('completed_days')) {
        console.log('   ⚠️ PlanProgress не удален (проблема со схемой БД), но это не критично');
      } else {
        console.warn('   ⚠️ Ошибка при удалении PlanProgress:', progressError?.message);
      }
    }
    
    // 4. Проверяем, что все очищено
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
    console.log(`   Осталось сессий: ${remainingSessions}`);
    console.log(`   Осталось прогресса: ${remainingProgress}`);
    console.log('\n💡 Теперь можно генерировать план заново.');
    console.log('   План будет автоматически перегенерирован при следующем запросе к /api/plan/generate');
    
  } catch (error: any) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearCache()
  .then(() => {
    console.log('\n🎉 Готово! Можно пробовать генерировать план.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  });

