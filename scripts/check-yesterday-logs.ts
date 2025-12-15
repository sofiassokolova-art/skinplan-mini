// scripts/check-yesterday-logs.ts
// Проверка логов за вчера

import { prisma } from '../lib/db';

async function checkYesterdayLogs() {
  console.log('🔍 Проверяю логи за вчера...\n');
  
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setDate(today.getDate() - 1);
    today.setHours(23, 59, 59, 999);
    
    // Получаем все логи за вчера
    const yesterdayLogs = await prisma.clientLog.findMany({
      where: {
        createdAt: {
          gte: yesterday,
          lte: today,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            id: true,
          },
        },
      },
    });
    
    console.log(`📊 Найдено логов за вчера: ${yesterdayLogs.length}\n`);
    console.log(`📅 Период: ${yesterday.toLocaleString('ru-RU')} - ${today.toLocaleString('ru-RU')}\n`);
    
    if (yesterdayLogs.length === 0) {
      console.log('⚠️ Логов за вчера не найдено');
    } else {
      // Группируем по уровням
      const byLevel = yesterdayLogs.reduce((acc, log) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('📈 Распределение по уровням:');
      Object.entries(byLevel).forEach(([level, count]) => {
        console.log(`   ${level.toUpperCase()}: ${count}`);
      });
      
      // Ищем логи связанные с планом
      const planLogs = yesterdayLogs.filter(log => 
        log.message.toLowerCase().includes('plan') ||
        log.message.toLowerCase().includes('план') ||
        log.message.toLowerCase().includes('toner') ||
        log.message.toLowerCase().includes('moisturizer') ||
        log.message.toLowerCase().includes('крем') ||
        log.message.toLowerCase().includes('тонер') ||
        log.message.toLowerCase().includes('phase') ||
        log.message.toLowerCase().includes('фаза')
      );
      
      if (planLogs.length > 0) {
        console.log(`\n📋 Логи связанные с планом (${planLogs.length}):`);
        planLogs.slice(0, 20).forEach((log, idx) => {
          const time = new Date(log.createdAt).toLocaleString('ru-RU');
          console.log(`\n${idx + 1}. [${time}] ${log.level.toUpperCase()}`);
          console.log(`   User: ${log.user.firstName} (${log.user.telegramId})`);
          console.log(`   Message: ${log.message}`);
          if (log.context) {
            const contextStr = JSON.stringify(log.context, null, 2);
            if (contextStr.length < 300) {
              console.log(`   Context: ${contextStr}`);
            } else {
              console.log(`   Context: ${contextStr.substring(0, 300)}...`);
            }
          }
          if (log.url) {
            console.log(`   URL: ${log.url}`);
          }
        });
      }
      
      // Ищем ошибки
      const errorLogs = yesterdayLogs.filter(log => log.level === 'error');
      if (errorLogs.length > 0) {
        console.log(`\n❌ Найдено ${errorLogs.length} ошибок за вчера:`);
        errorLogs.slice(0, 10).forEach((log, idx) => {
          const time = new Date(log.createdAt).toLocaleString('ru-RU');
          console.log(`\n   ${idx + 1}. [${time}] ${log.message}`);
          if (log.context) {
            const contextStr = JSON.stringify(log.context, null, 2);
            console.log(`      Context: ${contextStr.substring(0, 400)}`);
          }
        });
      }
      
      // Ищем предупреждения
      const warnLogs = yesterdayLogs.filter(log => log.level === 'warn');
      if (warnLogs.length > 0) {
        console.log(`\n⚠️ Найдено ${warnLogs.length} предупреждений за вчера:`);
        warnLogs.slice(0, 10).forEach((log, idx) => {
          const time = new Date(log.createdAt).toLocaleString('ru-RU');
          console.log(`\n   ${idx + 1}. [${time}] ${log.message}`);
          if (log.context) {
            const contextStr = JSON.stringify(log.context, null, 2);
            if (contextStr.length < 200) {
              console.log(`      Context: ${contextStr}`);
            }
          }
        });
      }
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkYesterdayLogs()
  .then(() => {
    console.log('\n✅ Проверка завершена');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  });

