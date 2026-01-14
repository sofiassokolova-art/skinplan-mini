// scripts/check-server-logs.ts
// Проверка серверных логов из PostgreSQL

import { prisma } from '../lib/db';

async function checkServerLogs() {
  try {
    console.log('\n🔍 Проверка серверных логов из PostgreSQL\n');
    console.log('='.repeat(60));

    // 1. Проверяем последние логи сохранения ответов
    console.log('\n📝 Последние логи сохранения ответов (за последние 24 часа):');
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const answerLogs = await prisma.clientLog.findMany({
      where: {
        OR: [
          { message: { contains: 'Сохранение ответа' } },
          { message: { contains: 'Ответ успешно сохранен' } },
          { message: { contains: 'Ошибка сохранения ответа' } },
          { message: { contains: 'Saving quiz progress' } },
          { message: { contains: 'quiz progress' } },
        ],
        createdAt: {
          gte: oneDayAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    console.log(`   Найдено логов: ${answerLogs.length}`);

    if (answerLogs.length === 0) {
      console.log('   ⚠️  Нет логов сохранения ответов за последние 24 часа');
      console.log('   Это может означать, что:');
      console.log('   1. Ответы не сохраняются (нет initData)');
      console.log('   2. Логи не записываются в БД');
      console.log('   3. Пользователи не отвечали на вопросы');
    } else {
      console.log('\n   Детали логов:');
      answerLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. [${log.createdAt.toISOString()}] ${log.level.toUpperCase()}: ${log.message}`);
        if (log.context) {
          const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
          console.log(`      Context:`, JSON.stringify(context, null, 2).substring(0, 200));
        }
      });
    }

    // 2. Проверяем логи API запросов к /api/questionnaire/progress
    console.log('\n📡 Логи API запросов к /api/questionnaire/progress (POST):');
    
    const apiLogs = await prisma.clientLog.findMany({
      where: {
        OR: [
          { message: { contains: '/api/questionnaire/progress' } },
          { message: { contains: 'questionnaire/progress' } },
        ],
        createdAt: {
          gte: oneDayAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    console.log(`   Найдено логов: ${apiLogs.length}`);
    
    if (apiLogs.length > 0) {
      apiLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. [${log.createdAt.toISOString()}] ${log.level.toUpperCase()}: ${log.message}`);
      });
    }

    // 3. Проверяем все логи за последний час
    console.log('\n⏰ Все логи за последний час:');
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentLogs = await prisma.clientLog.findMany({
      where: {
        createdAt: {
          gte: oneHourAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    console.log(`   Всего логов: ${recentLogs.length}`);

    // Группируем по уровням
    const logsByLevel = recentLogs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`   По уровням:`, logsByLevel);

    // Показываем последние 20 логов
    if (recentLogs.length > 0) {
      console.log('\n   Последние 20 логов:');
      recentLogs.slice(0, 20).forEach((log, index) => {
        console.log(`   ${index + 1}. [${log.createdAt.toISOString()}] ${log.level.toUpperCase()}: ${log.message.substring(0, 100)}`);
      });
    }

    // 4. Проверяем логи ошибок
    console.log('\n❌ Логи ошибок за последние 24 часа:');
    
    const errorLogs = await prisma.clientLog.findMany({
      where: {
        level: 'error',
        createdAt: {
          gte: oneDayAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    console.log(`   Найдено ошибок: ${errorLogs.length}`);
    
    if (errorLogs.length > 0) {
      errorLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. [${log.createdAt.toISOString()}] ${log.message}`);
        if (log.context) {
          const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
          console.log(`      Context:`, JSON.stringify(context, null, 2).substring(0, 300));
        }
      });
    }

    // 5. Статистика по пользователям
    console.log('\n👥 Статистика логов по пользователям (за последние 24 часа):');
    
    // Получаем все логи и группируем вручную, так как userId обязательное поле
    const allLogsForStats = await prisma.clientLog.findMany({
      where: {
        createdAt: {
          gte: oneDayAgo,
        },
      },
      select: {
        userId: true,
      },
    });

    const logsByUserMap = allLogsForStats.reduce((acc, log) => {
      acc[log.userId] = (acc[log.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const logsByUser = Object.entries(logsByUserMap)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    console.log(`   Пользователей с логами: ${logsByUser.length}`);
    logsByUser.forEach((group, index) => {
      console.log(`   ${index + 1}. User ID: ${group.userId}, Логов: ${group.count}`);
    });

  } catch (error) {
    console.error('\n❌ Ошибка при проверке логов:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack?.substring(0, 500));
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkServerLogs();

