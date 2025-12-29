// scripts/check-questionnaire-logs.ts
// Проверка логов, связанных с загрузкой анкеты

import { prisma } from '../lib/db';

async function checkQuestionnaireLogs() {
  console.log('🔍 Проверяю логи загрузки анкеты...\n');
  
  try {
    // Ищем логи за последние 24 часа, связанные с анкетой
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    const questionnaireKeywords = [
      'questionnaire',
      'анкет',
      'loadQuestionnaire',
      'init()',
      'loading',
      'quiz',
      'loadQuestionnaire()',
      'questionnaireRef',
      'setQuestionnaire',
      'RENDER',
      'loadQuestionnaire() CALLED',
      'loadQuestionnaire() RETURNED',
      'questionnaire loaded',
      'questionnaireRef.current',
    ];
    
    // Ищем в базе данных
    const dbLogs = await prisma.clientLog.findMany({
      where: {
        createdAt: {
          gte: yesterday,
        },
        OR: [
          {
            message: {
              contains: 'questionnaire',
              mode: 'insensitive',
            },
          },
          {
            message: {
              contains: 'анкет',
              mode: 'insensitive',
            },
          },
          {
            message: {
              contains: 'loadQuestionnaire',
              mode: 'insensitive',
            },
          },
          {
            message: {
              contains: 'init()',
              mode: 'insensitive',
            },
          },
          {
            message: {
              contains: 'loading',
              mode: 'insensitive',
            },
          },
          {
            context: {
              path: ['questionnaire'],
              not: null,
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
          },
        },
      },
    });
    
    console.log(`📊 Найдено логов в БД за последние 24 часа: ${dbLogs.length}\n`);
    
    if (dbLogs.length > 0) {
      console.log('📋 Последние логи загрузки анкеты:\n');
      dbLogs.forEach((log, idx) => {
        const time = new Date(log.createdAt).toLocaleString('ru-RU');
        console.log(`${idx + 1}. [${time}] [${log.level.toUpperCase()}]`);
        console.log(`   User: ${log.user?.firstName || 'unknown'} (${log.user?.telegramId || 'unknown'})`);
        console.log(`   Message: ${log.message}`);
        if (log.url) {
          console.log(`   URL: ${log.url}`);
        }
        if (log.context) {
          const contextStr = JSON.stringify(log.context, null, 2);
          if (contextStr.length > 300) {
            console.log(`   Context: ${contextStr.substring(0, 300)}...`);
          } else {
            console.log(`   Context: ${contextStr}`);
          }
        }
        console.log('');
      });
    } else {
      console.log('⚠️ Логов в базе данных не найдено');
      console.log('\n💡 Логи могут быть:');
      console.log('   1. В консоли браузера (F12 → Console)');
      console.log('   2. В Vercel Logs (Vercel Dashboard → Logs)');
      console.log('   3. В KV (Upstash Redis) - если настроен');
      console.log('\n📝 Для проверки логов в консоли браузера:');
      console.log('   1. Откройте страницу с анкетой');
      console.log('   2. Нажмите F12 (или Cmd+Option+I на Mac)');
      console.log('   3. Перейдите на вкладку Console');
      console.log('   4. Фильтруйте по: "questionnaire", "loadQuestionnaire", "init", "loading"');
      console.log('   5. Ищите логи с префиксами: 🔵, 🟢, ✅, ❌, ⚠️, 🔍');
    }
    
    // Проверяем ошибки
    const errorLogs = dbLogs.filter(log => log.level === 'error');
    if (errorLogs.length > 0) {
      console.log(`\n❌ Найдено ${errorLogs.length} ошибок:\n`);
      errorLogs.slice(0, 5).forEach((log, idx) => {
        const time = new Date(log.createdAt).toLocaleString('ru-RU');
        console.log(`${idx + 1}. [${time}] ${log.message}`);
        if (log.context) {
          console.log(`   Context: ${JSON.stringify(log.context, null, 2).substring(0, 200)}`);
        }
        console.log('');
      });
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkQuestionnaireLogs()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });

