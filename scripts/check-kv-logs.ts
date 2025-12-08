// scripts/check-kv-logs.ts
// Проверка логов из Upstash KV

import { getRedis } from '../lib/redis';

async function checkKVLogs() {
  console.log('🔍 Проверяю логи из Upstash KV...\n');
  
  // ИСПРАВЛЕНО: Пробуем использовать переданные переменные окружения или из .env
  let redis = getRedis();
  
  if (!redis) {
    // Если Redis не инициализирован через getRedis(), пробуем использовать Redis.fromEnv()
    const { Redis } = require('@upstash/redis');
    
    try {
      // ИСПРАВЛЕНО: Используем Redis.fromEnv() согласно документации
      redis = Redis.fromEnv();
      console.log('✅ Upstash Redis подключен через Redis.fromEnv()');
    } catch (err: any) {
      // Если fromEnv() не работает, пробуем с явными параметрами
      const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
      
      if (url && token) {
        try {
          redis = new Redis({ url, token });
          console.log('✅ Upstash Redis подключен напрямую');
        } catch (directErr) {
          console.error('❌ Ошибка подключения к Upstash Redis:', directErr);
          console.error('   Используйте переменные окружения:');
          console.error('   KV_REST_API_URL=https://super-bat-14283.upstash.io');
          console.error('   KV_REST_API_TOKEN=ATfLAAIncDJjYTk0YjA4MGY4ZDI0ZmYyOWI2OTg1MDA3OTAyZDY3NXAyMTQyODM');
          process.exit(1);
        }
      } else {
        console.error('❌ Upstash Redis не настроен');
        console.error('   Установите переменные окружения:');
        console.error('   KV_REST_API_URL=https://super-bat-14283.upstash.io');
        console.error('   KV_REST_API_TOKEN=ATfLAAIncDJjYTk0YjA4MGY4ZDI0ZmYyOWI2OTg1MDA3OTAyZDY3NXAyMTQyODM');
        console.error('\n   Или:');
        console.error('   UPSTASH_REDIS_REST_URL=https://super-bat-14283.upstash.io');
        console.error('   UPSTASH_REDIS_REST_TOKEN=ATfLAAIncDJjYTk0YjA4MGY4ZDI0ZmYyOWI2OTg1MDA3OTAyZDY3NXAyMTQyODM');
        process.exit(1);
      }
    }
  }

  try {
    // Получаем последние ошибки
    console.log('📋 Последние ошибки (logs:errors:recent):');
    const errorsKey = 'logs:errors:recent';
    const errorKeys = await redis.lrange(errorsKey, 0, 9); // Последние 10 ошибок
    
    if (errorKeys.length === 0) {
      console.log('   Логов ошибок не найдено');
    } else {
      for (const logKey of errorKeys) {
        try {
          const logData = await redis.get(logKey);
          if (logData) {
            const log = typeof logData === 'string' ? JSON.parse(logData) : logData;
            const time = log.timestamp ? new Date(log.timestamp).toLocaleString('ru-RU') : 'unknown';
            console.log(`\n   [${time}] ${log.level?.toUpperCase() || 'ERROR'}`);
            console.log(`   User: ${log.userId || 'anonymous'}`);
            console.log(`   Message: ${log.message}`);
            if (log.context) {
              console.log(`   Context: ${JSON.stringify(log.context, null, 2).substring(0, 200)}`);
            }
          }
        } catch (err) {
          console.log(`   ⚠️ Ошибка чтения лога ${logKey}:`, err);
        }
      }
    }

    // Проверяем логи конкретного пользователя (если передан telegramId)
    const telegramId = process.argv[2];
    if (telegramId) {
      console.log(`\n📋 Логи пользователя ${telegramId}:`);
      
      // Нужно найти userId по telegramId
      const { prisma } = await import('../lib/db');
      const user = await prisma.user.findFirst({
        where: { telegramId },
        select: { id: true },
      });
      
      if (user) {
        const userLogsKey = `user_logs:${user.id}`;
        const userLogKeys = await redis.lrange(userLogsKey, 0, 19); // Последние 20 логов
        
        if (userLogKeys.length === 0) {
          console.log('   Логов не найдено');
        } else {
          console.log(`   Найдено ${userLogKeys.length} логов:`);
          for (const logKey of userLogKeys) {
            try {
              const logData = await redis.get(logKey);
              if (logData) {
                const log = typeof logData === 'string' ? JSON.parse(logData) : logData;
                const time = log.timestamp ? new Date(log.timestamp).toLocaleString('ru-RU') : 'unknown';
                console.log(`\n   [${time}] ${log.level?.toUpperCase() || 'LOG'}`);
                console.log(`   Message: ${log.message}`);
                if (log.context) {
                  const contextStr = JSON.stringify(log.context, null, 2);
                  if (contextStr.length > 200) {
                    console.log(`   Context: ${contextStr.substring(0, 200)}...`);
                  } else {
                    console.log(`   Context: ${contextStr}`);
                  }
                }
              }
            } catch (err) {
              console.log(`   ⚠️ Ошибка чтения лога ${logKey}:`, err);
            }
          }
        }
      } else {
        console.log(`   ❌ Пользователь с telegramId ${telegramId} не найден`);
      }
      
      await prisma.$disconnect();
    } else {
      console.log('\n💡 Для просмотра логов пользователя запустите:');
      console.log('   npx tsx scripts/check-kv-logs.ts <telegramId>');
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  }
}

checkKVLogs()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
