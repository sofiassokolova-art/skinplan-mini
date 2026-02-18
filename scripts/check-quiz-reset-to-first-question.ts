// scripts/check-quiz-reset-to-first-question.ts
// Скрипт для проверки логов возврата к первому вопросу в анкете

import { prisma } from '../lib/db';

async function checkQuizResetToFirstQuestion() {
  try {
    console.log('\n🔍 Проверяю логи возврата к первому вопросу в анкете\n');

    // Ищем логи, связанные с возвратом к первому вопросу
    const resetLogs = await prisma.clientLog.findMany({
      where: {
        OR: [
          { message: { contains: 'Сбрасываем currentQuestionIndex на 0', mode: 'insensitive' as any } },
          { message: { contains: 'setCurrentQuestionIndex(0)', mode: 'insensitive' as any } },
          { message: { contains: 'currentQuestionIndex = 0', mode: 'insensitive' as any } },
          { message: { contains: 'возврат к первому', mode: 'insensitive' as any } },
          { message: { contains: 'первый вопрос', mode: 'insensitive' as any } },
          { message: { contains: 'questionIndex: 0', mode: 'insensitive' as any } },
          { message: { contains: 'questionIndex.*0', mode: 'insensitive' as any } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (resetLogs.length === 0) {
      console.log('❌ Логов возврата к первому вопросу не найдено');
      return;
    }

    console.log(`✅ Найдено ${resetLogs.length} логов возврата к первому вопросу:\n`);

    // Группируем по пользователям
    const logsByUser = new Map<string, typeof resetLogs>();
    resetLogs.forEach(log => {
      const userId = log.userId;
      if (!logsByUser.has(userId)) {
        logsByUser.set(userId, []);
      }
      logsByUser.get(userId)!.push(log);
    });

    // Показываем логи по пользователям
    logsByUser.forEach((logs, userId) => {
      const user = logs[0].user;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`👤 Пользователь: ${user?.firstName || 'не указано'} ${user?.lastName || ''} (ID: ${userId}, Telegram: ${user?.telegramId})`);
      console.log(`   Всего логов возврата: ${logs.length}`);
      console.log(`   Первый лог: ${logs[logs.length - 1].createdAt.toLocaleString('ru-RU')}`);
      console.log(`   Последний лог: ${logs[0].createdAt.toLocaleString('ru-RU')}`);
      
      // Показываем все логи для этого пользователя в хронологическом порядке
      logs.reverse().forEach((log, idx) => {
        const time = new Date(log.createdAt).toLocaleString('ru-RU');
        console.log(`\n   ${idx + 1}. [${time}] [${log.level.toUpperCase()}] ${log.message}`);
        if (log.context) {
          try {
            const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
            // Показываем ключевые поля
            const relevantFields = [
              'currentQuestionIndex',
              'questionIndex',
              'currentInfoScreenIndex',
              'infoScreenIndex',
              'initialInfoScreensLength',
              'allQuestionsLength',
              'allQuestionsRawLength',
              'answersCount',
              'hasResumed',
              'hasNoSavedProgress',
              'savedProgress',
              'isRetakingQuiz',
              'showResumeScreen',
              'isSubmitting',
              'isQuizCompleted',
              'loading',
              'questionnaireId',
              'correctedIndex',
              'isOutOfBounds',
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
        if (log.url) {
          console.log(`      URL: ${log.url}`);
        }
      });
    });

    // Анализируем паттерны
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('📊 АНАЛИЗ ПАТТЕРНОВ:\n');

    // Подсчитываем причины возврата
    const reasons = new Map<string, number>();
    resetLogs.forEach(log => {
      const message = log.message.toLowerCase();
      if (message.includes('новый пользователь')) {
        reasons.set('Новый пользователь', (reasons.get('Новый пользователь') || 0) + 1);
      } else if (message.includes('выходит за пределы') || message.includes('out of bounds')) {
        reasons.set('Индекс выходит за пределы', (reasons.get('Индекс выходит за пределы') || 0) + 1);
      } else if (message.includes('savedprogress') || message.includes('нет сохраненного прогресса')) {
        reasons.set('Нет сохраненного прогресса', (reasons.get('Нет сохраненного прогресса') || 0) + 1);
      } else if (message.includes('корректируем') || message.includes('корректируем индекс')) {
        reasons.set('Корректировка индекса', (reasons.get('Корректировка индекса') || 0) + 1);
      } else if (message.includes('переход к вопросам') || message.includes('после инфо-скринов')) {
        reasons.set('Переход к вопросам после инфо-экранов', (reasons.get('Переход к вопросам после инфо-экранов') || 0) + 1);
      } else if (message.includes('handleNext')) {
        reasons.set('В handleNext', (reasons.get('В handleNext') || 0) + 1);
      } else if (message.includes('useQuizEffects') || message.includes('useEffect')) {
        reasons.set('В useQuizEffects/useEffect', (reasons.get('В useQuizEffects/useEffect') || 0) + 1);
      } else if (message.includes('loadSavedProgress')) {
        reasons.set('При загрузке сохраненного прогресса', (reasons.get('При загрузке сохраненного прогресса') || 0) + 1);
      } else {
        reasons.set('Другое', (reasons.get('Другое') || 0) + 1);
      }
    });

    console.log('Причины возврата к первому вопросу:');
    Array.from(reasons.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        console.log(`   ${reason}: ${count} раз(а)`);
      });

    // Ищем логи с ошибками или предупреждениями
    console.log(`\n\n⚠️ Логи с ошибками или предупреждениями (первые 20):`);
    const errorLogs = resetLogs.filter(log => log.level === 'error' || log.level === 'warn');
    if (errorLogs.length > 0) {
      errorLogs.slice(0, 20).forEach((log, idx) => {
        const time = new Date(log.createdAt).toLocaleString('ru-RU');
        const user = log.user?.firstName || 'не указано';
        console.log(`\n   ${idx + 1}. [${time}] [${log.level}] ${log.message}`);
        console.log(`      Пользователь: ${user} (${log.user?.telegramId})`);
        if (log.context) {
          try {
            const context = typeof log.context === 'string' ? JSON.parse(log.context) : log.context;
            if (context.currentQuestionIndex !== undefined || context.questionIndex !== undefined) {
              console.log(`      currentQuestionIndex: ${context.currentQuestionIndex ?? context.questionIndex}`);
            }
            if (context.allQuestionsLength !== undefined) {
              console.log(`      allQuestionsLength: ${context.allQuestionsLength}`);
            }
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }
      });
    } else {
      console.log('   Нет ошибок или предупреждений');
    }

    // Ищем пользователей с множественными возвратами
    console.log(`\n\n🔴 Пользователи с множественными возвратами к первому вопросу:`);
    const usersWithMultipleResets = Array.from(logsByUser.entries())
      .filter(([_, logs]) => logs.length > 1)
      .sort(([_, logsA], [__, logsB]) => logsB.length - logsA.length)
      .slice(0, 10);

    if (usersWithMultipleResets.length > 0) {
      usersWithMultipleResets.forEach(([userId, logs], idx) => {
        const user = logs[0].user;
        console.log(`\n   ${idx + 1}. ${user?.firstName || 'не указано'} (${user?.telegramId}): ${logs.length} возвратов`);
        console.log(`      Период: ${logs[logs.length - 1].createdAt.toLocaleString('ru-RU')} - ${logs[0].createdAt.toLocaleString('ru-RU')}`);
      });
    } else {
      console.log('   Нет пользователей с множественными возвратами');
    }

    console.log('\n✅ Проверка завершена\n');
  } catch (error: any) {
    console.error('❌ Ошибка:', error?.message);
    console.error(error?.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkQuizResetToFirstQuestion();
