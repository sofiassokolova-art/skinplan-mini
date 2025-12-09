// scripts/check-user-api-logs.ts
// Проверка API логов для пользователя

import { getRedis } from '../lib/redis';
import { prisma } from '../lib/db';

const telegramId = process.argv[2] || '643160759';

async function checkApiLogs() {
  console.log(`🔍 Проверяю API логи для пользователя: ${telegramId}\n`);
  
  try {
    // Находим пользователя
    const user = await prisma.user.findFirst({
      where: { telegramId },
      select: { id: true, telegramId: true, firstName: true },
    });
    
    if (!user) {
      console.log('❌ Пользователь не найден');
      await prisma.$disconnect();
      return;
    }
    
    console.log('✅ Пользователь найден:', {
      userId: user.id,
      telegramId: user.telegramId,
      name: user.firstName,
    });
    
    // Получаем Redis
    let redis = getRedis();
    
    if (!redis) {
      const { Redis } = await import('@upstash/redis');
      const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
      
      if (url && token) {
        redis = new Redis({ url, token });
        console.log('✅ Подключен к Upstash Redis\n');
      } else {
        console.log('⚠️ Redis не настроен, проверяю только БД логи\n');
      }
    }
    
    // Проверяем API логи из KV
    if (redis) {
      try {
        const userApiLogsKey = `user_api_logs:${user.id}`;
        const apiLogKeys = await redis.lrange(userApiLogsKey, 0, 19); // Последние 20 логов
        
        console.log(`📋 API логи из KV (последние ${apiLogKeys.length}):`);
        
        if (apiLogKeys.length === 0) {
          console.log('   Логов не найдено');
        } else {
          for (const logKey of apiLogKeys) {
            try {
              const logData = await redis.get(logKey);
              if (logData) {
                const log = typeof logData === 'string' ? JSON.parse(logData) : logData;
                const time = log.timestamp ? new Date(log.timestamp).toLocaleString('ru-RU') : 'unknown';
                const path = log.path || 'unknown';
                const method = log.method || 'GET';
                const status = log.statusCode || 'unknown';
                
                // Показываем только логи связанные с отправкой ответов или созданием профиля
                if (path.includes('questionnaire/answers') || 
                    path.includes('profile') ||
                    log.message?.includes('profile') ||
                    log.message?.includes('Profile') ||
                    status >= 400) {
                  console.log(`\n   [${time}] ${method} ${path}`);
                  console.log(`   Status: ${status}, Duration: ${log.duration || 'unknown'}ms`);
                  if (log.message) {
                    console.log(`   Message: ${log.message}`);
                  }
                  if (log.error) {
                    console.log(`   Error: ${log.error}`);
                  }
                  if (log.context) {
                    const contextStr = JSON.stringify(log.context, null, 2);
                    if (contextStr.length > 300) {
                      console.log(`   Context: ${contextStr.substring(0, 300)}...`);
                    } else {
                      console.log(`   Context: ${contextStr}`);
                    }
                  }
                }
              }
            } catch (err) {
              console.log(`   ⚠️ Ошибка чтения лога ${logKey}:`, err);
            }
          }
        }
        
        // Проверяем ошибки
        const errorsKey = 'logs:errors:recent';
        const errorKeys = await redis.lrange(errorsKey, 0, 9);
        
        if (errorKeys.length > 0) {
          console.log(`\n❌ Последние ошибки из KV (${errorKeys.length}):`);
          for (const errorKey of errorKeys) {
            try {
              const errorData = await redis.get(errorKey);
              if (errorData) {
                const error = typeof errorData === 'string' ? JSON.parse(errorData) : errorData;
                const time = error.timestamp ? new Date(error.timestamp).toLocaleString('ru-RU') : 'unknown';
                const userId = error.userId || 'unknown';
                
                // Показываем только ошибки этого пользователя или связанные с профилем
                if (userId === user.id || 
                    error.message?.includes('profile') ||
                    error.message?.includes('Profile') ||
                    error.message?.includes('CRITICAL')) {
                  console.log(`\n   [${time}] ${error.level?.toUpperCase() || 'ERROR'}`);
                  console.log(`   User: ${userId}`);
                  console.log(`   Message: ${error.message}`);
                  if (error.context) {
                    const contextStr = JSON.stringify(error.context, null, 2);
                    if (contextStr.length > 300) {
                      console.log(`   Context: ${contextStr.substring(0, 300)}...`);
                    } else {
                      console.log(`   Context: ${contextStr}`);
                    }
                  }
                }
              }
            } catch (err) {
              // Игнорируем ошибки чтения
            }
          }
        }
      } catch (kvError: any) {
        console.log(`⚠️ Ошибка при чтении из KV: ${kvError?.message}`);
      }
    }
    
    // Проверяем последние ответы и их статус
    console.log(`\n📝 Проверяю последние ответы:`);
    const activeQuestionnaire = await prisma.questionnaire.findFirst({
      where: { isActive: true },
    });
    
    if (activeQuestionnaire) {
      const allAnswers = await prisma.userAnswer.findMany({
        where: { 
          userId: user.id,
          questionnaireId: activeQuestionnaire.id,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          question: {
            select: { code: true, text: true, position: true },
          },
        },
      });
      
      console.log(`   Всего ответов: ${allAnswers.length}`);
      if (allAnswers.length > 0) {
        console.log(`   Последний ответ: ${allAnswers[0].question.code} в ${allAnswers[0].createdAt.toLocaleString('ru-RU')}`);
      }
    }
    
    // Проверяем профили
    const profiles = await prisma.skinProfile.findMany({
      where: { userId: user.id },
      orderBy: { version: 'desc' },
      take: 3,
    });
    
    console.log(`\n👤 Профили: ${profiles.length}`);
    if (profiles.length === 0) {
      console.log('   ❌ ПРОБЛЕМА: Профиль не создан, хотя есть ответы!');
    } else {
      profiles.forEach((p, idx) => {
        console.log(`   ${idx + 1}. Version ${p.version}, SkinType: ${p.skinType}, Created: ${p.createdAt.toLocaleString('ru-RU')}`);
      });
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkApiLogs()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
