// scripts/check-filter-questions-logs.ts
// Проверка логов filterQuestions из Upstash KV

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env.local') });

import { getRedis } from '../lib/redis';

async function checkFilterQuestionsLogs() {
  const userId = process.argv[2] || 'cmjeid9g80000jj04ffjghuim';
  
  console.log(`🔍 Проверяю логи filterQuestions для пользователя ${userId}...\n`);
  
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
    const pattern = `logs:${userId}:*`;
    
    console.log(`📋 Ищу логи с паттерном: ${pattern}`);
    console.log(`   (это может занять некоторое время...)\n`);
    
    // Используем SCAN для поиска ключей с ограничениями
    let cursor = 0;
    const allLogKeys: string[] = [];
    const batchSize = 100;
    const maxIterations = 50; // Ограничиваем количество итераций
    let iterations = 0;
    
    do {
      iterations++;
      if (iterations > maxIterations) {
        console.log(`   ⚠️ Достигнут лимит итераций (${maxIterations}), останавливаюсь...`);
        break;
      }
      
      if (iterations % 10 === 0) {
        console.log(`   ... обработано ${allLogKeys.length} ключей (итерация ${iterations})`);
      }
      
      try {
        const result = await redis.scan(cursor, { match: pattern, count: batchSize });
        cursor = result[0] as number;
        const keys = result[1] as string[];
        allLogKeys.push(...keys);
        
        // Если cursor вернулся к 0, значит все ключи обработаны
        if (cursor === 0) break;
      } catch (err: any) {
        console.error(`   ⚠️ Ошибка при SCAN (итерация ${iterations}):`, err?.message);
        break;
      }
    } while (cursor !== 0 && iterations < maxIterations);
    
    console.log(`   Найдено ${allLogKeys.length} логов\n`);
    
    if (allLogKeys.length === 0) {
      console.log('   ❌ Логов не найдено');
      return;
    }
    
    // Сортируем ключи по timestamp
    const sortedKeys = allLogKeys.sort((a, b) => {
      const timestampA = parseInt(a.split(':')[2] || '0');
      const timestampB = parseInt(b.split(':')[2] || '0');
      return timestampB - timestampA; // Новые сначала
    });
    
    // Берем последние 200 логов (увеличиваем для лучшего покрытия)
    const recentKeys = sortedKeys.slice(0, 200);
    
    console.log(`📋 Проверяю ${recentKeys.length} логов на наличие filterQuestions и allQuestions...\n`);
    
    const filterLogs: any[] = [];
    let processed = 0;
    
    for (const logKey of recentKeys) {
      processed++;
      if (processed % 50 === 0) {
        console.log(`   ... обработано ${processed}/${recentKeys.length} логов, найдено ${filterLogs.length} релевантных`);
      }
      
      try {
        const logData = await redis.get(logKey);
        if (logData) {
          const log = typeof logData === 'string' ? JSON.parse(logData) : logData;
          const message = log.message || '';
          
          // Ищем логи, связанные с filterQuestions или allQuestions
          if (
            message.includes('filterQuestions') ||
            message.includes('allQuestions') ||
            message.includes('allQuestionsRaw') ||
            message.includes('ВСЕ ВОПРОСЫ') ||
            message.includes('ОТФИЛЬТРОВАНЫ') ||
            message.includes('currentQuestion') ||
            message.includes('allQuestions is empty')
          ) {
            filterLogs.push({
              timestamp: log.timestamp,
              level: log.level || 'log',
              message: log.message,
              context: log.context,
            });
          }
        }
      } catch (err: any) {
        // Игнорируем ошибки чтения
        if (processed % 100 === 0) {
          console.log(`   ⚠️ Ошибка чтения лога ${logKey}: ${err?.message}`);
        }
      }
    }
    
    // Сортируем по времени
    filterLogs.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
    
    console.log(`   Найдено ${filterLogs.length} релевантных логов:\n`);
    
    for (const log of filterLogs) {
      const time = log.timestamp 
        ? new Date(log.timestamp).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
        : 'unknown';
      const level = (log.level || 'log').toUpperCase();
      
      console.log(`\n[${time}] [${level}] ${log.message}`);
      if (log.context && Object.keys(log.context).length > 0) {
        console.log(`Context:`);
        console.log(JSON.stringify(log.context, null, 2));
      }
      console.log('─'.repeat(80));
    }
    
    console.log('\n✅ Проверка завершена');
  } catch (error: any) {
    console.error('❌ Ошибка:', error?.message);
    console.error(error?.stack);
    process.exit(1);
  }
}

checkFilterQuestionsLogs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });

