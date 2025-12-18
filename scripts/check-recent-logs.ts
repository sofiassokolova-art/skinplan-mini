// scripts/check-recent-logs.ts
// Проверка последних логов (сегодня)

import { prisma } from '../lib/db';

async function checkRecentLogs() {
  console.log('🔍 Проверяю последние логи (последние 24 часа)...\n');
  
  try {
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    
    // Получаем все логи за последние 24 часа
    const recentLogs = await prisma.clientLog.findMany({
      where: {
        createdAt: {
          gte: yesterday,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
          },
        },
      },
    });
    
    console.log(`📊 Найдено логов за последние 24 часа: ${recentLogs.length}\n`);
    
    if (recentLogs.length === 0) {
      console.log('⚠️ Логов за последние 24 часа не найдено');
    } else {
      // Группируем по уровням
      const byLevel = recentLogs.reduce((acc, log) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('📈 Распределение по уровням:');
      Object.entries(byLevel).forEach(([level, count]) => {
        console.log(`   ${level.toUpperCase()}: ${count}`);
      });
      
      console.log('\n📋 Последние 10 логов:');
      recentLogs.slice(0, 10).forEach((log, idx) => {
        const time = new Date(log.createdAt).toLocaleString('ru-RU');
        console.log(`\n${idx + 1}. [${time}] ${log.level.toUpperCase()}`);
        console.log(`   User: ${log.user.firstName} (${log.user.telegramId})`);
        console.log(`   Message: ${log.message}`);
        if (log.url) {
          console.log(`   URL: ${log.url}`);
        }
      });
    }
    
    // Проверяем логи за сегодня
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayLogs = await prisma.clientLog.findMany({
      where: {
        createdAt: {
          gte: today,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`\n📅 Логов за сегодня (с ${today.toLocaleString('ru-RU')}): ${todayLogs.length}`);
    
    // Проверяем, есть ли ошибки при записи логов
    const errorLogs = recentLogs.filter(log => log.level === 'error');
    if (errorLogs.length > 0) {
      console.log(`\n❌ Найдено ${errorLogs.length} ошибок за последние 24 часа:`);
      errorLogs.slice(0, 5).forEach((log, idx) => {
        const time = new Date(log.createdAt).toLocaleString('ru-RU');
        console.log(`\n   ${idx + 1}. [${time}] ${log.message}`);
        if (log.context) {
          console.log(`      Context:`, JSON.stringify(log.context, null, 2).substring(0, 200));
        }
      });
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentLogs()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });
