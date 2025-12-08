// scripts/check-kv-logs.ts
// Проверка логов из Upstash KV

import { getRedis } from '../lib/redis';

async function checkKVLogs() {
  console.log('🔍 Проверяю логи из Upstash KV...\n');
  
  // ИСПРАВЛЕНО: Пробуем использовать переданные переменные окружения или из .env
  let redis = getRedis();
  
  if (!redis) {
    // Если Redis не инициализирован через getRedis(), пробуем использовать Redis напрямую
    const { Redis } = await import('@upstash/redis');
    
    try {
      // Пробуем с явными параметрами из переменных окружения
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
    } catch (err: any) {
      console.error('❌ Ошибка при импорте Redis:', err);
      process.exit(1);
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

    // Проверяем API логи (последние 10)
    console.log('\n📋 Последние API запросы:');
    try {
      // Пробуем найти ключи API логов через SCAN (если поддерживается)
      // Или используем известный userId из логов ошибок
      const testUserId = errorKeys.length > 0 ? errorKeys[0].split(':')[1] : null;
      
      if (testUserId && testUserId !== 'anonymous') {
        const userApiLogsKey = `user_api_logs:${testUserId}`;
        const apiLogKeys = await redis.lrange(userApiLogsKey, 0, 9); // Последние 10 API логов
        
        if (apiLogKeys.length > 0) {
          console.log(`   Найдено ${apiLogKeys.length} API логов для пользователя ${testUserId}:`);
          for (const logKey of apiLogKeys) {
            try {
              const logData = await redis.get(logKey);
              if (logData) {
                const log = typeof logData === 'string' ? JSON.parse(logData) : logData;
                const time = log.timestamp ? new Date(log.timestamp).toLocaleString('ru-RU') : 'unknown';
                console.log(`\n   [${time}] ${log.method || 'GET'} ${log.path || 'unknown'}`);
                console.log(`   Status: ${log.statusCode || 'unknown'}, Duration: ${log.duration || 'unknown'}ms`);
                console.log(`   User: ${log.userId || 'anonymous'}`);
              }
            } catch (err) {
              console.log(`   ⚠️ Ошибка чтения API лога ${logKey}:`, err);
            }
          }
        } else {
          console.log('   API логов не найдено (проверяю для другого пользователя...)');
        }
      } else {
        console.log('   API логов не найдено (нет userId для проверки)');
      }
    } catch (err: any) {
      console.log(`   ⚠️ Ошибка при проверке API логов: ${err?.message}`);
    }

    // Проверяем логи конкретного пользователя (если передан telegramId или userId)
    const userIdOrTelegramId = process.argv[2];
    if (userIdOrTelegramId) {
      console.log(`\n📋 Логи пользователя ${userIdOrTelegramId}:`);
      
      let userId: string | null = null;
      
      // Пробуем найти пользователя по telegramId или использовать как userId напрямую
      const { prisma } = await import('../lib/db');
      const user = await prisma.user.findFirst({
        where: { telegramId: userIdOrTelegramId },
        select: { id: true },
      });
      
      if (user) {
        userId = user.id;
      } else {
        // Если не найден по telegramId, пробуем использовать как userId напрямую
        // Проверяем, существует ли пользователь с таким id
        const userById = await prisma.user.findFirst({
          where: { id: userIdOrTelegramId },
          select: { id: true },
        });
        if (userById) {
          userId = userIdOrTelegramId;
        }
      }
      
      if (userId) {
        // Обычные логи
        const userLogsKey = `user_logs:${userId}`;
        const userLogKeys = await redis.lrange(userLogsKey, 0, 19); // Последние 20 логов
        
        if (userLogKeys.length === 0) {
          console.log('   Обычных логов не найдено');
        } else {
          console.log(`   Найдено ${userLogKeys.length} обычных логов:`);
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

        // API логи
        const userApiLogsKey = `user_api_logs:${userId}`;
        const apiLogKeys = await redis.lrange(userApiLogsKey, 0, 19); // Последние 20 API логов
        
        if (apiLogKeys.length === 0) {
          console.log('\n   API логов не найдено');
        } else {
          console.log(`\n   Найдено ${apiLogKeys.length} API логов:`);
          for (const logKey of apiLogKeys) {
            try {
              const logData = await redis.get(logKey);
              if (logData) {
                const log = typeof logData === 'string' ? JSON.parse(logData) : logData;
                const time = log.timestamp ? new Date(log.timestamp).toLocaleString('ru-RU') : 'unknown';
                console.log(`\n   [${time}] ${log.method || 'GET'} ${log.path || 'unknown'}`);
                console.log(`   Status: ${log.statusCode || 'unknown'}, Duration: ${log.duration || 'unknown'}ms`);
              }
            } catch (err) {
              console.log(`   ⚠️ Ошибка чтения API лога ${logKey}:`, err);
            }
          }
        }
      } else {
        // Если пользователь не найден, все равно пробуем проверить логи напрямую по переданному ID
        console.log(`   ⚠️ Пользователь с telegramId/userId ${userIdOrTelegramId} не найден в БД`);
        console.log(`   Проверяю логи напрямую по ID ${userIdOrTelegramId}...\n`);
        
        userId = userIdOrTelegramId;
        
        // Обычные логи
        const userLogsKey = `user_logs:${userId}`;
        const userLogKeys = await redis.lrange(userLogsKey, 0, 19);
        
        if (userLogKeys.length === 0) {
          console.log('   Обычных логов не найдено');
        } else {
          console.log(`   Найдено ${userLogKeys.length} обычных логов:`);
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

        // API логи
        const userApiLogsKey = `user_api_logs:${userId}`;
        const apiLogKeys = await redis.lrange(userApiLogsKey, 0, 19);
        
        if (apiLogKeys.length === 0) {
          console.log('\n   API логов не найдено');
        } else {
          console.log(`\n   Найдено ${apiLogKeys.length} API логов:`);
          for (const logKey of apiLogKeys) {
            try {
              const logData = await redis.get(logKey);
              if (logData) {
                const log = typeof logData === 'string' ? JSON.parse(logData) : logData;
                const time = log.timestamp ? new Date(log.timestamp).toLocaleString('ru-RU') : 'unknown';
                console.log(`\n   [${time}] ${log.method || 'GET'} ${log.path || 'unknown'}`);
                console.log(`   Status: ${log.statusCode || 'unknown'}, Duration: ${log.duration || 'unknown'}ms`);
              }
            } catch (err) {
              console.log(`   ⚠️ Ошибка чтения API лога ${logKey}:`, err);
            }
          }
        }
      }
      
      await prisma.$disconnect();
    } else {
      console.log('\n💡 Для просмотра логов пользователя запустите:');
      console.log('   npx tsx scripts/check-kv-logs.ts <telegramId или userId>');
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
