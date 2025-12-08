// scripts/clear-user-cache-643160759.ts
// Очистка кэша и сессий для пользователя 643160759

import { prisma } from '../lib/db';
import { invalidateAllUserCache } from '../lib/cache';

const userId = '643160759';

async function clearCache() {
  console.log('🧹 Очищаю кэш и сессии для пользователя:', userId);
  
  try {
    // 1. Очищаем весь кэш пользователя
    console.log('📋 Очищаю кэш плана и рекомендаций...');
    await invalidateAllUserCache(userId);
    console.log('   ✅ Кэш очищен');
    
    // 2. Удаляем все RecommendationSession
    console.log('📋 Удаляю RecommendationSession...');
    const sessionsDeleted = await prisma.recommendationSession.deleteMany({
      where: { userId },
    });
    console.log(`   ✅ Удалено сессий: ${sessionsDeleted.count}`);
    
    // 3. Получаем информацию о профиле
    const profile = await prisma.skinProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, skinType: true },
    });
    
    if (profile) {
      console.log('\n📊 Информация о профиле:');
      console.log(`   Profile ID: ${profile.id}`);
      console.log(`   Version: ${profile.version}`);
      console.log(`   Skin Type: ${profile.skinType}`);
    } else {
      console.log('\n⚠️  Профиль не найден');
    }
    
    console.log('\n✅ Готово! Теперь можно генерировать план заново.');
    console.log('   План будет автоматически перегенерирован при следующем запросе.');
    
  } catch (error: any) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearCache()
  .then(() => {
    console.log('\n🎉 Очистка завершена успешно!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  });

