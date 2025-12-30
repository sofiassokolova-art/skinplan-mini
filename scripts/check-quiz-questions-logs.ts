// scripts/check-quiz-questions-logs.ts
// Скрипт для проверки логов, связанных с переходами к вопросам в анкете

import { prisma } from '../lib/db';

async function checkQuizQuestionsLogs() {
  try {
    console.log('\n🔍 Проверяю логи переходов к вопросам в анкете\n');

    // Ищем логи, связанные с переходами к вопросам
    const keywords = [
      'handleNext',
      'переход к вопросам',
      'УСТАНОВКА ВОПРОСОВ',
      'infoScreenIndex',
      'currentInfoScreenIndex',
      'initialInfoScreens',
      'Завершены все начальные',
      'переход на следующий инфо-экран',
    ];

    // Получаем последние логи за последние 24 часа
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const logs = await prisma.clientLog.findMany({
      where: {
        OR: keywords.map(keyword => ({
          message: {
            contains: keyword,
            mode: 'insensitive' as any,
          },
        })),
        createdAt: {
          gte: yesterday,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
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

    console.log(`📋 Найдено ${logs.length} логов, связанных с переходами к вопросам:\n`);

    if (logs.length === 0) {
      console.log('❌ Логов не найдено за последние 24 часа');
      return;
    }

    // Группируем логи по пользователям
    const logsByUser = new Map<string, typeof logs>();
    logs.forEach(log => {
      const userId = log.userId;
      if (!logsByUser.has(userId)) {
        logsByUser.set(userId, []);
      }
      logsByUser.get(userId)!.push(log);
    });

    // Выводим логи по пользователям
    logsByUser.forEach((userLogs, userId) => {
      const user = userLogs[0].user;
      console.log(`\n👤 Пользователь: ${user.firstName || 'не указано'} (@${user.username || 'нет'})`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Telegram ID: ${user.telegramId}`);
      console.log(`   Логов: ${userLogs.length}\n`);

      // Выводим последние 10 логов этого пользователя
      userLogs.slice(0, 10).forEach((log, index) => {
        console.log(`   ${index + 1}. [${log.level.toUpperCase()}] ${log.message}`);
        console.log(`      Время: ${new Date(log.createdAt).toLocaleString('ru-RU')}`);
        if (log.context) {
          try {
            const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
            // Выводим важные поля из контекста
            if (context.currentInfoScreenIndex !== undefined) {
              console.log(`      currentInfoScreenIndex: ${context.currentInfoScreenIndex}`);
            }
            if (context.infoScreenIndex !== undefined) {
              console.log(`      infoScreenIndex: ${context.infoScreenIndex}`);
            }
            if (context.initialInfoScreensLength !== undefined) {
              console.log(`      initialInfoScreensLength: ${context.initialInfoScreensLength}`);
            }
            if (context.currentQuestionIndex !== undefined) {
              console.log(`      currentQuestionIndex: ${context.currentQuestionIndex}`);
            }
            if (context.allQuestionsLength !== undefined) {
              console.log(`      allQuestionsLength: ${context.allQuestionsLength}`);
            }
            if (context.hasQuestionnaire !== undefined) {
              console.log(`      hasQuestionnaire: ${context.hasQuestionnaire}`);
            }
            if (context.loading !== undefined) {
              console.log(`      loading: ${context.loading}`);
            }
            if (context.isRetakingQuiz !== undefined) {
              console.log(`      isRetakingQuiz: ${context.isRetakingQuiz}`);
            }
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }
        console.log('   ---');
      });
    });

    // Также проверим логи с ошибками, связанными с вопросами
    console.log('\n\n🔴 Ошибки, связанные с вопросами:\n');
    const errorLogs = await prisma.clientLog.findMany({
      where: {
        level: 'error',
        OR: [
          {
            message: {
              contains: 'question',
              mode: 'insensitive' as any,
            },
          },
          {
            message: {
              contains: 'вопрос',
              mode: 'insensitive' as any,
            },
          },
          {
            message: {
              contains: 'quiz',
              mode: 'insensitive' as any,
            },
          },
        ],
        createdAt: {
          gte: yesterday,
        },
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
          },
        },
      },
    });

    if (errorLogs.length > 0) {
      errorLogs.forEach((log, index) => {
        console.log(`\n${index + 1}. [ERROR] ${log.message}`);
        console.log(`   Пользователь: ${log.user.firstName || 'не указано'} (${log.user.telegramId})`);
        console.log(`   Время: ${new Date(log.createdAt).toLocaleString('ru-RU')}`);
        if (log.context) {
          try {
            const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
            console.log(`   Контекст:`, JSON.stringify(context, null, 2));
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }
      });
    } else {
      console.log('✅ Ошибок не найдено');
    }

    console.log('\n✅ Проверка завершена\n');
  } catch (error: any) {
    console.error('❌ Ошибка:', error?.message);
    console.error(error?.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkQuizQuestionsLogs();

