// scripts/check-redis-keys.ts
// Проверка ключей в Redis

import { getRedis } from '../lib/redis';

const userId = 'cmieq8w2v0000js0480u0n0ax';

async function checkRedisKeys() {
  console.log('🔍 Проверяю ключи в Redis...\n');
  
  const redis = getRedis();
  
  if (!redis) {
    console.error('❌ Redis не подключен!');
    console.log('Проверьте переменные окружения:');
    console.log('  UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL || 'не установлен');
    console.log('  UPSTASH_REDIS_REST_TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN ? 'установлен' : 'не установлен');
    process.exit(1);
  }
  
  console.log('✅ Redis подключен\n');
  
  try {
    // Проверяем ключи для плана (формат: plan:{userId}:{version})
    console.log('📋 Проверяю ключи для плана...');
    for (let version = 1; version <= 10; version++) {
      const key = `plan:${userId}:${version}`;
      const value = await redis.get(key);
      if (value) {
        console.log(`   ✅ Найден ключ: ${key}`);
        console.log(`      Тип: ${typeof value}`);
        console.log(`      Длина: ${typeof value === 'string' ? value.length : 'N/A'}`);
        if (typeof value === 'string' && value.length < 200) {
          console.log(`      Значение (первые 100 символов): ${value.substring(0, 100)}...`);
        }
      }
    }
    
    // Проверяем ключи для рекомендаций (формат: recommendations:{userId}:{version})
    console.log('\n📋 Проверяю ключи для рекомендаций...');
    for (let version = 1; version <= 10; version++) {
      const key = `recommendations:${userId}:${version}`;
      const value = await redis.get(key);
      if (value) {
        console.log(`   ✅ Найден ключ: ${key}`);
        console.log(`      Тип: ${typeof value}`);
        console.log(`      Длина: ${typeof value === 'string' ? value.length : 'N/A'}`);
      }
    }
    
    // Пробуем найти все ключи с паттерном
    console.log('\n📋 Пробую найти все ключи с паттерном "plan:*"...');
    try {
      // Upstash Redis REST API не поддерживает SCAN напрямую
      // Но можем попробовать через KEYS (если доступно)
      console.log('   ⚠️ SCAN не доступен через REST API');
      console.log('   Используйте Data Browser в Upstash Dashboard для просмотра всех ключей');
    } catch (error: any) {
      console.log('   ⚠️ Ошибка при поиске ключей:', error.message);
    }
    
    // Тестовый ключ для проверки записи
    console.log('\n📋 Тестирую запись в Redis...');
    const testKey = `test:${userId}:${Date.now()}`;
    const testValue = JSON.stringify({ test: true, timestamp: new Date().toISOString() });
    
    try {
      await redis.set(testKey, testValue);
      console.log(`   ✅ Тестовый ключ записан: ${testKey}`);
      
      const retrieved = await redis.get(testKey);
      if (retrieved === testValue) {
        console.log('   ✅ Тестовый ключ успешно прочитан');
      } else {
        console.log('   ⚠️ Тестовый ключ прочитан, но значение не совпадает');
      }
      
      // Удаляем тестовый ключ
      await redis.del(testKey);
      console.log('   ✅ Тестовый ключ удален');
    } catch (writeError: any) {
      console.error('   ❌ Ошибка при записи в Redis:', writeError.message);
      if (writeError.message?.includes('NOPERM') || writeError.message?.includes('no permissions')) {
        console.error('   ⚠️ ВНИМАНИЕ: Используется read-only токен! Нужен токен с правами записи.');
      }
    }
    
    console.log('\n✅ Проверка завершена');
    console.log('\n💡 Если ключи не найдены:');
    console.log('   1. План может быть еще не сгенерирован');
    console.log('   2. Ключи могут быть в другом формате');
    console.log('   3. Проверьте Data Browser в Upstash Dashboard');
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  }
}

checkRedisKeys()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
