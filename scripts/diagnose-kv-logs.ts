// scripts/diagnose-kv-logs.ts
// Диагностика проблемы с записью логов в KV

// Загружаем переменные окружения из .env.local
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });

import { getRedis } from '../lib/redis';

async function diagnoseKVLogs() {
  console.log('🔍 Диагностика записи логов в KV...\n');
  
  // Проверка 1: Переменные окружения
  console.log('📋 Проверка 1: Переменные окружения');
  const hasKVUrl = !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
  const hasKVToken = !!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN);
  const hasReadOnlyToken = !!process.env.KV_REST_API_READ_ONLY_TOKEN;
  const readOnlyToken = process.env.KV_REST_API_READ_ONLY_TOKEN;
  const writeToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  console.log(`   KV_REST_API_URL: ${process.env.KV_REST_API_URL ? '✅ установлен' : '❌ не установлен'}`);
  console.log(`   UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? '✅ установлен' : '❌ не установлен'}`);
  console.log(`   KV_REST_API_TOKEN: ${process.env.KV_REST_API_TOKEN ? '✅ установлен' : '❌ не установлен'}`);
  console.log(`   UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ установлен' : '❌ не установлен'}`);
  console.log(`   KV_REST_API_READ_ONLY_TOKEN: ${hasReadOnlyToken ? '✅ установлен' : '❌ не установлен'}`);
  
  if (writeToken && readOnlyToken && writeToken === readOnlyToken) {
    console.log('\n   ⚠️ ПРОБЛЕМА: KV_REST_API_TOKEN совпадает с KV_REST_API_READ_ONLY_TOKEN!');
    console.log('   Это означает, что используется read-only токен для записи.');
  }
  
  if (!hasKVToken && hasReadOnlyToken) {
    console.log('\n   ⚠️ ПРОБЛЕМА: Установлен только KV_REST_API_READ_ONLY_TOKEN, но нет KV_REST_API_TOKEN!');
    console.log('   Запись в KV будет невозможна.');
  }
  
  if (!hasKVUrl || !hasKVToken) {
    console.log('\n   ❌ ПРОБЛЕМА: Переменные окружения для KV не установлены!');
    console.log('   Логи не будут записываться в KV.');
    return;
  }
  
  // Проверка 2: Инициализация Redis
  console.log('\n📋 Проверка 2: Инициализация Redis');
  const redis = getRedis();
  
  if (!redis) {
    console.log('   ❌ ПРОБЛЕМА: getRedis() вернул null!');
    console.log('   Redis не может быть инициализирован.');
    console.log('\n   Возможные причины:');
    console.log('   1. Переменные окружения установлены неправильно');
    console.log('   2. Используется read-only токен вместо write токена');
    console.log('   3. Ошибка при создании экземпляра Redis');
    return;
  }
  
  console.log('   ✅ Redis инициализирован успешно');
  
  // Проверка 3: Тест записи
  console.log('\n📋 Проверка 3: Тест записи в KV');
  try {
    const testKey = `diagnose:test:${Date.now()}`;
    const testValue = JSON.stringify({
      timestamp: new Date().toISOString(),
      test: true,
      message: 'Diagnostic test log',
    });
    
    console.log(`   Пытаюсь записать тестовый ключ: ${testKey}`);
    const setResult = await redis.set(testKey, testValue, { ex: 60 }); // TTL 60 секунд
    
    if (setResult !== 'OK') {
      console.log(`   ❌ ПРОБЛЕМА: redis.set вернул неожиданный результат: ${setResult}`);
      return;
    }
    
    console.log('   ✅ Запись выполнена успешно (setResult = OK)');
    
    // Проверка 4: Верификация записи
    console.log('\n📋 Проверка 4: Верификация записи (чтение)');
    const retrieved = await redis.get(testKey);
    
    if (!retrieved) {
      console.log('   ❌ ПРОБЛЕМА: Данные не сохранились!');
      console.log('   redis.set вернул OK, но redis.get вернул null.');
      console.log('   Это может означать, что используется read-only токен.');
      return;
    }
    
    if (typeof retrieved === 'string' && retrieved === testValue) {
      console.log('   ✅ Данные успешно сохранены и прочитаны');
    } else {
      console.log('   ⚠️ Данные прочитаны, но значение не совпадает');
      console.log(`   Ожидалось: ${testValue.substring(0, 50)}...`);
      console.log(`   Получено: ${typeof retrieved === 'string' ? retrieved.substring(0, 50) + '...' : typeof retrieved}`);
    }
    
    // Удаляем тестовый ключ
    await redis.del(testKey);
    console.log('   ✅ Тестовый ключ удален');
    
    // Проверка 5: Тест записи лога в формате /api/logs
    console.log('\n📋 Проверка 5: Тест записи лога в формате /api/logs');
    const logKey = `logs:diagnose:${Date.now()}:${Math.random().toString(36).substring(7)}`;
    const logData = {
      userId: 'diagnose-test',
      level: 'info',
      message: 'Diagnostic test log from diagnose-kv-logs script',
      context: { test: true },
      userAgent: 'diagnose-script',
      url: '/diagnose',
      timestamp: new Date().toISOString(),
    };
    
    const logValue = JSON.stringify(logData);
    const logSetResult = await redis.set(logKey, logValue, { ex: 30 * 24 * 60 * 60 }); // TTL 30 дней
    
    if (logSetResult !== 'OK') {
      console.log(`   ❌ ПРОБЛЕМА: Не удалось записать лог: ${logSetResult}`);
      return;
    }
    
    console.log('   ✅ Лог записан успешно');
    
    // Верификация лога
    const logRetrieved = await redis.get(logKey);
    if (logRetrieved) {
      console.log('   ✅ Лог успешно прочитан и верифицирован');
      const parsedLog = typeof logRetrieved === 'string' ? JSON.parse(logRetrieved) : logRetrieved;
      console.log(`   Уровень: ${parsedLog.level}, Сообщение: ${parsedLog.message}`);
    } else {
      console.log('   ❌ ПРОБЛЕМА: Лог не может быть прочитан после записи!');
      return;
    }
    
    // Удаляем тестовый лог
    await redis.del(logKey);
    console.log('   ✅ Тестовый лог удален');
    
    console.log('\n✅ Все проверки пройдены успешно!');
    console.log('\n💡 Если логи все еще не пишутся, проверьте:');
    console.log('   1. Логи Vercel на наличие ошибок при вызове /api/logs');
    console.log('   2. Что переменные окружения установлены в Vercel Dashboard');
    console.log('   3. Что используется write токен, а не read-only токен');
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА при тестировании:', error);
    
    if (error?.message?.includes('NOPERM') || error?.message?.includes('no permissions') || error?.message?.includes('read-only')) {
      console.error('\n⚠️ КРИТИЧЕСКАЯ ПРОБЛЕМА: Используется read-only токен!');
      console.error('   KV_REST_API_TOKEN должен быть токеном для записи, а не read-only токеном.');
      console.error('   Проверьте настройки в Vercel Dashboard → Environment Variables');
    }
    
    if (error?.code === 'NOPERM') {
      console.error('\n⚠️ КРИТИЧЕСКАЯ ПРОБЛЕМА: Ошибка прав доступа (NOPERM)');
      console.error('   Это означает, что токен не имеет прав на запись.');
    }
    
    throw error;
  }
}

diagnoseKVLogs()
  .then(() => {
    console.log('\n✅ Диагностика завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Ошибка при диагностике:', error);
    process.exit(1);
  });

