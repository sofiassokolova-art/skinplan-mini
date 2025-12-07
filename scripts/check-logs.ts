// scripts/check-logs.ts
// Скрипт для проверки логов клиентов

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLogs() {
  try {
    // Получаем последние 20 ошибок
    const errorLogs = await prisma.clientLog.findMany({
      where: {
        level: 'error',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    });

    console.log(`\n📋 Найдено ${errorLogs.length} ошибок:\n`);
    
    errorLogs.forEach((log, index) => {
      console.log(`\n${index + 1}. Ошибка #${log.id}`);
      console.log(`   Время: ${new Date(log.createdAt).toLocaleString('ru-RU')}`);
      console.log(`   Пользователь: ${log.user.firstName} ${log.user.lastName || ''} (@${log.user.username || 'нет username'})`);
      console.log(`   User ID: ${log.userId}`);
      console.log(`   Telegram ID: ${log.user.telegramId}`);
      console.log(`   Сообщение: ${log.message}`);
      if (log.url) {
        console.log(`   URL: ${log.url}`);
      }
      if (log.context) {
        console.log(`   Контекст:`, JSON.stringify(log.context, null, 2));
      }
      console.log('   ---');
    });

    // Также проверим логи по конкретному пользователю, если указан
    const args = process.argv.slice(2);
    if (args.length > 0) {
      const userIdOrTelegramId = args[0];
      console.log(`\n\n🔍 Поиск логов для: ${userIdOrTelegramId}\n`);
      
      // Пробуем найти пользователя
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: userIdOrTelegramId },
            { telegramId: userIdOrTelegramId },
          ],
        },
      });

      if (user) {
        // Фильтр для сегодняшних логов
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const userLogs = await prisma.clientLog.findMany({
          where: {
            userId: user.id,
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 100,
        });

        console.log(`Найдено ${userLogs.length} логов для пользователя ${user.firstName} ${user.lastName || ''}:\n`);
        
        userLogs.forEach((log, index) => {
          console.log(`${index + 1}. [${log.level.toUpperCase()}] ${log.message}`);
          console.log(`   Время: ${new Date(log.createdAt).toLocaleString('ru-RU')}`);
          if (log.context) {
            console.log(`   Контекст:`, JSON.stringify(log.context, null, 2));
          }
          console.log('   ---');
        });
      } else {
        console.log('Пользователь не найден');
      }
    }
  } catch (error) {
    console.error('Ошибка при получении логов:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLogs();

