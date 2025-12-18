// scripts/clear-cache-production.ts
// Очистка кэша и сессий для пользователя на production
// Использует production переменные окружения

import { prisma } from '../lib/db';
import { invalidateAllUserCache, invalidateCache } from '../lib/cache';

const userId = 'cmieq8w2v0000js0480u0n0ax'; // User ID для Sofia
const telegramId = '643160759';

async function clearCacheProduction() {
  console.log('🧹 Очищаю кэш и сессии для пользователя на PRODUCTION:');
  console.log(`   User ID: ${userId}`);
  console.log(`   Telegram ID: ${telegramId}`);
  console.log('');
  
  // Проверяем наличие production переменных окружения
  const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  
  console.log('📋 Проверка переменных окружения:');
  console.log(`   UPSTASH_REDIS: ${hasRedis ? '✅' : '❌'}`);
  console.log(`   VERCEL_KV: ${hasKV ? '✅' : '❌'}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅' : '❌'}`);
  console.log('');
  
  if (!hasRedis && !hasKV) {
    console.warn('⚠️ ВНИМАНИЕ: Redis/KV переменные окружения не найдены!');
    console.warn('   Кэш не будет очищен, только данные из БД.');
    console.warn('   Убедитесь, что вы установили переменные окружения:');
    console.warn('   - UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN');
    console.warn('   или');
    console.warn('   - KV_REST_API_URL и KV_REST_API_TOKEN');
    console.log('');
  }
  
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
      if (hasRedis || hasKV) {
        console.log(`📋 Очищаю кэш для версии ${profile.version}...`);
        try {
          await invalidateCache(userId, profile.version);
          console.log('   ✅ Кэш для версии очищен');
        } catch (cacheError: any) {
          console.warn('   ⚠️ Ошибка при очистке кэша версии:', cacheError?.message);
        }
      } else {
        console.log('   ⏭️ Пропущено (нет доступа к кэшу)');
      }
    }
    
    // 1. Очищаем весь кэш пользователя (все версии)
    if (hasRedis || hasKV) {
      console.log('📋 Очищаю весь кэш пользователя (все версии)...');
      try {
        await invalidateAllUserCache(userId);
        console.log('   ✅ Весь кэш очищен');
      } catch (cacheError: any) {
        console.warn('   ⚠️ Ошибка при очистке кэша:', cacheError?.message);
        if (cacheError?.message?.includes('NOPERM') || cacheError?.message?.includes('no permissions')) {
          console.warn('   ⚠️ Возможно, используется read-only токен. Нужен токен с правами записи.');
        }
      }
    } else {
      console.log('📋 Очистка кэша пропущена (нет доступа к Redis/KV)');
    }
    
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
    
    if (hasRedis || hasKV) {
      console.log('\n💡 Кэш очищен. План будет перегенерирован при следующем запросе.');
    } else {
      console.log('\n⚠️ ВНИМАНИЕ: Кэш НЕ был очищен из-за отсутствия переменных окружения!');
      console.log('   План может остаться в кэше на production.');
      console.log('   Для полной очистки установите переменные окружения Redis/KV.');
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка при очистке:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearCacheProduction()
  .then(() => {
    console.log('\n🎉 Готово! Можно пробовать генерировать план.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error);
    process.exit(1);
  });
