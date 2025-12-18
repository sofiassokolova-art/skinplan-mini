// scripts/test-redis-write.ts
// Тест записи в Redis с правильной сериализацией

import { getRedis } from '../lib/redis';

async function testRedisWrite() {
  console.log('🧪 Тестирую запись в Redis...\n');
  
  const redis = getRedis();
  
  if (!redis) {
    console.error('❌ Redis не подключен!');
    process.exit(1);
  }
  
  console.log('✅ Redis подключен\n');
  
  try {
    // Тест 1: Простая строка
    console.log('📋 Тест 1: Запись простой строки...');
    const testKey1 = `test:simple:${Date.now()}`;
    const testValue1 = 'Hello, Redis!';
    await redis.set(testKey1, testValue1);
    const retrieved1 = await redis.get(testKey1);
    console.log(`   Записано: ${testValue1}`);
    console.log(`   Прочитано: ${retrieved1}`);
    console.log(`   Совпадает: ${retrieved1 === testValue1 ? '✅' : '❌'}`);
    await redis.del(testKey1);
    
    // Тест 2: JSON строка (как в setCachedPlan)
    console.log('\n📋 Тест 2: Запись JSON строки (как в setCachedPlan)...');
    const testKey2 = `test:json:${Date.now()}`;
    const testData = { plan: { days: 28 }, version: 1 };
    const testValue2 = JSON.stringify(testData);
    await redis.set(testKey2, testValue2);
    const retrieved2 = await redis.get(testKey2);
    console.log(`   Записано: ${testValue2.substring(0, 50)}...`);
    console.log(`   Прочитано: ${typeof retrieved2 === 'string' ? retrieved2.substring(0, 50) + '...' : typeof retrieved2}`);
    console.log(`   Тип: ${typeof retrieved2}`);
    
    if (typeof retrieved2 === 'string') {
      try {
        const parsed = JSON.parse(retrieved2);
        console.log(`   Парсинг JSON: ✅`);
        console.log(`   Совпадает: ${JSON.stringify(parsed) === JSON.stringify(testData) ? '✅' : '❌'}`);
      } catch (e) {
        console.log(`   Парсинг JSON: ❌ ${e}`);
      }
    }
    await redis.del(testKey2);
    
    // Тест 3: С TTL (как в setWithTTL)
    console.log('\n📋 Тест 3: Запись с TTL (как в setWithTTL)...');
    const testKey3 = `test:ttl:${Date.now()}`;
    const testValue3 = JSON.stringify({ test: 'with ttl' });
    // Upstash Redis REST API использует другой синтаксис для TTL
    // Проверяем, как работает setex или set с опциями
    try {
      // @upstash/redis использует set с опциями
      await redis.set(testKey3, testValue3, { ex: 60 }); // 60 секунд
      const retrieved3 = await redis.get(testKey3);
      console.log(`   Записано с TTL: ✅`);
      console.log(`   Прочитано: ${retrieved3 ? '✅' : '❌'}`);
      await redis.del(testKey3);
    } catch (ttlError: any) {
      console.log(`   Ошибка с TTL: ${ttlError.message}`);
      // Пробуем без TTL
      await redis.set(testKey3, testValue3);
      await redis.del(testKey3);
    }
    
    // Тест 4: Реальный формат ключа плана
    console.log('\n📋 Тест 4: Запись в формате ключа плана...');
    const userId = 'cmieq8w2v0000js0480u0n0ax';
    const version = 3;
    const planKey = `plan:${userId}:${version}`;
    const planData = {
      plan28: {
        days: [
          { dayIndex: 1, morning: [], evening: [] }
        ],
        mainGoals: ['test']
      }
    };
    const planValue = JSON.stringify(planData);
    
    await redis.set(planKey, planValue);
    const retrievedPlan = await redis.get(planKey);
    console.log(`   Ключ: ${planKey}`);
    console.log(`   Записано: ✅`);
    console.log(`   Прочитано: ${retrievedPlan ? '✅' : '❌'}`);
    
    if (retrievedPlan) {
      try {
        const parsedPlan = typeof retrievedPlan === 'string' 
          ? JSON.parse(retrievedPlan)
          : retrievedPlan;
        console.log(`   Парсинг: ✅`);
        console.log(`   Структура: plan28.days.length = ${parsedPlan?.plan28?.days?.length || 0}`);
      } catch (e) {
        console.log(`   Парсинг: ❌ ${e}`);
      }
    }
    
    // Оставляем ключ для проверки в Data Browser
    console.log(`\n💡 Ключ ${planKey} оставлен в Redis для проверки в Data Browser`);
    console.log('   Вы можете удалить его вручную или через скрипт очистки');
    
    console.log('\n✅ Все тесты завершены');
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    if (error.message?.includes('NOPERM') || error.message?.includes('no permissions')) {
      console.error('\n⚠️ ВНИМАНИЕ: Используется read-only токен!');
      console.error('   Нужен токен с правами записи (TOKEN, а не READONLY TOKEN)');
    }
    throw error;
  }
}

testRedisWrite()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
