// scripts/check-kv-logs.ts
// Проверка логов из Upstash KV

import { getRedis } from '../lib/redis';

async function checkKVLogs() {
  console.log('🔍 Проверяю логи из Upstash KV...\n');
  
  const redis = getRedis();
  
  if (!redis) {
    console.error('❌ Upstash Redis не настроен');
    process.exit(1);
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
