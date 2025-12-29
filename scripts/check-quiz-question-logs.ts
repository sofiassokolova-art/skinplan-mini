// scripts/check-quiz-question-logs.ts
// Скрипт для проверки логов установки вопросов в анкете

import { prisma } from '../lib/db';

async function checkQuizQuestionLogs() {
  try {
    console.log('\n🔍 Проверяю логи установки вопросов в анкете\n');

    // Ищем логи, связанные с установкой вопросов
    const questionLogs = await prisma.clientLog.findMany({
      where: {
        OR: [
          { message: { contains: 'УСТАНОВКА ВОПРОСОВ' } },
          { message: { contains: 'setCurrentQuestionIndex' } },
          { message: { contains: 'currentQuestion' } },
          { message: { contains: 'пропускаем инфо-скрины' } },
          { message: { contains: 'Завершены все начальные инфо-экраны' } },
          { message: { contains: 'isShowingInitialInfoScreen' } },
          { message: { contains: 'currentQuestion: null' } },
          { message: { contains: 'blocked by info screen' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
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

    if (questionLogs.length === 0) {
      console.log('❌ Логов установки вопросов не найдено');
      return;
    }

    console.log(`✅ Найдено ${questionLogs.length} логов установки вопросов:\n`);

    // Группируем по пользователям
    const logsByUser = new Map<string, typeof questionLogs>();
    questionLogs.forEach(log => {
      const userId = log.userId;
      if (!logsByUser.has(userId)) {
        logsByUser.set(userId, []);
      }
      logsByUser.get(userId)!.push(log);
    });

    // Показываем логи по пользователям
    logsByUser.forEach((logs, userId) => {
      const user = logs[0].user;
      console.log(`\n👤 Пользователь: ${user?.firstName || 'не указано'} (ID: ${userId}, Telegram: ${user?.telegramId})`);
      console.log(`   Логов: ${logs.length}`);
      console.log(`   Последний лог: ${logs[0].createdAt.toISOString()}`);
      
      // Показываем последние 10 логов для этого пользователя
      logs.slice(0, 10).forEach((log, idx) => {
        console.log(`\n   ${idx + 1}. [${log.level}] ${log.message}`);
        if (log.context) {
          try {
            const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
            // Показываем ключевые поля
            const relevantFields = [
              'currentQuestionIndex',
              'currentInfoScreenIndex',
              'initialInfoScreensLength',
              'allQuestionsLength',
              'isShowingInitialInfoScreen',
              'hasCurrentQuestion',
              'currentQuestionId',
              'isNewUser',
              'hasNoSavedProgress',
            ];
            const relevantContext: any = {};
            relevantFields.forEach(field => {
              if (context[field] !== undefined) {
                relevantContext[field] = context[field];
              }
            });
            if (Object.keys(relevantContext).length > 0) {
              console.log(`      Контекст:`, JSON.stringify(relevantContext, null, 2));
            }
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }
      });
    });

    // Ищем логи с ошибками или предупреждениями
    console.log('\n\n⚠️ Логи с ошибками или предупреждениями:');
    const errorLogs = questionLogs.filter(log => log.level === 'error' || log.level === 'warn');
    if (errorLogs.length > 0) {
      errorLogs.slice(0, 10).forEach((log, idx) => {
        console.log(`\n   ${idx + 1}. [${log.level}] ${log.message}`);
        if (log.context) {
          try {
            const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
            console.log(`      Контекст:`, JSON.stringify(context, null, 2));
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }
      });
    } else {
      console.log('   Нет ошибок или предупреждений');
    }

    console.log('\n✅ Проверка завершена\n');
  } catch (error: any) {
    console.error('❌ Ошибка:', error?.message);
    console.error(error?.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkQuizQuestionLogs();

