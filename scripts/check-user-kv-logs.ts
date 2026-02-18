// scripts/check-user-kv-logs.ts
// Проверка логов конкретного пользователя из Upstash KV

// Загружаем переменные окружения из .env.local
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env.local') });

import { getRedis } from '../lib/redis';

async function checkUserKVLogs() {
  const userId = process.argv[2];
  
  if (!userId) {
    console.error('❌ Укажите userId или telegramId');
    console.error('   Пример: npx tsx scripts/check-user-kv-logs.ts cmjeid9g80000jj04ffjghuim');
    process.exit(1);
  }

  console.log(`🔍 Проверяю логи пользователя ${userId} из Upstash KV...\n`);
  
  let redis = getRedis();
  
  if (!redis) {
    const { Redis } = await import('@upstash/redis');
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    
    if (url && token) {
      redis = new Redis({ url, token });
      console.log('✅ Upstash Redis подключен\n');
    } else {
      console.error('❌ Upstash Redis не настроен');
      process.exit(1);
    }
  }

  try {
    // Ищем все ключи логов для этого пользователя
    // Формат ключа: logs:{userId}:{timestamp}:{random}
    const pattern = `logs:${userId}:*`;
    
    console.log(`📋 Ищу логи с паттерном: ${pattern}`);
    
    // Используем SCAN для поиска ключей (более эффективно, чем KEYS)
    let cursor = 0;
    const allLogKeys: string[] = [];
    const batchSize = 100;
    
    do {
      const result = await redis.scan(cursor, { match: pattern, count: batchSize });
      cursor = result[0] as number;
      const keys = result[1] as string[];
      allLogKeys.push(...keys);
    } while (cursor !== 0);
    
    console.log(`   Найдено ${allLogKeys.length} логов\n`);
    
    if (allLogKeys.length === 0) {
      console.log('   ❌ Логов не найдено');
      return;
    }
    
    // Сортируем ключи по timestamp (извлекаем из ключа)
    const sortedKeys = allLogKeys.sort((a, b) => {
      const timestampA = parseInt(a.split(':')[2] || '0');
      const timestampB = parseInt(b.split(':')[2] || '0');
      return timestampB - timestampA; // Новые сначала
    });
    
    // Берем последние 50 логов
    const recentKeys = sortedKeys.slice(0, 50);
    
    console.log(`📋 Последние ${recentKeys.length} логов:\n`);
    
    for (const logKey of recentKeys) {
      try {
        const logData = await redis.get(logKey);
        if (logData) {
          const log = typeof logData === 'string' ? JSON.parse(logData) : logData;
          const time = log.timestamp 
            ? new Date(log.timestamp).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
            : 'unknown';
          const level = (log.level || 'log').toUpperCase();
          
          // Показываем только важные логи (warn, error, и некоторые info)
          const importantMessages = [
            'currentQuestion',
            'allQuestions',
            'filterQuestions',
            'isShowingInitialInfoScreen',
            'init',
            'loading',
            'questionnaire',
            'profile',
            'retake',
            'timeout',
            'error',
            'warn',
            'filter',
            'ВСЕ ВОПРОСЫ',
            'ОТФИЛЬТРОВАНЫ',
          ];
          
          const message = log.message || '';
          const context = log.context || {};
          const isImportant = 
            log.level === 'warn' || 
            log.level === 'error' ||
            importantMessages.some(keyword => 
              message.toLowerCase().includes(keyword.toLowerCase()) ||
              JSON.stringify(context).toLowerCase().includes(keyword.toLowerCase())
            );
          
          if (isImportant) {
            console.log(`\n[${time}] [${level}] ${message}`);
            if (context && Object.keys(context).length > 0) {
              const contextStr = JSON.stringify(context, null, 2);
              // Ограничиваем длину контекста
              if (contextStr.length > 500) {
                console.log(`   Context: ${contextStr.substring(0, 500)}...`);
              } else {
                console.log(`   Context: ${contextStr}`);
              }
            }
          }
        }
      } catch (err: any) {
        console.log(`   ⚠️ Ошибка чтения лога ${logKey}: ${err?.message}`);
      }
    }
    
    console.log('\n✅ Проверка завершена');
  } catch (error: any) {
    console.error('❌ Ошибка:', error?.message);
    console.error(error?.stack);
    process.exit(1);
  }
}

checkUserKVLogs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });

